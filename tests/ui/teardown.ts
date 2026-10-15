import { cleanupKernel } from '../kernel-fixture.js';

export default async function teardown() {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  if (!directory) throw new Error('Missing isolated UI configuration');
  await cleanupKernel(directory);
}
