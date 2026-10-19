// @ts-nocheck
export async function load(): Promise<unknown[]> {
  const child = await import('node:child_process');
  const internal = await import('@fixture/beta/src/internal.js');
  return [child, internal];
}
