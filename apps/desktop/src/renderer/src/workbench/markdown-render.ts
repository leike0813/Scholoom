import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

/** 预览展示树：只保留渲染需要的字段，可直接结构化克隆。 */
export interface PreviewNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: PreviewNode[];
}

export interface PreviewRequest {
  id: number;
  content: string;
}

export type PreviewResponse = { id: number; tree: PreviewNode } | { id: number; error: string };

/** 标题锚点：与 GitHub 风格接近的 slug，重复标题按出现顺序加序号。 */
function headingId(text: string, seen: Map<string, number>): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/\s+/gu, '-')
      .replace(/[^\p{L}\p{N}-]+/gu, '') || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

function textOf(node: PreviewNode): string {
  if (node.type === 'text') return node.value ?? '';
  return (node.children ?? []).map(textOf).join('');
}

/** 原始 HTML 只作为可见文本保留，绝不进入 HTML 渲染通道。 */
function prepare(node: PreviewNode, seen: Map<string, number>): PreviewNode {
  if (node.type === 'raw') return { type: 'text', value: node.value ?? '' };
  if (node.children) node.children = node.children.map((child) => prepare(child, seen));
  if (node.type === 'element' && /^h[1-6]$/.test(node.tagName ?? '')) {
    node.properties = { ...node.properties, id: headingId(textOf(node), seen) };
  }
  return node;
}

function headingIds() {
  return (tree: PreviewNode) => {
    prepare(tree, new Map());
  };
}

const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  // allowDangerousHtml 只是保留 raw 节点，headingIds 紧接着转成文本；没有 rehype-raw。
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(headingIds)
  .use(rehypeKatex, { trust: false, maxExpand: 1000 });

export async function renderMarkdown(content: string): Promise<PreviewNode> {
  const tree = await pipeline.run(pipeline.parse(content));
  return tree as unknown as PreviewNode;
}
