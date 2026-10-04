# 14 文档处理 Worker（document-worker）

`document-worker/` 是 Zotero 主仓库的 Git 子模块（`.gitmodules` 里的历史名是 `pdf-worker`），负责 PDF 标注处理、PDF 文本提取与渲染，以及从 PDF、EPUB 和 HTML 快照中抽取结构化文本。本文基于子模块自身的知识图谱（76 个文件节点、395 节点、856 边、9 个分层）撰写，调研时子模块 commit 为 `9d114713`。

**这份子模块在旧版调研中是完全的空白**——它当时是空目录，描述只能从主仓调用侧反推。现在可以给出内部实现了。

## 一、三个宿主的同一份代码

源码以 ESM 在 Node.js 中运行，生产构建产出**单个 Web Worker bundle**，同时被 Zotero 桌面端与 iOS 的 JavaScriptCore/JSContext 复用。

`src/pdf/render-runtime.js` 是双运行时适配的核心：决定渲染时用真实的 canvas 与 document，还是在 Node.js 下动态加载 canvas、fs、os、path 并用最小 DOM 垫片满足 pdf.js 的接口要求。`src/pdf/pdfjs-polyfills.js` 补齐宿主缺失的运行时 API，例如 `Promise.try`、`Math.sumPrecise` 以及 `Uint8Array` 上的 `toHex` / `toBase64` / `fromBase64` / `toBinary`。

**项目里那些看起来多余的 shim，答案都在这两个文件。**

## 二、入口与版本契约

`src/index.js` 是唯一的对外入口，按 `contentType` 把任务分派给 PDF、EPUB、HTML 快照三条管线，把结构化文本打包压缩后回传；在 Web Worker 环境下它还注册了基于 `postMessage` 的 RPC 协议，处理 `pdf.*` 系列指令。

`src/versions.js` 与 `src/versions.d.ts` 是版本契约：schema 版本、打包版本以及各处理器（pdf / epub / snapshot）的输出版本号，供宿主判断缓存产物是否需要重新生成。主仓的 `xpcom/sdt.js` 按源文件哈希缓存抽取结果，正是靠这个版本号判断缓存是否失效。

主仓的调用侧是 `xpcom/pdfWorker/manager.js`（`Zotero.PDFWorker`）：启动 worker、用消息队列**串行**调度任务，提供导入导出 PDF、页操作、全文提取、批注处理。

## 三、PDF 能力门面

`src/pdf/index.js` 扇出 39，是全库扇出第二高的节点。它不直接解析 PDF，而是自建 dataProvider 桥接 pdf.js 的 worker，把下列能力收拢到同一组函数上：

- 标注读写与导入（含从既有批注去重匹配、剔除已迁移项）
- 页面删改旋转
- 全文与结构抽取
- 外部标注格式导入（Citavi、Mendeley）
- 标注渲染

几乎所有 PDF 子系统都从它这里取能力，读完这个文件就知道后续每个 PDF 子模块在能力地图上的位置。

## 四、Annotation 模型与读写

这一组文件把 PDF 原生的 `/Annots` 字典与 Zotero 的 annotation 对象互相翻译：

| 文件 | 职责 |
| --- | --- |
| `read.js` | 覆盖 highlight、underline、note、image、ink、text 六种类型，把 QuadPoints 与 Rect 归一化到页面坐标系 |
| `write.js` | 反向路径：生成 highlight/underline 的 quadPoints、note 的图标矩形、ink 路径，以及 FreeText 文本所需的字体嵌入 |
| `delete.js` | 导入前从 `/Annots` 数组中剔除已迁移的 annotation 及其 `/Popup`，避免重复导入 |
| `common.js` | 页面视图交集、PDF 字符串取值、唯一 ID 提取等公共工具 |

`importAnnotations` 是完整流程：解析原 PDF 标注 → 与已有标注去重匹配 → 剔除已迁移项 → 写回生成新 buffer。

## 五、PDF 底层原语

标注与抽取最终都要落到 PDF 字节上：

- `pdfassembler.js`（`PDFAssembler` 类，683 行文件中类体占 146–683）遍历解析后的对象树、重新编号并序列化对象，管理对象 ID 分配、间接引用解析、页树扁平化与分组、xref 与 trailer 生成，最终产出 ArrayBuffer。**这是写回修改的唯一落盘环节。**
- `text.js` 基于逐字符矩形做几何计算，把高亮区域或选区起止偏移还原为文本范围与矩形列表。
- `renderer.js` 把页面坐标经 viewport 变换到像素坐标，以 4 倍缩放绘制标注与高亮并导出 PNG 预览图。
- `font-embedder.js` 负责 FreeText 注释所需的内置 TTF 字体子集嵌入（jsPDF 移植的 `TTFFont`）。

## 六、结构化抽取流水线

`src/pdf/structure/structure.js`（扇出 25）是全库扇出最高的**单个功能文件**，串起 ONNX block-seg 推理、目录与图表公式参考文献识别、页码标注和引用回填，最终产出文档结构树。围绕它：

- `structure-index.js`（`StructureIndex` 类）建立按 block ref 与包围盒的空间索引，为高频查找提供 O(1) 访问，是跨模块引用/链接解析的统一查询接口。
- `flow-policy.js` 把 block 归一为 body / auxiliary / excluded 三类，是 flow class 的**单一事实源**。
- `block-cleanup.js` 补齐度量并把被页眉页脚打断的段落与列表项重新串联。
- `list-relations.js` 的 `getListItemContinuationRelation` 判定后一个 block 是否为前一个列表项的换行续写，依据缩进导轨、行末未完形态与跨页许可综合判定。
- 其余：`contents.js`（目录）、`figure.js`（图表）、`math.js`（公式）、`link.js`、`page-furniture.js`（页眉页脚）、`page-label.js`（页码）、`footnote-refs.js`、`apply-refs.js`、`post-process.js`。

大纲与文献两处启发式规则值得单列：

- `outline/outline.js` 把 PDF 原生书签与抽取出的标题块、目录页条目指纹**合并**，推断标题层级与父子关系。
- `citations.js` 在 block 文本上扫描上标数字、括号引用、年份、作者姓名、图表编号与 URL 等引用形态。
- `reference/reference.js` 先按年份与文献特征证据筛出参考文献候选列表，再合并被非正文 block 打断的续接列表；`reference/source-identifiers.js` 判定引用指向的来源标识。

三者共同支撑正文与文献表的对齐。

## 七、block-seg 的 ONNX 推理层

结构化抽取能判断块类型和阅读流向，靠的是这一层机器学习：

- `features.js` 为块分类器构造特征张量，包含块与行的几何统计、字体特征、文本哈希槽和类别直方图，输出 regular/rich 浮点特征与 hash/char 整数槽。
- `classifier/runtime.js` 加载 `model.onnx` 与 `stats.bin` 归一化统计量，按 `maxBlocks` 分批切片并输出块类型与流向预测。
- `clusterer/runtime.js` 加载聚类模型、repair 模型与 CRF 转移矩阵，用 **Viterbi 解码**行标签并修补相邻不一致的 gap。
- `manifest.json` 为 7 个模型资产登记字节数与 sha256。
- `mutex.js` 把 ONNX WASM 运行时的初始化**串行化**。

## 八、EPUB 与 HTML 快照

非 PDF 文档走另一条管线，但产出的结构与 PDF 侧共用同一套 schema。

- `dom/epub/index.ts` 是编排入口（`buildEpubStructure`）：解包 → 解析 OPF 与目录 → 逐章节转换 → 汇总 ID 与链接 → 解析交叉引用和页码映射 → 组装成符合 schema 的结构化文档。
- `dom/epub/zip.ts` 基于 fflate **只解压文本类条目**，省下图片与字体的内存开销。
- `dom/epub/opf.ts` 解析元数据、manifest、spine 顺序与目录路径；`cfi.ts`、`toc.ts`、`cross-references.ts`、`page-mapping.ts` 各自负责一类结构。
- `dom/epub/epub-xhtml-to-blocks.ts` 为通用转换器注入 CFI 锚点、ID 表、链接记录等 EPUB 专用 hooks。
- `dom/snapshot/index.ts`（`buildSnapshotStructure`）处理 HTML 快照：解码 → Readability 过滤正文 → 构建 DOM 索引 → 注入 selector/文本流锚点 hook → 执行块转换 → 组装。
- `dom/html-to-blocks.ts` 是两条路径**共享**的 HTML/XHTML 到块级结构的转换器（扇出 20），**以 hooks 的形式把格式差异外置**。

## 九、构建与开发预览

`package.json` 是构建与测试矩阵的事实源：`build` 串联 webpack 生产构建与资源生成脚本；`test` 链按 typecheck → build → pdf/dom/node/jscontext 运行时测试**逐层展开**。运行时依赖（fflate、htmlparser2、pako）与构建期依赖（onnxruntime-web、esbuild）被明确分开。

`webpack.config.cjs` 的关键约束是 `dynamicImportMode: eager`——**Zotero 只分发一个 JS worker 文件，所有动态 import 必须被打包器内联**。产物格式是 UMD、target `webworker`，关闭压缩，只清理旧的 js 产物。

`preview/index.html` 配合 `vite.config.js` 提供开发预览：左侧渲染 PDF、右侧渲染 block 结构并叠加高亮，用来**人工核对 block-seg 的分类与聚类结果**。这类需要肉眼判断的 ML 环节，预览页是必要的配套而非附属品。

CI 在 push 与 pull_request 上以 Node 24 执行 `npm ci` 与 `npm run test`，master/hotfix 推送时把 build 产物打包上传 S3 供 Zotero 客户端下载。

## 十、给 Scholoom 的启示

1. **格式差异用 hooks 外置，而不是用继承多态**。EPUB 与快照两条管线共用 `html-to-blocks.ts`，各自注入锚点与过滤逻辑。新增格式只需写 hooks，不必继承或复制转换器主体。
2. **版本号是缓存正确性的前提**。`versions.js` 声明各处理器输出版本，宿主据此判断缓存是否失效。产物要落盘缓存的子系统，版本契约必须由产出方声明而不是由消费方猜测。
3. **单文件分发倒逼打包约束**。Zotero 只分发一个 worker 文件，于是 webpack 必须 eager 内联所有动态 import。这个约束向上传导到源码写法，越早写进构建配置越省事。
4. **shim 要集中并写明原因**。`render-runtime.js` 与 `pdfjs-polyfills.js` 把三宿主的差异收敛到两个文件，其余代码保持干净。散落的 polyfill 补丁最终会失控。
5. **ML 结果需要人工核对通道**。`preview/` 的左右对照页把不可解释的分类结果变成可肉眼检查的东西。

## 来源

- `~/Workspace/Code/JavaScript/zotero/.ua/document-worker-knowledge-graph.json`（395 节点 / 856 边 / 9 层 / 10 步导览，子模块 commit `9d114713`）
- `.ua/wiki/layers/document-worker-*.md`（9 个分层页）、`.ua/wiki/modules/document-worker/**`（16 个目录页）、`.ua/wiki/files/document-worker/**`（84 个文件页）
- `.ua/wiki/symbols/document-worker/`（58 个复杂符号页，含 `StructureIndex`、`PDFAssembler`、`buildEpubStructure` 等）
- 主仓对接侧：`xpcom/pdfWorker/manager.js`、`xpcom/sdt.js`、`js-build/document-worker.js` 的文件页摘要
