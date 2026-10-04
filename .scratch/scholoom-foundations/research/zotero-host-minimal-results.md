# BBT 独立最小宿主实验

关联 [#16](../issues/16-zotero-host-prototype.md)。2026-10-04 用户指出完整 Zotero 套壳偏离目标，并确认继续执行独立兼容宿主实验。

**这轮首次证明：不运行完整 Zotero，未修改的 BBT 9.0.68 可以经真实 bootstrap／startup 在我们提供的兼容接口上启动，向独立题录存储保存引用键，并用它自己的 Worker 和 translator 生成真实 BibTeX。** 成功方案是 Node 主宿主加原生 Chromium Worker／IndexedDB；纯 Node 对照在缓存初始化失败。

这只是两条普通期刊题录的代表性链路，没有完成整个插件兼容或宿主选型。前六轮保留为完整 Zotero 参考宿主证据，不支持独立兼容内核已经可用的结论。

后续[题录变更实验](zotero-host-mutation-results.md)已验证普通题录通知驱动的原 BBT 缓存更新；茉莉花装载被原工具包的 Prompt DOM 初始化阻断，尚未到达元数据业务。下文保留首次独立宿主运行时的范围和结果。

再后续的[原生 DOM 实验](zotero-host-native-dom-results.md)已让原茉莉花主包和 onStartup 在 Chromium DOM 中完成，并实际保存中文作者拆分结果，供 BBT 从同一权威导出。第二个插件目前仅覆盖这条限定处理链。

## 实跑链路与数据权威

```text
实验能力脚本
  → 原 BBT bootstrap.js / content/better-bibtex.js（Node VM）
  → 原 startup 编排，无任务删除或入口替换
  → 原 KeyManager.fill → Item.setField / saveTx
  → 独立 literature.sqlite / literature 表

原 BBT Translators.exportItems
  → 原序列化逻辑读取上述 Item
  → 原 Worker（Chromium DedicatedWorker + 原生 IndexedDB）
  → 原 Better BibTeX translator → 实际 export.bib
```

兼容对象叫 `Zotero`，声明 API 基线 10.0.5，由本轮适配代码提供；没有执行 Zotero 应用内核。只复用一份官方 10.0.5 日期格式静态资源（16110 字节），已作为样本保存，运行不需要完整 Zotero 安装树。

`literature` 表保存唯一题录事实、稳定 sourceID 及兼容 key。BBT 原 SQL 看到的 `items`、`itemData`、`itemDataValues` 是从同一表生成的只读视图；库、类型、字段表仅提供本轮需要的目录。translatorCache 保存插件资源元数据，IndexedDB 的五个对象存储保存可重建缓存，不另建一份可自由修改的当前文献库。

这回答了原型此前遗漏的问题：原包要求 SQL 表名／字段语义，不必因此把题录权威交给完整 Zotero。实际可承接到什么范围仍取决于逐项验证。

## 输入与实际结果

原 XPI 使用此前保存的 BBT 9.0.68。主宿主 Node 24.12.0；浏览器实际版本见 [结果基线](../prototypes/bbt-minimal-host-prototype/evidence/chromium/result.json)，本轮为 Chromium 153.0.8010.12。使用已有资产，没有安装依赖或启动开发服务器。

| 行为 | 实际结果 |
| --- | --- |
| 原 bootstrap／主包／startup | 成功；原编排任务保留，ready 与 startup 返回均检查 |
| 显式生成引用键 | 原包启动后首条仍无键；调用原 `KeyManager.fill` 后得到 `chenResearchAgentsReproducible2026` |
| 原有中文题录键保留 | `ScholoomPreserved2026` 保留；中文作者、标题和期刊进入实际导出 |
| 再调用 fill | 两条键均不变 |
| 插件保存与能力侧读回 | 原 setField 先暂存，原 saveTx 调用写入独立表；以 sourceID 直接查询看到保存值 |
| SQL／对象契约 | 原启动 SQL 正常运行；兼容 SQL 读到两条 citationKey，与 Item／权威记录一致 |
| BibTeX 导出 | 原 Worker 调用原 translator，产物含两条 entry、引用键、DOI 和中文字段；没有用手工文本代替导出 |
| 关闭数据库后重读 | 新建只读连接查同一表，身份和引用键一致；SQLite integrity_check 为 ok |
| 原代码不改动 | 输入 XPI 前后相同；bootstrap、主包、Worker、Better BibTeX translator 与 XPI 对应成员逐字节相同 |

为区分显式生成与启动自动生成，按普通插件配置设置 `fillKeyAfter=0`、`autoPinMigrated=true`。未改插件内部方法、编排或结果。

[真实导出](../prototypes/bbt-minimal-host-prototype/evidence/chromium/export.bib)、[SQLite 权威](../prototypes/bbt-minimal-host-prototype/evidence/chromium/literature.sqlite)、[完整结构化证据](../prototypes/bbt-minimal-host-prototype/evidence/chromium/result.json)均保存。关闭数据库后重读不是重启整个插件或缓存的验证。

## 纯 Node 对照与本轮修正

[纯 Node 证据](../prototypes/bbt-minimal-host-prototype/evidence/node/result.json)执行同一原 bootstrap 和主包，Worker 源码在 Node worker_threads 中求值。原 initialize 通过真实 JSON-RPC 返回 `IndexedDB is not supported in your environment`；startup 内捕获失败，ready 没有成立，所有业务检查未通过，退出 2。

原包主文件在 43385 行创建 ChromeWorker；worker 任务在 43434 行调用 initialize；Worker 文件 103996 行进入 Cache.open，44441 行打开五个 IndexedDB object store，44087 行在环境缺少 IndexedDB 时抛错。引用键管理任务明确依赖 worker，导出也复用这一缓存。因此本轮没有把缓存 RPC 改成空结果或强行跳过它。

Chromium 对照只替换宿主提供的 Worker 实现，使用浏览器原生 IndexedDB，随后原启动和业务链通过。实际 translator 在 Worker 104000 行经原 importScripts 装载。Node 仍控制题录权威，浏览器只承担插件 Worker。

早期试跑的字段契约、资源 URL 解码及空 tags 序列化缺口已修正。一次导出误用了 translator ID，导致进入前台 translation 分支；最终改为从原包 `bySlug.BetterBibTeX` 取标识。失败目录保留，见[试跑索引](../prototypes/bbt-minimal-host-prototype/evidence/earlier-runs.json)。这些属于原型接线错误，不归因于插件不兼容。

## 适配工作与未覆盖服务

| 契约 | 本轮实现与实际边界 |
| --- | --- |
| 文件、路径、环境和包资源 | Node 标准库；隔离临时目录与 PATH；原包资源 URL 映射到解包文件 |
| privileged bootstrap 的基础对象 | Node VM、身份透传及 chrome 注册适配；不提供 Gecko 权限、安全隔离或完整 XPCOM |
| Item／Items／Libraries／类型／DB | 两条 journalArticle 的字段、creator、保存及所需 SQL 视图；多类型、附件、集合和并发未覆盖 |
| Prefs、菜单、面板、Notifier、idle／窗口 | 支持配置和接受注册；偏好／通知／窗口／idle 事件投递及真实 UI 未实现 |
| translator 初始化与保存 | 真实资源写入临时目录和 translatorCache；导出使用原 Worker，前台 Zotero translation engine 未实现 |
| Worker／缓存／导出 | 纯 Node 缺 IndexedDB；Chromium 原生实现通过。browser bridge 仍由 Playwright 代管，未成为产品运行时 |
| 本地化、DOM、迁移等 | 本地化仅缺省标识；涉及真实 DOMParser、文件选择、旧 BBT 数据库迁移的调用明确不支持 |

适配代码见[运行说明](../prototypes/bbt-minimal-host-prototype/README.md)。这是一组有范围的接口实现，不是可发布的通用宿主。可选 git／TeXstudio 二进制探测有非致命缺文件日志；退出 0 与业务通过不等于完整生命周期或所有服务正确。

最终命令为 `node .../bbt-minimal-host-prototype/run.mjs --worker-engine=chromium`（退出 0）和同一入口 `--worker-engine=node`（预期失败，退出 2），证据参数分别指向 chromium／node 目录。四个 MJS 文件的 `node --check` 均通过；本地文档链接、结构化证据、实际导出及静态资源字节核对见[核对摘要](../prototypes/bbt-minimal-host-prototype/evidence/validation.json)。没有新增测试套件、提交代码或修改项目依赖。

## 能支持的判断

| 路线 | 当前证据 | 尚需承担的工作 |
| --- | --- | --- |
| 纯 Node 最小宿主 | 主包及 Worker 可执行；本轮缓存初始化失败，业务未通过 | 提供可用 IndexedDB 或其他原包接受的运行时；不能据这一缺口判断整条路线不可行 |
| Node 主宿主 + Chromium 原 Worker | 本轮引用键与 BibTeX 代表性链路通过，独立题录权威成立 | 通知／缓存失效、其他题录类型与文件语义、持久设置、运行时封装及插件生命周期 |
| 裁剪 Gecko 辅助宿主 | 尚未实现 | 识别可复用服务、接入同一文献权威，并实际比较维护成本 |
| 完整 Zotero 参考宿主 | 前六轮已有选定业务和工作台接入事实 | 保留完整 Zotero 的成本；不能替代独立兼容宿主证据 |

本轮支持继续评估由 Scholoom 管理文献、提供兼容接口的路线。尚不足以选定整体宿主：茉莉花未在该宿主装载，BBT 自动导出、HTTP 接口、附件导出及通知驱动的缓存更新未验收，也未把本轮 Chromium Worker 嵌入 Electron。

下一项应验证**题录修改后的通知／缓存失效，以及茉莉花一个元数据或附件匹配路径能否落到同一权威**。是否需要 Gecko 由这些真实缺口决定，不继续追加完整 Zotero 的窗口展示或重启实验。#16 保持 claimed，未写正式 Answer。
