# 独立宿主：茉莉花元数据任务与 PDF 关联

关联 [#16](../issues/16-zotero-host-prototype.md)。2026-10-04 用户同意继续验证原元数据／附件任务，复用上一轮 Node／Chromium 宿主和独立 SQLite。

**原茉莉花 1.1.39 已完成“解析中文 PDF 文件名 → 搜索 → 筛选结果 → 新建题录 → 关联原 PDF”；原 BBT 9.0.68 从同一文献权威实际导出该题录和附件路径。** 全程没有运行 Zotero 应用，两份 XPI 与执行成员不变。

网络边界返回的是明确标注的合成 PubScholar 协议样本，未请求线上服务。这证明宿主能承接这条任务的业务读写，尚不证明真实论文在线识别、站点访问或搜索质量。

## 原任务和对照

实验输入是已有两页 PDF 的临时副本，文件名为 `中文文献元数据任务验证.pdf`。原插件使用 `{%t}` 文件名模式；没有执行 PDF 文本提取、OCR 或自动猜测标题。

```text
SQLite 中的顶层 PDF 附件
  → 原 taskRunner.createTask / runTask
  → 原文件名解析、PubScholar 查询与结果筛选
  → HTTP 边界提供合成响应
  → 原 articleToRIS / importRIS
  → 请求的 translator ID 未注册
  → 原插件捕获异常，执行自己的 createItemFromArticle 回退
  → Item.saveTx 写同一 SQLite，新建后发送 add 通知
  → 原插件保存附件 parentID，发送 modify 通知
  → 原 BBT 引用键和 Worker BibTeX 导出
```

宿主没有注入 searchResult、预设 parentID、伪造任务成功或改写插件建项逻辑。HTTP 适配只返回状态和原始 JSON 字符串；结果转换、标题匹配、相似度和后续服务跳过均由原插件执行。显式调用任务入口，未验收菜单、进度窗口或任务队列界面。

| 观察 | 实际结果 |
| --- | --- |
| 无结果对照 | 先返回空 content；原任务状态 fail、结果为空，没有 RIS 导入、新题录或附件变更。原包实际发出两次查询，检查不限制内部调用次数 |
| 命中样本 | 原 POST 查询来自文件名，原插件选中唯一 PubScholar 记录，similarity 为 1，任务 success |
| 原插件建项 | 标题、作者、期刊、年份、卷期、页码、DOI、摘要和 URL 写入 SQLite；原插件按偏好移除自动标签 |
| 附件关系 | 原附件 ID 5 保留，parentID 保存为新题录 ID 6；父项 getAttachments 从同一表派生得到 ID 5 |
| 文件 | PDF 字节、路径和附件身份保持；仅新增父子关系，没有复制入库、下载、重命名或移动实验 |
| 跨插件消费 | 原 BBT 导出含标题、DOI、原作者、引用键和原 PDF 路径，文件见 metadata-parent.bib |
| 持久保存 | 关闭后新建只读连接核对全部七条记录，字段／身份一致，SQLite integrity_check 为 ok |
| 原有行为 | 原有两条题录不变；作者拆分及关闭偏好的对照通过，缓存变更场景回归通过 |

七条记录包括原有两条题录、两个作者处理样本、一个 PDF、原任务建出的父题录，以及下面的独立 RIS 对照题录。对照题录用于验证导入器，不是原任务重复建项。

## RIS 导入的真实缺口

原茉莉花请求 `32d59d2d-b6a9-4a3a-bd44-1cc23d3d2c49`；本机此前实验资产中的官方 RIS 文件注册为 `32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7`，其 header lastUpdated 为 `2026-01-05 18:52:35`。本轮没有把两个 ID 偷换或互相映射。请求 ID 找不到 translator，原插件自己捕获错误并回退建项；任务整体成功不等于原 RIS 导入分支通过。

另一个对照使用该 RIS 文件的真实注册 ID，输入仍是原茉莉花刚生成的 RIS。宿主解析结构化 header 后执行完整、未修改的 translator body；原 doImport 经行读取、new Zotero.Item 和 complete 产生 DTO，再经相同 Item 保存桥写 SQLite。标题、DOI、页码和作者实际导入成功，保留关键词标签。原文件与证据副本逐字节相同。

这支持样本上的官方 RIS 导入契约，不代表完整 translator 引擎兼容。当前字段有效性和日期工具只支持这条普通期刊样本；translator 完成输出中的笔记和附件不保存，本样本两者为空。请求 ID 的差异仅是本次两份固定资产的观察，不据此断言其他版本或官方完整环境必然失败。

## 本轮补充的宿主契约

`literature-store.mjs` 保持 literature 单一权威，SQL items 视图按真实 itemType 映射类型；增加附件文件路径、parentID、标签和派生 getAttachments。浏览器 Item 支持新建题录及有限属性，通过 RPC 保存；新建字段提交后发 add，已有题录更新发 modify。页面只接收本次通知的有限 ID，没有全库投影。

HTTP 是离线响应适配，没有验证签名／Cookie、TLS、重定向、重试、线上协议或授权。Utilities.Internal.md5 仅对本任务 ID 返回 Node 预先实际计算的摘要，不是完整通用工具实现。库固定为 libraryID 1，集合和笔记为空。当前 saveTx 是样本保存接口，没有验证新建／关系更新的跨请求原子性、失败回滚、并发、批量或崩溃恢复。

Gecko actor、Reader、主窗和菜单仍保留上一轮的占位边界。没有为此任务加载完整 Zotero 或实现这些服务。

## 运行与证据

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=jasminum-metadata --evidence=/new/evidence/directory
```

本机 RIS 路径变化时用 `SCHOLOOM_RIS_TRANSLATOR=/absolute/path/RIS.js` 指定已有官方资源。无需安装依赖或启动开发服务器。

最终场景退出 0，13 项元数据检查、作者处理及 BBT 基线通过。`--scenario=mutation` 和 `--scenario=jasminum-dom` 两项回归均退出 0。语法、SQLite、附件、导出和文档链接核对见[核对摘要](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-validation.json)。

- [完整结果与原调用轨迹](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/result.json)、[SQLite](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/literature.sqlite)、[实际 BibTeX](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/metadata-parent.bib)。
- [HTTP 协议输入](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/metadata-http.json)、[原包生成的 RIS](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/metadata-generated.ris)、[未改动的官方 RIS 文件](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/RIS.js)、[PDF 副本](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-final/metadata-fixture.pdf)。
- [缓存变更回归](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-mutation-regression/result.json)、[作者处理回归](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-metadata-dom-regression/result.json)。

保留失败过程：metadata-attempt-1 的新 Item 缺 libraryID setter；metadata-attempt-2 把未分配的 ID 传给 SQLite 查询。修正宿主后 metadata-attempt-3 成功。增加无结果对照后的 `2026-10-04-metadata` 因探针错误地限定一次 HTTP 查询而失败，实际原任务已正确失败且未建项；改为检查无结果与无副作用，最终全部通过。这些是宿主／探针错误，未修改原插件。

## 对宿主选择的意义

独立 Node／Chromium 候选已有 BBT 引用键、导出和缓存更新，以及茉莉花作者处理、固定协议输入下的元数据建项与 PDF 关联证据。原插件能够直接改变我们的文献事实，支持继续评估该候选；目前不能承诺整个 BBT、茉莉花或任意 Zotero 插件兼容。

用户随后结束原型，并在 [#16](../issues/16-zotero-host-prototype.md) 确认 Node＋Chromium 通用兼容层、固定 Zotero 10 基线，以重要插件推动开发适配而不承诺全部插件无缝运行；票已 resolved。真实在线请求、独立阅读器大纲／书签写回、Electron 运行时封装和跨平台分发转入正式实现验收，不继续安排本原型实验，也不以此前完整 Zotero 中的成功代替。
