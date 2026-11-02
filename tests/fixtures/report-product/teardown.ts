import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  kernelLifecycleDiagnostics,
  kernelResultSummary,
  runKernel,
  waitForKernelStop,
} from '../../kernel-fixture.js';

export default async function teardown() {
  const directory = process.env.SCHOOLOOM_UI_DATA_DIR;
  const root = process.env.SCHOOLOOM_REPORT_PRODUCT_RUN;
  assert(directory && root);
  const requested = await runKernel(directory, 'stop');
  let result = requested;
  let failure: unknown;
  if (result.state !== 'stopped') {
    try {
      result = await waitForKernelStop(directory, undefined, (current) => {
        result = current;
      });
    } catch (error) {
      failure = error;
    }
  }
  await writeFile(
    join(root, 'kernel-stop.json'),
    JSON.stringify(
      {
        requested: kernelResultSummary(requested),
        result: kernelResultSummary(result),
        ...(failure ? { failure: String(failure) } : {}),
        lifecycle: await kernelLifecycleDiagnostics(directory),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  if (failure) throw failure;
  assert.equal(
    result.state,
    'stopped',
    'Product-owned kernel stop is unconfirmed; preserve evidence',
  );
}
