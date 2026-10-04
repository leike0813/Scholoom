# BBT 最小宿主实验（一次性原型）

问题：不启动完整 Zotero，指定版本 BBT 原包能否在独立题录权威上保存引用键、实际导出并在题录修改后更新缓存？茉莉花原包能否在同一宿主中处理元数据？

本目录验证这条业务链，不实现生产插件加载器。题录只保存在临时 `literature.sqlite` 的 `literature` 表；`items`、`itemData`、`itemDataValues` 是只读 SQL 视图。原 BBT 对象读写经 Item 适配落到该表。IndexedDB 的 Serialized／Export 等对象存储属于可重建插件缓存。

## 运行

在项目根目录执行，使用本机已有 Node 24.12.0、`unzip` 和 BBT 9.0.68 XPI：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=node
```

纯 Node 对照预期退出 2：原 Worker 在 IndexedDB 初始化失败，引用键与导出未验证。启动函数内部捕获异常后返回，不算插件启动成功。

复用本机已有 Chromium／Playwright，让原 Worker 使用浏览器原生 IndexedDB：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium
```

本机路径变化时，通过 `--xpi=/absolute/path/zotero-better-bibtex-9.0.68.xpi`、`SCHOLOOM_PLAYWRIGHT_MODULE`（完整 `index.mjs` 路径）和 `SCHOLOOM_CHROMIUM_PATH` 指定现有资产。实验不安装依赖。`--evidence=/new/output/directory` 保存结果、临时数据库及实际导出；默认只写新建的 `/tmp/scholoom-bbt-minimal-*`。

Chromium 使用一个本地空页面承载 DedicatedWorker，无可见工作台，没有开发服务器。Node 执行原 bootstrap 和主包；原 Worker 与 translator 通过本地资源映射运行。没有启动 Zotero 可执行文件、加载它的应用内核或读写日常文献库。

验证已导出题录的变更，默认设置不变，执行：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=mutation
```

包含预热缓存、屏蔽通知的失败对照、正常保存通知及再次导出。茉莉花原包装载和姓名处理目标使用 `--scenario=jasminum`，当前预期退出 2：原主包求值时需要 Prompt DOM，宿主尚未实现 `document.createElementNS`，姓名处理没有执行。用 `SCHOLOOM_JASMINUM_XPI` 指定已有 1.1.39 XPI 路径。

用真实 Chromium DOM 承接茉莉花原主包，验证原新增通知触发的中文姓名拆分、SQLite 保存及 BBT 导出：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=jasminum-dom
```

该场景退出 0。关闭自动拆名的对照保持完整姓名，开启后原包保存拆分结果。页面仅投影通知携带的样本 ID，saveTx 经 RPC 写同一 SQLite；真实 DOM 创建成功，Gecko 专属模块及 UI 注册仍为占位，在线元数据／附件匹配没有验收。

执行原茉莉花元数据任务，使用合成 PubScholar HTTP 输入、无结果对照和原插件自己的建项回退，再关联原 PDF 并让 BBT 导出：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=jasminum-metadata
```

该场景退出 0，但没有验证线上服务。原包请求的 RIS ID 与本机官方文件的注册 ID 不同，任务实际走原插件回退；另用正确注册 ID 执行未修改官方 RIS 的导入对照，两者分开记录。已有 RIS 资产通过 `SCHOLOOM_RIS_TRANSLATOR` 指定；默认复用此前实验的临时文件，所有输入路径均记录在 result.json。详细边界见[元数据任务报告](../../research/zotero-host-metadata-results.md)。

## 工件

- `run.mjs`：真实 bootstrap／startup、窄宿主契约、显式 fill、重复 fill、实际导出和落盘核对。整条业务调用限时 30 秒。
- `literature-store.mjs`：独立 SQLite 权威与只读兼容视图；字段先暂存，save／saveTx 写库后投递通知。
- `notifier.mjs`、`mutation-probe.mjs`：顺序通知投递与原 BBT 缓存变更实验，含无通知对照。
- `jasminum-probe.mjs`：原茉莉花装载和业务探针，明确记录未实现服务；未越过 Prompt DOM 初始化。
- `jasminum-dom-probe.mjs`：真实 Chromium DOM 中执行原 bootstrap／主包和 onStartup；有限 Item 投影、保存桥接及作者处理／关闭偏好对照。
- `metadata-task-probe.mjs`、`fixtures/pubscholar-protocol.json`：原搜索／建项／附件关联任务，合成协议输入及无结果对照；官方 RIS 原文件的独立导入对照。
- `node-worker.mjs`：Node Worker 对照，执行原 Worker 内容；没有 IndexedDB 实现。
- `chromium-worker.mjs`：原生 Worker／IndexedDB 对照，不改 BBT 内容，不剪启动任务图。
- `fixtures/dateFormats.json`：16110 字节静态日期资源，逐字节复制自此前下载的官方 Zotero 10.0.5 `app/omni.ja` 中 `resource/schema/dateFormats.json`。运行无需 Zotero 安装树。题录复用 [现有样本](../zotero-host-prototype/fixtures/items.json)。
- [实跑报告](../../research/zotero-host-minimal-results.md)、[纯 Node 证据](evidence/node/result.json)、[Chromium 对照证据](evidence/chromium/result.json)、[真实 BibTeX](evidence/chromium/export.bib)、[核对摘要](evidence/validation.json)。
- [变更及茉莉花报告](../../research/zotero-host-mutation-results.md)、[变更成功证据](evidence/2026-10-04-mutation/result.json)、[茉莉花 DOM 失败证据](evidence/2026-10-04-jasminum-dom/result.json)。
- [原生 DOM 及作者处理报告](../../research/zotero-host-native-dom-results.md)、[成功证据](evidence/2026-10-04-native-dom/result.json)、[跨插件实际导出](evidence/2026-10-04-native-dom/jasminum-dom-names.bib)。
- [元数据任务报告](../../research/zotero-host-metadata-results.md)、[成功证据](evidence/2026-10-04-metadata-final/result.json)、[含 PDF 路径的实际导出](evidence/2026-10-04-metadata-final/metadata-parent.bib)、[核对摘要](evidence/2026-10-04-metadata-validation.json)。

## 结果边界

BBT 9.0.68 的两条普通期刊题录、引用键生成／保留／重复调用、对象／SQL 一致和一次 Worker BibTeX 导出通过。以正常插件设置关闭启动时自动填键，保证生成动作来自显式 `KeyManager.fill`。原包、bootstrap、主包、Worker 和实际 translator 成员均做字节核对。

这里的 `Zotero` 对象是我们提供的兼容接口。API 基线声明为 Zotero 10.0.5；这不表示加载了完整 Zotero，也不表示已经实现全部 API。

题录 modify 通知投递及原 BBT 缓存更新已实跑，屏蔽通知确实产生旧数据。通知实现未覆盖事务队列、批量合并和并发。菜单、设置面板、主窗／idle／偏好观察器只接受注册，未实现事件投递及 UI；本地化用缺省标识。数据类型、附件及空集合只支持样本。旧库迁移、其他字段／类型、自动导出、真实 HTTP 服务、卸载、缓存跨重启及 Electron 嵌入没有验收。初始化中可选二进制探测的非致命日志保留在证据中。

本原型证明独立文献权威可以满足代表性 SQL／对象契约。它没有证明整个 BBT、茉莉花或任意 Zotero 插件兼容，也不决定正式数据库 Schema 或进程架构。

茉莉花的原 Prompt DOM 初始化、onStartup 结束及通知触发的中文作者拆分／保存已通过。内部页面 getMainWindows 列表为空，菜单 popup 缺失；XUL、actor、Reader、主窗口加载和插件全部生命周期没有通过此场景验收。

元数据场景补充普通期刊新建、标签及 PDF parentID／文件路径读取，原 BBT 导出含该附件路径。仅关联已有临时 PDF，未覆盖下载、移动、托管存储或外部链接语义。官方 RIS 对照只支持这条期刊输入，notes／attachments 为空；不能扩大为完整 translation 引擎。
