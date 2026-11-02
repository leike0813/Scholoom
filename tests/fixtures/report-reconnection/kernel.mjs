import { serveKernel } from '../../../apps/kernel/dist/lifecycle.js';
import { description, graphs } from './graphs.mjs';

const directory = process.argv[2];
const options = JSON.parse(process.argv[3] ?? '{}');
const workerEntry = new URL('./worker.mjs', import.meta.url);
if (options.publicationBarrier)
  workerEntry.searchParams.set('publicationBarrier', options.publicationBarrier);
try {
  await serveKernel(directory, {
    environment: {},
    development: false,
    executionGraphs: graphs,
    researchGraphs: [description],
    workerEntry,
    ...(options.modelEndpoint ? { modelEndpoint: options.modelEndpoint } : {}),
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  process.disconnect?.();
}
