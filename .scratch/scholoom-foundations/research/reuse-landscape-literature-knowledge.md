# 文献获取、解析与混合检索复用调查

调查日期：2026-10-11（会话日期）\
范围：文献来源、Zotero 采集链、文档解析、OCR、全文与向量检索。\
方法：官方文档、上游源码和 LICENSE/模型卡静态核对；**不是运行测试**。未安装、构建、调用需凭据接口或实跑解析样本。动态限流以服务响应及当日官方文档为准。

## PRD 需求映射

| PRD 需求 | 复用候选能覆盖 | Scholoom 仍须负责 |
| --- | --- | --- |
| 线上发现、标识符检索、覆盖/部分失败 | OpenAlex、Crossref、Semantic Scholar、arXiv、PubMed、Europe PMC 提供查询入口 | 多源查询计划、归并、覆盖记录、来源和字段溯源、部分成功语义 |
| Connector 页面识别与保存到自有库 | Zotero translators + Connector 的识别/采集部分、SingleFile 快照 | 自有目标选择、权限与确认、条目/附件保存、共存、错误和重试 |
| DOI/题录/全文位置/实际附件分层 | API 题录、OA 指针与部分全文接口 | 权利判定、下载许可/站点限制、内容哈希、附件版本及不可用原因 |
| PDF/网页解析和可复用材料 | PDF.js、GROBID、Docling、MinerU、Unstructured、Tesseract.js | 原始材料不变、解析器版本、块到页/坐标定位、重解析和错误保留 |
| 题录、Digest、全文片段统一词法+语义检索 | SQLite FTS5、sqlite-vec、LanceDB、Qdrant、Orama、MiniSearch 是索引候选 | 中文分词/短词精确性、嵌入选择、融合/重排、同文献归组、证据引用与范围过滤 |

PRD 已把来源与实际全文分开；Crossref、PubMed 和 Semantic Scholar 的全文字段/链接不能当作全文许可。arXiv/PMC 内容也要按各文献具体许可处理。检索源的“OA”标签或可下载 URL 只说明发现线索，不自动授权再分发。见 [literature PRD](../../../docs/prd/literature.md) 和 [已有来源调查](academic-search-source-candidates.md)。

## 候选结论

共 21 个候选（检索源六项逐一计数；Zotero 采集链按一个复用组合计数）。

| 候选 | 判断 | 主要理由 |
| --- | --- | --- |
| Zotero translators / translate / Connector / SingleFile 组合 | 推荐采集能力复用，需切出自有保存流程 | translator 覆盖成熟；上游 browser connector 与 Zotero 协议耦合，不能整包直接嵌入 Scholoom |
| WXT | 推荐作为自有扩展构建器原型 | Vite 工作流、MV2/MV3 与多浏览器产物；不提供 Zotero 采集逻辑 |
| webextension-polyfill | 有条件备选 | 只补 browser Promise API 差异；Chrome 148 等新版本已逐步原生支持，须按目标版本核查必要性 |
| OpenAlex | 推荐首批广域发现/全文位置查询 | 领域覆盖广，API 有免费 key；用量与价格制度近期变动，必须节流缓存 |
| Crossref | 推荐 DOI 题录核对 | 免费、来源直接、礼貌池可用；复杂列表查询现行限速较严格 |
| Semantic Scholar | 推荐引用扩展，限额依真实 key 验收 | citations/references 和 OA PDF 指针有用；共享限流、许可用途边界需注意 |
| arXiv | 推荐预印本专用 | API 和全文 PDF 明确；请求限速严格，版本和分发许可须保留 |
| PubMed / E-utilities | 推荐生医题录 | 稳定标识符及批量工具；常规返回不是论文全文 |
| Europe PMC | 推荐生医全文补充 | OA 子集有 fullTextXML；许可和全文范围逐条检查 |
| GROBID | 仅借鉴/可选外部解析服务 | 学术论文结构与引文抽取强；Java 服务/资源常驻增加个人桌面运维面 |
| Docling | 推荐解析器原型候选 | Python 本地、结构化输出和表格/版面；模型权重单独许可、冷启动与包体需实测 |
| MinerU | 备选高质量复杂 PDF 原型 | OCR/公式/表格路线丰富；Python、模型/推理栈和特别许可增加成本 |
| Unstructured | 备选通用文档解析 | 多格式与 partition API；完整高质量路径可依赖额外模型/API，云端涉及付费/文档外发 |
| PDF.js text layer | 仅作 PDF 读取引擎比较候选 | 浏览器/Electron 可用、JS 生态贴合；不做学术结构理解，需检查扫描页和布局。项目已有 EmbedPDF/PDFium 读取引擎若满足文本读取与定位需求，应优先复用，避免并行引入第二套 PDF 引擎 |
| Tesseract.js | 推荐仅作按需 OCR | TypeScript/JS、Node/浏览器和 WASM；独立 OCR，语言数据包下载与性能/精度须验 |
| SQLite FTS5 | 推荐词法索引基线 | 随 SQLite 本地嵌入、无守护进程；内置 tokenizer 对中文不等于中文分词 |
| sqlite-vec | 推荐优先试验向量扩展 | 同一 SQLite 文件/SQL 接入、Node 包；项目仍处早期且多平台原生包装须验 |
| LanceDB | 备选本地向量/混合检索 | Node SDK 和 embedded 本地模式；Rust/native 包与 Electron 三平台打包风险需实测 |
| Qdrant | 不推荐作为桌面默认，保留服务型备选 | 混合搜索完整，但本地标准路线启动独立服务；Edge 路线仍需单独验证与维护 |
| Orama | 推荐轻量前端/小库索引原型 | TypeScript、browser/Node、词法/向量/混合；数据规模、持久化和中文 tokenizer 需实测 |
| MiniSearch | 推荐轻量词法补充或比较基线 | MIT、Node/browser、prefix/fuzzy/字段权重；内存索引，不提供语义向量或持久化 |

## Zotero 采集链与浏览器构建

**Translator 与执行框架。** 官方 translator 文档确认四类 translator：web、import、export、search；站点抓取依赖 `detectWeb` / `doWeb`，每个 `.js` 文件带 JSON 元数据、代码和测试案例。可复用的最小面是 translator 数据及执行框架，不是 Zotero 的库数据模型。官方建议用 Translator Editor/Scaffold 测试，且 web translator 需遵守请求节制与不泄漏数据原则。[官方说明](https://www.zotero.org/support/dev/translators)

`zotero/translate` 是框架源码，`zotero/translation-server` 是 Node/Koa + JSDOM 的 HTTP 装配例；已有 [zotero-ingest 调查](zotero-ingest.md)已确认 translation-server 的 ItemSaver 只累加 JSON，未实现文献库落盘或附件保存。它接入内核、兼容宿主或以独立本地服务运行的位置尚未决定；JSDOM 的运行边界、宿主接口和服务生命周期应作为原型问题核实，不预设把 DOM 解析放进内核进程。[translate 源码](https://github.com/zotero/translate/tree/master/src) · [translation-server 入口](https://github.com/zotero/translation-server/blob/master/src/server.js)

上述仓库 `COPYING` 实际核对为 AGPL-3.0；translators 许可按单个文件头确认，官方贡献指南鼓励 AGPL-3.0-or-later，不能假定每个 translator 都是同一许可。发布前须对纳入文件逐项检查头部、版权声明和所调用站点条款。[translate COPYING](https://github.com/zotero/translate/blob/master/COPYING) · [translator 许可说明](https://www.zotero.org/support/dev/translators#licensing)

**Connector 与快照。** Zotero Connector 原仓库覆盖 Chrome、Firefox、Edge、Safari，并以 `build.sh`、Gulp、自定义配置和从 Zotero 源码复制设置组成构建链；其 README 指出 `lib/SingleFile` 的生成 bundle 已提交，普通 build 直接复制。它不等于可作为独立 React 组件导入的采集 SDK。可取用页面 detection、translator 管理、附件抓取、SingleFile 集成的源码模块，再适配 Scholoom 的权限、消息、保存与错误 UX；应固定上游 commit 并记录 cherry-pick/模块来源。[Connector README](https://github.com/zotero/zotero-connectors) · [build.sh](https://github.com/zotero/zotero-connectors/blob/master/build.sh) · [已有源码映射](scholoom-connector-source-reuse.md)

Connector 仓库 `COPYING` 为 AGPLv3，另有 Zotero 商标声明；其 SingleFile 子目录并非全由该许可证覆盖。SingleFile 上游根 `LICENSE` 是 AGPLv3；集成的具体生成 bundle、附带第三方子目录/文件是否带额外声明，本次未能逐项穷举核实，按包复制前仍需检查清单。网页快照只保存页面状态，页面内资源可能受登录、跨域、CSP、脚本及站点封锁影响；不能把“调用保存 API 成功”当完整快照保证。[Connector COPYING](https://github.com/zotero/zotero-connectors/blob/876e41ad15139077f2e07b2f71a0fa94742e0b4a/COPYING) · [SingleFile LICENSE](https://github.com/gildas-lormeau/SingleFile/blob/master/LICENSE) · [snapshot 集成源码](https://github.com/zotero/zotero-connectors/tree/master/src/common)

**WXT / polyfill 关系。** WXT 是 MIT 的 TypeScript/Vite 扩展构建框架，可分别生成浏览器与 manifest 版本；它既不包含 Zotero translators，也不会自动改造 Connector 源码的 `gulp`、配置生成、预构建 SingleFile 和 Safari Swift 壳。若 Scholoom 选择 WXT，需要将自有扩展入口移植到 WXT，决定哪些 Connector 文件以源码模块接入，不能期待在原 Connector 仓库里切换一项配置即完成。[WXT introduction](https://wxt.dev/guide/introduction) · [target builds](https://wxt.dev/guide/essentials/target-different-browsers.html) · [WXT LICENSE](https://github.com/wxt-dev/wxt/blob/main/LICENSE)

`webextension-polyfill` 是 Mozilla 的 MPL-2.0 小型运行时库，主要给 Chrome 等提供 Firefox 风格 `browser.*` Promise API；它不补缺失的浏览器 API，也不统一 permissions、MV2/MV3、后台生命周期或内容脚本差异。官方目前明确测试 Chrome/Firefox，Edge 只是 Chrome-compatible 的非正式目标。新 Chrome 已增加 Promise API 支持，因此仅当实际目标矩阵仍有差异时加它，不作为默认兼容层。[polyfill README](https://github.com/mozilla/webextension-polyfill) · [LICENSE](https://github.com/mozilla/webextension-polyfill/blob/master/LICENSE) · [MDN browser differences](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Browser_support_for_JavaScript_APIs)

## 官方学术来源：鉴权、配额与全文边界

| 来源 | 接入/认证与配额 | 全文、维护与判断 |
| --- | --- | --- |
| OpenAlex | REST `/works`、`/authors` 等；可匿名试用，免费 API key 用 `api_key` 或 Bearer；免费 key 扩大日预算，超日预算或 100 req/s 返回 429。用响应额度头、缓存、退避；单页 100、基本分页 10,000，较大结果 cursor。 | 全文接口可供其已托管 OA 内容；`locations`/OA 字段只是位置线索。官方文档在 2026-08 更新且 2025 起使用量计费制度变化；免费预算金额/credits 动态读取官方 pricing。推荐广域发现与 OA 候选，不依赖无 key 的稳定额度。[认证/限制](https://help.openalex.org/api/authentication/) · [全文](https://help.openalex.org/access/fulltext/) · [价格](https://help.openalex.org/access/pricing/) |
| Crossref | REST `/works`、`/works/{doi}`；无需注册；`mailto` 进入 polite pool。依据实际响应 header 限速。2026-07 官方已按单记录与列表查询区分限制；列表比单 DOI 请求低，不能沿用旧调查的统一 5/10 RPS 数字。 | 以会员提交题录为主，元数据多可自由用，但摘要可能版权受限。全文 URL 或 TDM link 不保证访问；站点可要求订阅、登录或 TDM 许可。推荐 DOI 核对，不是全文提供者。[REST API](https://www.crossref.org/documentation/retrieve-metadata/rest-api/) · [access](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) · [全文边界](https://www.crossref.org/documentation/retrieve-metadata/text-and-data-mining/) |
| Semantic Scholar | Graph API `/paper/search`、paper details、references/citations；API key 放 `x-api-key`。官方文档不承诺所有用户固定配额，匿名为共享限流；只按实际响应状态、账号 key 和当前文档实现退避。 | `openAccessPdf` 是链接字段，不代表 API 托管全文或授予再分发许可。Academic Graph API 推荐引用拓展；许可页面区分标准与 expanded use，商用/超出标准用途联系申请。推荐作为可选引用图补充。[API docs](https://api.semanticscholar.org/api-docs/) · [license agreement](https://api.semanticscholar.org/license/) |
| arXiv | Atom API `api.arxiv.org/api/query`，`search_query`、`id_list`；无需 key。官方建议同一客户端请求间至少 3 秒、单连接，不遵守可暂时封禁。 | API 提供摘要与论文 PDF/HTML 地址，内容可在本机科研使用的权利需按 arXiv 条款和每篇作者选择的 license 判断；抓取不等于允许重新分发。推荐预印本专用，限速队列必须全局共享。[API manual](https://info.arxiv.org/help/api/user-manual.html) · [terms](https://info.arxiv.org/help/api/tou.html) |
| PubMed / NCBI | E-utilities `esearch`/`esummary`/`efetch`；免费，email/tool 标识；无 key 默认 3 req/s，key 默认 10 req/s，更多需申请。批量用 History/EPost/Efetch，避免逐篇请求。 | PubMed 以 citation/abstract 为主；通过 PMC 链接寻找全文，E-utilities 不等于无条件全文库。摘要可能受版权保护，NCBI 要求呈现免责声明。推荐生医题录。[usage](https://www.ncbi.nlm.nih.gov/books/NBK25497/) · [NCBI API](https://www.ncbi.nlm.nih.gov/home/develop/api/) |
| Europe PMC | REST `/search`、`/{id}/fullTextXML` 等；公开文档未发现 API key 要求或固定限流数字，未知时采用低并发、缓存和退避，不据此声称不限流。 | 文档明确 metadata 全集可查、full text 仅为部分内容；OA 子集提供 XML。下载后仍检查 license 字段和允许用途。推荐做生命科学全文补充，与 PubMed 去重合并。[developers](https://europepmc.org/developers) · [REST API](https://europepmc.org/RestfulWebService) · [PMC OAI OA rights](https://pmc.ncbi.nlm.nih.gov/tools/oai/)

以上 API 对应的 scholarly metadata/data 条款不同于代码许可证；缓存、向用户展示、全文存储和内容再发布须分别核对。所有实时配额数字均可能调整，软件不应写死成产品保证。来源候选的旧调查也列有 Unpaywall，但 PRD 明确首批不单独接入，本报告不将它增加为候选。

### 来源 API 的接入和运行条件

- 六个来源都是 HTTPS JSON/XML/Atom 接口，可由 Node 内核原生 `fetch` 调用；不需要 Electron renderer 直接访问，避免把 key 暴露到浏览器上下文。
- OpenAlex 免费 API key 是用户账号凭据，应放在内核安全存储；匿名额度也会被网站浏览共享，不应当成每台桌面独占额度。
- Crossref 无需用户 key；建议 Scholoom 提供固定 `mailto` 身份并遵守返回的 rate/concurrency headers。Metadata Plus 属付费服务，不是常规题录检索前提。
- Semantic Scholar 的 API key 需用户自行申请/配置；本次没有找到稳定公开的每分钟或每日配额承诺。只把状态码和 Retry-After 等当前响应作为限制信号。
- arXiv API 不需授权账号，但全产品的请求队列需共用 3 秒间隔；不能按窗口、并行任务或多个 Agent 各自限流。
- NCBI key 归账号，默认每个账号一个有效 key；提升配额仍需向 NCBI 申请。请求的 `tool`、`email` 应提供，History 用于大批量关联查询。
- Europe PMC 的开发者页覆盖 API、SOAP、FTP/OAI；FTP 快照适合批量数据，不适合桌面用户只为一篇文章启动的日常路径。
- 官方 API 文档不承诺浏览器端离线使用；Node 原生网络访问须由内核授权、记录外发字段，并在断网时保留已经缓存的内容和明确的来源失败状态。
- 所有来源接口均可不用专用 npm SDK，直接按公开 HTTP schema 接入，可减少依赖和升级耦合；若采用 SDK，应先核 API 字段覆盖与许可证。
- 上述 API 服务本身有组织维护和公开文档，但调用方不能把服务 SLA 推为 Scholoom 的可用性承诺；本次没有做 uptime、延迟或配额实测。

## PDF、论文结构与 OCR

| 候选 / 接入 | 适用条件与代价 | 许可证、维护与判断 |
| --- | --- | --- |
| PDF.js (`pdfjs-dist`) | JS API 在 Electron renderer 可读 text items/页面 viewport，Node 示例也存在；无需 daemon。作为读取/定位比较候选；先检查已选 EmbedPDF/PDFium 路径能否提供需要的文本层和位置，避免重复 PDF 引擎。浏览器 Worker、CSP、打包路径需核验。 | 上游 LICENSE 为 Apache-2.0（含第三方 notice）；官方仓库有版本发布记录，但本调查不据此判断维护活跃程度。不是 OCR、论文结构器或完整语义解析器。[API](https://mozilla.github.io/pdf.js/api/) · [Node examples](https://mozilla.github.io/pdf.js/examples/) · [LICENSE](https://github.com/mozilla/pdf.js/blob/master/LICENSE) · [releases](https://github.com/mozilla/pdf.js/releases) |
| GROBID | Java/Spring 类 web service 或 Java API；可比较其本地服务、按需子进程等接入方式，解析 scholarly PDF 的 TEI、标题/作者、段落、参考文献与结构。需要 JVM、模型、服务生命周期，适合评估高质量批次解析，不宜预设常驻方式。 | 源码 Apache-2.0；文档 CC0、标注数据 CC-BY；随发版的 `pdfalto` 有 GPL 边界需核查组合。官方 release 页面记录 0.9.1 于 2026-08 发布；此为发布记录，不据此保证维护活跃或未来更新。仅借鉴/候选解析器。[service](https://grobid.readthedocs.io/en/latest/Grobid-service/) · [license](https://github.com/grobidOrg/grobid/blob/master/doc/License.md) · [releases](https://github.com/grobidOrg/grobid/releases) |
| Docling (`docling`) | Python package，提供统一 DoclingDocument、Markdown/JSON 输出、表格/版面/OCR pipeline；适合复杂排版、表格和有本地模型预算的深解析。通常首次下载模型，可离线预缓存。需要 Python worker，不是 TS 直连包。 | 代码 LICENSE 已读为 MIT；Docling models 仓库标注 CDLA-Permissive-2.0，必须与代码分开记录；个别模型/依赖还应按所选 pipeline 核许可证。GPU 可选，CPU/OS wheel 与冷启动要实测。推荐原型候选，按需后台运行。[usage](https://docling-project.github.io/docling/usage/) · [code LICENSE](https://github.com/docling-project/docling/blob/main/LICENSE) · [model repo/license](https://huggingface.co/docling-project/docling-models) |
| MinerU | Python CLI/API/server；新版本分层选择快速原生文本至 OCR/VLM，高阶布局、公式、表格质量需要模型与推理后端。与 Electron 通过子进程/localhost HTTP 连接；NVIDIA/Linux 最成熟，Apple Silicon/CPU 后端需按版本验证。重量级模型不适合随默认安装包内置。 | `LICENSE.md` 是 Apache-2.0 加附加条款：第三方在线服务需显著归因；达到 1 亿 MAU 或月收入 2,000 万美元需另获商业许可。具体模型权重许可必须按 Hugging Face 仓库/commit 核对；本轮查到旧 `MinerU2.5-2509-1.2B` 模型卡标 AGPL-3.0，不能推及后续 4.x 每个权重；4.x 所选权重许可尚未全部核清。仅作为特定复杂 PDF 备选。[license](https://github.com/opendatalab/MinerU/blob/master/LICENSE.md) · [runtime/model sources](https://github.com/opendatalab/MinerU/blob/master/docs/en/usage/model_source.md) · [tiers](https://opendatalab.github.io/MinerU/usage/tiers/) · [旧模型卡](https://huggingface.co/opendatalab/MinerU2.5-2509-1.2B/tree/1aa090b41282e64fadd79c10572221f91ec21924) |
| Unstructured | Python `partition_pdf` / `partition` 支持多种文档，输出元素化文本/表格。轻量文本路径可本地跑；`hi_res`/OCR/复杂表格的依赖及质量与策略有关；也有 SaaS API（需 key，文档发送到供应商计算）。 | 核心库 Apache-2.0；托管平台属商业产品，价格依套餐/服务，不等同于开源库免费承诺。包依赖广、API 版本差异与模型成本较高；作为 Docling/GROBID 对照备选，不同时接入。[PDF partition](https://docs.unstructured.io/open-source/core-functionality/partitioning) · [LICENSE](https://github.com/Unstructured-IO/unstructured/blob/main/LICENSE.md) · [hosted API](https://docs.unstructured.io/platform-api/api/overview) |
| Tesseract.js | npm `tesseract.js` + WASM core，Node.js 与浏览器可运行，worker 下载语言 `.traineddata`；输入应为页面图像，由选定 PDF 引擎渲染扫描页后再 OCR。不是 PDF 解析器。Node worker、WASM、语言数据文件必须本地打包/缓存以满足离线。 | wrapper 和 core LICENSE 为 Apache-2.0；tessdata 模型集各有许可/来源，不因 wrapper 许可自动统一。上游仓库提供源码与版本记录；本调查未据此推断维护活跃或持续更新。推荐作为可选扫描件 OCR，不对全文默认逐页运行。[README](https://github.com/naptha/tesseract.js) · [releases](https://github.com/naptha/tesseract.js/releases) · [worker/data FAQ](https://github.com/naptha/tesseract.js/blob/master/docs/faq.md) · [LICENSE](https://github.com/naptha/tesseract.js/blob/master/LICENSE.md) · [core LICENSE](https://github.com/naptha/tesseract.js-core/blob/master/LICENSE)

解析流水线建议以“已选阅读引擎的文字层优先，缺字页再 OCR，复杂学术结构按需调用一个 Python 解析器”为待验证策略；仅在已有引擎存在缺口时比较 PDF.js。这是建议，不是已确认产品决定。禁止默默将用户文档传云；需单独显示外部服务行为和授权。解析输出必须保留源 PDF 页码/坐标、引擎版本与模型来源，否则不能用于可核验证据定位。

### 解析器运行/维护边界补充

- PDF.js 的 `pdfjs-dist` 是 npm 分发入口，但 viewer 与 core API 是不同使用层；只解析时不要嵌完整 reader。其发行仓库带第三方声明，升级须合并对应 `third_party` notices。
- GROBID 官方提供 Docker image 和 Java API，也有社区 Node/Python 客户端；客户端只包 HTTP 请求，不消除 Java 服务、heap、模型目录和端口生命周期。桌面可按需启动并在任务结束后退出，仍需管理冷启动失败。
- GROBID 0.9.1 的 release 说明含 Dropwizard/Jetty 依赖更新和 rootless Docker 修正，是具体维护证据；其升级会影响服务运行环境，不等于稳定 Node npm API。
- Docling 源码自身是 Python 包，PDF 解析要求下载 Docling model weights；官方模型仓库目前声明 CDLA-Permissive-2.0。模型缓存大小、首次下载时间和 CPU/GPU 内存并非 Node 包体信息。
- Docling 可选 OCR 与多种 PDF pipeline；不能只看 `pip install docling` 就得出“跨平台完整模型已安装”。Windows/macOS/Linux 要分别核 Python wheel、OCR 可选依赖和模型缓存。
- MinerU 4.0 仓库提供 tier、model source 和服务运行方式，Docker/服务形态是部署选项，不应据此假定必须常驻；高质量后端模型权重可能达 GB 级，显存需求随引擎变化。
- MinerU 许可附加条款中的在线服务 attribution 是软件许可条件；商业阈值是企业规模门槛，个人桌面不会因此自动产生付费，但若将来提供线上服务要重新审查。
- Unstructured Python 库 Apache-2.0，可本地调用；hosted API 需要 API key 并让文件经过供应商服务。自托管 API 另增应用服务依赖，跟最少守护服务目标有张力。
- Unstructured 提供的 `fast`、`ocr_only`、`hi_res` 等 partition strategy 功能和成本不同；不应把平台端 API 的模型质量当作可离线重现的开源能力。
- Tesseract.js JS wrapper 使用 WASM core，官方 FAQ说明 Node 从文件系统、浏览器从 IndexedDB 缓存语言数据；离线首启必须把 worker/core/data 作为可定位资源随产品准备。
- `.traineddata` 有 fast/best 等不同准确率、体积取舍；中英文混排需具体语言组合试验，不能把“100+ languages”宣传当作目标语料的识别通过。
- PDF.js 和 Tesseract.js 都可在 Electron 的 Chromium renderer 工作；内核 Node worker 与 renderer Worker/wasm 路径各自不同，不能只验证网页 demo 后推断 Electron 三平台包可运行。

## 本地索引、中文与混合排名

| 候选 | 运行/接入及许可 | 中文/边界与判断 |
| --- | --- | --- |
| SQLite FTS5 | SQLite 内置扩展，better-sqlite3 可直接 SQL 查询，不需服务。FTS5 可 `unicode61`、porter、trigram；SQLite 公有领域。 | 默认 unicode tokenizer 按 Unicode 类别，不提供中文词典分词；中文连续文本的精确短词、英文/数字混排需 tokenizer/三元组实测。推荐作为结构化库的词法候选索引，必要时用预分词或 trigram 比对。[FTS5](https://www.sqlite.org/fts5.html) |
| sqlite-vec | C 扩展，官方 repo 提供 Node `sqlite-vec` 装载路径；embedding 存 SQLite、KNN SQL 查询。Apache-2.0/MIT 双许可证；项目 README 标注早期阶段。 | 只负责向量近邻，不负责 embedding、中文分词、全文/证据维护或稳健 ANN 规模承诺。原生二进制/SQLite ABI、Electron Node ABI、三平台包要先验。最贴合本地单库原则，推荐小样本试验。[README](https://github.com/asg017/sqlite-vec) · [Apache license](https://github.com/asg017/sqlite-vec/blob/main/LICENSE-APACHE) |
| LanceDB | Embedded OSS，TypeScript SDK，支持 vector / FTS / hybrid / rerank；可本地文件路径，无守护服务。Apache-2.0；Enterprise/cloud 是独立付费平台。 | Node SDK 实际带 native/Rust 依赖与多平台产物；Electron target、arm64/macOS/Windows/Linux rebuild 和升级需要验证。功能面可能超过首期需求。备选对照，不默认引入。[docs](https://docs.lancedb.com/) · [repo/license](https://github.com/lancedb/lancedb) |
| Qdrant | Rust server + JS REST client；支持 sparse+dense prefetch、RRF/DBSF 融合及文本索引。自托管软件 Apache-2.0；Cloud/Hybrid Cloud 按资源收费。标准快速开始常用 Docker/独立 server，会增加服务管理。 | 混合能力成熟，但单机桌面若常驻 daemon 与产品“最少守护服务”冲突；Qdrant Edge/本地嵌入接口须作为独立候选另验。无需先部署它。仅当规模/功能证明需要时才引入。[hybrid](https://qdrant.tech/documentation/search/hybrid-queries/) · [local install](https://qdrant.tech/documentation/quickstart/) · [pricing](https://qdrant.tech/pricing/) |
| Orama | `@orama/orama` TypeScript，无依赖，browser/Node/edge；同一 search API 提供全文、vector、hybrid。README 与 `package.json` 声明 Apache-2.0；GitHub API 未找到根 `LICENSE` 文件，故许可证正文未能核对，纳入前应检查 npm tarball/子包。Cloud 服务另有商业边界。 | 容易小样本试验，嵌入由调用者提供/配置；官方宣称小体积不能替代真实数据规模测试。browser 内存与持久化不是自动解决方案；中文 analyzer、索引落盘及 Electron IPC/内核边界需实测。推荐小型 TS 对比原型。[intro](https://docs.orama.com/docs/orama-js) · [hybrid](https://docs.orama.com/docs/orama-js/search/hybrid-search) · [package license](https://github.com/oramasearch/orama/blob/main/package.json) · [README license statement](https://github.com/oramasearch/orama/blob/main/README.md) |
| MiniSearch | `minisearch` MIT，浏览器和 Node 内存索引；支持字段权重、prefix、fuzzy、term processing/tokenizer、自定义组合。无需服务器或原生扩展。 | 默认 tokenizer 面向词边界，中文需自定义切词且查询/索引须相同规则；不提供 embeddings、磁盘索引或跨进程一致性。适合作为词法 recall/排序基线，不是统一混合检索引擎。[README](https://github.com/lucaong/minisearch) · [LICENSE](https://github.com/lucaong/minisearch/blob/master/LICENSE.txt)

**排名边界。** FTS/BM25 与向量相似度分值不可直接相加；RRF 可按名次融合，降低分值尺度不一致的影响。精确标识符召回、题名匹配与混合结果之间的相对排名需用代表性查询验证，不预定硬性提升或固定排名规则。中文语义依赖所选嵌入对简繁体、学科词、引文格式和混合语言的表现；本地模型的许可、磁盘大小、CPU 延迟另算。任何检索库只产候选命中，无法替产品判断同一文献、预印本与正式版本、论证证据是否同源，也不能维护引用位置、变更影响、主题关系或分析更新语义。[Qdrant RRF 说明](https://qdrant.tech/documentation/search/hybrid-queries/) · [FTS5 tokenizer](https://www.sqlite.org/fts5.html)

对个人桌面部署，可比较现有 SQLite + FTS5、sqlite-vec 与 Orama 的适配性；Qdrant 常规服务形态会增加服务管理成本。此为研究候选比较，不预先决定组件、宿主位置或排名策略。

### 检索实现与中文边界补充

- `better-sqlite3` 是项目已经选定的 SQLite driver；FTS5 能力由实际 SQLite build 决定，分发前要确认启用 FTS5 和 tokenizers，不要只按开发机 SQLite 版本判断。
- FTS5 的 `unicode61` 更适合英文/Unicode token，不会自动用中文词典切分；trigram 可做连续子串匹配，但索引体积、短查询行为和标点处理需实测。
- 如果增加中文分词，应只让一个确定的 analyzer 同时处理建索引与查询；分词器版本改变要使旧索引可重建，不能导致原始内容被改写。
- DOI、PMID、arXiv ID、引用键、作者名、数字和带连字符术语需保留原串索引/精确匹配路径，中文分析词法不能替代标识符规范化。
- sqlite-vec 的 README 将其描述为 early-stage；GitHub 有 Node binding，但其静态/预编译扩展和 SQLite extension loading 与 Electron 分发有关。本轮没有核完每个平台每个 target 的现成 binary 矩阵。
- LanceDB TypeScript SDK API 本身接近内嵌库；实际 npm 依赖链含 Native/Rust 部分，Windows/Linux glibc/macOS arm64 等产物组合须锁定版本做 packaging 验证。
- Qdrant Local quickstart 提供 Docker 服务路径；Node JS SDK 主要连接 REST/gRPC endpoint。Cloud 定价与开源自托管成本是两回事，个人桌面若装容器仍是额外服务。
- Qdrant 文档同时列出 Edge 产品，但不能把 server client API 的完整 hybrid query 能力直接推到 Edge；版本、平台支持和数据同步机制需独立原型。
- Orama 官方宣传的“小于 2KB”与 embedding、索引 JSON、输入模型无关；实际索引仍需要持久化策略，且 UI renderer 内存中的索引不能自动成为内核共同事实。
- MiniSearch 的 `processTerm` / `tokenize` 可插入中文切词；索引与查询必须用同一函数，构建的内存索引重启后需重载/重建，体量增长会影响启动与内存。
- 所有候选均需保持检索结果有界；一次检索不能把全库全文/所有 PDF page chunks 投影到 UI 或 Agent 上下文中。
- “hybrid”在各库中可能分别表示全文+vector，也可能 sparse+dense、RRF 或服务端 reranker；比较时固定输入、embedding、top-k 和 relevance judgment，否则排行榜不可比。
- 对作品级归并应先合并命中，再做排序与片段选择。索引可以给相似片段分，但不能直接判定预印本/正式版是否同一版本，也不能把重叠段落视为两份独立证据。

## 优先原型问题与验收观察

| 原型 | 要回答的问题 | 可观察验收条件 |
| --- | --- | --- |
| 1. Connector 抽取链 + WXT | translator 执行和 SingleFile 能否保留，替换保存端并与官方扩展共存？ | Chromium/Firefox 各运行代表站点；识别/多结果选择正确；落到 Scholoom 独立目标；附件失败单独呈现；普通与复杂页面快照能打开；与 Zotero Connector 并装时目标不串写。源树/构建改动可定位且许可证清单完整。 |
| 2. 解析器对照集 | PDF.js、Docling、GROBID、MinerU 哪些应按需采用？ | 同一小型多语言样本集覆盖双栏、公式、表格、扫描件、参考文献；记录文本准确性、页/区域定位是否回到原文、空页/乱码、内存和单篇耗时、冷启动体积、离线首次运行。未跑不以文档宣称代替。 |
| 3. 中文/混合检索 | FTS5 tokenizer / MiniSearch / Orama + sqlite-vec 的真实召回/融合如何？ | 固定人工判断相关性的中英混合 query 集；DOI/精确短语、中文同义表达、英文术语、跨字段查询分开观察；检查 Recall@k、MRR、同篇片段聚合、引用定位、增量更新与重启持久性。先不定融合权重。 |
| 4. 来源实际请求 | 官方限速/授权语义能否安全包装并可解释部分失败？ | 六来源请求使用真实允许的低频样例；记录状态码/headers、匿名/key 路径、429 退避、缓存命中、全文链接失效；结果分别显示元数据、全文指针和下载文件，不把可访问性当许可。Semantic Scholar 配额与 OpenAlex 花费在真实 account/key 上确认。 |

## 自研职责与未核实项

外部库不能替代 Scholoom 自己维护的领域事实：跨源去重和版本关系、字段来源/冲突、稳定身份映射、题录与全文/附件层级、下载/快照许可状态、解析产物到原文页和坐标的可复核引用、候选与实际收录的差别、部分完成/重试/取消、索引重建、材料变更触发的分析影响、同篇命中归组及证据与主张判断。这些是产品契约，不是选择某搜索引擎后自然得到的功能。

以下仍未核实，不能据此做承诺：

- Zotero `lib/SingleFile` 中所有 vendored 第三方文件的独立 LICENSE、Connector 每个 translator 文件的许可清单；需固定 commit 后做分发清单。
- Orama 上游仓库根 `LICENSE` 未找到；当前以 README 与 package.json 的 Apache-2.0 声明为证，npm 分发包中的完整许可文件尚未核对。
- Docling 权重仓库不同 revision/各模型文件是否全由 CDLA-Permissive-2.0 覆盖；依赖模型与具体 pipeline 许可证需逐项核。
- MinerU 4.x 当前选用每个模型权重的 LICENSE，不能用旧 2.5 model card 推断；需要确定模型版本后直接核其 LICENSE/README。
- Tesseract 各语言 `traineddata` 的精确许可及特定模型效果；wrapper Apache-2.0 不覆盖任意语言包。
- Crossref 2026-07 新限流具体各类 endpoint 的当前数字；应跟响应 header/在线文档走，不把旧表复制进程序。
- Europe PMC 固定请求配额；Semantic Scholar 单 key 配额、商业/扩展用途确认；OpenAlex 账单额度以当日 pricing/account 为准。
- Electron 目标版本下 PDF.js Worker/CSP、sqlite-vec/LanceDB 二进制的 Linux/Windows/macOS packaging；WXT + Zotero 代码实际迁移效果；本文未跑任何构建、请求或解析。
- 任一官方全文链接对具体出版物的下载/保存/再分发许可；必须按条目元数据和内容站点条款判断。

资料核对于 2026-10-11 完成。以上是文档/源码调查与原型建议，不表示候选已集成或通过运行验收。
