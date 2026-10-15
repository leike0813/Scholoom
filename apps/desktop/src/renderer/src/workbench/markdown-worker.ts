import { type PreviewRequest, type PreviewResponse, renderMarkdown } from './markdown-render';

// DOM 的 self 没有 worker 的 postMessage 重载，这里显式声明用到的两个方法。
const worker = self as unknown as {
  onmessage: ((event: MessageEvent<PreviewRequest>) => void) | null;
  postMessage: (message: PreviewResponse) => void;
};

worker.onmessage = (event) => {
  const { id, content } = event.data;
  void renderMarkdown(content).then(
    (tree) => worker.postMessage({ id, tree }),
    (error: unknown) =>
      worker.postMessage({ id, error: error instanceof Error ? error.message : '预览渲染失败' }),
  );
};
