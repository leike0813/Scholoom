import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Node, SourceFile, StringLiteral } from 'typescript/unstable/ast';
import {
  isCallExpression,
  isClassDeclaration,
  isExportDeclaration,
  isExternalModuleReference,
  isFunctionDeclaration,
  isIdentifier,
  isImportDeclaration,
  isImportEqualsDeclaration,
  isNamedImports,
  isNamespaceImport,
  isPropertyAccessExpression,
  isStringLiteral,
  isVariableDeclaration,
  SyntaxKind,
} from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';

const sourceExtensions = ['.ts', '.tsx', '.mts', '.cts'];
const skippedDirectories = new Set(['node_modules', 'dist', 'out', 'release', '.git']);

export type ArchitectureFinding = {
  category: string;
  module: string;
  file: string;
  line: number;
  detail: string;
  specifier: string;
  api: string;
};

export type ArchitectureReport = {
  root: string;
  moduleNames: string[];
  fileCount: number;
  findings: ArchitectureFinding[];
  exceptions: string[];
  notes: string[];
};

type SystemAdapter = { path?: string; apis?: string[] };

type PolicyModule = {
  name: string;
  package?: string;
  root: string;
  sourceRoot?: string;
  allows?: string[];
  systemAdapters?: SystemAdapter[];
  provides?: string[];
  consumes?: string[];
};

type PolicyException = {
  module: string;
  from?: string;
  specifier?: string;
  path?: string;
  apis?: string[];
  reason?: string;
  removal?: string;
};

type Policy = {
  modules?: PolicyModule[];
  system?: { pure?: string[]; specifiers?: string[]; globals?: string[] };
  exceptions?: PolicyException[];
};

type PackageJson = {
  exports?: Record<string, unknown>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

type ModuleRecord = {
  name: string;
  packageName: string | undefined;
  rootAbsolute: string;
  rootRelative: string;
  sourceRoot: string;
  allows: string[];
  adapters: { pattern: string; apis: string[] }[];
  dependencies: Set<string>;
  exports: Record<string, unknown> | undefined;
  provides: string[];
};

type SourceFileRecord = {
  absolute: string;
  relative: string;
  moduleRelative: string;
  module: ModuleRecord;
};

type Edge = { kind: string; specifier: string; line: number; typeOnly: boolean };

type SystemUse = { api: string; line: number };

type Classification = {
  category?: string;
  detail?: string;
  api?: string;
  target?: string;
  unanalyzed?: 'dynamic' | 'unresolved' | 'virtual';
};

function toPosix(value: string): string {
  return value.split(sep).join('/');
}

function normalizeApi(api: string): string {
  return api.startsWith('node:') ? api.slice('node:'.length) : api;
}

function matchesPattern(pattern: string, value: string): boolean {
  let expression = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index] ?? '';
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        expression += '.*';
        index += 1;
      } else {
        expression += '[^/]*';
      }
    } else if ('\\^$.|?+()[]{}'.includes(character)) {
      expression += '\\' + character;
    } else {
      expression += character;
    }
  }
  return new RegExp(expression + '$').test(value);
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readPolicy(path: string): Policy {
  const parsed = readJson(path);
  if (parsed === undefined) throw new Error('missing architecture policy: ' + path);
  return parsed as Policy;
}

function buildModules(root: string, policy: Policy): ModuleRecord[] {
  const modules: ModuleRecord[] = [];
  for (const entry of policy.modules ?? []) {
    const rootAbsolute = resolve(root, entry.root);
    const packageJson = (readJson(join(rootAbsolute, 'package.json')) ?? {}) as PackageJson;
    const dependencies = new Set<string>([
      ...Object.keys(packageJson.dependencies ?? {}),
      ...Object.keys(packageJson.devDependencies ?? {}),
    ]);
    modules.push({
      name: entry.name,
      packageName: entry.package,
      rootAbsolute,
      rootRelative: toPosix(relative(root, rootAbsolute)),
      sourceRoot: resolve(rootAbsolute, entry.sourceRoot ?? 'src'),
      allows: entry.allows ?? [],
      adapters: (entry.systemAdapters ?? []).map((adapter) => ({
        pattern: adapter.path ?? '',
        apis: adapter.apis ?? [],
      })),
      dependencies,
      exports: packageJson.exports,
      provides: entry.provides ?? [],
    });
  }
  return modules;
}

function collectSourceFiles(modules: ModuleRecord[]): SourceFileRecord[] {
  const records: SourceFileRecord[] = [];
  for (const module of modules) {
    const pending = [module.sourceRoot];
    while (pending.length > 0) {
      const directory = pending.pop();
      if (directory === undefined || !existsSync(directory)) continue;
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!skippedDirectories.has(entry.name)) pending.push(path);
          continue;
        }
        if (!sourceExtensions.some((extension) => entry.name.endsWith(extension))) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        records.push({
          absolute: path,
          relative: toPosix(relative(module.rootAbsolute, path)),
          moduleRelative: toPosix(relative(module.rootAbsolute, path)),
          module,
        });
      }
    }
  }
  records.sort((left, right) => (left.absolute < right.absolute ? -1 : 1));
  return records;
}

function moduleOfFile(absolute: string, modules: ModuleRecord[]): ModuleRecord | undefined {
  let match: ModuleRecord | undefined;
  for (const module of modules) {
    const prefix = module.rootAbsolute + sep;
    if (!absolute.startsWith(prefix)) continue;
    if (match === undefined || module.rootAbsolute.length > match.rootAbsolute.length)
      match = module;
  }
  return match;
}

function allowedSystemUse(record: SourceFileRecord, api: string): boolean {
  const normalized = normalizeApi(api);
  return record.module.adapters.some(
    (adapter) =>
      adapter.apis.some((allowed) => normalizeApi(allowed) === normalized) &&
      matchesPattern(adapter.pattern, record.moduleRelative),
  );
}

function findModuleBySpecifier(
  specifier: string,
  modules: ModuleRecord[],
): ModuleRecord | undefined {
  for (const module of modules) {
    const name = module.packageName;
    if (name === undefined) continue;
    if (specifier === name || specifier.startsWith(name + '/')) return module;
  }
  return undefined;
}

function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  if (specifier.startsWith('@')) return parts.slice(0, 2).join('/');
  return parts[0] ?? specifier;
}

function isAllowedDependency(allows: string[], specifier: string, target: ModuleRecord): boolean {
  if (allows.includes(specifier) || allows.includes(target.name)) return true;
  const name = target.packageName;
  return name !== undefined && allows.includes(name);
}

function builtinName(specifier: string): string | undefined {
  if (specifier.startsWith('node:')) return specifier;
  return builtinModules.includes(specifier) ? specifier : undefined;
}

function isPureModule(policy: Policy, api: string): boolean {
  const normalized = normalizeApi(api);
  return (policy.system?.pure ?? []).some((entry) => normalizeApi(entry) === normalized);
}

function isSystemSpecifier(policy: Policy, specifier: string): boolean {
  return (policy.system?.specifiers ?? []).includes(specifier);
}

function resolveMaybeExtensions(base: string): string | undefined {
  const withoutExtension = base.replace(/\.(js|mjs|cjs|jsx|ts|tsx|mts|cts|d\.ts|d\.mts)$/, '');
  const candidates = [base];
  for (const extension of sourceExtensions) {
    candidates.push(withoutExtension + extension);
    candidates.push(join(withoutExtension, 'index' + extension));
  }
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

function exportKey(subpath: string): string {
  return subpath === '' ? '.' : './' + subpath;
}

function matchingExportKey(module: ModuleRecord, key: string): string | undefined {
  const entries = Object.keys(module.exports ?? {});
  return entries.find(
    (entry) => entry === key || (entry.includes('*') && matchesPattern(entry, key)),
  );
}

function exportTarget(module: ModuleRecord, key: string): string | undefined {
  const mapping = module.exports?.[key];
  if (typeof mapping === 'string') return mapping;
  if (mapping !== null && typeof mapping === 'object') {
    const conditions = mapping as Record<string, unknown>;
    for (const condition of ['import', 'types', 'default']) {
      const value = conditions[condition];
      if (typeof value === 'string') return value;
    }
  }
  return undefined;
}

function resolveExportedFile(module: ModuleRecord, key: string): string | undefined {
  const target = exportTarget(module, key);
  if (target === undefined) return undefined;
  if (target.startsWith('./dist/')) {
    return resolveMaybeExtensions(join(module.sourceRoot, target.slice('./dist/'.length)));
  }
  return resolveMaybeExtensions(resolve(module.rootAbsolute, target));
}

function classifyEdge(
  edge: Edge,
  record: SourceFileRecord,
  modules: ModuleRecord[],
  policy: Policy,
): Classification {
  const specifier = edge.specifier;
  if (specifier.startsWith('.')) {
    const target = resolveMaybeExtensions(resolve(dirname(record.absolute), specifier));
    if (target === undefined) return { unanalyzed: 'unresolved' };
    const owner = moduleOfFile(target, modules);
    if (owner === undefined) {
      return {
        category: 'private-path',
        detail: 'relative import leaves module roots',
        target,
      };
    }
    if (owner.name !== record.module.name) {
      return {
        category: 'private-path',
        detail: 'relative import reaches ' + owner.name + ' source instead of its declared exports',
        target,
      };
    }
    return { target };
  }
  const builtin = builtinName(specifier);
  if (builtin !== undefined) {
    if (edge.typeOnly || isPureModule(policy, builtin) || allowedSystemUse(record, builtin))
      return {};
    return { category: 'system-access', detail: 'imports ' + builtin, api: builtin };
  }
  const target = findModuleBySpecifier(specifier, modules);
  if (target !== undefined) {
    const prefix = target.packageName === undefined ? specifier : target.packageName;
    const subpath = specifier === prefix ? '' : specifier.slice(prefix.length + 1);
    const key = exportKey(subpath);
    const matched = matchingExportKey(target, key);
    if (matched === undefined) {
      return {
        category: 'private-path',
        detail:
          'imports ' + target.name + ' subpath ' + key + ' that is not declared in its exports',
      };
    }
    if (!isAllowedDependency(record.module.allows, specifier, target)) {
      const allowed = record.module.allows.length === 0 ? 'none' : record.module.allows.join(', ');
      return {
        category: 'reverse-dependency',
        detail: 'imports ' + target.name + ' while allowed dependencies are ' + allowed,
      };
    }
    const resolvedTarget = resolveExportedFile(target, matched);
    return resolvedTarget === undefined ? {} : { target: resolvedTarget };
  }
  if (edge.typeOnly && isSystemSpecifier(policy, specifier)) return {};
  if (isSystemSpecifier(policy, specifier)) {
    if (allowedSystemUse(record, specifier)) return {};
    return {
      category: 'system-access',
      detail: 'imports host facility ' + specifier,
      api: specifier,
    };
  }
  if (specifier.includes(':')) return { unanalyzed: 'virtual' };
  const packageName = packageNameOf(specifier);
  if (!record.module.dependencies.has(packageName)) {
    return {
      category: 'undeclared-dependency',
      detail:
        'imports ' + packageName + ' that is not a declared dependency of ' + record.module.name,
    };
  }
  return {};
}

function analyzeFile(
  source: SourceFile,
  policy: Policy,
): { edges: Edge[]; systemUses: SystemUse[] } {
  const edges: Edge[] = [];
  const systemUses: SystemUse[] = [];
  const boundNames = new Set<string>();
  const globals = policy.system?.globals ?? [];
  const globalCalls = new Set(globals.filter((name) => !name.includes('.')));
  const globalMembers = new Set(globals.filter((name) => name.includes('.')));
  const lineOf = (node: Node): number =>
    1 + source.getLineAndCharacterOfPosition(node.getStart(source)).line;
  const textOf = (node: Node): string => node.getText(source);
  const addEdge = (specifier: StringLiteral, kind: string, typeOnly: boolean): void => {
    edges.push({ kind, specifier: specifier.text, line: lineOf(specifier), typeOnly });
  };
  const visit = (node: Node): void => {
    if (isImportDeclaration(node)) {
      const clause = node.importClause;
      if (clause !== undefined) {
        if (clause.name !== undefined) boundNames.add(clause.name.text);
        const bindings = clause.namedBindings;
        if (bindings !== undefined) {
          if (isNamespaceImport(bindings)) {
            boundNames.add(bindings.name.text);
          } else if (isNamedImports(bindings)) {
            for (const element of bindings.elements) boundNames.add(element.name.text);
          }
        }
      }
      if (node.moduleSpecifier !== undefined && isStringLiteral(node.moduleSpecifier)) {
        const allTyped =
          clause === undefined ||
          clause.phaseModifier === SyntaxKind.TypeKeyword ||
          (clause.namedBindings !== undefined &&
            isNamedImports(clause.namedBindings) &&
            clause.namedBindings.elements.every((element) => element.isTypeOnly));
        addEdge(node.moduleSpecifier, 'import', allTyped);
      }
    } else if (isExportDeclaration(node)) {
      if (node.moduleSpecifier !== undefined && isStringLiteral(node.moduleSpecifier)) {
        addEdge(node.moduleSpecifier, 'export', node.isTypeOnly);
      }
    } else if (isImportEqualsDeclaration(node)) {
      boundNames.add(node.name.text);
      const reference = node.moduleReference;
      if (
        isExternalModuleReference(reference) &&
        reference.expression !== undefined &&
        isStringLiteral(reference.expression)
      ) {
        addEdge(reference.expression, 'require', false);
      }
    } else if (
      isVariableDeclaration(node) ||
      isFunctionDeclaration(node) ||
      isClassDeclaration(node)
    ) {
      const name = node.name;
      if (name !== undefined && isIdentifier(name)) boundNames.add(name.text);
    } else if (isCallExpression(node)) {
      const argument = node.arguments?.[0];
      if (
        node.expression.kind === SyntaxKind.ImportKeyword &&
        argument !== undefined &&
        isStringLiteral(argument)
      ) {
        addEdge(argument, 'dynamic-import', false);
      } else if (
        isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        argument !== undefined &&
        isStringLiteral(argument)
      ) {
        addEdge(argument, 'require', false);
      }
    }
    if (isPropertyAccessExpression(node)) {
      const path = textOf(node);
      if (globalMembers.has(path)) {
        const owner = textOf(node.expression);
        if (!boundNames.has(owner)) systemUses.push({ api: path, line: lineOf(node) });
      }
    }
    if (isCallExpression(node)) {
      const callee = node.expression;
      if (isIdentifier(callee) && globalCalls.has(callee.text) && !boundNames.has(callee.text)) {
        systemUses.push({ api: callee.text, line: lineOf(node) });
      } else if (isPropertyAccessExpression(callee)) {
        const owner = textOf(callee.expression);
        if (
          globalCalls.has(callee.name.text) &&
          ['globalThis', 'global', 'window'].includes(owner) &&
          !boundNames.has(owner)
        ) {
          systemUses.push({ api: callee.name.text, line: lineOf(node) });
        }
      }
    }
    node.forEachChild(visit);
  };
  source.forEachChild(visit);
  return { edges, systemUses };
}

function importFinding(
  record: SourceFileRecord,
  edge: Edge,
  classification: Classification,
): ArchitectureFinding {
  return {
    category: classification.category ?? 'unknown',
    module: record.module.name,
    file: record.relative,
    line: edge.line,
    detail: classification.detail ?? '',
    specifier: edge.specifier,
    api: classification.api ?? '',
  };
}

function systemFinding(record: SourceFileRecord, use: SystemUse): ArchitectureFinding {
  return {
    category: 'system-access',
    module: record.module.name,
    file: record.relative,
    line: use.line,
    detail: 'uses ' + use.api + ' outside an allowed adapter path',
    specifier: '',
    api: use.api,
  };
}

function findSourceFile(
  projects: readonly { program: { getSourceFile: (file: string) => SourceFile | undefined } }[],
  absolute: string,
): SourceFile | undefined {
  for (const project of projects) {
    const source = project.program.getSourceFile(absolute);
    if (source !== undefined) return source;
  }
  return undefined;
}

function detectCycles(
  records: SourceFileRecord[],
  edges: Map<string, { target: string; line: number; specifier: string }[]>,
): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  const state = new Map<string, number>();
  const stack: string[] = [];
  const reported = new Set<string>();
  const byPath = new Map(records.map((record) => [record.absolute, record]));
  const visitFile = (absolute: string): void => {
    state.set(absolute, 1);
    stack.push(absolute);
    for (const edge of edges.get(absolute) ?? []) {
      const next = byPath.get(edge.target);
      if (next === undefined) continue;
      const nextState = state.get(edge.target) ?? 0;
      if (nextState === 1) {
        const start = stack.indexOf(edge.target);
        const cycle = stack.slice(start);
        const key = [...cycle].sort().join('>');
        if (!reported.has(key)) {
          reported.add(key);
          const record = byPath.get(cycle[0] ?? absolute);
          const closer = byPath.get(stack[stack.length - 1] ?? absolute);
          findings.push({
            category: 'cycle',
            module: closer?.module.name ?? record?.module.name ?? '',
            file: closer?.relative ?? '',
            line: edge.line,
            detail:
              'import cycle: ' +
              cycle.map((item) => byPath.get(item)?.relative ?? item).join(' -> '),
            specifier: edge.specifier,
            api: '',
          });
        }
      } else if (nextState === 0) {
        visitFile(edge.target);
      }
    }
    stack.pop();
    state.set(absolute, 2);
  };
  for (const record of records) {
    if ((state.get(record.absolute) ?? 0) === 0) visitFile(record.absolute);
  }
  return findings;
}

function policyErrors(policy: Policy, modules: ModuleRecord[]): ArchitectureFinding[] {
  const findings: ArchitectureFinding[] = [];
  const names = new Set(modules.map((module) => module.name));
  const wholeTargets = new Set<string>();
  for (const module of modules) {
    wholeTargets.add(module.rootRelative);
    if (module.packageName !== undefined) wholeTargets.add(module.packageName);
  }
  const exceptionFindings = (index: number, detail: string): ArchitectureFinding[] => [
    {
      category: 'policy-error',
      module: policy.exceptions?.[index]?.module ?? '',
      file: '',
      line: 0,
      detail: 'exception ' + index + ': ' + detail,
      specifier: '',
      api: '',
    },
  ];
  const exceptions = policy.exceptions ?? [];
  for (let index = 0; index < exceptions.length; index += 1) {
    const exception = exceptions[index];
    if (exception === undefined) continue;
    if (!names.has(exception.module))
      findings.push(...exceptionFindings(index, 'unknown module ' + exception.module));
    if (exception.removal === undefined)
      findings.push(...exceptionFindings(index, 'missing removal task'));
    if (exception.specifier === undefined && exception.path === undefined) {
      findings.push(...exceptionFindings(index, 'names no specific import edge or path'));
      continue;
    }
    for (const target of [exception.specifier, exception.path]) {
      if (target === undefined) continue;
      if (target === '*' || target === '**' || wholeTargets.has(target)) {
        findings.push(...exceptionFindings(index, 'ignores a whole module or package: ' + target));
      }
    }
  }
  const providers = new Map<string, string[]>();
  for (const module of modules) {
    for (const capability of module.provides) {
      providers.set(capability, [...(providers.get(capability) ?? []), module.name]);
    }
  }
  for (const [capability, ownerNames] of providers) {
    if (ownerNames.length < 2) continue;
    findings.push({
      category: 'duplicate-capability',
      module: ownerNames[1] ?? '',
      file: '',
      line: 0,
      detail: capability + ' is provided by ' + ownerNames.join(', '),
      specifier: '',
      api: '',
    });
  }
  return findings;
}

function applyExceptions(
  findings: ArchitectureFinding[],
  policy: Policy,
): { findings: ArchitectureFinding[]; exceptions: string[]; notes: string[] } {
  const exceptions = policy.exceptions ?? [];
  const kept: ArchitectureFinding[] = [];
  const granted: string[] = [];
  const matched = new Set<number>();
  const matches = (exception: PolicyException, finding: ArchitectureFinding): boolean => {
    if (exception.module !== finding.module) return false;
    if (exception.from !== undefined && !matchesPattern(exception.from, finding.file)) return false;
    if (exception.specifier !== undefined) {
      if (finding.specifier === '' || !matchesPattern(exception.specifier, finding.specifier))
        return false;
    }
    if (exception.path !== undefined) {
      if (finding.file === '' || !matchesPattern(exception.path, finding.file)) return false;
    }
    if (exception.apis !== undefined) {
      if (finding.api === '') return false;
      if (!exception.apis.some((api) => normalizeApi(api) === normalizeApi(finding.api)))
        return false;
    }
    return true;
  };
  for (const finding of findings) {
    let grantedBy: number | undefined;
    for (let index = 0; index < exceptions.length; index += 1) {
      const exception = exceptions[index];
      if (exception === undefined || !matches(exception, finding)) continue;
      grantedBy = index;
      break;
    }
    if (grantedBy === undefined) {
      kept.push(finding);
      continue;
    }
    matched.add(grantedBy);
    const exception = exceptions[grantedBy];
    granted.push(
      'granted ' +
        finding.file +
        ':' +
        finding.line +
        ' [' +
        finding.module +
        '] ' +
        (finding.specifier === '' ? finding.api : finding.specifier) +
        ' (reason: ' +
        (exception?.reason ?? 'unspecified') +
        '; removal: ' +
        (exception?.removal ?? 'unspecified') +
        ')',
    );
  }
  const notes: string[] = [];
  for (let index = 0; index < exceptions.length; index += 1) {
    if (matched.has(index)) continue;
    const exception = exceptions[index];
    if (exception === undefined) continue;
    notes.push(
      'unused migration exception ' +
        index +
        ' for ' +
        exception.module +
        ' (removal: ' +
        (exception.removal ?? 'unspecified') +
        ')',
    );
  }
  return { findings: kept, exceptions: granted, notes };
}

export function checkArchitecture(options: { root: string }): ArchitectureReport {
  const root = resolve(options.root);
  const policy = readPolicy(join(root, 'architecture.json'));
  const modules = buildModules(root, policy);
  const records = collectSourceFiles(modules);
  const findings: ArchitectureFinding[] = policyErrors(policy, modules);
  const notes: string[] = [];
  const unexcepted: ArchitectureFinding[] = [];
  const edgesByFile = new Map<string, { target: string; line: number; specifier: string }[]>();
  let allowedSystemUses = 0;

  if (records.length > 0) {
    const api = new API();
    try {
      const snapshot = api.updateSnapshot({ openFiles: records.map((record) => record.absolute) });
      const projects = snapshot.getProjects();
      let unresolved = 0;
      const unresolvedImports: string[] = [];
      let dynamic = 0;
      let virtual = 0;
      for (const record of records) {
        const source = findSourceFile(projects, record.absolute);
        if (source === undefined) {
          notes.push('not parsed: ' + record.relative);
          continue;
        }
        const analysis = analyzeFile(source, policy);
        for (const use of analysis.systemUses) {
          if (allowedSystemUse(record, use.api)) {
            allowedSystemUses += 1;
            continue;
          }
          unexcepted.push(systemFinding(record, use));
        }
        for (const edge of analysis.edges) {
          const classification = classifyEdge(edge, record, modules, policy);
          if (classification.category !== undefined) {
            unexcepted.push(importFinding(record, edge, classification));
          } else if (classification.unanalyzed === 'dynamic') {
            dynamic += 1;
          } else if (classification.unanalyzed === 'unresolved') {
            unresolved += 1;
            unresolvedImports.push(record.relative + ':' + edge.line + ' ' + edge.specifier);
          } else if (classification.unanalyzed === 'virtual') {
            virtual += 1;
          }
          if (classification.target !== undefined) {
            const existing = edgesByFile.get(record.absolute) ?? [];
            existing.push({
              target: classification.target,
              line: edge.line,
              specifier: edge.specifier,
            });
            edgesByFile.set(record.absolute, existing);
          }
        }
      }
      snapshot.dispose();
      if (unresolved > 0) notes.push('unresolved relative imports: ' + unresolved);
      for (const unresolvedImport of unresolvedImports.slice(0, 5)) {
        notes.push('unresolved relative import ' + unresolvedImport);
      }
      if (dynamic > 0) notes.push('dynamic imports without a literal specifier: ' + dynamic);
      if (virtual > 0) notes.push('url-style imports resolved by another tool: ' + virtual);
      unexcepted.push(...detectCycles(records, edgesByFile));
    } finally {
      api.close();
    }
  }

  const applied = applyExceptions(unexcepted, policy);
  findings.push(...applied.findings);
  findings.sort((left, right) =>
    left.file === right.file
      ? left.line === right.line
        ? left.category < right.category
          ? -1
          : 1
        : left.line - right.line
      : left.file < right.file
        ? -1
        : 1,
  );
  if (allowedSystemUses > 0) notes.push('allowed adapter system uses: ' + allowedSystemUses);
  return {
    root,
    moduleNames: modules.map((module) => module.name),
    fileCount: records.length,
    findings,
    exceptions: applied.exceptions,
    notes: [...notes, ...applied.notes],
  };
}

export function formatReport(report: ArchitectureReport): string {
  const lines: string[] = [
    'architecture: ' +
      report.root +
      ' - ' +
      report.moduleNames.length +
      ' modules, ' +
      report.fileCount +
      ' files, ' +
      report.findings.length +
      ' findings, ' +
      report.exceptions.length +
      ' granted exceptions',
  ];
  for (const finding of report.findings) {
    lines.push(
      finding.category +
        ' ' +
        (finding.file === '' ? '-' : finding.file + ':' + finding.line) +
        ' [' +
        finding.module +
        '] ' +
        finding.detail +
        (finding.specifier === '' ? '' : ' (specifier ' + finding.specifier + ')'),
    );
  }
  for (const exception of report.exceptions) lines.push('exception ' + exception);
  for (const note of report.notes) lines.push('note ' + note);
  return lines.join('\n') + '\n';
}

function main(): void {
  const args = process.argv.slice(2);
  let root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--root') {
      const value = args[index + 1];
      if (value === undefined) {
        process.stderr.write('usage: node scripts/check-architecture.ts [--root <directory>]\n');
        process.exit(2);
      }
      root = resolve(value);
      index += 1;
      continue;
    }
    process.stderr.write('unknown argument: ' + args[index] + '\n');
    process.exit(2);
  }
  try {
    const report = checkArchitecture({ root });
    process.stdout.write(formatReport(report));
    process.exit(report.findings.length > 0 ? 1 : 0);
  } catch (error) {
    process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
    process.exit(2);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main();
