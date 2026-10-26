# 实际交付与交接

## 当前状态与成果

2026-10-25，按用户“实现该change”及随后允许锁文件安装／Electron准备的授权，完成独立H1阶段；**整个change尚未完成，I6真实共同库接线仍受阻**。任务进度以[tasks](tasks.md)为准；没有提交、推送、PR、归档或同步正式规格。

- `apps/zotero-host/src/main/host.ts` 提供私有ZoteroHost及status/start/fillKeys/export/close。固定BBT原bootstrap、主包、Worker与两种translator实际执行，模块只消费注入Adapter，不创建产品文献权威。
- `environment.ts` 承接固定原包所需对象环境和私有文件范围；`workers.ts`、sandbox preload及隐藏renderer提供真实Chromium Worker／IndexedDB，资源来自受限本地scheme，网络及新窗口拒绝。
- 合成SQLite和有限SQL视图只在 `tests/fixtures/zotero-host/catalog.cjs`；它们不是正式类型目录、引用键／修订／身份提供者。默认产品入口仍为外壳，没有启用共同库、人工CLI／Agent生态操作或真实用户库写入。
- 局部关闭、未知保存与OS完整归属分别表达。已受理写入保留等待；迟到操作结束可重试close；shutdown／flush未知不能被再次空清理抹成closed。Worker失联后的只读导出等待可结束，窗口销毁不依赖renderer响应。
- 固定资源清单及来源／许可在 `apps/zotero-host/resources/`，随现有host目录包规则包含；原XPI未内置。构建增加host模块、preload和Worker页面，`architecture.json`只补受控vm／preload访问。开发说明已更新独立入口和限制。

[design](design.md)的总览和时序图仍表达完整目标；当前只有私有Module／原包／显式Adapter段真实，broker／共同文献／长驻监督连线未实现。H1状态不能替代图中的生产角色与领域提交确认。

### 第二阶段交接结果

按用户最新指令，本轮在同一树／change继续，消费主线正式快照 `/tmp/scholoom-phase2-handoff-VZS5mS`，完成消费者核对、公共需求与监督候选及两项隔离失败校准，然后停止。**本轮未修改业务源码、未接入他域私有实现，任务仍4/13**；没有因文档交接完成勾选共同提供者或整合任务。使用原生只读辅助Agent，保持`gpt-6.1-sol/high`，没有新Agent终端或常驻协调者。

- 主线`acceptance.md`已独立接收H1，复验原包9项与Electron归属1项通过。其结论没有扩大到I6、生产、完整正常shutdown或多平台。
- 已读文献B批design、tasks／delivery及`library.ts`／`catalog.ts`实际快照。开放metadata、单条CAS、内部事务和持久摄取批次存在；来源实例／原值保留、正式键固定状态／冲突、多Item提交／稳定结果查询均未交付。精确路径、符号、消费者需求及反例只维护于[investigation第二阶段交接](investigation.md#第二阶段正式交接与消费者核对)，本记录引用，不另建进度账本。
- 阅读材料及报告两个design和实际位置schema已分别消费。**E5“未收到设计”已解除**；sidecar转换／新PDF字节提交仍无真实提供者。报告独立，不作为BBT或基础综合前置；没有复制或合并对方change。
- 计算`ManagedCommands`／`program`观察快照已消费。`started`不证明Electron或BBTready，`cancel`回执不证明停止；现可复用原生准入、固定程序、日志背压及stopped。计算快照C3需其提供者修复，不在生态改超时或复制programs记录。
- [E4公共候选](design.md#第二阶段e4长驻监督公共候选)已细化到宿主实例／操作身份、一次性stdin供应、独立回环listener、双向RPC、ready、正常shutdown、失联、重启unknown及文件／符号写集。推荐独立host listener，保留共享product listener选项。**未生成公共源码补丁**：跨模块启动供应与监督记录语义待确认；不能把公共候选当已授权实现。

公共依赖顺序：P0由计算拆command观察增量、修C3，经dev验证后用户同步；P1确认宿主私有启动供应／listener／恢复记录并独立校准；P2接真实原包与固定样本、补当前shutdown差距；最后在文献E1–E3实际交付后做P3共同接线／I6。P0/P1明确不依赖programs私有包、项目数据库迁移或本树BBT私有实现；对应文件与验收以design的P0–P3表为准。

## 实际验证

### H1已有实现记录

本机Linux、Node24.12.0、Electron44.5.1，使用现有锁文件。`pnpm install --frozen-lockfile`及`pnpm setup:electron`成功；package.json／pnpm-lock.yaml没有版本变更。安装初次提示内核bin尚未构建，随后 `pnpm build:shared` 成功生成共享包及内核，不以缺bin警告掩盖构建结果。

| 命令／操作 | 结果与实际范围 |
| --- | --- |
| `pnpm --filter @scholoom/zotero-host build` | 成功生成index.cjs、host.cjs、sandbox preload及Worker资源；没有启动开发服务器 |
| `pnpm build:shared` | 所选16个workspace的共享包／内核构建成功；没有重做公共业务实现 |
| host tsconfig与根 `tsconfig.tools.json` 的 `tsc --noEmit` | 通过；核对真实源码与测试类型 |
| `node scripts/check-architecture.ts` | 13模块、199源码文件、0 findings、0 granted exceptions |
| `SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/zotero-host.spec.ts --output test-results/zotero-host` | **9/9，41.2秒**：空库、显式补键／已有键、两种原包导出、正常通知／无通知反例、实际进程重启读回、版本失败、启动取消、迟到保存、卡住renderer、悬空链接、在途导出失联及未知flush。若干风险边界属于同一端到端场景，非9种完整产品能力 |
| `xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/entrypoints.spec.ts --grep 'compatibility host'` | **1/1，3.9秒**：既有默认隐藏外壳入口回归通过 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/zotero-host-scope.spec.ts` | **1/1，3.6秒**：实际Electron Browser／Tab及忙Worker在现runCommand原生归属下启动，取消返回前退出。未改平台契约；仅Linux，未接真实host角色或共同库 |
| `node tests/fixtures/zotero-host/catalog.cjs` | fixture读取、同对象、SQL、回滚、提交后通知及通知失败、skipNotifier和重开自检通过；仅检查替身自身一致性，不是生产事务验收 |
| 固定资源／原包核对 | 日期资源解析内容与既有10.0.5静态来源一致；9.0.68整份XPI及bootstrap、主包、Worker、BibTeX／BibLaTeX成员未改。没有运行外部Zotero或使用其用户profile |
| `pnpm lint`及定向Biome | 全仓通过，保留71条warning和35条info；本轮源码、配置及测试的定向检查通过，无诊断。未顺带修改全仓既有提示 |
| `openspec validate connect-zotero-host-bbt --strict`、本地链接及diff检查 | 规格结构通过；规划工件本地链接0处失效；已跟踪差异和23个新增文件空白检查通过，新增JSON可解析 |

BBT原资产来自versions清单的精确官方发布地址，保存于 `/tmp/scholoom-zotero-bbt-assets/`。每轮样本位于新的 `/tmp/scholoom-bbt-*`，scope夹具位于 `/tmp/scholoom-owned-electron-*`。最终H1结果在 `test-results/zotero-host`，其中主样本保留 `bibtex.bib`、`biblatex.bib`、`updated.bib`及`restarted.bib`；其他结果／失败trace沿 `test-results/smoke` 与 `test-results/kernel`。这些临时工件保留为调查与复验依据；没有批量删除或接管其他进程。XPI不是项目依赖，也没有被安装到真实Zotero。

scope测试通过Xvfb并仅对固定夹具使用 `--no-sandbox`，不能作为产品Chromium sandbox或真实分发证明。H1测试中的内部Adapter是明确替身，Electron／原包／Worker／SQLite／文件和重启真实；没有模型请求。Windows／macOS、自动导出、外部JSON-RPC／pull export、生产大库及签名分发未验收。

### 第二阶段实际校准与检查

本轮没有业务实现变化，故未重跑整套H1／全仓CI。先执行 `pnpm --filter @scholoom/zotero-host build`，成功后才运行样本；测试期间未重建共享产物，没有新安装依赖。

`xvfb-run -a node /tmp/scholoom-eco-phase2-nHIkpI/bbt-multi-item.cjs` 首次运行退出0，两项独立断言通过，首次日志及JSON结果保留同目录，不以重跑替代首轮证据。真实Electron44.5.1（内嵌Node24.21.0／Chromium152.0.7977.130）、运行器Node24.12.0；两份全新profile和合成SQLite，不操作真实库。原包执行成员来自既有固定9.0.68发布资产，实验只在Adapter的第二次Item.save注入异常，不修改原包。

| 校准／已注入失败 | 预期与实际结果 | 不能据此推出 |
| --- | --- | --- |
| 原`fill`选择两条缺键，第二条拒绝 | 第一条提交、第二条无持久键；一条modify，host降为degraded；原包map仍有第二条候选，断言通过 | 不能把所有条目报未保存，也不能用候选继续导出；不是共同库正式键／稳定提交查询测试 |
| 原`fillMissing`开启条件后调用，第二条拒绝 | 外层事务回滚两条、零modify；map仍有两个候选，断言通过 | 内部方法由实验直接调用，未经过host业务封装；不证明产品回滚后的ready或缓存已修复 |
| 两项原包关闭日志 | 均出现`shutdown done failed`／缺失`Services.profiler.IsActive`，而局部close为`localResourcesClosed` | 退出0只表示预定反例断言成立，**不是正常插件shutdown验收通过**。新差距已进入2.3／P2，未在本轮文档范围内修改业务代码 |

原`Orchestrator.run`会吞shutdown任务异常，故此失败没有抛回H1的原shutdown Promise；新spec场景明确监督层不能把局部closed升级为完整正常停止。P2需修实际兼容缺口并保护同类失败边界，不能删错误日志或返回占位成功。本轮没有声称已修复任何业务缺陷。

本轮新增交接文字经独立只读辅助复核，未发现具体事实错误或矛盾；确认P1不依赖programs私有实现、P0–P3没有提前解除E1–E4、E5只解除设计等待，profiler差距仍待修。审查者未运行工具链，结论只针对文档与已读源码事实，不是跨域接线／生命周期验收。

本轮收尾检查：`openspec validate connect-zotero-host-bbt --strict`、`openspec schema validate scholoom-dev`通过；本change的32个本地文件链接均存在；`git diff --check`及23个新增文件的空白检查通过。原XPI中的bootstrap、主包、Worker及两种translator与实验后执行成员逐字节相同。当前apply仍为4完成／9未完成，CLI的ready只表示规划工件可读。

与主线接收的`H/zotero-ecosystem`逐文件比较，23个文件相同，仅本change的investigation、design、tasks、delivery和spec delta这5份工件变化，清单保留在 `/tmp/scholoom-eco-phase2-nHIkpI/changed-from-accepted-snapshot.json`。临时审查增量为 `/tmp/scholoom-eco-phase2-nHIkpI/phase2-planning.patch`，以主线已接收的本线快照为前态；它只含上述5份规划／交接工件，**不是公共源码补丁，也不能用于宣称dev已接入**。

原包反例细节与精确执行成员行号在investigation，不把临时脚本作为生产依赖。临时样本、首次日志和JSON保留为本阶段可复验依据，未批量清理。未重跑typecheck、架构、全部H1和完整CI：本轮源码／配置／依赖与接收快照相同，只增加校准证据及工件；先前结果与主线独立复验分别保留。

## 审查与问题处理

独立只读审查依据实际Module、契约和测试，发现并用可复现反例修复了：悬空symlink写越界、迟到操作后关闭不可重试、renderer卡住使收尾无上限、就绪后Worker故障仍ready、在途只读导出阻止局部销毁、shutdown失败在空重试时误报closed。主方另修复启动被取消后重新变ready的竞态；原失败与最终通过分别保留，不将静态意见当作实际测试结果。

最后两项修复经同一审查者静态复核，未发现剩余具体P1/P2；其未运行测试，运行结果由主方提供。收尾类型检查发现新增失联测试缺少窗口空值守卫，补齐后根工具类型检查与最终9项实际回归通过。

初次原包装载因blob Worker URL／资源CSP适配停在startup，改为本地受限scheme的固定Worker桥并开放明确包资源来源；未改原成员或延长生产等待时限。测试一度在29MB Buffer的通用deep-equal中耗费约40秒，trace证实业务已完成；改用Buffer字节比较后同一路径数秒完成。测试总预算包含既有30秒操作上限及收尾，不修改生产时限。

显式补键回归发现BBT偏好迁移会重新启用自动补键。沿原包配置为全新自有profile标记autoPinMigrated，并保留fillKeyAfter=0；测试确认启动缺键为空、显式调用才写入。没有裁剪原包启动图，也不把此行为当作迁入已有用户设置的规则。

## 未完成事项与下一步

1. E1–E3的文献B批设计及实际schema已消费，但所需提供者仍缺。共同来源实例及复制政策／原字段载体、正式键固定及冲突规则归文献决定；E3的A（共同有界多Item原子提交）与B（只开放显式逐条补键及准确部分结果）需文献／主线确认。两者均需要稳定结果查询，不据本轮反例自行选择B。
2. E4公共候选已成，需主线核对独立host listener或共享server分派、私有stdin供应Interface、监督记录及重启unknown归属。先P0公共接入／同步再P1/P2；长驻ready／可信身份／双向WS／正常shutdown／其他平台仍未实接，新发现的原包吞shutdown错误保持待修。完整停止不以runCommand有界测试或localResourcesClosed代替。
3. E5两份设计交接已闭合，材料新字节／sidecar共同记录转换未闭合；BBT样本不等报告，不实施Reader或茉莉花。E6题录／附件删除恢复仍缺，status明确生产不可用；不执行迁入／自动导出／外部接口／真实用户库路径。
4. 完整I6、整体审查及最终delivery任务保持未完成，不归档或声称整个change已交付。既有CI基线未复跑／修复，未把尚未诊断失败归因于超时，也未将本机结果称全仓绿色。

继续沿当前 `tasks.md`／`delivery.md`，不需要用户重述已给出的实施及锁文件安装授权；需要的是实际跨线接口结果和必要架构输入，不是再次批准同样动作。
