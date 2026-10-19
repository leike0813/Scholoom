// @ts-nocheck
import { readFileSync } from 'node:fs';

export function readLegacy(path: string): string {
  return readFileSync(path, 'utf8');
}
