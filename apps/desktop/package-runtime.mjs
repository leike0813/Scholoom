import { access, cp } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

export default async function preserveRuntime({ appOutDir, packager }) {
  await access(
    join(
      packager.getResourcesDir(appOutDir),
      'app.asar.unpacked/node_modules/@scholoom/platform/dist',
      packager.platform.nodeName === 'win32' ? 'process-scope.exe' : 'process-scope',
    ),
  );
  const harness = createRequire(new URL('../../packages/harness/package.json', import.meta.url));
  const graph = createRequire(harness.resolve('@langchain/langgraph'));
  const sdk = graph.resolve('@langchain/langgraph-sdk');
  // The SDK ships bundled code under dist/node_modules, which the packager omits as dependencies.
  await cp(
    join(dirname(sdk), 'node_modules'),
    join(
      packager.getResourcesDir(appOutDir),
      'app.asar.unpacked/node_modules/@langchain/langgraph-sdk/dist/node_modules',
    ),
    { recursive: true },
  );
}
