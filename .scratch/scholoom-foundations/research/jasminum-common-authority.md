# 茉莉花原包与共同题录权威：有界一手来源调查

调查日期：2026-10-29。项目基线：`dev b69f08e`。方法：只读本地契约、GitHub 官方仓库 API 与固定 commit 的 raw 源码，另对两个 XPI 地址做 HEAD 请求；未下载 XPI、未核验包内字节，未构建、安装或运行插件、模型及测试，也未接触真实数据。本文是静态事实研究，不能替代任务 2.3 的最终验收。

结论接收方：[共同权威任务 2.3](../../../openspec/changes/archive/2026-10-30-define-library-zotero-record-authority/tasks.md)、父任务实施者。父任务选择版本及实施范围；本文不修改 OpenSpec、不设计新公共接口、不把 BBT 结果算作茉莉花结果。

## 结论与既有资料核对

官方主仓仍为 [`l0o0/jasminum`](https://github.com/l0o0/jasminum)，插件身份为 `jasminum@linxzh.com`。当前可取得的最新稳定 release 是 **v1.1.43**；既有原型对应的 **v1.1.39** 也仍提供原始 XPI。两版 `package.json` 均声明 `AGPL-3.0-or-later`，但 Zotero 清单上限已从 `10.*.*` 扩到 `11.*.*`。[R1–R6]

最小、可明确追到真实保存的候选是原菜单的 **中文姓名拆分**：原 `commandListener → splitName(item) → getCreators/setCreators → saveTx`。这能在已有普通期刊记录上改原值，不要求新增文献、下载 PDF 或调用模型。它自身没有直接 SQL；固定 Zotero 基线中，`saveTx` 下游才进入事务、creators SQL 与通知队列。因此它能作为共同保存／SQL一致性／通知／失败保护的代表候选，**单独执行函数或查看返回值不覆盖全部四项，也不证明原包直接 SQL 调用兼容**。[J1、J2、Z1–Z4]

当前 `ZoteroHost` 只接受 BBT 9.0.68；`JournalItem` 有 `getCreators`、没有 `setCreators`，`JournalCatalog.fill` 又把共同提交限定到补缺引用键。因此这个候选还不能直接在当前宿主上执行。已有 `library.commitRecords` 可以保存完整 `original.creators`，共同权威没有缺少这类载荷；缺口主要在原包装载、入口可达、creator 草稿／提交与异步完成的宿主接线。[L1–L5]

前置材料已核对：

- [原插件宿主调查](zotero-plugin-host.md)中的 1.1.39 身份、清单 `9.0.3` 至 `10.*.*`、Gecko 特权宿主依赖与本次固定源码一致。它引用的 `main` 快照没有固定 commit，本报告补上 tag 解引用，不能继续把该旧快照当作“当前最新”。
- 原调查所引 [Zotero 7 开发文档](https://www.zotero.org/support/dev/zotero_7_for_developers)与 [Electron 扩展文档](https://www.electronjs.org/docs/latest/api/extensions)用于说明加载机制；本次函数与数据语义以固定上游源码为依据，不从机制说明推导兼容已通过。
- [原型结果](zotero-host-prototype-results.md)记载的是完整 Zotero 10.0.5 下的选定 Reader／离线元数据回放路径，不是当前 Node＋Chromium 共同库接线；本次没有重跑或独立复核那些运行证据。该报告开头仍保留当时“用户尚未选择路线”的表述，最终路线以已解决的[决议 05](../issues/05-zotero-compatibility-policy.md)为准。
- 决议 05 的首批 BBT＋茉莉花原包不改、Node＋Chromium、用户无需安装 Zotero，以及任务 2.3 的两个原包消费者均保留。仅验证姓名工具不能替代决议 05 中中文元数据、translators／CSL、本地匹配及 PDF 大纲／书签的其他功能验收。

## 可取得版本、原包来源与许可

| 项目 | 既有原型版本 v1.1.39 | 当前最新稳定版 v1.1.43 |
| --- | --- | --- |
| 官方发布时间 | 2026-09-02 08:20:51 UTC | 2026-10-22 07:38:51 UTC |
| Release | [v1.1.39][R1] | [v1.1.43][R2] |
| Tag 所指 commit | `b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0` | `b85bbb75090885cecd7f4e1c6fe1466ed6801881` |
| Tag 解析 | annotated tag 对象 `71f6a600ee12dc8703f7eb5ab6d94216ae207b90`，再解到上述 commit | ref 直接指向上述 commit |
| 官方原 XPI | [jasminum_1.1.39.xpi][X39] | [jasminum_1.1.43.xpi][X43] |
| GitHub asset ID／大小 | `540855639`／406,468 bytes | `665066396`／1,802,261 bytes |
| 本次可达性核对 | 跟随重定向的 HEAD 最终 HTTP 200 | 跟随重定向的 HEAD 最终 HTTP 200 |
| 源码版本／身份／许可 | `1.1.39`／`jasminum@linxzh.com`／`AGPL-3.0-or-later` [R3] | `1.1.43`／同一 ID／`AGPL-3.0-or-later` [R4] |
| 源码清单声明 | `strict_min_version: 9.0.3`，`strict_max_version: 10.*.*` [R5] | `strict_min_version: 9.0.3`，`strict_max_version: 11.*.*` [R6] |

`releases/latest` API 在本次查询返回 v1.1.43；这是查询时状态，不保证以后仍为 latest。[R2] 两版源树都有 AGPL v3 的 [LICENSE（1.1.39）][R7]／[LICENSE（1.1.43）][R8]；“or-later”来自各自 `package.json` 的明确声明。GitHub 仓库 license 检测显示 `AGPL-3.0`，不能据此省去包声明中的后续版本许可。本文未审计捆绑第三方代码的完整许可清单。

源码 `addon/manifest.json` 的名称、版本、ID 等使用构建占位符；[构建配置][J8]把 `package.json` 配置与版本注入，定义 XPI 命名、下载模板和 `src/index.ts` 打包入口。release API＋tag＋构建配置给出可追溯的来源，但未证明已发布 XPI 与该 commit 逐字节对应，也未读取包内最终 manifest。

v1.1.40 release 已加入 AI 元数据识别；v1.1.41 release 说明扩展 Zotero 11 范围，AI 图片识别要求 Zotero 10 或以上及模型，并说明更新元数据菜单暂不开放。[R9] 本文完整调用链以 **1.1.39 固定源码**为范围；对 1.1.43 只补核 release、许可、清单和 `tools.ts` 的姓名函数，后者仍保留同名 `setCreators → saveTx` 路径。[R10] 这不是替父任务锁版，也不表示新旧版初始化／菜单完全相同。

Zotero 10.0.5 落在两份源码清单声明范围内。**声明覆盖、完整 Zotero 原型记录、当前兼容宿主实跑是三种不同证据；本次没有新增任何 Zotero 10 兼容实跑结论。**

## 最小代表调用链：既有条目的中文姓名拆分

以下均为 v1.1.39 commit `b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0` 的静态事实。

| 层次 | 原函数与宿主 API | 可确定的行为／限制 |
| --- | --- | --- |
| 原包装载 | `addon/bootstrap.js::startup`，`Components.classes[…addon-manager-startup…].getService`，`Services.io.newURI`，`registerChrome`，`Services.scriptloader.loadSubScript` | 加载 `chrome/content/scripts/jasminum.js`，随后调用 `Zotero.Jasminum.hooks.onStartup()`；bootstrap **没有 await 或 return 该 hooks Promise**。[J3] |
| 实例与启动 | `src/index.ts` 创建 `Addon`；`hooks.ts::onStartup` 等待 `initializationPromise/unlockPromise/uiReadyPromise` | 注册 headless actor、偏好、notifier、菜单、Reader toolbar、列和样式监听；启动并非只加载姓名函数。`Addon.api` 没有公开 `splitName/mergeName`。[J4、J5] |
| 原菜单入口 | `menu.ts::registerMenu` 的 `toolsMenuItems` 中 `label: "splitName"` 的 `commandListener`；`ztoolkit.Menu.register("item", …)` | 经 `Zotero.getActiveZoteroPane().getSelectedItems()` 对选中项逐个调用 `splitName(item)`；工具菜单的可见性用 `isTopLevelItem/isRegularItem`。该 listener 没有 await／return 各次保存 Promise。[J1] |
| 姓名变化 | `tools.ts::splitName`，`item.getCreators()`，`item.setCreators(creators)` | 原数组顺序迭代，修改 `lastName/firstName/fieldMode`；复姓表支持“欧阳”等。中文已有 `fieldMode=0` 且 `firstName` 非空的 creator 跳过；英语拆分取决于 `getPref("splitEnName")`。[J2、J6] |
| 保存 | 同函数 `await item.saveTx()` | 函数本身没有 catch、没有直接 `Zotero.DB`、没有 `Notifier.trigger`；保存／SQL／发通知语义由宿主实现。`mergeName` 也走 `getCreators → setCreators → saveTx`。[J2] |
| 原包观察者 | `notifier.ts::registerNotifiers → registerNotifier → onAddItem`；`Zotero.Notifier.registerObserver`、`Zotero.Plugins.addObserver` | 注册 `item` 观察者并在关闭时解除；`onAddItem` 仅处理 `event="add", type="item"`。既有条目拆分产生的 `modify` 会被它忽略，不能把该观察者无动作视为通知失败。wrapper 调 `onNotify` 也没有 await；自动拆分分支同样没有 await `splitName`。[J7] |

可人工推导的独立样本：原 creator 为 `creatorType: "author", lastName: "欧阳明", firstName: "", fieldMode: 1`，按源码应变为 `lastName: "欧阳", firstName: "明", fieldMode: 0`；数组位置及其他 creator 字段不由该函数主动改写。这只是源码推导预期，没有执行样本。[J2]

调用可达性不能略过：`splitName` 是 TS 模块 export，不等于原发布包提供 `Zotero.Jasminum.api.splitName`。本次核对的 `Addon.api` 仅有 outline、HTTP 文档、远程帮助与 headless browser 相关入口。[J5] 最小候选的真实入口是原包所注册的菜单回调；重新编译导出此函数或复制源码调用不满足原包不改，菜单 callback 如何在宿主中可达仍需实施核查。

### SQL、通知与失败保护分别来自哪里

这里对照的是项目 [versions.json][L1] 固定的 Zotero 源码 commit `ca61760225d25191d0c65acbfd0c4f12a172d263`，不是让 Scholoom 运行外部 Zotero。

| 任务维度 | 固定上游源码事实 | 当前能否算验收证据 |
| --- | --- | --- |
| 真实保存 | `DataObject.saveTx` 复制 options 并置 `tx=true` 后调用 `save`；`save` 经 `DB.executeTransaction` 调 `_saveData/_finalizeSave`。[Z1] | 只能确定插件期待的保存语义。当前 `JournalItem.saveTx` 是调用 `save` 的别名，真正持久提交在外层 `JournalCatalog.fill`，不能把函数名或投影变化当共同库已提交。[L3] |
| SQL | `Item.setCreators` 按序调用 `setCreator`；`Item._saveData` creators 分支调用 `Creators.getIDFromData(data,true)`，经 `DB.queryAsync` 执行 `INSERT OR REPLACE INTO itemCreators(itemID, creatorID, creatorTypeID, orderIndex)`，删除位置另有 DELETE。[Z2] | 姓名函数本身没有原包直发 SQL。共同库持久原值、宿主 SQL 投影和 Item API 的一致性仍需真实读取验证；不能宣称此调用已覆盖茉莉花直接 SQL，或用手写 SQL／BBT 结果代替茉莉花消费者。 |
| 通知 | `Item._saveData` 主数据新增／更新分支排队 `Notifier.queue('add'/'modify','item',…)`；初始化将 DB begin／commit／rollback 对接 `Notifier.begin/commit/reset`。[Z2、Z3] | 这是 Zotero 的静态队列机制。当前 `JournalCatalog` 是另一个提交后投递实现，只有真实共同提交后观察原包／宿主消费者，才可判断其语义是否成立。[L3] |
| 失败保护 | 上游 `save` 对错误调用恢复处理后重新抛出；DB `executeTransaction` 先等待底层事务完成，再调用 commit callbacks，异常路径运行 rollback callbacks 并抛出。[Z1、Z4] | 不由此推出跨进程回执、未知结果、通知失败处理已通过。commit callback 处于物理提交之后，后续异常也不能简单等同数据库未提交；Scholoom 须沿其共同回执核查。 |

这个候选为“已有记录的原值修订”提供最小真实写入触发点。任务 2.3 的 SQL、通知与失败保护仍须逐项保留；如果所选验收还要求茉莉花原包显式调用 `Zotero.DB.queryAsync`，本次有界阅读没有给出这样的茉莉花调用点，不能据此删去该要求。

### DOM／HTTP／PDF 边界

- **姓名业务函数本体**：没有 DOM、HTTP、PDF 读取或模型调用；中文分支只处理 creators，英文分支还读取 `Zotero.Prefs.get`。[J2、J6]
- **原菜单入口**：需要活动 pane 的选中项，以及 toolkit 菜单注册和可见性判断。不能从函数本体无 DOM 推导原包无窗口依赖。[J1]
- **原包初始化**：`headlessBrowser.ts` 顶层就导入 `ActorManager.mjs`、`BlockingObserver.mjs`、`E10SUtils.sys.mjs`；`registerHeadlessActor` 调 `ChromeUtils.registerWindowActor/unregisterWindowActor`。即使不抓元数据，这些源码仍进入打包初始化依赖。[J4、J9]
- **窗口与阅读器注册**：启动会注册 Reader `renderToolbar`、题录树列、偏好页及偏好窗口样式监听；注册不等于读取 PDF 内容，但宿主仍须承接这些实际调用。[J4、J7、J10]
- **启动可能访问 HTTP**：`initPrefs` 在 firstRun 时调用 `isMainlandChina`，其经 `requestDocument → Zotero.HTTP.request(responseType:"document")` 请求 `https://ip.chinaz.com/` 并用 XPath 解析；缺少 translatorSource 时还调用 `bestSpeedBaseUrl`。`onMainWindowLoad` 在自动更新偏好开启时延迟调用 `updateTranslators`。默认 `firstRun=true`、`autoUpdateTranslators=true`、`translatorSource=""`，不能把整包启动描述为天然离线。[J4、J11–J13]

较大的元数据候选确有保存路径：`services/index.ts` 在单条翻译结果后调 `globalItemFix`，附件分支设置 `parentID` 后 `saveTx`；snapshot 分支可能 `fromJSON/eraseTx/setCollections/saveTx`，而翻译错误或空结果先设 task fail 返回。[J14] 它牵涉抓取／翻译、新建／删除及附件关系，超出当前 JournalCatalog 的已有普通期刊补键能力；本文只记录这个事实，不将姓名工具包装成元数据识别验收。

## 对现有契约的复用与确切缺口（八项）

以下是现状对照，未提出新的公共操作名、DTO 或权限。现有普通期刊限制、共同权威及数据保护要求继续有效。

| # | 可直接复用的现有部分 | 确切缺口及依据 |
| --- | --- | --- |
| 1 | `ZoteroHost` 的独立 profile、原 bootstrap VM 装载、有界串行执行、诊断及关闭监督结构 | `initialize` 明确检查 BBT 9.0.68 的版本／ID，ready 又依赖 `BetterBibTeX.starting`；`versions.json` 没有茉莉花登记，`fillKeys/export` 均绑定 BBT。当前不是能直接放入 Jasminum XPI 的通用入口。[L1、L2] |
| 2 | `createEnvironment` 已有资源范围检查、Prefs、部分 chrome／Components 与脚本执行能力 | `resource` 仅识别 BBT chrome host，本地化硬读 `locale/en-US/better-bibtex.ftl`；仅有 `loadSubScriptWithOptions`，茉莉花 bootstrap 用 `loadSubScript`。其 actor 模块导入、actor 注册、`uiReadyPromise`、Plugins、Reader、ItemTreeManager 与窗口／pane 行为也未由当前环境实现；已有返回空窗口／null pane 不能提供原菜单入口。[L4；J1、J3、J4、J7、J9] |
| 3 | `HostCatalog` 已通过 `zotero: Record<string,unknown>` 注入领域 facade，并以 `item(sourceId)` 映射共同身份；`JournalItem.getCreators` 返回原值克隆 | 缺少 `setCreators`、creator 草稿与完整顺序／角色保存；菜单可见性所需 `isTopLevelItem` 也不在当前 JournalItem。原包菜单 callback 不在 `Addon.api`，不能假设存在可调用导出。[L3、L4；J1、J2、J5] |
| 4 | 现有 `library.commitRecords` 已允许 `original`（含完整 creators）且不要求 key；共同 SQLite 提交、修订核对、历史和回执由 `LiteratureCatalog.commitRecords` 持有 | `JournalCatalog.set` 只接字符串 `citationKey/extra`，`fill` 又要求缺失键及 draft key；纯 creators 修订不能形成共同提交。现有 `managed.ts` 只分派 `zotero.fillKeys/export`，也没有茉莉花工作的内部接线。公共载荷已足够表示姓名原值变化，无须从这项调查发明公共接口。[L3、L5、L6] |
| 5 | `JournalCatalog` 的 SQLite 投影与 `DB.queryAsync/valueQueryAsync/columnQueryAsync/executeTransaction` 兼容 facade 可复用 | 当前 `itemData/itemDataValues` 只投影 citationKey，没有 creators／itemCreators 投影；原值更新后的 SQL、Item、重启读取一致性尚无茉莉花证据。该内存 SQLite 不是共同持久权威，亦不能将其执行任意 SQL 的能力暴露为库 SQL 公共口。[L3；Z2；共同权威 design] |
| 6 | `JournalCatalog` 已有按类型／优先级的观察者、提交后刷新及投递、通知失败保留 committed receipt | 现有 save 的变化检测只看字段草稿，不能感知 creators；原包额外需要 `Zotero.Plugins.addObserver`。其 `onAddItem` 忽略 modify，而且异步链多处未 await；仅注册成功或 listener 同步返回不足以确认写入／通知完成。[L3、L4；J1、J3、J7] |
| 7 | `managed.ts` 现有 `commitRecords → commitResult` 查询及 `outcomeUnknown` 保护、`JournalCatalog.fill` 的拒绝不通知和 finally 清草稿、Host 的在途写入归属 | 原包菜单和启动 hooks 丢弃 Promise，不能直接套用一个已完成的外层 operation 就结束 staging；迟到 `saveTx`、真实 SQL 中途失败、CAS／撤权拒绝、提交后刷新／observer 失败与失联结果都缺茉莉花自身运行证据。沿共同 requestId／receipt 核查，不自动重放。[L2、L3、L6；J1、J3、J7] |
| 8 | 现有 `journalOriginal` 可容纳 schema 44 的普通期刊 creator 角色、fieldMode 和顺序；现有测试定义及 delivery 提供 BBT／共同库核对入口 | 没有本次茉莉花原包共同库运行结果，不能把测试定义、旧 Gecko 原型或 BBT 通过改称 2.3 完成。当前 creator 校验／CSL分离、固定键及源身份保留也必须在茉莉花修改后核对；任何后续版本、系统和分发承诺仍以相应实测为限。[L5、L7、L8] |

## 固定来源与不确定项

上游事实优先引用 commit 永久链接；release API 与 HEAD 记录仅代表调查时的官方发布状态。

### 官方发布与身份

- [R1] [v1.1.39 release API][R1]；[annotated tag ref](https://api.github.com/repos/l0o0/jasminum/git/ref/tags/v1.1.39)；[tag 对象解引用](https://api.github.com/repos/l0o0/jasminum/git/tags/71f6a600ee12dc8703f7eb5ab6d94216ae207b90)。
- [R2] [v1.1.43 release API][R2]；[latest API](https://api.github.com/repos/l0o0/jasminum/releases/latest)；[tag ref](https://api.github.com/repos/l0o0/jasminum/git/ref/tags/v1.1.43)。
- [R3–R8] 两版 [package.json][R3]／[package.json][R4]、[manifest][R5]／[manifest][R6]、[LICENSE][R7]／[LICENSE][R8]，均固定 commit；[官方仓库元数据](https://api.github.com/repos/l0o0/jasminum)用于核对所有者与 license 检测。
- [R9] [v1.1.40 release](https://github.com/l0o0/jasminum/releases/tag/v1.1.40)、[v1.1.41 release](https://github.com/l0o0/jasminum/releases/tag/v1.1.41)；[R10] [1.1.43 tools.ts][R10]，姓名函数在 171–234 行。

### 茉莉花固定源码：1.1.39

- [J1] [menu.ts][J1]：54–74 行姓名菜单，127–147 行 tools menu 与 toolkit 注册。
- [J2] [tools.ts][J2]：11–169 行复姓表，171–234 行 splitName／mergeName。
- [J3] [bootstrap.js][J3]：14–46 行装载／启动，56–77 行关闭。
- [J4] [hooks.ts][J4]：23–74 行启动、窗口及关闭流程。
- [J5] [addon.ts][J5]：15–23 行 API 类型、56–80 行实例构造；[index.ts](https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/index.ts)为实际打包入口。
- [J6] [prefs.ts][J6]：12–14 行原生 Prefs getter；[J7] [notifier.ts][J7]：12–78 行 observer，103–129 行列／Reader 注册。
- [J8] [zotero-plugin.config.ts][J8]：4–45 行构建配置；[release workflow](https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/.github/workflows/release.yml)只作发布流程定义参考，未核验 workflow 运行。
- [J9] [headlessBrowser.ts][J9]：1–8 行顶层模块依赖、602–647 行 actor 注册／解除；[J10] [styles.ts][J10]：82–89 行窗口监听。
- [J11] [preferences/main.ts][J11]：43–85 行 initPrefs；[J12] [http.ts][J12]：30–36 行 HTTP 文档读取、51–93 行地域检测；[J13] [addon/prefs.js][J13]为默认配置。
- [J14] [services/index.ts][J14]：305–348 行翻译结果、父子关系及保存路径。

### Zotero 固定基线源码与本地契约

- [Z1] [dataObject.js][Z1]：1079–1125 行事务保存／错误传播，1130–1134 行 saveTx。
- [Z2] [item.js][Z2]：1450–1462 行 setCreators，1665–1680 行主表写入／通知，1796–1839 行 creators SQL。
- [Z3] [zotero.js][Z3]：542–545 行 DB 与 notifier 对接；[notifier.js](https://github.com/zotero/zotero/blob/ca61760225d25191d0c65acbfd0c4f12a172d263/chrome/content/zotero/xpcom/notifier.js)的 queue／commit／reset。
- [Z4] [db.js][Z4]：446–578 行 executeTransaction，尤其 498 行底层事务、526–578 行 commit／异常 callbacks。
- [L1] [versions.json][L1]；[L2] [host.ts][L2]（121–175 行 BBT 检查／启动；210–259 行执行与 BBT 操作）。
- [L3] [journal-catalog.ts][L3]（25–45 行 SQL 投影；81–184 行草稿／保存／共同提交；207–264 行 facade；285 行起 Item 方法）。
- [L4] [environment.ts][L4]（15–25 行 HostCatalog；168–183 行资源及本地化；259–325、380–425 行 Zotero／Services／ChromeUtils）。
- [L5] [library-records.ts][L5]；[L6] [managed.ts][L6]；[L7] [zotero.ts::journalOriginal][L7]、[LiteratureCatalog.commitRecords](../../../packages/library/src/catalog.ts)（309–489 行）。
- [L8] [zotero-host.spec.ts][L8]仅阅读测试定义；[共同权威 design](../../../openspec/changes/archive/2026-10-30-define-library-zotero-record-authority/design.md)、[delivery](../../../openspec/changes/archive/2026-10-30-define-library-zotero-record-authority/delivery.md)用于核对任务与已有证据声明，未据此宣称本次实跑。

尚未确定：发布 XPI 内最终 manifest／捆绑 toolkit 与 tag 的对应；原菜单在 Node＋Chromium 宿主中的实际可达性；Jasminum hooks 与未 await 保存的可观察完成边界；creator 数值类型／顺序映射的完整等价性；真实共同 SQL、回执、通知及各失败路径；1.1.43 相对 1.1.39 的完整宿主依赖差异。源码可见的启动网络访问不等于已发生请求；本文没有访问这些第三方业务站点。

本次止于一个研究文档。父任务仍需选定原包版本、完成宿主与共同权威接入，并分别验收 BBT／茉莉花；不关闭任务 2.3 或任何现有 change。

[R1]: https://api.github.com/repos/l0o0/jasminum/releases/tags/v1.1.39
[R2]: https://api.github.com/repos/l0o0/jasminum/releases/tags/v1.1.43
[X39]: https://github.com/l0o0/jasminum/releases/download/v1.1.39/jasminum_1.1.39.xpi
[X43]: https://github.com/l0o0/jasminum/releases/download/v1.1.43/jasminum_1.1.43.xpi
[R3]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/package.json
[R4]: https://github.com/l0o0/jasminum/blob/b85bbb75090885cecd7f4e1c6fe1466ed6801881/package.json
[R5]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/addon/manifest.json
[R6]: https://github.com/l0o0/jasminum/blob/b85bbb75090885cecd7f4e1c6fe1466ed6801881/addon/manifest.json
[R7]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/LICENSE
[R8]: https://github.com/l0o0/jasminum/blob/b85bbb75090885cecd7f4e1c6fe1466ed6801881/LICENSE
[R10]: https://github.com/l0o0/jasminum/blob/b85bbb75090885cecd7f4e1c6fe1466ed6801881/src/modules/tools.ts
[J1]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/menu.ts
[J2]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/tools.ts
[J3]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/addon/bootstrap.js
[J4]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/hooks.ts
[J5]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/addon.ts
[J6]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/utils/prefs.ts
[J7]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/notifier.ts
[J8]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/zotero-plugin.config.ts
[J9]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/utils/headlessBrowser.ts
[J10]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/styles.ts
[J11]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/preferences/main.ts
[J12]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/utils/http.ts
[J13]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/addon/prefs.js
[J14]: https://github.com/l0o0/jasminum/blob/b63a6a1e0ac4ce25fcd0c9200ec647b063ce02c0/src/modules/services/index.ts
[Z1]: https://github.com/zotero/zotero/blob/ca61760225d25191d0c65acbfd0c4f12a172d263/chrome/content/zotero/xpcom/data/dataObject.js
[Z2]: https://github.com/zotero/zotero/blob/ca61760225d25191d0c65acbfd0c4f12a172d263/chrome/content/zotero/xpcom/data/item.js
[Z3]: https://github.com/zotero/zotero/blob/ca61760225d25191d0c65acbfd0c4f12a172d263/chrome/content/zotero/xpcom/zotero.js
[Z4]: https://github.com/zotero/zotero/blob/ca61760225d25191d0c65acbfd0c4f12a172d263/chrome/content/zotero/xpcom/db.js
[L1]: ../../../apps/zotero-host/resources/versions.json
[L2]: ../../../apps/zotero-host/src/main/host.ts
[L3]: ../../../apps/zotero-host/src/main/journal-catalog.ts
[L4]: ../../../apps/zotero-host/src/main/environment.ts
[L5]: ../../../packages/protocol/src/library-records.ts
[L6]: ../../../apps/zotero-host/src/main/managed.ts
[L7]: ../../../packages/protocol/src/zotero.ts
[L8]: ../../../tests/kernel/zotero-host.spec.ts
