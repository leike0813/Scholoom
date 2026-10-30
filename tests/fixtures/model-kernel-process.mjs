import { channel } from 'node:diagnostics_channel';
import { rename, writeFile } from 'node:fs/promises';
import { KernelApplication } from '../../apps/kernel/dist/application.js';
import { serveKernel } from '../../apps/kernel/dist/lifecycle.js';
import { createExecutionObserver, observationErrorCode } from '../execution-observer.ts';

// Only the trusted test parent configures this entry over its private IPC channel.
let parentUnavailable = () => {};
const parentGone = () => parentUnavailable();
process.once('disconnect', parentGone);
process.on('error', parentGone);
process.once(
  'message',
  async ({ directory, endpoint, artifact, observationMs, taskSaveConflictOnce }) => {
    const started = performance.now();
    const startedAt = Date.now();
    const observers = new Map();
    const lifecycle = [];
    let droppedScopeEvents = 0;
    let droppedLifecycle = 0;
    let timedOut = false;
    let observing = true;
    let parentDisconnected = false;
    let unsubscribe = () => {};
    let timer;
    let deadline;
    let writing;
    let dirty = false;
    let writeFailures = 0;
    let errorCode;
    let application;
    let published = false;
    const send = process.send;
    process.send = function (message, ...args) {
      if (message?.state === 'ready') published = true;
      return send.call(this, message, ...args);
    };
    const phase = (name) => {
      if (lifecycle.length < 16)
        lifecycle.push({ phase: name, elapsedMs: Math.round(performance.now() - started) });
      else droppedLifecycle++;
      schedule();
    };
    const snapshot = () => {
      // Reserve space for this entry's lifecycle envelope within the 240 KiB child file.
      const captures = [...observers.values()].map((observer) =>
        JSON.parse(observer.body(224 * 1024)),
      );
      let omittedScopes = 0;
      const encode = () =>
        JSON.stringify({
          version: 1,
          kernelProcessId: process.pid,
          startedAt,
          lifecycle,
          droppedLifecycle,
          timedOut,
          parentDisconnected,
          droppedScopeEvents,
          omittedScopes,
          writeFailures,
          errorCode,
          captures,
        });
      while (Buffer.byteLength(encode()) > 240 * 1024 && captures.length > 1) {
        captures.shift();
        omittedScopes++;
      }
      while (Buffer.byteLength(encode()) > 240 * 1024 && captures[0]?.samples.length > 2) {
        captures[0].samples.splice(1, 1);
        captures[0].droppedSamples++;
      }
      return encode();
    };
    const flush = async () => {
      if (writing) return writing;
      writing = (async () => {
        do {
          dirty = false;
          try {
            await writeFile(`${artifact}.pending`, snapshot(), { mode: 0o600 });
            await rename(`${artifact}.pending`, artifact);
          } catch {
            writeFailures++;
            dirty = false;
          }
        } while (dirty);
      })().finally(() => {
        writing = undefined;
      });
      return writing;
    };
    function schedule() {
      dirty = true;
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          void flush().catch(() => {});
        }, 250);
    }
    const topic = channel('scholoom.harness.execution');
    const changed = () => schedule();
    const stopObservation = async () => {
      unsubscribe();
      topic.unsubscribe(changed);
      clearTimeout(deadline);
      await Promise.all([...observers.values()].map((observer) => observer.stop()));
      clearTimeout(timer);
      timer = undefined;
      await flush();
    };
    const initialize = KernelApplication.prototype.initialize;
    parentUnavailable = () => {
      observing = false;
      parentDisconnected = !process.connected;
      phase('kernel.parent-ipc-unavailable');
      void stopObservation().catch(() => {});
    };
    KernelApplication.prototype.initialize = function (...args) {
      application = this;
      phase('application.initializing');
      return initialize.apply(this, args).then((result) => {
        KernelApplication.prototype.initialize = initialize;
        if (taskSaveConflictOnce === true) {
          const projectTasks = this.projectTasks.bind(this);
          let conflict = true;
          this.projectTasks = (context) => {
            const port = projectTasks(context);
            if (context.role !== 'execution') return port;
            return {
              ...port,
              save: async (input) => {
                if (conflict) {
                  conflict = false;
                  const current = await this.call('tasks.read', { task: input.task });
                  await this.call('tasks.save', {
                    task: input.task,
                    basis: current.entry.basis,
                    content: `${current.content}\n人工并发注记：请保留。\n`,
                  });
                  phase('task.navigation-cas-race');
                }
                return port.save(input);
              },
            };
          };
        }
        if (!observing) return result;
        unsubscribe = this.subscribe((change) => {
          if (!observing || !change.projectId || !change.sessionId) return;
          const key = JSON.stringify([change.projectId, change.sessionId]);
          if (!observers.has(key)) {
            if (observers.size === 8) {
              droppedScopeEvents++;
              return;
            }
            try {
              observers.set(
                key,
                createExecutionObserver(this, {
                  projectId: change.projectId,
                  sessionId: change.sessionId,
                }),
              );
            } catch {
              droppedScopeEvents++;
            }
          }
          schedule();
        });
        topic.subscribe(changed);
        phase('application.observed');
        return result;
      });
    };
    try {
      phase('kernel.starting');
      await flush();
      deadline = setTimeout(
        () => {
          observing = false;
          timedOut = true;
          void stopObservation().catch(() => {});
        },
        Math.min(Math.max(observationMs, 1000), 120_000),
      );
      await serveKernel(directory, { modelEndpoint: endpoint, environment: {}, development: true });
      phase('kernel.serve.closed');
      await stopObservation();
      phase('kernel.observation.closed');
      await flush();
      process.off('disconnect', parentGone);
      if (process.connected) process.disconnect();
    } catch (error) {
      errorCode = observationErrorCode(error);
      phase(published ? 'kernel.stop.failed' : 'kernel.startup.failed');
      if (!published) {
        try {
          await application?.close();
        } catch {
          phase('kernel.cleanup.unknown');
          await stopObservation().catch(() => {});
          return;
        }
      }
      await stopObservation().catch(() => {});
      if (!published) process.exit(1);
    }
  },
);
