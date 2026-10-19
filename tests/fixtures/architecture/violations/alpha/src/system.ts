// @ts-nocheck
import { readFileSync } from 'node:fs';
import { app } from 'electron';

export function read(path: string): string {
  return readFileSync(path, 'utf8');
}

export async function remote(url: string): Promise<unknown> {
  const response = await fetch(url);
  return [app, response];
}
