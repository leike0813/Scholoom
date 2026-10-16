import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { lstat, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { OperationError } from '../errors.js';
import { atomicPrivateFile, privateDirectory } from '../storage/private-files.js';

export interface CredentialStatus {
  configured: boolean;
  source: 'saved' | 'environment' | 'missing';
  error?: string;
}

export class CredentialStore {
  private tail = Promise.resolve();
  constructor(
    private readonly directory: string,
    private readonly environment: NodeJS.ProcessEnv = process.env,
  ) {}

  private async existing(filename: string): Promise<Buffer | null> {
    try {
      const path = join(this.directory, filename);
      const stat = await lstat(path);
      if (
        !stat.isFile() ||
        stat.isSymbolicLink() ||
        (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)
      )
        throw new Error('Unsafe credential permissions');
      return await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new OperationError(
        'credentialUnavailable',
        '凭据文件不可读或权限不安全；已保留原文件。',
      );
    }
  }

  async get(): Promise<{ key: string; source: 'saved' | 'environment' }> {
    const encrypted = await this.existing('minimax.json');
    if (encrypted) {
      try {
        const master = await this.existing('master.key');
        if (master?.length !== 32) throw new Error('Missing master');
        const value = JSON.parse(encrypted.toString('utf8'));
        const decipher = createDecipheriv('aes-256-gcm', master, Buffer.from(value.iv, 'base64'));
        decipher.setAuthTag(Buffer.from(value.tag, 'base64'));
        const key = Buffer.concat([
          decipher.update(Buffer.from(value.data, 'base64')),
          decipher.final(),
        ]).toString('utf8');
        if (!key.trim()) throw new Error('Empty credential');
        return { key, source: 'saved' };
      } catch {
        throw new OperationError('credentialUnavailable', '凭据无法解锁；已保留密文和主密钥。');
      }
    }
    const key = this.environment.MINIMAX_CN_API_KEY?.trim();
    if (!key)
      throw new OperationError('credentialUnavailable', '请配置 MiniMax M Plan 中国区 API Key。');
    return { key, source: 'environment' };
  }

  async status(): Promise<CredentialStatus> {
    try {
      return { configured: true, source: (await this.get()).source };
    } catch (error) {
      return {
        configured: false,
        source: 'missing',
        error: error instanceof OperationError ? error.message : '凭据不可用。',
      };
    }
  }

  save(key: string): Promise<CredentialStatus> {
    const run = this.tail.then(async () => {
      if (!key.trim() || key.length > 4096)
        throw new OperationError('invalidRequest', 'API Key 不能为空。');
      await privateDirectory(this.directory);
      const current = await this.existing('minimax.json');
      if (current) await this.get();
      let master = await this.existing('master.key');
      if (!master) {
        master = randomBytes(32);
        const handle = await open(join(this.directory, 'master.key'), 'wx', 0o600);
        try {
          await handle.writeFile(master);
          await handle.sync();
        } finally {
          await handle.close();
        }
      }
      if (master.length !== 32)
        throw new OperationError('credentialUnavailable', '主密钥损坏；已保留原文件。');
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', master, iv);
      const data = Buffer.concat([cipher.update(key.trim(), 'utf8'), cipher.final()]);
      await atomicPrivateFile(
        this.directory,
        'minimax.json',
        JSON.stringify({
          version: 1,
          iv: iv.toString('base64'),
          tag: cipher.getAuthTag().toString('base64'),
          data: data.toString('base64'),
        }),
      );
      return this.status();
    });
    this.tail = run.then(
      () => {},
      () => {},
    );
    return run;
  }
}
