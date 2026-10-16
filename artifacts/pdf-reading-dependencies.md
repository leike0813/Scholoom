# P4b PDF 阅读依赖授权项

状态：已获授权，执行中。用户已明确回复“批准，继续吧”，并要求完成当前 change 后停止。对应变更 `openspec/changes/establish-shared-pdf-reading/`。

## 待执行的具体变更

用 `apply_patch` 修改下列清单，直接依赖精确锁为 `2.15.1`：

| 文件 | 新增包 | 用途 |
| --- | --- | --- |
| `apps/desktop/package.json` | `@embedpdf/react-pdf-viewer`、`@embedpdf/pdfium`、`@embedpdf/models` | 成熟 React 阅读器、本地 WASM 资源、SDK 类型及坐标适配 |
| `apps/kernel/package.json` | `@embedpdf/engines`、`@embedpdf/pdfium`、`@embedpdf/models` | 无窗口按页取文，放在 Node Worker 中执行 |
| `pnpm-workspace.yaml` | `autoInstallPeers: false` | 避免多框架发布包自动带入未使用的 Vue／Svelte；既有 React、snippet 正常依赖的 Preact 及实际使用插件须满足 |
| `pnpm-lock.yaml` | 由 `pnpm install --ignore-scripts` 更新 | 解析并安装上述直接／传递依赖，保持现有包版本，无必要不运行安装脚本 |

去重后是五个直接包名，不增加 sharp、canvas、原生编译器或云端 PDF 服务。`@embedpdf/react-pdf-viewer` 正常依赖 `@embedpdf/snippet@2.15.1`，后者包含成熟工具栏、约30个插件、Preact 和 tailwind-merge。安装完成核对锁文件差异及真实 import，不靠忽略警告隐藏缺失的运行依赖。若现有锁文件因 peer 策略发生非必要版本变化，保留原版本并修正后再实施，不无关升级。

2026-10-16 按 npm 元数据递归核对：EmbedPDF 直接及传递包合计约40个，解包约176.4 MiB，其中七组 OFL 字体约150.1 MiB；这是包的解包大小，不是下载量或最终安装包大小。WASM 本体约4.43 MiB。需要将 PDFium WASM 和使用的后备字体加入本地构建资源，浏览器与 Electron 共享加载配置，禁用默认 Google Fonts／jsDelivr 请求；不把包从 npm 下载下来等同于离线打包已验收。

SDK 包声明 MIT，PDFium fork 声明 Apache-2.0，后备字体声明 OFL-1.1；实施时按实际发布文件补第三方许可说明。

## 已完成的只读实验

没有安装工作区依赖、改写清单或锁文件。仅在 `/tmp` 解包 npm 发布产物，Node v24.12.0 中运行：

```js
const wrapped = await init({ wasmBinary: localWasmBytes });
const pointer = wrapped.pdfium.wasmExports.malloc(pdfBytes.length);
wrapped.pdfium.HEAPU8.set(pdfBytes, pointer);
const doc = wrapped.FPDF_LoadMemDocument(pointer, pdfBytes.length, '');
// FPDFText_LoadPage / FPDFText_GetText 后逐项关闭和释放。
```

输入：一页自行生成的 PDF 1.4，独立预期为 `Scholoom PDF evidence 42`。

实际结果：`typeof window` 为 `undefined`，页数1，提取文字与预期完全一致。证据 `/tmp/scholoom-pdf-engine-probe.json`。SDK 高层 adapter、Worker、中文／旋转坐标、UI 和资源打包尚未验证，列入变更验收。

## 阻塞来源与继续路径

用户提供的 AGENTS.md「需事先授权的操作」规定依赖安装需要明确授权；本清单已通过用户“批准，继续吧”获得授权。

按同一 OpenSpec tasks／delivery 继续实施、验证、归档并提交。用户已明确本轮止于当前变更，不进入路线图后续变更。
