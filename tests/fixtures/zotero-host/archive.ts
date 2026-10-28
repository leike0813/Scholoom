import { execFileSync } from 'node:child_process';

/** Unpacks a trusted original release into a new isolated test directory. */
export function unpackPlugin(archive: string, directory: string) {
  if (process.platform === 'win32') {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:SCHOOLOOM_XPI_ARCHIVE,$env:SCHOOLOOM_XPI_DIRECTORY)',
      ],
      {
        env: { ...process.env, SCHOOLOOM_XPI_ARCHIVE: archive, SCHOOLOOM_XPI_DIRECTORY: directory },
        timeout: 30_000,
      },
    );
  } else {
    execFileSync('unzip', ['-q', archive, '-d', directory]);
  }
}

export function readPluginMember(archive: string, member: string): Buffer {
  if (process.platform !== 'win32')
    return execFileSync('unzip', ['-p', archive, member], { maxBuffer: 20 * 1024 * 1024 });
  return execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip=[System.IO.Compression.ZipFile]::OpenRead($env:SCHOOLOOM_XPI_ARCHIVE); try { $entry=$zip.GetEntry($env:SCHOOLOOM_XPI_MEMBER); if (!$entry) { throw "Missing archive member" }; $stream=$entry.Open(); try { $stream.CopyTo([Console]::OpenStandardOutput()) } finally { $stream.Dispose() } } finally { $zip.Dispose() }',
    ],
    {
      env: { ...process.env, SCHOOLOOM_XPI_ARCHIVE: archive, SCHOOLOOM_XPI_MEMBER: member },
      timeout: 30_000,
      maxBuffer: 20 * 1024 * 1024,
    },
  );
}
