# 实际交付与交接

## 当前状态与成果

2026-10-26，沿用户“验收工作并进行下一轮调度”及既有提交授权，公共源码已接入dev，提交b838402并推送origin/dev；七线任务已派发。七树正式输入为 `/tmp/scholoom-round3-handoff-qefwKi/manifest.json` 及逐树源码快照，均来自e3d58fc上的未提交成果。没有覆盖、同步或切换Git工作树，没有安装依赖或操作真实用户库。

已核对[设计图](design.md#变更总览)及命令时序：资源叶声明保持原导出对象；双窗口夹具同时保留projectId定位；命令观察和长时限进入原ManagedCommands；v5委派→v6程序表沿单一迁移链；ContextItem位置／区域／草稿对象经原编码路径；集合直接父范围及开放CSL声明不关闭未知metadata。执行历史由独立 [add-harness-execution-history](../add-harness-execution-history/delivery.md)维护，未复制其契约。

本公共范围达到proposal的代码与验证判据。七域私有业务、图片格式、X1题录选择、M2归因、M3产物ref、E4监督和库来源／键／事务仍按[下一轮计划](../../../.scratch/domain-development/parallel-development-plan.md#公共切片接入后的下一轮)分别交付；不能据公共通过关闭I1／I3／I5／I6。

## 实际验证

Linux，Node24、pnpm11、Playwright1.63，既有依赖；隔离profile／项目／库／输出，真实内部broker、数据库、受管worker和UI组件。模型只在既有受控边界使用，不是科研质量验收。先完成构建再测试，测试运行期间不重建其产物。

| 范围 | 实际命令／入口与结果 | 证据 |
| --- | --- | --- |
| 共享构建 | 按根build:shared顺序直接执行已有包脚本，避免pnpm重复安装检查；通过 | `/tmp/scholoom-round3-dev-shared-build.log`；驱动 `/tmp/scholoom-public-combined-AV5Aey/public-build.mjs`，cwd为dev |
| 桌面构建 | `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/desktop build`，通过 | `/tmp/scholoom-round3-dev-desktop-build.log` |
| 类型／架构／生成 | 全包typecheck、根tools tsc通过；13模块／197文件、0 findings／exceptions；生成器self-test及6份派生映射格式归一化后一致 | `/tmp/scholoom-round3-dev-typecheck.log`；当前schema与生成类型 |
| 主线公共内核组合 | 下述13文件组合 **95/95通过**，5.3分钟 | `/tmp/scholoom-round3-dev-kernel.log` |
| Agent兼容组合 | 隔离公共基线加入已修A1的正式Agent切片，history、委派、races、harness-module **24/24通过** | `/tmp/scholoom-round3-history-agent-tests.log`；`/tmp/scholoom-public-agent-combined-fMVf99` |
| 双窗口公共夹具 | 同名不同projectId、目录选择、两窗口会话与草稿隔离；Electron通过，Browser首次加载超时，原测试原时限单独复验通过 | `/tmp/scholoom-round3-main-ui-recheck.log`、`/tmp/scholoom-round3-main-ui-browser-confirm.log`；`/tmp/scholoom-main-fixture-ui-kuN0AX/` |
| 格式与delta | 关键改动源码Biome、diff空白检查通过；两个change定向OpenSpec strict通过 | `/tmp/scholoom-round3-dev-lint.log`；收尾重新校验 |

主线内核命令：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/execution-history.spec.ts tests/kernel/registered-graph.spec.ts \
  tests/kernel/research-capabilities.spec.ts tests/kernel/command-observation.spec.ts \
  tests/kernel/managed-commands.spec.ts tests/kernel/project-container.spec.ts \
  tests/kernel/project-migration-chain.spec.ts tests/kernel/project-recovery.spec.ts \
  tests/kernel/resource-access.spec.ts tests/kernel/resource-creation.spec.ts \
  tests/kernel/context-instructions.spec.ts tests/kernel/public-contract-baseline.spec.ts \
  tests/kernel/literature-catalog.spec.ts \
  --workers=1 --reporter=line --output test-results/public-domain-foundations
```

七线修复的独立复验：Agent17/17、catalog9/9、content-selection8/8、计算48通过／1跳过，随后注入实际Agent records适配单跑原跳过项1/1通过；类型化CSL与Markdown边界各双宿主2/2通过。跳过不计通过，后续单跑另记；其余未变化的独立成果沿上一轮验收，不重复宣称重跑。

首次失败保留：临时公共组合的恢复用例仍按旧版本检查且未删除新表，首轮93通过／2失败；补入提供者原本已有、但公共补丁漏带的恢复夹具修正后，恢复3/3及最终dev95/95通过，没有放宽生产迁移检查。UI临时配置首轮缺ES module声明，补临时package.json后继续；Browser随后首次load超时，trace显示Vite依赖请求未返回。原测试、原30秒时限、独立新profile复验25秒通过；没有确认冷启动问题根因已修复，保留其不稳定性，不称首次全绿。

`openspec validate --all --strict`原正式agent-harness／ui-workbench-shell有超过500字符的requirement警告，在当前CLI strict下失败：19通过／2失败。未修改这两份正式规格，不顺带改写既有契约；定向change校验与全量结果分别表达。

## 审查与问题处理

两位原生独立审查分别核对Standards及Spec，已复验A1／C1–C3／U1闭合，未发现新的确证源码增量缺陷。公共与Agent组合额外核对runtime导入、操作表、来源及生成映射，没有以整文件覆盖解决冲突。

主线Spec追加复核发现1项P2：命令delta未把启动确认／背压限定为新增start观察模式，超过原editor execute实际行为。现限定 `ManagedCommands.start` 及相应WHEN，所有命令的完整停止保护保留；独立复核确认关闭。无生产代码改动，不重复运行已通过的95项。

## 未完成事项与下一步

tasks 2.3已完成：公共代码b838402已推送，七份任务经orca-cli发送，均返回accepted:true及turn_started；配置经各既有终端实读为GPT-6.1-Sol high。原生审查已结束，没有等待下一轮工作完成。逐线prompt及回执在 `/tmp/scholoom-round3-handoff-qefwKi/prompts/`、`dispatch-receipts.json`。Orca空闲探测接口两次timeout，既有终端状态及屏幕确认done／空输入框后按既有终端投递，实际启动由回执证实；详情见同目录readiness-note.md，没有重复发送或新开Agent。

本公共范围已交付，不据accepted推定下一轮实现完成。用户手动同步各消费者后，再核对其业务接线；历史change的同步任务保持开放。各线本轮允许整理可审查本地提交／补丁，不自动merge／rebase／reset、不推送／开PR或归档。本变更未同步正式规格或归档。

用户已确认来源副本与正式键冲突政策，分别记录在领域决议，供文献／生态下一轮实施。本批不混入该新行为。Windows、macOS、分发包、真实模型科研质量及既有全仓CI失败未本轮复验；macOS受管执行仍明确不可用。临时快照、组合和日志保留为本机验收依据，不进入生产依赖。

## 提前调度的纠正与消费者同步

用户指出七树未同步却已收到下一轮任务，主线调度顺序不当。已先中断七线并取得全部停写确认，关闭各自子Agent；用户追加授权“这次由你同步并验证，再恢复Agent”，本次同步改由主线承担。七树仍在e3d58fc时已备份源码、未跟踪文件、暂存和工作区差异，目录 `/tmp/scholoom-sync-recovery-wyn13R/`；保留原有成果及文献线提前形成的4份OpenSpec修改。

每树建立本地WIP检查点，再合入0519904；检查点tree与备份预演一致。六树冲突逐处处理，计算树自动合并。Agent迁移保留统一v5委派→v6程序，恢复夹具和本线测试沿新版本；执行历史及委派共用runtime／操作表／生成类型并存。阅读树将原图片format移入新叶schema，保留实际视图及权限消费者。项目／文献夹具同时保留projectId及真实多窗口。所有非公共私有文件逐字节保持；独立只读复核未发现确证合并遗漏。

七树全部构建、包与tools类型检查、架构及生成器self-test通过，冲突源码Biome检查退出0（Agent原5项non-null warnings保留）；同步后真实定向内核203/203、双宿主UI16/16、BBT原包9/9通过。没有失败或跳过项；不据此宣称七域完整交付。各树先构建再测试，测试运行期间不重建产物；UI使用已构建产品与静态测试服务，未启动开发服务器。

同步提交：文献70be8bf、项目77cd078、科研2812777、Agent 2cb6aed、计算91615d5、阅读e71663b、生态eaf38be。提交完成时七树均clean且0519904为祖先；没有reset／rebase、切分支、覆盖已有成果或推送工作树分支。完整命令、逐树日志、检查点及文件保全记录在同目录recovery.md、synchronized.json、source-preservation.json和各树子目录。恢复回执沿tasks 2.5实际记录，恢复前不再允许依赖旧基线实施。

七份恢复指令现已全部accepted及turn_started，回执为同目录resume-receipts.json；各自明确本树同步提交、实际测试及原有界任务，撤销旧“等待用户手动同步”条件，不重复新建Agent。用户本轮无需再手动同步公共代码。恢复后Agent可产生新的正常改动，同步完成时clean不代表后续一直clean。本主线收尾提交只补交付文档，不改变0519904公共代码基线；不要求七树为该回执文档再做一轮同步。

## 后续共同消费复验

七域成果已保全、建立本地检查点并逐线合入dev，共同源码基线为 `1026796d854b8f568c3e819f13268a9638980bc1`，已推送。对应业务成果和剩余任务仍归各自change；本节只记录共同消费验证，不扩大原公共变更范围或据此归档。下一轮职责与共享符号分工见[并行开发计划](../../../.scratch/domain-development/parallel-development-plan.md)。证据根目录为 `/tmp/scholoom-round5-acceptance-WBreMJ/`，原树验收、命令、日志和独立审查见 `acceptance.md`。

主线完整构建、类型检查、架构检查（14模块247文件、0 findings）、生成映射及13个相关change定向strict通过。共同内核首轮209项中207通过、1失败、1跳过：新增合法editId触发旧完整对象断言，改为保留必要字段的部分匹配后原项1/1通过；恢复组合移除旧快照adapter条件，直接消费真实HarnessRecords，原跳过项1/1通过。209个不同用例分别有通过证据，不记为一次209/209。双宿主首轮22通过14失败，最小对照证明测试删除仍登记项目会触发既有未知恢复及容量保护；仅修正三份UI夹具的项目生命周期和用例名称，保留合成项目至共享配置退役，未放宽生产保护。相同整组复验36/36通过，见 `main-ui-recheck/result.json`；测试目录约定已进入开发说明。

Standards独立审查未发现确证新增缺陷；Spec独立审查发现报告共享JSON子树在容量检查前指数展开、UTF8 BOM来源漏认递归报告两项P2。两项均先实际复现失败，再由主线修复，报告模块70/70通过；两位审查者追加复核确认闭合。报告仍仅为独立模块，未注册生产操作或开放HTML写入／iframe。历史TeX首次unknown的根因仍未定位，下一轮由计算线补最小退出诊断，停止与容量判据保持。

七树已逐一快进至同一共同源码基线，同步完成时全部clean，没有reset、rebase或覆盖成果。新programs包仅补现有同版本依赖和本树workspace链接，没有下载或升级；检查点、逐线合并、文件保全及同步结果见 `checkpoints.json`、`source-preservation.json`、`synchronized.json`。

同步后七树分别完整构建、包类型、架构和生成器self-test全部通过；各树定向内核共80/80通过（项目5、Agent1、文献3、阅读45、计算1、生态24、科研1），命令与结果见 `sync-build-results.json`、`sync-kernel-results.json`。构建完成后才测试，没有在测试期间重建同树产物。随后再次核对唯一Codex终端、GPT-6.1-Sol/high、空输入及共同HEAD，才发送下一轮prompt。七份均取得 `accepted:true` 和 `turn_started`，见 `prompts/`、`dispatch-receipts.json`；六条实施线已启动，科研图运行时只接收验收及等待指令，不重复项目线I1。Orca卡片同步更新，无后台协调轮询或等待实现结束。

本节收尾提交仅记录验证和实际派发，七树已验证源码仍以 `1026796` 为基线，无需为回执文档再同步。用户本轮无需手动同步。完整change、I1／I3／I5／I6及真实科研质量仍按各自未完成任务续做；未增加全仓CI或Windows／macOS分发通过结论，macOS受管执行继续明确不可用。

## 2026-10-27真实整合验收与下一轮

用户请求验收本轮交回成果并继续协调。七个既有Codex终端核对为gpt-6.1-sol/high、结束上一轮及空输入；科研图线按约无新增改动，六条实施线相对1026796的完整增量含untracked已冻结到git tree、建立本地检查点，再逐线合入dev。六次合并均无文本冲突；77个单线文件在合并时逐字节保留，9个共享文件追加独立只读核对无确证错接。原始快照、检查点、源码保全、命令及日志见 `/tmp/scholoom-round6-acceptance-dXuzCA/`；各业务任务及未完成范围仍沿所属change，不扩大本公共变更。

本轮接入真实任务科研图及独立调用输入快照／新会话机械接续、M2异步可信执行来源与通用worker TaskPort、共享库草稿右栏、真实历史／Evidence／整次undo、进程退出诊断、最多100条隔离普通期刊的共同库／受管原包补键及两格式导出。生产Graph仍为空，库正文M1及报告生产／隔离仍未完成，原包仍不启用真实用户库。

Standards独立审查发现1项P1：生态工具返回内容没有持久登记库上下文，撤send后历史可再次进入模型。主线真实only-export回归先失败，再复用既有rememberCatalog修复，原回归1/1通过（当前内核下一轮及重启、模型请求均不增），原审查者追加只读复核确认闭合。Spec轴未发现确证其他问题，两轴不混记。具体修复、授权场景及红绿依据已进入生态change同一delivery；审查者均已关闭。

六树分别完整构建、包类型、架构和生成自检通过；定向内核84/84通过。主线共同构建／包类型、根tools、架构14模块253文件0 findings、8份生成映射及13个change定向strict通过；59份改动源码／配置Biome无error，保留22条warnings。构建及P1重编译结束后才运行组合测试，期间不重建。主线内核172/172通过（含P1原回归），双宿主关键路径18/18通过；分别见 `main-kernel.log`、`main-kernel-result.json`、`main-ui.log`、`main-ui-result.json`，UI使用已构建产品的静态测试承载，没有开发服务器。内核包含已受理写入、调用快照、任务关联、真实委派、来源／历史、未知停止、容量及原包路径；外部模型受控，不能据机械结果宣称科研质量通过。

另读取共同起点6b22d60的最新[CI 40315429083](https://github.com/leike0813/Scholoom/actions/runs/40315429083)：Linux内核689通过／9失败／16跳过，Windows628通过／49失败／30跳过，macOS入口3通过／1失败。日志及按平台清单在同一证据目录；未重跑全仓或将其称为本轮绿色。下一轮沿并行计划，将project-backend及research-capabilities合成身份夹具、harness／会话、生命周期、文献剩余映射和报告资源装配分别交所属线；生态仅形成CSL／原值差异的具体方案，不自行确定自动同步规则。宏观科研流程与角色、真实质量、目标平台／分发及macOS受管执行限制保持。
