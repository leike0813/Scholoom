import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';
import { promisify } from 'node:util';

export async function executable(name: string): Promise<string | undefined> {
  for (const directory of [
    join(homedir(), '.local/bin'),
    ...(process.env.PATH ?? '').split(delimiter),
  ]) {
    const path = join(directory, process.platform === 'win32' ? `${name}.exe` : name);
    try {
      await access(path);
      return path;
    } catch {}
  }
  return undefined;
}

const wheelBuilder = String.raw`import base64,csv,hashlib,io,pathlib,sys,zipfile
path=pathlib.Path(sys.argv[1]); path.parent.mkdir(parents=True,exist_ok=True)
info='scholoom_env_fixture-1.0.0.dist-info/'
files={
    'scholoom_env_fixture/__init__.py':('VALUE = '+sys.argv[2]+'\n').encode(),
    info+'METADATA':b'Metadata-Version: 2.1\nName: scholoom-env-fixture\nVersion: 1.0.0\n',
    info+'WHEEL':b'Wheel-Version: 1.0\nGenerator: Scholoom fixture\nRoot-Is-Purelib: true\nTag: py3-none-any\n',
}
record=io.StringIO(); writer=csv.writer(record)
for name,data in files.items(): writer.writerow([name,'sha256='+base64.urlsafe_b64encode(hashlib.sha256(data).digest()).rstrip(b'=').decode(),len(data)])
writer.writerow([info+'RECORD','','']); files[info+'RECORD']=record.getvalue().encode()
with zipfile.ZipFile(path,'w') as archive:
    for name,data in files.items(): archive.writestr(name,data)
`;

export async function writeWheel(python: string, path: string, value = 42) {
  await promisify(execFile)(python, ['-I', '-c', wheelBuilder, path, String(value)], { env: {} });
}

export async function localWheelProject(f: { tools: { python: string }; project: string }) {
  const wheel = 'wheels/scholoom_env_fixture-1.0.0-py3-none-any.whl';
  const path = join(f.project, wheel);
  await writeWheel(f.tools.python, path);
  const hash = `sha256:${createHash('sha256')
    .update(await readFile(path))
    .digest('hex')}`;
  const pyproject = `[project]
name = "env-project"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = ["scholoom-env-fixture==1.0.0"]
[tool.uv.sources]
scholoom-env-fixture = { path = "${wheel}" }
`;
  const lock = `version = 1
revision = 3
requires-python = ">=3.11"
[[package]]
name = "env-project"
version = "0.1.0"
source = { virtual = "." }
dependencies = [{ name = "scholoom-env-fixture" }]
[package.metadata]
requires-dist = [{ name = "scholoom-env-fixture", path = "${wheel}" }]
[[package]]
name = "scholoom-env-fixture"
version = "1.0.0"
source = { path = "${wheel}" }
wheels = [{ filename = "scholoom_env_fixture-1.0.0-py3-none-any.whl", hash = "${hash}" }]
`;
  await writeFile(join(f.project, 'pyproject.toml'), pyproject);
  await writeFile(join(f.project, 'uv.lock'), lock);
  return { path, wheel, hash, pyproject, lock };
}
