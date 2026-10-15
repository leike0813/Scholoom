const SCHEME = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

function localTarget(basePath: string, value: string): string | undefined {
  try {
    const reference = decodeURIComponent(value.split(/[?#]/u, 1)[0] ?? '');
    if (
      !reference ||
      reference.startsWith('/') ||
      reference.includes('\\') ||
      SCHEME.test(reference)
    )
      return undefined;
    return projectPath(basePath, reference);
  } catch {
    return undefined;
  }
}

/** 把文档相对路径归一为项目相对路径；越出项目根目录时拒绝。 */
export function projectPath(basePath: string, reference: string): string | undefined {
  const segments = [...basePath.split('/').slice(0, -1), ...reference.split('/')];
  const path: string[] = [];
  for (const segment of segments) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (!path.length) return undefined;
      path.pop();
      continue;
    }
    path.push(segment);
  }
  return path.length ? path.join('/') : undefined;
}

export type AssetTarget =
  | { kind: 'local'; path: string }
  | { kind: 'remote' }
  | { kind: 'invalid' };

/** 图片只接受项目内相对路径：远端、绝对路径和 file/data 等协议统一拒绝。 */
export function assetTarget(basePath: string, source: string): AssetTarget {
  const value = source.trim();
  if (!value) return { kind: 'invalid' };
  if (value.startsWith('//') || /^https?:/i.test(value)) return { kind: 'remote' };
  if (value.startsWith('/') || SCHEME.test(value)) return { kind: 'invalid' };
  const path = localTarget(basePath, value);
  return path ? { kind: 'local', path } : { kind: 'invalid' };
}

export type LinkTarget =
  | { kind: 'anchor'; id: string }
  | { kind: 'file'; path: string }
  | { kind: 'external'; url: string };

/** 相对链接交给文件入口，http/https/mailto 只在点击后交给外部打开；其余协议不处理。 */
export function linkTarget(basePath: string, href: string): LinkTarget | undefined {
  const value = href.trim();
  if (value.startsWith('#')) {
    try {
      return value.length > 1
        ? { kind: 'anchor', id: decodeURIComponent(value.slice(1)) }
        : undefined;
    } catch {
      return undefined;
    }
  }
  if (/^(https?:\/\/|mailto:)/i.test(value)) return { kind: 'external', url: value };
  if (value.startsWith('/') || value.startsWith('//') || SCHEME.test(value)) return undefined;
  const path = localTarget(basePath, value);
  return path ? { kind: 'file', path } : undefined;
}
