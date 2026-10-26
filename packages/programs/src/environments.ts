import { randomUUID } from 'node:crypto';
import { statSync } from 'node:fs';
import { open } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { atomicPrivateFile, privateDirectory } from '@scholoom/platform/node';
import {
  type CallContext,
  compileContract,
  type ErrorInfo,
  OperationError,
} from '@scholoom/protocol/core';
import {
  type ProgramEnvironment,
  type ProgramEnvironmentPlan,
  type ProgramRun,
  type ProgramState,
  type ProgramsInputs,
  type ProgramsOutputs,
  programEnvironmentPlanSchema,
  programEnvironmentSchema,
  programsOperations,
} from '@scholoom/protocol/programs';
import type { ResourceEvidence } from '@scholoom/protocol/resources';

export type EnvironmentPorts = {
  check(projectId: string, context: CallContext): Promise<void>;
  /** path is the controlled absolute native path, after project-root and evidence checks. */
  describe(
    ref: ResourceEvidence,
    context: CallContext,
  ): Promise<{ path: string; relativePath: string; basis: string }>;
  launch(
    input: {
      projectId: string;
      operationId: string;
      environmentId: string;
      kind: 'environmentCheck' | 'environmentPreparation';
      executableId: string;
      executable: string;
      args: string[];
      declarations?: ResourceEvidence[];
      /** Project-relative; omission selects the project root. */
      cwd?: string;
      env?: Record<string, string>;
      timeoutMs: number;
    },
    context: CallContext,
  ): Promise<{ programRunId: string; state: ProgramState }>;
  wait(projectId: string, runId: string, context: CallContext): Promise<ProgramRun>;
  logs(projectId: string, runId: string, context: CallContext): Promise<string>;
};

type RegistrationInput = ProgramsInputs['programs.registerEnvironment'];
type PlanInput = ProgramsInputs['programs.environmentPlan'];
type PrepareInput = ProgramsInputs['programs.environmentPrepare'];
type Principal = CallContext['principal'];
type Reference = ProgramsOutputs['programs.environmentPrepare'];
type Registration = {
  input: RegistrationInput;
  principal: Principal;
  environment: ProgramEnvironment;
  checking: boolean;
  receipt?: { executable: string; stamp?: string; planId?: string };
};
type Plan = {
  input: PlanInput;
  principal: Principal;
  value: ProgramEnvironmentPlan;
  /** Native project root for uv --project, never the launch cwd. */
  cwd: string;
  paths: string[];
  working: boolean;
  evidence?: LockEvidence;
  authorization?: { authorizationId: string; principal: Principal };
  preparation?: { input: PrepareInput; principal: Principal; reference?: Reference };
};
type Store = { version: 1; registrations: Registration[]; plans: Plan[] };
const storeBytes = 4 * 1024 * 1024;
// Active entries reserve room for bounded IDs, receipts and recovery diagnostics.
const recoveryBytes = 16 * 1024;

// Keep objects held by in-flight probes while rolling back a rejected JSON candidate.
function restoreStore(target: object, saved: object): void {
  const current = target as Record<string, unknown>;
  const source = saved as Record<string, unknown>;
  for (const key of Object.keys(current)) if (!Object.hasOwn(source, key)) delete current[key];
  for (const [key, value] of Object.entries(source)) {
    const existing = current[key];
    if (
      value &&
      typeof value === 'object' &&
      existing &&
      typeof existing === 'object' &&
      Array.isArray(value) === Array.isArray(existing)
    )
      restoreStore(existing, value);
    else current[key] = structuredClone(value);
  }
  if (Array.isArray(target) && Array.isArray(saved)) target.length = saved.length;
}

type LockEvidence = {
  pythonVersion: string;
  dependencies: {
    name: string;
    version: string;
    source: string;
    wheels: { source: string; hash: string }[];
  }[];
  network: string[];
};

const inspectLock = fileURLToPath(new URL('./inspect-lock.py', import.meta.url));

const validEvidence = compileContract({
  params: {
    type: 'object',
    properties: {
      pythonVersion: { type: 'string', minLength: 1 },
      dependencies: {
        type: 'array',
        maxItems: 1000,
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 1024 },
            version: { type: 'string', minLength: 1, maxLength: 1024 },
            source: { type: 'string', minLength: 1, maxLength: 1024 },
            wheels: {
              type: 'array',
              minItems: 1,
              maxItems: 1000,
              items: {
                type: 'object',
                properties: {
                  source: { type: 'string', minLength: 1, maxLength: 1024 },
                  hash: { type: 'string', pattern: '^sha256:[0-9a-f]{64}$' },
                },
                required: ['source', 'hash'],
                additionalProperties: false,
              },
            },
          },
          required: ['name', 'version', 'source', 'wheels'],
          additionalProperties: false,
        },
      },
      network: {
        type: 'array',
        items: { type: 'string', minLength: 1, maxLength: 1024 },
        maxItems: 100,
        uniqueItems: true,
      },
    },
    required: ['pythonVersion', 'dependencies', 'network'],
    additionalProperties: false,
  },
  result: true,
}).params;

const validEnvironment = compileContract({ params: programEnvironmentSchema, result: true }).params;
const validPlan = compileContract({ params: programEnvironmentPlanSchema, result: true }).params;
const validInputs = Object.fromEntries(
  Object.entries(programsOperations).map(([method, contract]) => [
    method,
    compileContract(contract).params,
  ]),
);
const active = new Set<ProgramState>(['queued', 'running', 'cancelling', 'unknown']);

function syncArguments(project: string, interpreter: string, network: readonly string[]): string[] {
  return [
    'sync',
    '--locked',
    '--no-dev',
    '--no-install-project',
    '--no-install-workspace',
    '--no-python-downloads',
    '--no-build',
    '--no-editable',
    ...(network.length ? [] : ['--offline']),
    '--no-config',
    '--project',
    project,
    '--python',
    interpreter,
  ];
}

function diagnostic(error: unknown): ErrorInfo {
  return {
    code: error instanceof OperationError ? error.code : 'unavailable',
    message: (error instanceof Error ? error.message : '环境操作失败。').slice(0, 512),
  };
}

function human(context: CallContext): void {
  if (
    context.principal.kind !== 'human' ||
    context.role !== 'product' ||
    context.workDomain ||
    context.targetRead
  )
    throw new OperationError('permissionDenied', '环境登记与授权仅允许可信人类产品入口。');
}

function success(run: ProgramRun): boolean {
  return run.state === 'completed' && run.stop === 'confirmed' && run.exit?.code === 0;
}

function fileStamp(path: string): string {
  const stat = statSync(path);
  if (!stat.isFile()) throw new OperationError('unavailable', '解释器或环境配置不可读。');
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
}

function supportsPlans(version: string): boolean {
  const [major = 0, minor = 0] = version.split('.').map(Number);
  return major > 3 || (major === 3 && minor >= 11);
}

function failedAvailability(run: ProgramRun): ProgramEnvironment['availability'] {
  if (run.stop !== 'confirmed' || active.has(run.state)) return 'unknown';
  return run.state === 'cancelled' || run.state === 'interrupted' ? run.state : 'failed';
}

async function boundedText(path: string, maximum: number): Promise<string> {
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(maximum + 1);
    let size = 0;
    while (size < buffer.length) {
      const result = await file.read(buffer, size, buffer.length - size, size);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    if (size > maximum) throw new OperationError('tooLarge', '环境依据超过允许大小。');
    return buffer.subarray(0, size).toString('utf8');
  } finally {
    await file.close();
  }
}

export class ProgramEnvironments {
  private readonly directory: string;
  private store: Store = { version: 1, registrations: [], plans: [] };
  private saved = JSON.stringify(this.store);
  private tail: Promise<unknown> = Promise.resolve();
  private failure: unknown;
  private initialized = false;

  constructor(
    directory: string,
    private readonly ports: EnvironmentPorts,
  ) {
    this.directory = resolve(directory);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await privateDirectory(this.directory);
    let contents: string;
    try {
      contents = await boundedText(join(this.directory, 'environments.json'), storeBytes);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      this.initialized = true;
      return;
    }
    try {
      const store: Store = JSON.parse(contents);
      if (store.version !== 1 || !Array.isArray(store.registrations) || !Array.isArray(store.plans))
        throw new Error('shape');
      for (const entry of store.registrations) {
        if (
          !validEnvironment(entry.environment) ||
          !validInputs['programs.registerEnvironment']?.(entry.input) ||
          !entry.principal?.id ||
          typeof entry.checking !== 'boolean' ||
          !isAbsolute(entry.input.interpreterPath) ||
          (entry.input.kind === 'uv' && !isAbsolute(entry.input.uvPath))
        )
          throw new Error('registration');
        if (
          entry.environment.kind !== entry.input.kind ||
          entry.environment.environmentId === 'node' ||
          (entry.environment.availability === 'ready' &&
            (!entry.environment.programRunId || !entry.receipt))
        )
          throw new Error('registration identity');
        if (
          entry.receipt &&
          (typeof entry.receipt.executable !== 'string' ||
            (entry.input.kind !== 'uv' &&
              entry.receipt.executable !== entry.input.interpreterPath) ||
            (entry.input.kind === 'uv' &&
              (!entry.receipt.planId || typeof entry.receipt.stamp !== 'string')))
        )
          throw new Error('receipt');
      }
      for (const plan of store.plans) {
        if (
          !validPlan(plan.value) ||
          !validInputs['programs.environmentPlan']?.(plan.input) ||
          !plan.principal?.id ||
          typeof plan.working !== 'boolean' ||
          !isAbsolute(plan.cwd) ||
          !Array.isArray(plan.paths) ||
          !plan.paths.every((path) => typeof path === 'string' && isAbsolute(path)) ||
          plan.value.projectId !== plan.input.projectId ||
          plan.value.environmentId !== plan.input.environmentId
        )
          throw new Error('plan');
        this.child(plan.value.planId);
        if (plan.evidence && !validEvidence(plan.evidence)) throw new Error('lock evidence');
        if (
          plan.preparation &&
          !validInputs['programs.environmentPrepare']?.(plan.preparation.input)
        )
          throw new Error('preparation');
        if (
          plan.authorization &&
          (plan.authorization.principal?.kind !== 'human' ||
            !plan.authorization.principal.id ||
            plan.authorization.authorizationId !== plan.value.authorizationId)
        )
          throw new Error('authorization');
      }
      this.store = store;
      this.saved = JSON.stringify(store);
    } catch {
      throw new OperationError('unavailable', '环境配置已损坏；保留原文件供核查。');
    }
    for (const entry of this.store.registrations) {
      if (entry.checking) {
        entry.checking = false;
        entry.environment.availability = 'unknown';
        entry.environment.diagnostic = {
          code: 'outcomeUnknown',
          message: '宿主重启后尚无环境探测收尾证据。',
        };
      }
      this.checkReceipt(entry);
    }
    for (const plan of this.store.plans) {
      if (!plan.working) continue;
      plan.working = false;
      if (plan.value.state === 'pending') plan.value.state = 'unknown';
      plan.value.error = {
        code: 'outcomeUnknown',
        message: '宿主重启后须核查原环境运行；不自动重试。',
      };
      if (plan.preparation) {
        if (plan.preparation.reference) plan.preparation.reference.state = 'unknown';
        const entry = this.registration(plan.input.projectId, plan.input.environmentId);
        if (!entry.receipt) {
          entry.environment.availability = 'unknown';
          entry.environment.diagnostic = plan.value.error;
        }
      }
    }
    const recovered = structuredClone(this.store);
    try {
      await this.save();
    } catch (error) {
      if (!(error instanceof OperationError && error.code === 'tooLarge')) throw error;
      // A pre-reservation profile can be read safely without replacing its full history.
      restoreStore(this.store, recovered);
      this.saved = JSON.stringify(recovered);
    }
    this.initialized = true;
  }

  private child(id: string): string {
    if (!id || id === '.' || id === '..' || basename(id) !== id || id.includes('\\'))
      throw new OperationError('unavailable', '环境记录含无效私有目录身份。');
    return join(this.directory, id);
  }

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const result = this.tail.then(async () => {
      if (!this.initialized) throw new OperationError('unavailable', '环境模块尚未初始化。');
      if (this.failure)
        throw new OperationError('unavailable', '环境记录保存失败，须先核查私有配置。');
      return action();
    });
    this.tail = result.catch(() => {});
    return result;
  }

  private async save(): Promise<void> {
    const candidate = JSON.stringify(this.store);
    const remaining = (value: unknown) =>
      Math.max(0, recoveryBytes - Buffer.byteLength(JSON.stringify(value)));
    let reserved = this.store.registrations
      .filter((entry) => entry.checking)
      .reduce((size, entry) => size + remaining(entry), 0);
    for (const plan of this.store.plans) {
      if (!plan.working) continue;
      const entry = this.registration(plan.input.projectId, plan.input.environmentId);
      reserved += remaining({
        preparation: plan.preparation,
        error: plan.value.error,
        environment: entry.environment,
        receipt: entry.receipt,
      });
    }
    if (Buffer.byteLength(candidate) + reserved > storeBytes) {
      restoreStore(this.store, JSON.parse(this.saved));
      throw new OperationError('tooLarge', '环境登记与计划总容量超过4MiB，原记录保持可用。');
    }
    try {
      await atomicPrivateFile(this.directory, 'environments.json', candidate);
      this.saved = candidate;
    } catch (error) {
      this.failure = error;
      throw error;
    }
  }

  private watch(work: Promise<void>, fail: (error: unknown) => void): void {
    void work
      .catch((error) =>
        this.serial(async () => {
          fail(error);
          await this.save();
        }),
      )
      .catch((error: unknown) => {
        if (!(error instanceof OperationError && error.code === 'tooLarge')) this.failure = error;
      });
  }

  private registration(projectId: string, environmentId: string): Registration {
    const entry = this.store.registrations.find(
      (entry) =>
        entry.input.projectId === projectId && entry.environment.environmentId === environmentId,
    );
    if (!entry) throw new OperationError('notFound', '项目环境不存在。');
    return entry;
  }

  private storedPlan(projectId: string, planId: string): Plan {
    const plan = this.store.plans.find(
      (entry) => entry.input.projectId === projectId && entry.value.planId === planId,
    );
    if (!plan) throw new OperationError('notFound', '项目环境计划不存在。');
    return plan;
  }

  private duplicate(input: { projectId: string; operationId: string }, context: CallContext): void {
    const records = [
      ...this.store.registrations,
      ...this.store.plans,
      ...this.store.plans.flatMap((plan) => (plan.preparation ? [plan.preparation] : [])),
    ];
    const previous = records.find(
      (entry) =>
        entry.input.projectId === input.projectId &&
        entry.input.operationId === input.operationId &&
        isDeepStrictEqual(entry.principal, context.principal),
    );
    if (previous && !isDeepStrictEqual(previous.input, input))
      throw new OperationError('invalidRequest', '操作身份已绑定不同的环境请求。');
  }

  private variables(planId: string) {
    const directory = this.child(planId);
    return {
      UV_PROJECT_ENVIRONMENT: join(directory, 'environment'),
      UV_CACHE_DIR: join(directory, 'cache'),
      UV_PYTHON_DOWNLOADS: 'never',
      UV_NO_PROGRESS: '1',
      UV_NO_CONFIG: '1',
      PYTHONNOUSERSITE: '1',
      PYTHONDONTWRITEBYTECODE: '1',
    };
  }

  private python(planId: string): string {
    return join(
      this.variables(planId).UV_PROJECT_ENVIRONMENT,
      process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
    );
  }

  private stamp(planId: string): string {
    return [this.python(planId), join(this.variables(planId).UV_PROJECT_ENVIRONMENT, 'pyvenv.cfg')]
      .map(fileStamp)
      .join('/');
  }

  private checkReceipt(entry: Registration): void {
    const receipt = entry.receipt;
    if (!receipt) return;
    try {
      const executable = receipt.planId ? this.python(receipt.planId) : entry.input.interpreterPath;
      const stamp = receipt.planId ? this.stamp(receipt.planId) : fileStamp(executable);
      if (receipt.executable !== executable || receipt.stamp !== stamp) throw new Error('changed');
    } catch {
      delete entry.receipt;
      if (!receipt.planId) delete entry.environment.version;
      entry.environment.availability = 'unavailable';
      entry.environment.diagnostic = {
        code: 'contentChanged',
        message: '解释器或环境配置已改变，须重新核查。',
      };
    }
  }

  resolve(
    projectId: string,
    environmentId: string,
  ): { executableId: string; executable: string; version?: string; env?: Record<string, string> } {
    if (!this.initialized || this.failure)
      throw new OperationError('unavailable', '环境记录尚不可用。');
    if (environmentId === 'node')
      return { executableId: 'node', executable: process.execPath, version: process.version };
    const entry = this.registration(projectId, environmentId);
    this.checkReceipt(entry);
    if (!entry.receipt || entry.environment.availability !== 'ready')
      throw new OperationError('unavailable', '环境尚未核查为可用。');
    return {
      executableId: environmentId,
      executable: entry.receipt.executable,
      ...(entry.environment.version ? { version: entry.environment.version } : {}),
      ...(entry.receipt.planId ? { env: this.variables(entry.receipt.planId) } : {}),
    };
  }

  async validate(projectId: string, environmentId: string, context: CallContext): Promise<void> {
    await this.ports.check(projectId, context);
    await this.serial(async () => {
      if (environmentId === 'node') return;
      const entry = this.registration(projectId, environmentId);
      this.checkReceipt(entry);
      this.resolve(projectId, environmentId);
      try {
        if (entry.receipt?.planId)
          await this.revalidate(this.storedPlan(projectId, entry.receipt.planId), context);
      } catch (error) {
        delete entry.receipt;
        entry.environment.availability = 'unavailable';
        entry.environment.diagnostic = diagnostic(error);
        await this.save();
        throw error;
      }
    });
  }

  async list(
    input: ProgramsInputs['programs.environments'],
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.environments']> {
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      const limit = input.limit ?? 25;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100)
        throw new OperationError('invalidRequest', '环境分页大小须在 1 到 100 之间。');
      const entries = this.store.registrations.filter(
        (entry) => entry.input.projectId === input.projectId,
      );
      const environments: ProgramEnvironment[] = [
        { environmentId: 'node', kind: 'node', availability: 'ready', version: process.version },
        ...entries.map((entry) => entry.environment),
      ];
      const start = input.before
        ? environments.findIndex((entry) => entry.environmentId === input.before) + 1
        : 0;
      if (input.before && !start)
        throw new OperationError('invalidRequest', '环境分页游标不存在。');
      const page = environments.slice(start, start + limit);
      const before = page.at(-1)?.environmentId;
      const selected = new Set(page.map((entry) => entry.environmentId));
      for (const entry of entries.filter((entry) =>
        selected.has(entry.environment.environmentId),
      )) {
        this.checkReceipt(entry);
        if (entry.receipt?.planId) {
          try {
            await this.revalidate(this.storedPlan(input.projectId, entry.receipt.planId), context);
          } catch (error) {
            delete entry.receipt;
            entry.environment.availability = 'unavailable';
            entry.environment.diagnostic = diagnostic(error);
          }
        }
      }
      return structuredClone({
        environments: page,
        ...(start + limit < environments.length && before ? { before } : {}),
      });
    });
  }

  async register(
    input: RegistrationInput,
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.registerEnvironment']> {
    human(context);
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      if (!isAbsolute(input.interpreterPath) || (input.kind === 'uv' && !isAbsolute(input.uvPath)))
        throw new OperationError('invalidRequest', '环境工具必须使用人类登记的绝对原生路径。');
      this.duplicate(input, context);
      const previous = this.store.registrations.find(
        (entry) =>
          entry.input.projectId === input.projectId &&
          entry.input.operationId === input.operationId &&
          isDeepStrictEqual(entry.principal, context.principal),
      );
      if (previous)
        return {
          environmentId: previous.environment.environmentId,
          ...(previous.environment.programRunId
            ? { programRunId: previous.environment.programRunId }
            : {}),
        };
      const environmentId = randomUUID();
      const entry: Registration = {
        input: structuredClone(input),
        principal: { ...context.principal },
        checking: true,
        environment: { environmentId, kind: input.kind, availability: 'unavailable' },
      };
      this.store.registrations.push(entry);
      await this.save();
      let reference: Reference;
      try {
        reference = await this.ports.launch(
          {
            projectId: input.projectId,
            operationId: input.operationId,
            environmentId,
            kind: 'environmentCheck',
            executableId: environmentId,
            executable: input.interpreterPath,
            args: ['-I', '--version'],
            env: {},
            timeoutMs: 10_000,
          },
          context,
        );
      } catch (error) {
        entry.checking = false;
        entry.environment.diagnostic = diagnostic(error);
        await this.save();
        throw error;
      }
      entry.environment.programRunId = reference.programRunId;
      await this.save();
      this.watch(this.probe(entry, reference.programRunId, context), (error) => {
        entry.checking = false;
        entry.environment.availability = 'unknown';
        entry.environment.diagnostic = diagnostic(error);
      });
      return { environmentId, programRunId: reference.programRunId };
    });
  }

  private async probe(entry: Registration, runId: string, context: CallContext): Promise<void> {
    let run = await this.ports.wait(entry.input.projectId, runId, context);
    let version: string | undefined;
    if (success(run)) {
      version = (await this.ports.logs(entry.input.projectId, runId, context)).match(
        /\bPython\s+(\d+\.\d+\.\d+[^\s]*)/,
      )?.[1];
      if (!version || version.length > 1024)
        throw new OperationError('unavailable', '登记的程序未返回可确认的 Python 版本。');
      if (entry.input.kind === 'uv') {
        await this.ports.check(entry.input.projectId, context);
        const reference = await this.ports.launch(
          {
            projectId: entry.input.projectId,
            operationId: `${entry.input.operationId}:uv`,
            environmentId: entry.environment.environmentId,
            kind: 'environmentCheck',
            executableId: `${entry.environment.environmentId}:uv`,
            executable: entry.input.uvPath,
            args: ['--version'],
            env: {},
            timeoutMs: 10_000,
          },
          context,
        );
        run = await this.ports.wait(entry.input.projectId, reference.programRunId, context);
        if (
          success(run) &&
          !/\buv\s+\d+\.\d+/.test(
            await this.ports.logs(entry.input.projectId, reference.programRunId, context),
          )
        )
          throw new OperationError('unavailable', '登记的程序未返回可确认的 uv 版本。');
      }
    }
    await this.ports.check(entry.input.projectId, context);
    await this.serial(async () => {
      entry.checking = false;
      if (!success(run)) {
        entry.environment.availability = failedAvailability(run);
        entry.environment.diagnostic = run.error ?? {
          code: 'unavailable',
          message: '环境探测未成功且确认收尾。',
        };
      } else {
        if (version) entry.environment.version = version;
        entry.environment.availability = entry.input.kind === 'uv' ? 'needsAuthorization' : 'ready';
        if (entry.input.kind === 'uv' && version && !supportsPlans(version)) {
          entry.environment.availability = 'unavailable';
          entry.environment.diagnostic = {
            code: 'unavailable',
            message:
              '受管准备需要已登记 Python 3.11+ 的 tomllib；旧解释器仍可独立登记为 Python 直接运行。',
          };
        }
        if (entry.input.kind !== 'uv')
          entry.receipt = {
            executable: entry.input.interpreterPath,
            stamp: fileStamp(entry.input.interpreterPath),
          };
      }
      await this.save();
    });
  }

  private async declarationPaths(
    input: PlanInput,
    context: CallContext,
  ): Promise<[string, string]> {
    if (input.declarations.length !== 2)
      throw new OperationError('invalidRequest', '准备需要明确声明 pyproject.toml 和 uv.lock。');
    const paths: string[] = [];
    for (const evidence of input.declarations) {
      if (evidence.ref.source !== 'project' || evidence.ref.projectId !== input.projectId)
        throw new OperationError('permissionDenied', '环境声明必须来自当前项目。');
      const description = await this.ports.describe(evidence, context);
      if (description.relativePath !== basename(description.path))
        throw new OperationError('invalidRequest', '环境声明必须直接位于项目根。');
      if (description.basis !== evidence.basis)
        throw new OperationError('contentChanged', '环境声明依据已改变。');
      if (!isAbsolute(description.path))
        throw new OperationError('unavailable', '声明端口未提供受控原生路径。');
      paths.push(description.path);
    }
    const [first, second] = paths;
    if (
      !first ||
      !second ||
      !paths.some((path) => basename(path) === 'pyproject.toml') ||
      !paths.some((path) => basename(path) === 'uv.lock') ||
      dirname(first) !== dirname(second)
    )
      throw new OperationError(
        'invalidRequest',
        '环境声明必须是同一项目根中的 pyproject.toml 与 uv.lock。',
      );
    return [first, second];
  }

  private async revalidate(plan: Plan, context: CallContext): Promise<void> {
    await this.ports.check(plan.input.projectId, context);
    if (!isDeepStrictEqual(await this.declarationPaths(plan.input, context), plan.paths))
      throw new OperationError('contentChanged', '环境声明的实际位置已改变。');
  }

  async plan(
    input: PlanInput,
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.environmentPlan']> {
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      this.duplicate(input, context);
      const previous = this.store.plans.find(
        (plan) =>
          plan.input.projectId === input.projectId &&
          plan.input.operationId === input.operationId &&
          isDeepStrictEqual(plan.principal, context.principal),
      );
      if (previous)
        return { planId: previous.value.planId, programRunId: previous.value.programRunId };
      const entry = this.registration(input.projectId, input.environmentId);
      if (
        entry.input.kind !== 'uv' ||
        entry.checking ||
        !entry.environment.version ||
        entry.environment.availability === 'unknown'
      )
        throw new OperationError('unavailable', '计划需要已经核查的 uv 与 Python。');
      if (!supportsPlans(entry.environment.version))
        throw new OperationError('unavailable', '受管准备需要 Python 3.11+ 标准库 tomllib。');
      const paths = await this.declarationPaths(input, context);
      const cwd = dirname(paths[0]);
      const planId = randomUUID();
      const directory = this.child(planId);
      await privateDirectory(directory);
      await privateDirectory(join(directory, 'cache'));
      const project = paths.find((path) => basename(path) === 'pyproject.toml');
      const lock = paths.find((path) => basename(path) === 'uv.lock');
      if (!project || !lock) throw new OperationError('invalidRequest', '准备缺少根声明。');
      const args = ['-I', '-B', inspectLock, project, lock, join(directory, 'plan.json')];
      const reference = await this.ports.launch(
        {
          projectId: input.projectId,
          operationId: input.operationId,
          environmentId: input.environmentId,
          kind: 'environmentCheck',
          executableId: input.environmentId,
          executable: entry.input.interpreterPath,
          args,
          declarations: structuredClone(input.declarations),
          env: this.variables(planId),
          timeoutMs: 10_000,
        },
        context,
      );
      const plan: Plan = {
        input: structuredClone(input),
        principal: { ...context.principal },
        cwd,
        paths,
        working: true,
        value: {
          planId,
          projectId: input.projectId,
          environmentId: input.environmentId,
          programRunId: reference.programRunId,
          state: 'pending',
          declarations: structuredClone(input.declarations),
          interpreter: { executableId: input.environmentId, version: entry.environment.version },
          targetId: planId,
        },
      };
      this.store.plans.push(plan);
      await this.save();
      this.watch(this.inspectPlan(plan, entry, context), (error) => {
        plan.working = false;
        plan.value.state =
          error instanceof OperationError && error.code !== 'outcomeUnknown' ? 'failed' : 'unknown';
        plan.value.error = diagnostic(error);
      });
      return { planId, programRunId: reference.programRunId };
    });
  }

  private async inspectPlan(plan: Plan, entry: Registration, context: CallContext): Promise<void> {
    const run = await this.ports.wait(plan.input.projectId, plan.value.programRunId, context);
    if (!success(run)) {
      await this.serial(async () => {
        plan.working = false;
        plan.value.state = failedAvailability(run) === 'unknown' ? 'unknown' : 'failed';
        plan.value.error = run.error ?? {
          code: 'unavailable',
          message: 'uv 锁文件计划检查未成功。',
        };
        await this.save();
      });
      return;
    }
    const evidence: unknown = JSON.parse(
      await boundedText(join(this.child(plan.value.planId), 'plan.json'), 1024 * 1024),
    );
    if (evidence && typeof evidence === 'object' && 'error' in evidence) {
      const error = diagnostic(
        new OperationError('unavailable', String((evidence.error as ErrorInfo).message)),
      );
      throw new OperationError(error.code, error.message);
    }
    if (!validEvidence(evidence))
      throw new OperationError('unavailable', 'Python 未生成完整锁定来源证据。');
    const locked = evidence as LockEvidence;
    if (locked.pythonVersion !== plan.value.interpreter?.version)
      throw new OperationError('contentChanged', '计划检查的 Python 版本已改变。');
    if (entry.input.kind !== 'uv') throw new OperationError('unavailable', '环境不是 uv 登记。');
    await this.revalidate(plan, context);
    await this.serial(async () => {
      plan.working = false;
      plan.value.state = 'ready';
      plan.evidence = locked;
      plan.value.dependencies = locked.dependencies.map(({ name, version, source }) => ({
        name,
        version,
        source,
      }));
      plan.value.network = locked.network;
      plan.value.installation = true;
      plan.value.build = false;
      plan.value.actions = [
        {
          executableId: `${plan.input.environmentId}:uv`,
          cwd: '.',
          args: syncArguments('.', plan.input.environmentId, locked.network),
        },
      ];
      await this.save();
    });
  }

  async planStatus(
    input: ProgramsInputs['programs.environmentPlanStatus'],
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.environmentPlanStatus']> {
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      const plan = this.storedPlan(input.projectId, input.planId);
      if (plan.value.state === 'ready') {
        try {
          await this.revalidate(plan, context);
        } catch (error) {
          plan.value.state = 'failed';
          plan.value.error = diagnostic(error);
          await this.save();
        }
      }
      return structuredClone(plan.value);
    });
  }

  async authorize(
    input: ProgramsInputs['programs.authorizeEnvironment'],
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.authorizeEnvironment']> {
    human(context);
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      const plan = this.storedPlan(input.projectId, input.planId);
      if (plan.value.state !== 'ready' || !plan.evidence)
        throw new OperationError('unavailable', '环境计划尚未核查为可授权。');
      await this.revalidate(plan, context);
      plan.authorization ??= { authorizationId: randomUUID(), principal: { ...context.principal } };
      plan.value.authorizationId = plan.authorization.authorizationId;
      await this.save();
      return { planId: input.planId, authorizationId: plan.authorization.authorizationId };
    });
  }

  async prepare(
    input: PrepareInput,
    context: CallContext,
  ): Promise<ProgramsOutputs['programs.environmentPrepare']> {
    await this.ports.check(input.projectId, context);
    return this.serial(async () => {
      this.duplicate(input, context);
      const plan = this.storedPlan(input.projectId, input.planId);
      const entry = this.registration(input.projectId, plan.input.environmentId);
      if (
        plan.preparation?.input.operationId === input.operationId &&
        isDeepStrictEqual(plan.preparation.principal, context.principal)
      ) {
        if (!plan.preparation.reference)
          throw new OperationError(
            'outcomeUnknown',
            '准备意图已保存，原受理结果须按操作身份核查。',
          );
        return { ...plan.preparation.reference };
      }
      if (plan.value.state !== 'ready' || !plan.authorization || !plan.evidence)
        throw new OperationError('permissionDenied', `环境计划 ${input.planId} 尚未获得人类授权。`);
      if (entry.input.kind !== 'uv')
        throw new OperationError('invalidRequest', '仅允许准备私有 uv 环境。');
      if (
        this.store.plans.some(
          (other) =>
            other.input.environmentId === plan.input.environmentId &&
            other.input.projectId === input.projectId &&
            other.preparation &&
            (other.working ||
              !other.preparation.reference ||
              active.has(other.preparation.reference.state)),
        )
      )
        throw new OperationError('outcomeUnknown', '原环境准备仍在执行或收尾未知，不能重试。');
      await this.revalidate(plan, context);
      if (
        plan.preparation?.reference?.state === 'completed' &&
        entry.receipt?.planId === plan.value.planId
      ) {
        this.checkReceipt(entry);
        if (entry.receipt) return { ...plan.preparation.reference };
      }
      if (plan.preparation)
        throw new OperationError(
          'unavailable',
          '该准备目录已有执行结果，请形成新计划使用独立目录。',
        );
      const preparation: NonNullable<Plan['preparation']> = {
        input: structuredClone(input),
        principal: { ...context.principal },
      };
      plan.preparation = preparation;
      plan.working = true;
      if (!entry.receipt) entry.environment.availability = 'preparing';
      await this.save();
      let reference: Reference;
      try {
        reference = await this.ports.launch(
          {
            projectId: input.projectId,
            operationId: input.operationId,
            environmentId: plan.input.environmentId,
            kind: 'environmentPreparation',
            executableId: `${plan.input.environmentId}:uv`,
            executable: entry.input.interpreterPath,
            args: [
              '-I',
              '-B',
              inspectLock,
              '--sync',
              entry.input.uvPath,
              plan.cwd,
              ...syncArguments(plan.cwd, entry.input.interpreterPath, plan.evidence.network),
            ],
            declarations: structuredClone(plan.input.declarations),
            env: this.variables(plan.value.planId),
            timeoutMs: 600_000,
          },
          context,
        );
      } catch (error) {
        plan.working = false;
        plan.value.error = {
          code: 'outcomeUnknown',
          message: `准备意图已保存，原受理结果尚未核查：${diagnostic(error).message}`.slice(0, 512),
        };
        if (!entry.receipt) {
          entry.environment.availability = 'unknown';
          entry.environment.diagnostic = plan.value.error;
        }
        await this.save();
        throw new OperationError('outcomeUnknown', plan.value.error.message);
      }
      preparation.reference = { ...reference };
      entry.environment.programRunId = reference.programRunId;
      this.watch(this.finishPreparation(plan, entry, context), (error) => {
        plan.working = false;
        if (preparation.reference) preparation.reference.state = 'unknown';
        plan.value.error = diagnostic(error);
        if (!entry.receipt) {
          entry.environment.availability = 'unknown';
          entry.environment.diagnostic = diagnostic(error);
        }
      });
      await this.save();
      return { ...reference };
    });
  }

  private async finishPreparation(
    plan: Plan,
    entry: Registration,
    context: CallContext,
  ): Promise<void> {
    const preparation = plan.preparation;
    if (!preparation?.reference)
      throw new OperationError('unavailable', '环境准备缺少共同运行引用。');
    const preparedRun = preparation.reference;
    let run = await this.ports.wait(plan.input.projectId, preparedRun.programRunId, context);
    await this.serial(async () => {
      preparedRun.state = run.state;
      await this.save();
    });
    let version: string | undefined;
    if (success(run)) {
      await this.revalidate(plan, context);
      const reference = await this.ports.launch(
        {
          projectId: plan.input.projectId,
          operationId: `${preparation.input.operationId}:verify`,
          environmentId: plan.input.environmentId,
          kind: 'environmentCheck',
          executableId: plan.input.environmentId,
          executable: this.python(plan.value.planId),
          args: ['-I', '--version'],
          declarations: structuredClone(plan.input.declarations),
          env: this.variables(plan.value.planId),
          timeoutMs: 10_000,
        },
        context,
      );
      run = await this.ports.wait(plan.input.projectId, reference.programRunId, context);
      if (success(run)) {
        version = (
          await this.ports.logs(plan.input.projectId, reference.programRunId, context)
        ).match(/\bPython\s+(\d+\.\d+\.\d+[^\s]*)/)?.[1];
        if (!version) throw new OperationError('unavailable', '受管解释器版本核查失败。');
        if (version !== plan.value.interpreter?.version)
          throw new OperationError('contentChanged', '实际 Python 版本已偏离获授权计划。');
        await this.revalidate(plan, context);
      }
    }
    await this.serial(async () => {
      plan.working = false;
      if (success(run)) {
        entry.receipt = {
          executable: this.python(plan.value.planId),
          stamp: this.stamp(plan.value.planId),
          planId: plan.value.planId,
        };
        entry.environment.availability = 'ready';
        if (version) entry.environment.version = version;
        delete entry.environment.diagnostic;
        delete plan.value.error;
      } else {
        const error = run.error ?? {
          code: 'unavailable' as const,
          message: '环境准备未成功，不使用部分环境。',
        };
        plan.value.error = error;
        if (!entry.receipt) {
          entry.environment.availability = failedAvailability(run);
          entry.environment.diagnostic = error;
        }
      }
      await this.save();
    });
  }
}
