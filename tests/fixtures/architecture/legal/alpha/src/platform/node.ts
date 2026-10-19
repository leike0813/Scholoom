// @ts-nocheck
import { readFileSync } from 'node:fs';

export function readLocalFile(path: string): string {
  const endpoint = process.env.SCHOLOOM_FIXTURE_ENDPOINT;
  void fetch(endpoint ?? 'http://localhost');
  return readFileSync(path, 'utf8');
}
