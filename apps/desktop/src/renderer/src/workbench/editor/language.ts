import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { yaml } from '@codemirror/lang-yaml';
import { StreamLanguage } from '@codemirror/language';
import { r } from '@codemirror/legacy-modes/mode/r';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import type { Extension } from '@codemirror/state';

export function languageForPath(path: string): { label: string; extension?: Extension } {
  const extension = path.split('.').pop()?.toLowerCase() ?? '';
  if (extension === 'md' || extension === 'markdown' || extension === 'qmd')
    return { label: 'Markdown', extension: markdown() };
  if (extension === 'tex' || extension === 'bib' || extension === 'stex')
    return {
      label: extension === 'bib' ? 'BibTeX' : 'LaTeX',
      extension: StreamLanguage.define(stex),
    };
  if (extension === 'py') return { label: 'Python', extension: python() };
  if (extension === 'r') return { label: 'R', extension: StreamLanguage.define(r) };
  if (extension === 'js' || extension === 'jsx' || extension === 'ts' || extension === 'tsx')
    return {
      label: extension.toUpperCase(),
      extension: javascript({
        jsx: extension.endsWith('x'),
        typescript: extension.startsWith('t'),
      }),
    };
  if (extension === 'json') return { label: 'JSON', extension: json() };
  if (extension === 'yaml' || extension === 'yml') return { label: 'YAML', extension: yaml() };
  return { label: '纯文本' };
}
