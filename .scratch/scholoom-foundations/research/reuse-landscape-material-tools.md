# 网页读取、检索、嵌入与科研数据工具调查

调查日期：2026-10-11。本文核对官方文档、上游源码仓库中的 README／许可证／package metadata，以及官方模型卡；没有安装或运行候选，也没有下载权重。维护情况是文档和可见上游发布记录的桌面核对，不代表 Scholoom 集成或运行验收。

## 结论

- 网页工具链按“检索候选 → 获取页面 → 提取正文 → 保存页面快照”分层。推荐 Node `fetch` + Mozilla Readability + DOM 实现 + Turndown；动态页面与登录页按需交给隔离的受管浏览器或用户当前浏览器，不把浏览器渲染结果称为原网页快照。
- Scholoom 的 OpenAlex、Crossref、Semantic Scholar、arXiv、PubMed／Europe PMC 继续承担学术发现。Brave、Tavily、Exa 与 SearXNG 都只是一般网页检索候选；现有资料没有同一组中英科研查询上的结果对照，暂不选定 provider。
- 本地 embedding 可按需采用 Transformers.js 调 ONNX Runtime Node；首批不默认携带权重。multilingual-e5-small（约 0.1B 参数）作为轻量 CPU 基线，base（约 0.3B）与 large 作为质量/资源比较项，BGE-M3（568M）作为多功能比较项；前三者模型卡标 MIT，BGE-M3 权重卡标 MIT。EmbeddingGemma 约 300M 且多语言，但其 Gemma 使用条款与代码许可不同，须单独评估。
- 结构化科研文件：PapaParse 处理 CSV，SheetJS CE 处理 XLS/XLSX；大型 CSV／Parquet 分析复用已规划的 pandas／PyArrow 受管 Python 环境。DuckDB Node API 只在确有 Node 原生查询、筛选/聚合或 Parquet 直接扫描需求时评估，不作为 SQLite 领域库替代品。

## PRD 对应关系与已有基础

| PRD 行为 | 可用组件提供的部分 | Scholoom 仍需负责 |
| --- | --- | --- |
| 文献线上发现与筛选依据 | 网页 provider 搜索普通网页，学术 API 提供学术记录 | 查询计划、逐源覆盖、来源/标识符和部分失败、候选去重、入库判断；搜索摘要不能充当全文 |
| 页面识别与 Connector 收录 | Readability 抽正文；既有 Zotero translators 识别出版商页面 | 页面身份/目标库与集合、题录和附件分别保存、快照、来源与实际结果；translator 不是跨站搜索服务 |
| 网页快照阅读与证据定位 | HTML DOM 处理、正文转 Markdown；浏览器可渲染动态 DOM | 归档原始响应/资源与渲染视图的版本关系，稳定位置、来源、失效/重定位及 GUI/Agent 共同读取 |
| 混合检索 | embedding 推理、可选 rerank | Scholoom 统一词法/语义召回、融合、文献分组、原文位置、范围/覆盖；模型只产向量/分数，不定义引用事实 |
| 研究实施中的数据读取 | CSV/XLSX 解析、DuckDB 或 Python dataframe | 表头/编码/类型核对、缺失值及单位语义、来源和变换链、抽样展示、失败可见性、执行授权和科研结论 |

PRD 已指定 Node 内核、SQLite/Drizzle、受管 Python 与 Worker；解析、索引重建、检索质量和性能仍待实现验收。[约束与路线](../../../docs/prd/constraints-and-validation.md)、[文献 PRD](../../../docs/prd/literature.md)、[科研工作 PRD](../../../docs/prd/research.md)、[工作台 PRD](../../../docs/prd/workbench.md)。

**既有决定与本报告建议的边界：** PRD 已列出的学术来源和 Zotero Connector 行为是既有方向；普通网页 search provider 尚未选定。PRD 确认统一混合检索，但模型、provider、权重分发和 reranker 仍待实验。

PRD 已选择受管 Python 环境；这支持复用 pandas/PyArrow，却没有规定每类文件必须用哪一个 parser，也没有规定 DuckDB 必须或不得接入。

Electron 官方安全建议是技术依据；登录态、站点白名单、profile 策略和网页访问范围仍需具体产品契约确认，本文所列是待评估集成选项。

本报告不把模型 revision、快照元数据或原型验收项目升级为 PRD 硬约束。它们是可复现性建议，实际保存字段以未来接口/状态规格为准。

## 网页读取与浏览器

### Mozilla Readability、Cheerio、Turndown

1. **Mozilla Readability — 推荐正文提取核心。** Firefox Reader View 使用的独立抽取器，输入 DOM，输出标题、作者、正文等 article 对象；Node 使用时还需 DOM 实现（例如 `jsdom`）。Apache-2.0，Node ≥14 的 package metadata 可见；Mozilla 官方上游 README 与 changelog 仍可查。限制：需要已取得 HTML；不执行页面 JavaScript、不绕登录或付费墙；抽取结果不是原文存档。上游明确不负责安全净化，渲染到 Electron 前须安全净化/禁用危险 HTML。[README](https://github.com/mozilla/readability/blob/main/README.md)、[源码许可](https://github.com/mozilla/readability/blob/main/LICENSE.md)、[package metadata](https://github.com/mozilla/readability/blob/main/package.json)、[安全说明](https://github.com/mozilla/readability/security/policy)。
2. **Cheerio — 推荐作为已有 HTML/XML 的 DOM 工具，不作为浏览器。** 提供 selector 和树操作；其威胁模型明确称运行于 Node 而非浏览器，适合抽取元标签、链接或按站点规则修补 DOM。MIT。动态渲染、CSS 布局、页面脚本均不运行。不要同时用 Cheerio 和 Readability 重复做通用正文抽取；按 Readability 失败的具体站点再用窄规则。[上游 README](https://github.com/cheeriojs/cheerio/blob/main/Readme.md)、[源码许可](https://github.com/cheeriojs/cheerio/blob/main/LICENSE)、[威胁模型](https://github.com/cheeriojs/cheerio/blob/main/THREAT_MODEL.md)。
3. **Turndown — 推荐仅在下游需要 Markdown 时采用。** 把 HTML 转成 Markdown，不负责抓网页或抽正文；MIT，Node ≥18。保留图像、表格、脚注、公式和相对链接需配置与行为验证，转换文本不能替代原始 HTML/页面快照。活跃度应在锁定版本时复查上游提交和 release。[README](https://github.com/mixmark-io/turndown/blob/master/README.md)、[package metadata/许可](https://github.com/mixmark-io/turndown/blob/master/package.json)。

**建议路径：** Node 受控 HTTP 获取（限制重定向、响应字节、协议与目标地址）→ 记录原始响应及 URL/时间/headers → DOM + Readability → 可选 Turndown。浏览器输出另存为“渲染后 DOM/截图”，记录浏览器版本、访问时间和页面地址。禁止把页面脚本输出当作可信指令；导入页面文本是 Agent 的不可信材料。

页面访问还受站点条款、登录状态、验证码及付费墙影响，具体来源政策需后续规格确认。快照是可重读证据材料，抽取正文只是便于检索和阅读的衍生产物，两者分别记录。

### 受管 Playwright 浏览器

Playwright 是浏览器自动化库，不是网页读取器或托管服务。`playwright` 默认安装包并不代表浏览器二进制会随 Scholoom 安装器存在；官方文档要求单独安装匹配浏览器，也可用 `@playwright/browser-*` 包触发下载。Electron 已包含 Chromium，但 Playwright 是否能安全复用该 Chromium、跨版本及三平台行为需单独验证，不能据此认为无需额外浏览器包。Playwright 源码 Apache-2.0，浏览器二进制有各自许可/notice，打包要逐项核对。[浏览器安装](https://playwright.dev/docs/browsers)、[JS 库](https://playwright.dev/docs/library)、[源码许可](https://github.com/microsoft/playwright/blob/main/LICENSE)。

本地浏览器可以访问动态页面；使用登录态会让页面接触相应账户状态。具体交互和授权策略仍应按 Connector/产品规格确定，本文不把临时 profile、用户确认或站点白名单写成已定产品政策。集成时可评估下载、弹窗、权限请求、内网访问、进程隔离、导航限制、超时和取消。Electron 官方安全建议包括远程内容禁用 Node integration、保持 context isolation 和 sandbox，并限制导航及权限；这是 Electron 安全边界建议，不是本 PRD 新增的浏览器业务契约。[Electron 安全指引](https://www.electronjs.org/docs/latest/tutorial/security)、[进程沙箱](https://www.electronjs.org/docs/latest/tutorial/sandbox)。

托管浏览器（如 Browserless）通过 WebSocket 连接远端 Chromium，可以省本地浏览器运维并提供并发/会话能力；它把 URL、页面内容和可能的授权态交给第三方服务，受网络、账号、数据处理条款和用量影响。可作为待评估的集成选项，不代表 PRD 已确认产品默认或配置策略。[Browserless Playwright 连接](https://docs.browserless.io/overview/getting-started/connect-playwright)、[云用量模型](https://docs.browserless.io/overview/unit-consumption)。

## 网页搜索 providers

四者作为同一 provider 接口的候选，具体以查询/结果记录和来源追踪为契约；SDK不是必要依赖，HTTP API 可用标准 `fetch` 接入。价格和免费额度随时可能变，以下只引用调查日可见官方页面，不作为成本承诺。

| 候选 | 能力与定位 | 维护/许可/成本边界 | 判断 |
| --- | --- | --- | --- |
| Brave Search API | 通用网页索引，返回 URL、标题、摘要等；独立于学术元数据 API | SaaS，需账号与 key；官方有请求价目及查询日志政策，额度/条款需在原型时复核 | **候选**：没有相同查询集上的比较证据；与其他 provider 用同一组中英科研 queries 比较覆盖、相关性、引用页可访问性、延迟与成本。[API](https://api-dashboard.search.brave.com/documentation)、[当前价目](https://api-dashboard.search.brave.com/documentation/pricing)、[隐私](https://api-dashboard.search.brave.com/app/documentation/general/privacy-policy) |
| Tavily | Search 返回检索片段；Extract 支持 URL 批量提取，最多 20 条并逐 URL 报告失败；还有 crawl | SaaS + API key；credits 随 search depth/端点变化，官方文档列 basic/fast/ultra-fast 1 credit、advanced 2 credits | **候选**：适合和纯搜索 provider 对比“发现+抽取”的链路成本；不能替代自有快照与原始来源记录。[Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search)、[Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract)、[价格](https://www.tavily.com/#pricing) |
| Exa | Search 支持多种检索类型，可返回 text/highlights/summary，并提供 request 级 costDollars 字段 | SaaS + key；检索/内容字段分别计量，按实时官方价目核对；SDK不是必需 | **候选**：语义型网页检索路线，与其他 provider 用同一组中英 queries 做盲评；不视作学术索引或全文存档。[Search API](https://exa.ai/docs/reference/search)、[Pricing](https://exa.ai/pricing) |
| SearXNG | 自托管元搜索；HTTP API 可配置 JSON/CSV/RSS，但实例须开放所选格式；结果取决于管理员启用的引擎 | AGPL-3.0 服务端项目；自托管需 Python/服务运维和上游引擎可用性；公共实例政策和可靠性各异 | **用户配置备选**：适合本机/机构已有实例和隐私控制；不把公共实例设为 Scholoom 的免费公共后端。[Search API](https://docs.searxng.org/dev/search_api.html)、[源码与许可](https://github.com/searxng/searxng) |

provider key 应保持机密；Brave 官方要求不向客户端代码暴露。查询可能透露研究兴趣，出站数据和保留条件应作为 provider 评估项。Search 片段可帮助发现，不能证明全文完整或下载授权。OpenAlex 等学术源提供学术标识符、引用/版本关系和专业字段，普通 Web provider 不提供等价数据契约；搜索结果仍需学术 API 复核身份和版本。[Brave 认证](https://api-dashboard.search.brave.com/documentation/guides/authentication)。

## 本地 embedding 与 rerank 执行

| 候选 | 源码运行时 | 模型卡核对与输入规约 | 取舍 |
| --- | --- | --- | --- |
| Transformers.js + ONNX Runtime Node | Transformers.js Apache-2.0；Node 路径调用 `onnxruntime-node`，不是浏览器 WASM。ONNX Runtime MIT。官方当前预编译 CPU 矩阵列出 Windows x64/arm64、Linux x64/arm64、macOS x64/arm64；DirectML 仅 Windows 两种架构，CUDA 仅 Linux x64（文档标注 CUDA 11.8）。不据此推断其他执行后端或发行版本都支持。 | 从模型 Hub 载入 ONNX artifact 时首次需网络/缓存；可改为离线随包或按需下载。运行时包、原生二进制和模型权重是不同的许可/分发项；具体平台仍需安装器与 ABI 验收。 | **推荐推理路线原型**：TS 内核可在 Worker 隔离计算；按需下载/配置模型，不默认安装权重。优先验证 CPU，不在 renderer 做长任务。[Transformers.js Node backend](https://huggingface.co/docs/transformers.js/en/api/backends/onnx)、[源码/许可](https://github.com/huggingface/transformers.js)、[Node binding 支持矩阵](https://onnxruntime.ai/docs/get-started/with-javascript/node.html)、[ORT 许可](https://github.com/microsoft/onnxruntime/blob/main/LICENSE)。 |
| intfloat/multilingual-e5-small | 模型卡标 MIT，约 0.1B 参数（118M）、384 维，模型卡提供 ONNX 文件；比 base/large 更适合作为 CPU 资源基线。 | 检索仍使用文档 `passage: `、查询 `query: ` 前缀；模型输入最长 512 token，长文本需上游切分。卡上的 benchmark 不代表 Scholoom 中文科研语料效果。[官方模型卡/文件](https://huggingface.co/intfloat/multilingual-e5-small)。 | **轻量 CPU 基线**：先测它的安装体积、冷启动、吞吐、内存与中文/跨语召回，再决定是否升级。 |
| intfloat/multilingual-e5-base | 模型卡标 MIT，约 0.3B 参数（常见模型统计约 278M）、768 维；同系列中间档。[官方模型卡](https://huggingface.co/intfloat/multilingual-e5-base)。 | 查询/文档分别使用 `query: `/`passage: `，包括非英语；最长 512 token，长文本需分块。 | **轻量与质量之间的对照项**：不要把 base 或 large 标成小模型；按同一 CPU/语料测质量和资源。 |
| intfloat/multilingual-e5-large | 模型权重卡标 MIT；large 规模意味着较高内存与冷启动成本，参数/文件字节随格式和量化变化。 | 每篇文档输入前缀 `passage: `，查询 `query: `，包括非英语输入；未按规约会损害检索。其模型卡也说明长文本截断上限 512 token。[模型卡](https://huggingface.co/intfloat/multilingual-e5-large)。 | **质量/资源比较项**：不是轻量基线；对比 small/base 的召回增益是否足以覆盖 CPU 与分发成本。 |
| BAAI/bge-m3 | 模型权重卡标 MIT；卡给出 568M 参数、1024 维、最长 8192 token、100+ 语言，原生提供 dense/sparse/multi-vector (ColBERT) 路线。 | 实际 ONNX 转换/量化文件与 Node kernel 是否匹配未核验，必须实测。仍需核实具体实现 pooling、归一化和输入约定。 | **多功能比较项**：体量明显大于 E5-small/base；若只用 dense，稀疏和多向量能力不会自动得到。模型卡 benchmark 不是本地语料表现。[官方模型卡/权重许可](https://huggingface.co/BAAI/bge-m3)、[模型论文](https://arxiv.org/abs/2402.03216)。 |
| google/embeddinggemma-300m | 官方卡：约 300M 参数，100+ 语言，面向桌面/笔记本本地推理；有小型量化路线。 | Google Gemma 条款包含用途限制及分发要求，卡不是 Apache/MIT。官方卡示例面向 Sentence Transformers；此调查未确认所需 ONNX 文件、Transformers.js 任务支持和查询/文档提示串的本地端到端兼容。 | **许可敏感备选**：先评估条款、ONNX 转换/提示规约，再决定是否与 MIT 权重候选同测。[Google 模型卡](https://ai.google.dev/gemma/docs/embeddinggemma/model_card)、[Gemma 条款](https://ai.google.dev/gemma/terms)。 |

### 托管 embedding 与可选 reranker

托管 API 可与本地模型并行作为路线评估；阅读公开 API/模型/价格文档不需凭据，只有实际 API 调用才需要 key。本轮不调用 API，也不把“尚无凭据”当作跳过调研的理由。托管方案减少本地权重和 CPU 负担，但会把研究文本发给供应商，受网络、配额、价格、保留条款和模型迭代影响；不同模型的维度与向量空间不能混用，换代可能要求全文重嵌入。

Provider-neutral 对比应统一 query/document 输入语义和输出向量接口，同时记录模型 revision/维度、每次调用成本、批处理能力、限流、数据处理/保留及凭据存放要求；以同一中英 queries 和标注语料评估召回，不按品牌功能列表直接决定。

| 托管候选 | 公开资料与取舍 |
| --- | --- |
| Google Gemini Embedding | 官方文档列 `gemini-embedding-001`（文本、2048 token、可选维度）及新 `gemini-embedding-2`（多模态）；官方明确两代 embedding 空间不兼容，升级要重嵌入。按模型页和当前价格页评估文本成本、批处理折扣、API key、数据权利/保留条款；适合作为 provider-neutral 接口的一项托管比较，不等于选择 Gemini。[Embedding API](https://ai.google.dev/gemini-api/docs/embeddings)、[模型说明](https://ai.google.dev/gemini-api/docs/models/gemini-embedding-001)、[价格](https://ai.google.dev/gemini-api/docs/pricing)。 |
| Cohere Embed | 官方目录列 Embed v5 Pro/Fast、Embed v4 和多语言 v3；文档给出输入类型如 `search_document`/`search_query`、维度和上下文长度，价格需从当前官方价格入口核对。适合作为多语言 API 对照；保留文本外发、试用/生产 key 配额与供应商条款成本。[模型目录](https://docs.cohere.com/docs/cohere-embed)、[Embed API](https://docs.cohere.com/v2/reference/embed)、[价格说明](https://docs.cohere.com/docs/how-does-cohere-pricing-work)。 |

可选 reranker：`BAAI/bge-reranker-v2-m3` 是跨语言 cross-encoder reranker，模型卡标 Apache-2.0；将 query-document pair 打分并重排候选，不能替代召回。约 568M 级别模型可能让 CPU 对每对文本串行或批量打分产生明显额外延迟/内存，需限制候选数并实测；若本地成本不合适，可将 Cohere Rerank 作为独立托管 API 备选（按官方价格和 key/配额核对）。均为可选项，不默认启用。[BGE reranker 模型卡](https://huggingface.co/BAAI/bge-reranker-v2-m3)、[Cohere Rerank 文档/价格入口](https://docs.cohere.com/docs/rerank)。

集成建议：记录模型/provider ID、常规模型 revision、维度、归一化、分块及 query/document prefix，便于复现和判断索引是否兼容；无需把内容 hash 设成全局硬门禁。不同 embedding 空间不可直接混算，更新流程与旧索引保留方式待具体规格决定。词法精确检索（DOI、标题、术语）不可被 embedding 取代。

## 科学数据文件：CSV、Excel、Parquet

| 工具 | 适用方式 | 维护/许可/运行边界 | 推荐 |
| --- | --- | --- | --- |
| PapaParse | CSV/TSV 解析，支持 Node Readable stream、浏览器文件和 malformed input；MIT，上游 mholt/PapaParse 提供 README 与 release | 轻量 JS parser；CSV 类型推断不应被当作科研 schema，编码、分隔符、引号和空值仍要显式检查 | **CSV 默认候选**。[官方上游 README](https://github.com/mholt/PapaParse/blob/master/README.md)、[源码 LICENSE](https://github.com/mholt/PapaParse/blob/master/LICENSE)、[发布记录](https://github.com/mholt/PapaParse/releases) |
| SheetJS Community Edition | XLS/XLSX 多工作表与单元格提取/生成；Apache-2.0 | 项目官方维护源迁至 `git.sheetjs.com`，不是历史 GitHub `SheetJS/js-xlsx` 镜像；官方 CE 安装文档称其 CDN 为主要发行源。核定使用具体 CE 版本、发行包、源码与许可，避免从陈旧 npm 镜像随手取包。复杂 Excel 的公式计算、宏/VBA、外链和格式并不等同 Excel 应用行为 | **Excel 候选**，需以真实科研文件验证读取范围。[官方 CE 文档](https://docs.sheetjs.com/docs/)、[官方源码仓库](https://git.sheetjs.com/SheetJS/sheetjs)、[CE 许可](https://docs.sheetjs.com/docs/miscellany/license/)、[安装来源](https://docs.sheetjs.com/docs/getting-started/installation/) |
| DuckDB Node API (`@duckdb/node-api`) | 新的 Node client 用于嵌入式 SQL 和 CSV/Parquet 分析；注意不要把旧 `duckdb` package 文档当作新 API 文档 | Node Neo 源码及 API package 为 MIT；原生扩展/平台产物带来安装器、架构和内存管理验证。DuckDB 是分析引擎，不替代 SQLite 领域事务/任务状态。 | **有界备选**：当直接查询大文件是明确需求再做原型；否则先复用受管 Python。[Node Neo API](https://duckdb.org/docs/preview/clients/node_neo/overview)、[Node API MIT LICENSE](https://github.com/duckdb/duckdb-node-neo/blob/main/LICENSE)、[平台包清单](https://github.com/duckdb/duckdb-node-neo#packages)。 |
| pandas + PyArrow | 受管 Python 已是项目路线，可用于数据清洗、统计和 Parquet；pandas 提供 CSV/Parquet IO，PyArrow 可分列读取 Parquet | pandas 为 BSD-3-Clause；PyArrow 为 Apache-2.0。环境准备、wheel/平台支持和项目依赖按已定 uv/受管 Python 路线处理；交互式 GUI 预览可有界读取 | **科研分析优先复用现有路线**；Node 负责调度、执行授权和结果交付。[pandas IO](https://pandas.pydata.org/docs/user_guide/io.html)、[pandas LICENSE](https://github.com/pandas-dev/pandas/blob/main/LICENSE)、[PyArrow Parquet](https://arrow.apache.org/docs/python/parquet.html)、[PyArrow LICENSE](https://github.com/apache/arrow/blob/main/LICENSE.txt)、[Python 环境约束](../../../docs/prd/constraints-and-validation.md#已定技术路线)。 |

集成建议：可让 Node JS 负责轻量摄取/预览、Python 负责科研分析，避免无明确需求时维护重复的数据处理接口；是否复用解析器或增加 DuckDB 由具体规格与文件样本决定。CSV/Excel 的列名和自动类型不隐含单位、时区、缺失机制、实验组含义或数据质量判断。

## 建议接入次序

1. 在现有 Node 内核边界定义普通网页 Search provider 和 URL Fetch/Extract 分层结果；用同一组中英科研 queries 对比 Brave、Tavily、Exa，并按需要纳入 SearXNG；现有学术 API 继续独立逐源查询和记账。
2. 读取先走内置 HTTP fetch + DOM/Readability，Markdown 按需由 Turndown 生成；保存原始来源与抽取结果的版本/时间关系。遇到确实依赖 JS 或用户授权登录的网页，再单独启用隔离 Playwright provider。
3. 本地语义检索选 Transformers.js + ORT Node 做可选执行路线；E5-small 是 CPU 轻量基线，base/large 与 BGE-M3 为比较项，权重按需获取；与一至两个托管 API 比较成本、隐私及质量，不需先有 key 才能完成文档路线评估。
4. CSV 使用 PapaParse，XLSX 评估 SheetJS CE；Parquet 与较大分析优先复用 Python/PyArrow。DuckDB 只由原型证据触发。

不建议：把第三方抽取结果作为来源真相；把任意网页自动化放入产品 renderer；默认随安装器携带大模型权重；没有明确需求时在 Node 和 Python 重复维护 dataframe 接口；把 Web search snippets 当作已收录全文或学术检索覆盖。

## 三项原型行为验收

1. **静态网页抽取和证据回溯：** 使用一份带噪声、表格、公式、相对链接的许可样本 HTML。可观察验收：返回标题/正文及来源 URL；存档原始 HTML 和抽取文本可分别读取；链接解析稳定；脚本/事件属性不能在工作台执行；转换缺失处可回到原 HTML。记录失败率与人工可读差异，不要求像素一致。
2. **动态网页读取：** 用本地受控动态页面验证静态 fetch 与浏览器渲染的结果差异，明确记录实际读取方式及页面状态；把导航、下载、权限、取消和日志泄露列为安全审查问题，具体产品策略另由规格确定。
3. **跨语言检索与数据读取：** 同一小语料含中英文摘要/片段、精确 DOI、query/document 配对，以及代表性 CSV/XLSX/Parquet。对比 E5-small/base/large、BGE-M3 与可选托管模型，按官方约定输入；记录 provider/model revision/维度；精确 DOI 保留词法命中；人工标注相关片段评估 Top-k，并记录 CPU 延迟/峰值内存和托管成本。数据导入检查列类型、缺失及失败文件，Parquet 比较 Python/PyArrow 与确有需要时的 DuckDB。

## 许可与未核实项

- 代码许可只覆盖代码；模型权重、转换后的 ONNX、tokenizer、量化文件和浏览器发行版需要单独核对应许可及分发义务。AGPL 项目服务端许可也不能推导 SaaS provider 的服务条款。
- 官方页面在调查日可访问并核对关键能力/许可；发布节奏只用于粗略判断维护可见度。报告没有逐项核对所有传递依赖 SBOM、商标、weights 的实际字节数、三平台安装器兼容、模型量化质量或搜索供应商内容再分发条款。
- 没有做 provider 结果质量对照、中文/跨语 embedding benchmark、CPU 性能/内存测量、动态网页安全审计、文件解析覆盖测试，也未创建 API key 或调用商业 API。当前推荐是可供下一轮原型验证的候选，不是生产选型批准。
