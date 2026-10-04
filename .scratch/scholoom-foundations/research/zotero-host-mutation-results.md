# 独立宿主：题录变更、BBT 缓存与茉莉花装载

关联 [#16](../issues/16-zotero-host-prototype.md)。2026-10-04 用户回复“很好。继续下一轮验证”。沿用[独立最小宿主](zotero-host-minimal-results.md)，验证保存后是否导出当前文献，以及第二个原插件的实际依赖。

后续[原生 DOM 实验](zotero-host-native-dom-results.md)已越过这里的 Prompt 初始化缺口，并完成原茉莉花作者拆分／保存及 BBT 消费。本文保留本轮 Node 无 DOM 条件下的失败事实，在线元数据和附件匹配仍未验收。

**BBT 的通知驱动变更链通过；茉莉花业务仍未通过。** 两次最终运行都没有启动完整 Zotero。BBT 9.0.68 和茉莉花 1.1.39 原包与执行成员不变；Node VM 提供主宿主，Chromium 原 Worker／IndexedDB 提供 BBT 缓存，题录权威仍是自己的 SQLite `literature` 表。

## BBT：修改之后还会不会导出旧内容

实际调用链：

```text
能力脚本修改 Item → saveTx 提交 literature
  → 宿主 Notifier 投递 modify/item 和 changed 字段
  → 原 BBT ItemListener → 原 citation key／cache 更新
  → 原 Worker／translator → 当前 BibTeX
```

没有直接调用缓存清理、覆盖 Worker RPC、重启插件或重建数据库。BBT 的原 `ItemListener` 读取通知，原 `cacheTouch` 使修改项的导出缓存失效并更新序列化缓存。

| 步骤 | SQLite 当前事实 | 原 BBT 的实际导出 | Worker 返回的缓存命中比例 |
| --- | --- | --- | --- |
| 首次导出 | 原题录 | 原题录 | 0 |
| 重复导出，预热确认 | 原题录 | 原题录 | 1 |
| 对照：保存修改，但使用 skipNotifier | 已有对照标题和 DOI | **仍是原题录** | 1 |
| 保存最终修改，正常通知 | 新标题、新 DOI、作者 Grace Wang | **三个字段均为新值** | 0.5 |
| 再次导出 | 最终题录 | 保持最终值 | 1 |

比例读取原 Worker JSON-RPC 的结构化 `result.cacheRate`，1 表示全部命中。原包的调试日志把 1 输出为 `1%`，不能把该文案当成实际百分数。两条记录中只修改一条，修改后的 0.5 与另一条继续使用缓存一致。

最终标题为 `Updated research agents after committed notification`，DOI 为 `10.0000/updated-with-notification`，作者为 Grace Wang。BBT 按其默认规则调整导出标题大小写，核对字段语义时允许这一正常转换。原键 `chenResearchAgentsReproducible2026` 保留，另一条中文题录的键及完整 entry 保持不变。

8 项变更行为检查通过：预热命中、无通知对照出现旧数据、原监听器收到通知、当前元数据导出、对象与权威一致、已有键保留、另一条记录不变、重复导出保持当前值。关闭数据库后以新只读连接核对全部题录字段和身份，SQLite 完整性为 `ok`。上一轮引用键和一次导出的检查也在同次运行通过。

最终[结构化证据](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-mutation/result.json)、[正常通知后的导出](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-mutation/with-notification.bib)、[无通知对照](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-mutation/without-notification.bib)及 [SQLite 文件](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-mutation/literature.sqlite)均保留。

这轮增加的是**单条普通题录修改后，指定原 BBT 的读写及缓存语义兼容**。宿主 Notifier 只实现已提交变更的顺序、类型过滤和等待投递；不覆盖事务内通知队列、批量合并、并发、删除、附件、集合、偏好变更或自动导出。

## 茉莉花：实际阻断位于元数据业务之前

源码调查找到无需网络或 translator 的较小元数据处理入口：原包 `onAddItem` 监听新增题录，启用 `autoSplitName` 后调用原 `splitName` 并 `saveTx`。预定样本是“欧阳明、李华”，成功标准是原包把复姓／普通姓拆分后保存，再由 BBT 导出同一记录。这个入口用于判断第二个原插件能否开始实际写库，不代替在线元数据识别或附件匹配验收。

实跑仍没有到达这个入口。原 bootstrap 调用原主脚本，构造 Addon／ZoteroToolkit 时触发如下调用链：

```text
bootstrap.startup → 原 jasminum.js
  → Addon → createZToolkit → ZoteroToolkit
  → PromptManager → Prompt → initializeUI → addStyle
  → UITool.createElement → document.createElementNS（宿主未实现）
```

原文件调用位置：`bootstrap.js:41`；主包 `11197` 的插件构造、`4098` 的 PromptManager、`3866` 的 Prompt、`3224/3230` 的 UI 初始化、`3690` 的 style 创建和 `857` 的 `createElementNS`。完整栈见[最终失败证据](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-jasminum-dom/result.json)。主包未完成求值，bootstrap 未返回，`onStartup` 尚未调用。姓名处理、插件保存及跨插件读回全部为 false；没有生成姓名处理的 BibTeX，也没有新增该样本记录。

装载探针预置普通偏好，避开首次运行的地区请求和 translator 更新；提供了随机字符串、空 Reader 列表与注册接口。`HiddenBrowser`、`BlockingObserver`、`E10SUtils`、`AddonManager` 仅声明命名空间，实际服务调用会明确抛出未实现；`ActorManager` 没有执行 Gecko 的模块副作用。document 只可查询空节点，未提供节点创建。这些占位没有构成对应服务的兼容验证。原包的主窗口、菜单、Prompt、Reader、actor 或隐藏浏览器仍未验收。

因此，**仅给非 UI 业务提供对象和 SQL 接口还不够：这个版本的茉莉花在业务前就需要 DOM 初始化。** 当前失败定位了代价，不能推出所有后续依赖已知，更不能推出必须运行完整 Zotero 或必须选择 Gecko。可用的内部 DOM 环境是否足够，需要下一轮实跑。

原 bootstrap 没有等待 `hooks.onStartup()` 的 Promise。探针准备了透明调用观察器，供成功越过主包求值后等待原 hook；本次没有到达它，没有用 bootstrap 已返回或人为设置 ready 冒充启动成功。

## 实现、命令及试跑记录

工件仍在[一次性原型目录](../prototypes/bbt-minimal-host-prototype/README.md)：

- `literature-store.mjs`：字段／作者保存到同一表后发送真实通知，尊重 skipNotifier；URI 使用实际 sourceID，不再从数字 ID 猜测。
- `notifier.mjs`：唯一观察器 ID、类型过滤、优先级和等待调用。
- `mutation-probe.mjs`：原导出入口、无通知对照、正常通知和重复导出，保存每步权威快照及真实产物。
- `jasminum-probe.mjs`：原 bootstrap 装载、明确的未实现服务和业务成功标准；DOM 缺口保留为失败。
- `run.mjs`：复用已有宿主提供 scenario 入口，关闭后核对全部持久字段，分别保存证据。

在项目根目录执行：

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=mutation --evidence=/new/evidence/directory
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=jasminum --evidence=/another/new/evidence/directory
```

最终运行 mutation 退出 0，jasminum 退出 2。二者均完成 BBT 原启动／引用键／导出和持久数据核对，第二次的退出 2 明确来自茉莉花 DOM 缺口。7 个 MJS 文件的 `node --check`、结构化证据／SQLite／BibTeX 核对及本地文档链接检查见[本轮核对摘要](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-round-validation.json)。没有安装依赖、启动开发服务器、提交代码或改动 Zotero 安装树。

此前试跑保留：`evidence/mutation` 首次判定失败，是实验误读缓存比例并精确匹配了 BBT 会转换的标题大小写；`mutation-final` 修正判定后通过。`jasminum-attempt-1` 是 E10SUtils 命名空间接线错误；attempt-2/3 缺随机字符串／空 Reader 列表；attempt-4 到达真实 Prompt DOM 缺口。最终证据使用上文两个带日期的独立目录，不覆盖上一轮证据。

## 下一项

限定验证茉莉花所需 DOM 初始化能否由自己的运行环境承接，然后让原包实际处理题录并写入同一文献权威。若越过启动，再推进原元数据或附件匹配入口，逐项取证 HTTP、translator 和文件服务。无需再重复已经通过的 BBT 初次导出或完整 Zotero 窗口实验。

#16 保持 claimed。当前能支持独立 BBT 的限定业务兼容；第二个插件、整体宿主选择、Electron 嵌入和跨平台分发仍缺证据。
