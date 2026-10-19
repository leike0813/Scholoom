import { pathToFileURL } from 'node:url';

const { serveKernel } = await import(
  process.argv[4]
    ? pathToFileURL(process.argv[4]).href
    : new URL('../../../apps/kernel/dist/lifecycle.js', import.meta.url).href
);

await serveKernel(process.argv[2], {
  modelEndpoint: process.argv[3],
  environment: { MINIMAX_CN_API_KEY: 'synthetic' },
});
