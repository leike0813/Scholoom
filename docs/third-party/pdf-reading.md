# PDF 阅读资源

阅读器和无窗口取文固定使用 EmbedPDF 2.15.1。实际 npm 产物为 MIT；PDFium 许可见 `@embedpdf/pdfium/LICENSE.pdfium`，字体包为 OFL-1.1。构建插件 [pdf-assets.ts](../../apps/desktop/pdf-assets.ts) 将实际许可与资源一起输出，Electron 分发保留 renderer assets。

WASM 来自 `@embedpdf/pdfium/pdfium.wasm`。后备字体采用已安装的 `@embedpdf/fonts-{latin,jp,kr,sc,tc,hebrew,arabic}@1.0.0` 常规字重；内嵌字体仍由 PDF 本身提供，后备字体不能保证所有语言与原字形完全一致。UI 与签名字体外部加载关闭，未接入云 PDF 服务。

运行时按本地资源 URL 请求所需字体，开发服务只暴露明确白名单。生产构建由 Vite 输出同包资源，不依赖默认 CDN。SDK 来自 [EmbedPDF v2.15.1](https://github.com/embedpdf/embed-pdf-viewer/tree/v2.15.1)，字体原始项目为 [Noto](https://github.com/notofonts)。
