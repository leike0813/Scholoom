import { lstat, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { atomicPrivateFile, privateDirectory } from '@scholoom/platform/node';
import { compileContract, OperationError } from '@scholoom/protocol/core';
import {
  type Effort,
  type ModelProfile,
  type ModelProfilesPage,
  modelsModuleOperations,
  modelsOperations,
  type SaveModelProfile,
} from '@scholoom/protocol/models';
import { factoryDefaults, minimaxEfforts, minimaxModels } from './catalog.js';

import type { ModelDefaults } from './index.js';

const profileSave = compileContract(modelsOperations['provider.saveProfile']);
const profileRemove = compileContract(modelsOperations['provider.removeProfile']).params;
const profilePage = compileContract(modelsOperations['provider.profiles']).params;
const profileResolve = compileContract(modelsModuleOperations['models.resolveProfile']).params;
const profilesFile = compileContract({
  params: {
    type: 'object',
    properties: {
      revision: { type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER },
      profiles: {
        type: 'array',
        items: modelsOperations['provider.saveProfile'].result,
        maxItems: 100,
      },
    },
    required: ['revision', 'profiles'],
    additionalProperties: false,
  },
  result: true,
}).params;

interface ProfilesFile {
  revision: number;
  profiles: ModelProfile[];
}

function validateProfileConfig(profile: Pick<ModelProfile, 'config'>): void {
  const option = minimaxModels.find((item) => item.id === profile.config.model);
  if (!option || (profile.config.effort !== undefined && !option.supportsEffort))
    throw new OperationError('invalidRequest', '命名模型配置包含不可用的模型或推理参数。');
}

const parse = (value: unknown): ModelDefaults => {
  const candidate = value as Partial<ModelDefaults> | null;
  if (
    typeof candidate?.model !== 'string' ||
    !minimaxModels.some((item) => item.id === candidate.model) ||
    typeof candidate.effort !== 'string' ||
    !(minimaxEfforts as readonly string[]).includes(candidate.effort)
  )
    throw new Error('Unrecognized defaults');
  return { model: candidate.model, effort: candidate.effort as Effort };
};

export class ModelConfigStore {
  private tail = Promise.resolve();
  constructor(private readonly directory: string) {}
  private path(): string {
    return join(this.directory, 'provider.json');
  }

  async load(): Promise<ModelDefaults> {
    let raw: string;
    try {
      const path = this.path();
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
      )
        throw new Error('Unsafe config permissions');
      raw = await readFile(path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...factoryDefaults };
      throw new OperationError(
        'unavailable',
        `默认模型配置 ${this.path()} 不可读或权限不安全；已保留原文件，重新保存默认配置即可修复。`,
      );
    }
    try {
      return parse(JSON.parse(raw));
    } catch {
      throw new OperationError(
        'unavailable',
        `默认模型配置 ${this.path()} 已损坏；已保留原文件，重新保存默认配置即可修复。`,
      );
    }
  }

  save(defaults: ModelDefaults): Promise<void> {
    return this.enqueue(async () => {
      parse(defaults);
      await privateDirectory(this.directory);
      await atomicPrivateFile(
        this.directory,
        'provider.json',
        JSON.stringify({ version: 1, model: defaults.model, effort: defaults.effort }),
      );
    });
  }

  async profiles(input: { offset?: number; limit?: number } = {}): Promise<ModelProfilesPage> {
    if (!profilePage(input)) throw new OperationError('invalidRequest', '模型配置分页参数无效。');
    const { offset = 0, limit = 25 } = input;
    await this.tail;
    const { profiles } = await this.loadProfiles();
    const end = offset + limit;
    return {
      profiles: profiles.slice(offset, end),
      ...(end < profiles.length ? { nextOffset: end } : {}),
    };
  }

  async resolveProfile(id: string): Promise<ModelProfile> {
    if (!profileResolve({ id })) throw new OperationError('invalidRequest', '模型配置身份无效。');
    await this.tail;
    const profile = (await this.loadProfiles()).profiles.find((item) => item.id === id);
    if (!profile) throw new OperationError('notFound', '命名模型配置不存在。');
    return profile;
  }

  async saveProfile(input: SaveModelProfile): Promise<ModelProfile> {
    if (!profileSave.params(input))
      throw new OperationError('invalidRequest', '命名模型配置参数无效。');
    validateProfileConfig(input);
    const candidate = structuredClone(input);
    return this.enqueue(async () => {
      const state = await this.loadProfiles();
      const index = state.profiles.findIndex((item) => item.id === candidate.id);
      const current = state.profiles[index];
      if ((current?.revision ?? 0) !== candidate.expectedRevision)
        throw new OperationError('contentChanged', '模型配置已变化，请重新读取后保存。');
      if (!current && state.profiles.length >= 100)
        throw new OperationError('resourceLimit', '命名模型配置最多保存 100 项。');
      const profile: ModelProfile = {
        id: candidate.id,
        name: candidate.name,
        revision: this.nextRevision(state),
        provider: 'minimax-cn-m-plan',
        config: candidate.config,
      };
      if (current) state.profiles[index] = profile;
      else state.profiles.push(profile);
      await this.saveProfiles(state);
      return profile;
    });
  }

  async removeProfile(input: { id: string; expectedRevision: number }): Promise<void> {
    if (!profileRemove(input)) throw new OperationError('invalidRequest', '移除模型配置参数无效。');
    const { id, expectedRevision } = input;
    return this.enqueue(async () => {
      const state = await this.loadProfiles();
      const index = state.profiles.findIndex((item) => item.id === id);
      const current = state.profiles[index];
      if (!current) throw new OperationError('notFound', '命名模型配置不存在。');
      if (current.revision !== expectedRevision)
        throw new OperationError('contentChanged', '模型配置已变化，请重新读取后移除。');
      this.nextRevision(state);
      state.profiles.splice(index, 1);
      await this.saveProfiles(state);
    });
  }

  private nextRevision(state: ProfilesFile): number {
    if (state.revision >= Number.MAX_SAFE_INTEGER)
      throw new OperationError('resourceLimit', '模型配置修订已达到上限。');
    return ++state.revision;
  }

  private async loadProfiles(): Promise<ProfilesFile> {
    const path = join(this.directory, 'model-profiles.json');
    try {
      let stat: Awaited<ReturnType<typeof lstat>>;
      try {
        stat = await lstat(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT')
          return { revision: 0, profiles: [] };
        throw error;
      }
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
      )
        throw new Error('Unsafe config permissions');
      const state = JSON.parse(await readFile(path, 'utf8')) as ProfilesFile;
      if (
        !profilesFile(state) ||
        new Set(state.profiles.map((item) => item.id)).size !== state.profiles.length ||
        state.profiles.some((item) => item.revision < 1 || item.revision > state.revision)
      )
        throw new Error('Unrecognized profiles');
      for (const profile of state.profiles) validateProfileConfig(profile);
      return state;
    } catch {
      throw new OperationError(
        'unavailable',
        '命名模型配置不可读、权限不安全或已损坏；已保留原文件。',
      );
    }
  }

  private async saveProfiles(state: ProfilesFile): Promise<void> {
    await privateDirectory(this.directory);
    await atomicPrivateFile(this.directory, 'model-profiles.json', JSON.stringify(state));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = this.tail.then(operation);
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }
}
