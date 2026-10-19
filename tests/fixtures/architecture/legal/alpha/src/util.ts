// @ts-nocheck
import { createHash } from 'node:crypto';
import { basename } from 'node:path';

export function describe(value: string): string {
  return createHash('sha256').update(basename(value)).digest('hex');
}
