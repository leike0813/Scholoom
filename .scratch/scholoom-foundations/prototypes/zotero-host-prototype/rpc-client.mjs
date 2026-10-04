// Shared transport and evidence recording for independent prototype clients.
import {readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
export const ensure = (value, message) => {if (!value) throw new Error(message);};
export function createClient(outputDir, reportFile = 'ipc-client-results.json') {
  const report = {clientPID: process.pid, startedAt: new Date().toISOString(), checks: [], requests: []};
  const save = () => writeFile(join(outputDir, reportFile), JSON.stringify(report, null, 2));
  let ready;
  async function connect(timeoutMs) {
    for (let i = 0; i < timeoutMs / 100; i++) {
      try {ready = JSON.parse(await readFile(join(outputDir, 'ipc-ready.json'), 'utf8')); break;}
      catch (error) {if (error.code !== 'ENOENT') throw error; await delay(100);}
    }
    ensure(ready, `Host did not publish IPC readiness within ${timeoutMs / 1000}s`);
    report.transport = ready.url;
    return ready;
  }
  async function rpc(method, params = {}) {
    const response = await fetch(ready.url, {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Scholoom-Token': ready.token},
      body: JSON.stringify({method, params}), signal: AbortSignal.timeout(30000)});
    const body = await response.json();
    report.requests.push({method, params, status: response.status, body, time: new Date().toISOString()});
    await save();
    ensure(response.ok && body.ok, `${method}: ${body.error?.message || response.status}`);
    return body.result;
  }
  async function check(name, action) {
    try {
      const detail = await action(); report.checks.push({name, status: 'passed', detail}); await save();
      console.log(`Client passed: ${name}`); return detail;
    } catch (error) {
      report.checks.push({name, status: 'failed', error: error.message}); await save(); throw error;
    }
  }
  async function finish({shutdown = true} = {}) {
    if (ready && shutdown) {
      try {report.shutdown = await rpc('shutdown');}
      catch (error) {report.shutdownError = error.message; process.exitCode = 1;}
    }
    report.finishedAt = new Date().toISOString(); await save();
  }
  return {report, connect, rpc, check, finish};
}
