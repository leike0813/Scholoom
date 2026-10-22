import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

export function contractTypes(
  methods,
  declaration = 'businessSchemas',
  module = './operations.js',
) {
  assert(methods.every((method) => /^[a-zA-Z][a-zA-Z0-9.]*$/.test(method)));
  assert.equal(new Set(methods).size, methods.length);
  let source = `// Generated from ${declaration}; regenerate with pnpm generate:contracts.\nimport type { FromSchema } from 'json-schema-to-ts';\nimport type { ${declaration} } from '${module}';\n\n`;
  for (const [kind, schema] of [
    ['Inputs', 'params'],
    ['Outputs', 'result'],
  ]) {
    source += `export type ${kind} = {\n`;
    for (const method of [...methods].sort())
      source += `  '${method}': FromSchema<(typeof ${declaration})['${method}']['${schema}']>;\n`;
    source += '};\n';
  }
  return source;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--self-test') {
    assert.equal(contractTypes(['b.read', 'a.write']), contractTypes(['a.write', 'b.read']));
    assert.throws(() => contractTypes(['bad\nmethod']));
    assert.throws(() => contractTypes(['a.read', 'a.read']));
  } else {
    const source = new URL('../src/', import.meta.url).href;
    // Load declaration sources even when stale generated types prevent a full build.
    registerHooks({
      resolve(specifier, context, next) {
        if (
          context.parentURL?.startsWith(source) &&
          specifier.startsWith('.') &&
          specifier.endsWith('.js')
        )
          return next(new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL).href, context);
        return next(specifier, context);
      },
    });
    const { businessSchemas } = await import('../src/operations.ts');
    const { executionControlOperations } = await import('../src/execution-contracts.ts');
    const { projectExecutionOperations } = await import('../src/project-file-contracts.ts');
    const { projectHarnessOperations } = await import('../src/project-contracts.ts');
    const { projectTargetReadOperations } = await import('../src/work-domains.ts');
    const { workbenchContextContracts } = await import('../src/workbench-context-contracts.ts');
    const { harnessModuleOperations } = await import('../src/harness-module-contracts.ts');
    const { researchModuleOperations } = await import('../src/research-module-contracts.ts');
    const declarations = [
      [
        'workbench-context-types.ts',
        workbenchContextContracts,
        'workbenchContextContracts',
        './workbench-context-contracts.js',
      ],
      [
        'project-target-read-types.ts',
        projectTargetReadOperations,
        'projectTargetReadOperations',
        './work-domains.js',
      ],
      [
        'project-harness-types.ts',
        projectHarnessOperations,
        'projectHarnessOperations',
        './project-contracts.js',
      ],
      [
        'harness-module-types.ts',
        harnessModuleOperations,
        'harnessModuleOperations',
        './harness-module-contracts.js',
      ],
      [
        'research-module-types.ts',
        researchModuleOperations,
        'researchModuleOperations',
        './research-module-contracts.js',
      ],
      ['business-types.ts', businessSchemas, 'businessSchemas', './operations.js'],
      [
        'execution-control-types.ts',
        executionControlOperations,
        'executionControlOperations',
        './execution-contracts.js',
      ],
      [
        'project-execution-types.ts',
        projectExecutionOperations,
        'projectExecutionOperations',
        './project-file-contracts.js',
      ],
    ];
    if (process.argv[2] === '--patch') {
      const lines = (text, prefix) =>
        text
          .trimEnd()
          .split('\n')
          .map((line) => prefix + line)
          .join('\n');
      process.stdout.write('*** Begin Patch\n');
      for (const [file, schemas, name, module] of declarations) {
        const previous = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
        const source = contractTypes(Object.keys(schemas), name, module);
        if (previous !== source)
          process.stdout.write(
            `*** Update File: packages/protocol/src/${file}\n@@\n${lines(previous, '-')}\n${lines(source, '+')}\n`,
          );
      }
      process.stdout.write('*** End Patch\n');
    } else
      for (const [, schemas, name, module] of declarations)
        process.stdout.write(contractTypes(Object.keys(schemas), name, module));
  }
}
