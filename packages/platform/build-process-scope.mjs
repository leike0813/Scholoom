import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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
    writeFileSync(
      batch,
      `@echo off\r\ncall "${join(installation, 'VC', 'Auxiliary', 'Build', 'vcvarsall.bat')}" ${architecture} >nul\r\nif errorlevel 1 exit /b %errorlevel%\r\ncl /nologo /O2 /W4 /WX /Fe:"${output}" /Fo:"${join(temporary, 'scope.obj')}" "${source}"\r\n`,
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
