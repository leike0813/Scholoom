import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const source = join(root, 'native', 'process-scope.c');
const output = join(
  root,
  'dist',
  process.platform === 'win32' ? 'process-scope.exe' : 'process-scope',
);
mkdirSync(dirname(output), { recursive: true });
if (process.platform === 'win32') {
  const temporary = mkdtempSync(join(tmpdir(), 'scholoom-scope-build-'));
  try {
    const locator = join(
      process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
      'Microsoft Visual Studio',
      'Installer',
      'vswhere.exe',
    );
    const installation = execFileSync(
      locator,
      [
        '-latest',
        '-products',
        '*',
        '-requires',
        'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
        '-property',
        'installationPath',
      ],
      { encoding: 'utf8' },
    ).trim();
    if (!installation)
      throw new Error('The platform process supervisor requires Visual C++ build tools.');
    const architecture = process.arch === 'arm64' ? 'amd64_arm64' : 'x64';
    const batch = join(temporary, 'compile.cmd');
    const compile = (name, nativeSource, nativeOutput, libraries = '') =>
      `cl /nologo /O2 /W4 /WX /Fe:"${nativeOutput}" /Fo:"${join(temporary, `${name}.obj`)}" "${nativeSource}" ${libraries}\r\nif errorlevel 1 exit /b %errorlevel%\r\n`;
    writeFileSync(
      batch,
      `@echo off\r\ncall "${join(installation, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat')}" ${architecture} >nul\r\nif errorlevel 1 exit /b %errorlevel%\r\n${compile('scope', source, output)}${compile('private-resource-tree', join(root, 'native', 'private-resource-tree.c'), join(root, 'dist', 'private-resource-tree.exe'), 'advapi32.lib')}`,
    );
    execFileSync(process.env.COMSPEC ?? 'cmd.exe', ['/d', '/c', batch], { stdio: 'inherit' });
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
} else if (process.platform === 'linux' || process.platform === 'darwin') {
  execFileSync(
    process.env.CC ?? 'cc',
    ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror', source, '-o', output],
    { stdio: 'inherit' },
  );
} else {
  throw new Error(`The platform process supervisor does not support ${process.platform}.`);
}

if (process.platform === 'linux' && process.arch === 'x64') {
  const cache = process.env.TMPDIR ?? tmpdir();
  mkdirSync(cache, { recursive: true });
  const scriptModified = statSync(fileURLToPath(import.meta.url)).mtimeMs;
  for (const name of ['isolated-report-scope', 'isolated-report-gate']) {
    const nativeSource = join(root, 'native', `${name}.c`);
    const nativeOutput = join(root, 'dist', name);
    if (
      existsSync(nativeOutput) &&
      statSync(nativeOutput).mtimeMs >= Math.max(statSync(nativeSource).mtimeMs, scriptModified)
    )
      continue;
    const flags = ['-std=c11', '-O2', '-Wall', '-Wextra', '-Werror'];
    if (name === 'isolated-report-gate') {
      flags.push(
        '-nostdlib',
        '-static',
        '-fno-stack-protector',
        '-fno-builtin',
        '-fno-pie',
        '-no-pie',
        '-Wl,-e,_start',
      );
    }
    execFileSync(process.env.CC ?? 'cc', [...flags, nativeSource, '-o', nativeOutput], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TMPDIR: cache,
        XDG_CACHE_HOME: cache,
        CCACHE_DIR: join(cache, 'ccache'),
      },
    });
    chmodSync(nativeOutput, 0o755);
  }
}
