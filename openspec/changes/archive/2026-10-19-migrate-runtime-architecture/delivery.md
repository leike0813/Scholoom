# 实际交付与交接

## 当前状态与成果

2026-10-19，继续同一 change。进度以 [tasks](tasks.md) 为准，不以工件存在或 CLI ready 作为完成依据。用户已授权实施、离线 `pnpm install --offline --ignore-scripts` 刷新 workspace 链接和锁文件，并明确批准隔离开发服务器及使用现有 MiniMax 凭据运行合成样本的真实模型验收，要求持续完成本变更；本次平台范围随后确认为“本次以 Linux 验收，保留其他平台缺口”。复用原锁定依赖，没有下载新版本；保留用户已有文档与代码改动，未提交或切分支。

本次按用户确认的 Linux 验收范围完成，任务 34/34。harness 宿主逻辑及 research 内容、尝试和交付检查已迁入私有包；移除 ProjectStore、LiteratureCatalog、ResearchRuntime 实现引用及全产品契约依赖，所属仓储由宿主绑定，领域消费端口经 broker 接线。项目端口的独立替身直接接受派生签名检查，不以断言代替接口。架构检查目前 12 模块、127 源文件、0 违约、0 临时例外。保留 LangGraph／SQLite saver、同步 durability、checkpoint 后幂等确认和回执丢失核对补确认。

对应 [proposal 完成判据](proposal.md#完成判据)：

| 判据 | 当前实际成果与缺口 |
| --- | --- |
| 1 独立组合 | 七个私有模块均已迁入。人工组合经真实 WS 完成文件、题录、PDF 材料及阅读操作，sessions/runs 为空；harness／research 独立测试只建自己的表并替换窄端口，不启动完整宿主或无关模块。真实 Node CLI 经生产 broker、IPC、图及文件工具完成授权读写与成果核查，外部模型使用合成 HTTP 响应。 |
| 2 契约与调用 | protocol 的分域声明统一派生载荷、提供者和窄端口签名以及运行时校验。broker 构造、注册及实例赋值绑定 schema 和载荷，关联调用元组及事件订阅负例参与真实 tsc。文件、初始化、图事件、middleware、模型控制及进展接续已接入同源校验；生成映射只引用原声明。公开能力发现来自实际注册，普通连接不暴露内部控制；宿主投影经 broker 组合。领域授权、保存顺序和宿主准入仍由对应实现负责。 |
| 3 故障范围 | Agent／能力／PDF 使用实际受管进程及独立 controller。共同容量默认活动 4／等待 8／30 秒，父仍计占用；Agent 子计算不足即时拒绝，人工可有限等待。宿主每 5 秒核查事件循环，等待沿健康契约 5 秒；模型等待仍能回应。父子持久实例及当前尝试资格检查已接线。停止确认缺失保留占用和 interrupted／未知诊断，撤权写入失败仍尝试停止。真实阻塞、写入后暂停、迟到状态及能力崩溃后显式重试通过；目标平台分发与系统资源耗尽不在这些本机证据内。 |
| 4 上下文与恢复 | 保留 LangGraph／SQLite saver、同步 durability、保存后幂等确认及确认丢失后的核对补确认。每 run 私有 checkpoint、旧文件惰性导入、写者排除及 120 条指令已真实磁盘／IPC 验证。统一 send 已删公开 resume；缺失工具结果按原收据补完整结果或 outcomeUnknown，最新撤回指令能先进入决策。正常跨轮继承有效图及会话 scratch，真实框架连续压缩可追加历史，自动卸载资源缺失会提示 context_incomplete；新会话仅从已保存工作材料接续已有真实文件工具验收。旧资源清单未核查状态跨失败／重启保留。 |
| 5 数据与副本 | projects 掌握文件及成果关联，harness／research 各自连接和表，物理 v2→v3 迁移由宿主初始化适配注入。事务搬迁、原始结果及身份保留、升级前副本、WAL 下 commit 前 SIGKILL 后关闭原连接、重新打开 v2 并重试已有证据与限定范围复核。恢复经所属模块 hook；当前及 v2 混合样本矩阵验证归档会话、运行／科研记录、回收材料、成果、重绑定与授权清除；模块恢复失败保留副本且不报完成，源项目后续编辑保留。新增真实项目移动回归通过，宿主替换容器前协调执行、仓储和私有目录重绑定；停止未知时拒绝替换。 |
| 6 整合验收 | 双宿主 UI 本轮 65 通过、2 跳过，唯一临界耗时失败经准确计时的两宿主复验通过；真实开发命令及真实模型 UI 2 项通过，独立真实模型 1 项通过。最后所有者正常退出／SIGKILL 时活动 Agent 收尾 2 项通过；最后目录包 smoke 4 项、包内 CLI／PDF 1 项通过，最后版本内核全量 204 通过、2 跳过，9 分钟。三平台 CI 保留，Windows／macOS 没有实跑，不据本机结果宣称通过。 |

[design 总览](design.md#变更总览) 与既有架构图源已核对；当前实际范围以上表及任务为准。共享架构决议 01 和接口文档 §1.1 的另一会话内容保留；本轮仅在接口草稿三处实现状态改为正式规格／交付链接，清理已删除公开 resume 的旧现状描述。八份 delta 已同步正式规格，13 项修改、11 项新增；初设 K-01／K-02 已用正式规格链接替代重复正文。

## 实际验证

本轮 Node 24.12.0／pnpm 11.10.0、Linux x64，Intel Xeon E5-2697A v4 @ 2.60GHz（环境报告 64 逻辑 CPU）。离线链接刷新 downloaded 0；开发服务器在用户明确授权后使用隔离配置运行。当前整合证据如下，早期基线保留在后表，不代替后续改动复验。

| 本轮验证 | 实际结果与边界 |
| --- | --- |
| `pnpm typecheck`、`pnpm build`、架构守卫 | 全工作区通过，工具 tsc 编译实际 dist 声明及反例；架构 12 模块、127 源文件、0 违约、0 例外。生成器 self-test 与 strict OpenSpec 通过。 |
| 迁包整合组合 | harness／sessions／research／恢复／容量 40 项通过；项目路径复用、作者身份、授权撤回、原调用重试和取消等待保存保持。文献／阅读／模型准入组合 25 项通过。 |
| 独立模块及 CLI | 独立 harness／research、人工组合、真实 CLI 和科研组合 15 项通过。CLI 样本运行实际独立 Node 宿主、WS、broker、IPC、模型图、文件及数据库；只有模型 HTTP 是替身。CLI 后续增加的 PDF 原生样本已在最终全量及目录包中通过。 |
| 停止与取消窗口 | 已登记／尚未登记子执行两项真实故障均通过：忙循环后杀 controller，父和科研尝试 interrupted，实际 PID 仍活且占用保留；测试按创建归属清理。异步项目检查中取消单例通过，未受理结构操作没有目录或操作记录。 |
| kernel 上轮全量 | `SCHOOLOOM_LIVE_MODEL_TEST=0 npm_config_offline=true npm_config_ignore_scripts=true pnpm test:kernel --grep-invert 'Vite internal restart'`：200 通过、2 跳过，8.4 分钟。早于最后项目重新定位及根启动未知修复；最后版本 206 项另行记录。该轮跳过未启用的真实模型和非本平台的 Windows ACL；授权后真实模型与 Vite 用例已分别实跑通过。 |
| 生产入口 smoke | 源码构建的 Node CLI、真实 Electron/preload、关窗驻留重连、兼容宿主 4 项通过，23.8 秒。未启开发服务器；不能代替双宿主业务 UI。 |
| Linux 目录包 | 使用现有 Electron 本地分发、离线且跳过重建，最后自动 afterPack 产物为 `/tmp/scholoom-runtime-package-complete/linux-unpacked`，已包含最终项目重绑定和根／子停止未知修复。先复现 Node 不能读 ASAR，以及打包器遗漏 SDK 自带嵌套代码；修复解包路径、宿主 userData 选择及 afterPack 原样保留。最后目录包 Electron smoke 4 项通过（24.4 秒），包内独立 CLI／实际图／SQLite／PDF 1 项通过（16.3 秒）。系统 Node 24 仍为前置要求；没有下载或升级依赖。 |
| 最终静态检查 | 全仓 lint 0 error、5 warning、31 info；工具 tsc、架构守卫及 strict OpenSpec 通过。未因历史 warning 扩大本轮清理范围。 |
| kernel 最后版本全量 | `SCHOOLOOM_LIVE_MODEL_TEST=0 npm_config_offline=true npm_config_ignore_scripts=true pnpm test:kernel --grep-invert 'Vite internal restart' --output=/tmp/scholoom-runtime-kernel-final-v2`：204 通过、2 跳过，9 分钟，包含本轮新增的所有权收尾、项目移动及根启动未知用例。Vite 重启与真实模型另以各自显式入口实跑通过；Windows ACL 在 Linux 跳过。没有将受控模型替代真实模型验收。 |
| 双宿主 UI | `SCHOOLOOM_LIVE_MODEL_TEST=0 xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts --max-failures=2 --output=/tmp/scholoom-runtime-ui-serial`：65 通过、2 跳过，12.2 分钟；浏览器取消耗时 1007ms 失败，独立复验 1 通过（27.6 秒），输入 1.9ms、取消 999ms。测量原先计入断言轮询开销，最终用 DOM 实际呈现时刻记录且保留 1000ms 门槛，`tests/ui/file-workbench.spec.ts --output=/tmp/scholoom-runtime-ui-measured` 两宿主 2 项通过，53 秒。261,267 字节长稿并行预览与模型等待场景，浏览器输入／取消为 2.0／669.6ms，Electron 为 3.3／815.2ms。两宿主 PDF／阅读、草稿、重连、取消与续接已通过。已实际查看浏览器浅色及 Electron 深色预览截图。 |
| 真实开发命令与模型 UI | `SCHOOLOOM_LIVE_MODEL_TEST=1 xvfb-run -a pnpm exec playwright test tests/smoke/development.spec.ts --output=/tmp/scholoom-runtime-development-final`：2 通过，1.7 分钟。真实 dev:browser／dev:desktop 共用实例、页面刷新、退出顺序、资料保留均核对；真实 MiniMax 经产品入口读写合成材料，另一宿主打开结果。关闭 trace，只保留合成结果及脱敏日志。 |
| 独立真实模型 | `SCHOOLOOM_LIVE_MODEL_TEST=1 pnpm test:kernel tests/kernel/minimax-live.spec.ts --trace off --output=/tmp/scholoom-runtime-live-final`：1 通过，17.3 秒。仅合成观测值 2、4、6，实际保存和成果关联均核对，不代表真实科研充分性评价。 |
| Vite 重启所有权 | 授权后单独运行 development.spec.ts 的 `Vite internal restart`：1 通过，10.7 秒。预期注入失效凭据时保留旧 server／内核；没有将预期诊断视为失败。 |
| 活动执行与最后所有者 | `tests/kernel/development-execution.spec.ts`：dispose／SIGKILL 参数化 2 通过，28.9 秒；实际 WS、IPC、模型等待、Agent PID 退出、重启中断状态、项目文件与库题录保留，且不自动重启模型。 |
| 项目重新定位与停止未知 | 原构建真实移动后复现旧目录被重建；修复后项目移动＋独立模块／混合恢复 6 通过。最终根未登记、子未登记、子已登记停止未知及移动组合 4 通过，20.2 秒；原 run_instances 记录未知归属，无猜测 PID，替换被拒绝。独立复核关闭共同调度及三个未知停止窗口。 |

最终目录包验证命令及隔离产物：

```sh
SCHOOLOOM_PACKAGED_DESKTOP=/tmp/scholoom-runtime-package-complete/linux-unpacked/@scholoomdesktop xvfb-run -a pnpm exec playwright test tests/smoke/entrypoints.spec.ts --output=/tmp/scholoom-runtime-packaged-smoke-final-v2
SCHOOLOOM_PACKAGED_KERNEL=/tmp/scholoom-runtime-package-complete/linux-unpacked/resources/app.asar.unpacked/node_modules/@scholoom/kernel SCHOOLOOM_LIVE_MODEL_TEST=0 pnpm test:kernel tests/kernel/cli-runtime.spec.ts --output=/tmp/scholoom-runtime-packaged-cli-complete
```

文件、库、项目、配置及输出使用隔离临时目录，只收尾本轮进程。除明确标注的 live 验收外，模型使用受控 loopback HTTP 响应；live 仅使用已授权环境凭据和合成材料，验证接线及可判定结果，不评价真实科研质量。

| 检查／入口 | 实际结果和边界 |
| --- | --- |
| `pnpm typecheck` | 最新全工作区通过，包含 shared 构建、各包和工具 tsc；`tests/types/contracts.ts` 导入 dist，负例确实参与编译。新增 PDF 隔离测试后工具 tsc 另通过。 |
| `pnpm generate:contracts`、生成脚本 `--self-test` | 通过。产品及执行控制映射继续逐键引用原 schema，不复制 DTO；TS7 的泛型直接映射实测 TS2589／2590。复用键完整性、失效引用及真实装配的类型检查，不做全文比较门禁。输出更新 patch，应用后沿仓库 Biome 格式检查。 |
| `pnpm build`、`build:shared` | 最新全工作区 build 及多次 shared 构建通过。library 迁移资源、kernel 容器迁移、架构策略均复制到 dist；Electron／浏览器静态构建均成功。独立 Node CLI smoke 前次通过。 |
| `node scripts/check-architecture.ts` 迁包前基线 | 当时 11 模块、111 源文件，0 findings，3 处精确访问例外，分别属于 harness/runtime 和 research/content；已随 4.2／6.1 完成移除，当前结果见本轮验证表。已有 5 项真实违约夹具通过。 |
| `pnpm test:kernel` 较早全量 | 156 通过、2 跳过，耗时约 5.5 分钟。该轮早于最新控制器故障及工具补结果修复；不作为后续改动全量通过的证据。 |
| kernel 全量基线 | `SCHOOLOOM_LIVE_MODEL_TEST=0 pnpm test:kernel --grep-invert 'Vite internal restart'` 最新 181 通过、2 跳过，约 7 分钟。明确排除会启动开发服务器的一项；该基线已含 scratch 修复，但早于随后逐项文件桥、health 与项目窄端口，后者另有下列聚焦复验，不能把基线当作这些新代码的全量结果。 |
| 逐项文件桥 | execution-files／harness／harness-recovery／research-capabilities／work-materials 组合 38 通过，2.6 分钟；有界 peer 验证二进制 read/readRaw/filesUpdate 保留，非法结果与写后编码失败为 outcomeUnknown。随后缺 mimeType 的编码故障反例通过。 |
| 健康／当前尝试 | execution-isolation、execution-files、model-admission-integration 组合 11 通过，1.1 分钟；另迟到旧尝试单例通过。真实忙循环与正常模型等待并存、文件完成后 SIGSTOP 导致健康失败仍保留 unknown 工具收据、实际停止后回收。五项旧隔离边界继续有效。 |
| 项目文件窄端口 | 项目后端／harness／科研／容量／能力隔离／人工组合 33 通过，1.6 分钟；独立复核发现预期报告目录失效阻断无关保存的回归，恢复原有 lexical 目标比较后，项目后端＋科研 14 项复验通过，20.4 秒。独立替身不启动 broker／宿主，生产样本验证项目范围及领域撤权。 |
| 混合副本恢复 | project-recovery 3 通过，5.9 秒。固定持久样本覆盖当前 v3、v2 布局迁移后恢复，以及所属模块恢复失败；v2 没有运行实例表，迁入后为空，不凭虚构 PID 取得实际控制权。不是断电恢复或真实旧产品分发包验收。 |
| 能力故障与原调用重试 | capability-isolation 1 通过：真实根图与 broker／IPC，子入口换明确崩溃夹具，无关会话和文献继续可用；新消息触发实际能力重试沿原 invocation 增加尝试，旧失败保留，实际报告与 usable 均核对。仅替换子进程，不模拟领域交付。 |
| 非法提供者结果 | 实际图在文件已保存后收到非法提供者结果，工具保持 unknown，非法载荷未进入模型；人工 reconcile 只补关联，无第二次保存或模型调用。单例通过，9.2 秒。 |
| 最新恢复／broker／client／秘密组合 | `pnpm test:kernel tests/kernel/harness-recovery.spec.ts tests/kernel/broker.spec.ts tests/kernel/client.spec.ts tests/kernel/execution-secrets.spec.ts`：24 通过，1.8 分钟。含真实框架连续压缩、自动卸载但无摘要的工具结果缺失、合法空 scratch、新会话首轮失败重试隔离，以及旧资源标记提交后／诊断入图前失败并重开的窗口。 |
| model-access、model-admission-integration、work-materials | model-access 14 项通过；实际跨进程准入 4 项通过：串行及流结束释放、父 3 次加子 29 次后不允许第 33 次、排队中撤销 send 或实例资格均无新 HTTP。工作材料 2 项通过：无旧 transcript/checkpoint 的新会话读取 workspace.md 接续；必要工具收据保存失败无文件效果且人工文件操作可用。 |
| platform-resources、private-files、project-files、architecture | 最新组合 16 通过、1 跳过（Windows ACL），4.5 秒。真实临时文件系统及资源撤销、越界、符号链接、损坏保护、并发保存与备份保护继续有效。 |
| execution-secrets | 两项通过，使用唯一合成 key：受管进程 argv／继承环境不含 key 和无关宿主秘密；实际模型执行后公开状态、运行记录、checkpoint、项目及备份字节无 key。使用平台进程报告夹具观察 argv／env；不是直接探入生产 Agent 内存或验证远端计费。 |
| 生产入口 smoke | `xvfb-run -a pnpm exec playwright test tests/smoke/entrypoints.spec.ts`：4 通过，23.6 秒，真实 Node CLI、Electron React／preload、关窗内核驻留及重连、兼容宿主隐藏页面。使用已存在 Electron，不安装依赖或启动开发服务器。 |
| manual-application | 真实 WS／client／broker／SQLite／文件／PDF 子进程，1 通过；仅外部模型未装配。缺失 session 提供者局部 unavailable，后续文献查询继续工作，sessions/runs 为 0。 |
| execution-capacity、pdf-reading、platform-processes、research-capabilities | 修复后的组合 32 通过，含 controller 丢失不释放忙进程名额、父子容量不足、Agent PDF 不排队等待父名额、实际子树升级终止、宿主 SIGKILL、解析取消／崩溃／超时及资源收尾。 |
| execution-isolation | 4 通过：执行控制真实 IPC 校验；父 PID 崩溃后子退出、迟到模型申请拒绝且另一会话成功；controller 丢失后用户取消仍 interrupted／保留名额；数据库触发器拒绝撤权登记仍实际停止并保留诊断。忙循环 Agent 用明确的受控执行夹具，父子故障与撤权写入失败使用真实 Agent。 |
| harness、harness-recovery、sessions、model-access | 工具补结果接入后组合 39 通过。撤回旧目标另扩展为已确认／未知结果两种故障窗口，2 通过：原尝试接续、原完整结果或 outcomeUnknown 进入模型，tool_use/result 完整配对，最新要求可推进且不自动写旧报告。最后停止登记细化后的全量复验见上行。 |
| checkpoint-files、instruction-checkpoint、harness-recovery | 保留原先磁盘与 IPC 证据：三种来源、namespace/pending writes、跨进程写者排除；保存失败、确认事务失败及成功回执丢失均无后继模型调用，重开只注入一次；120 条用例损坏实际活动 run 并验证全部指令。最新控制端口接入后的恢复／人工组合 10 项复验通过。 |
| project-container | 3 通过并经独立复核。第三项随后改为生产 WAL 模式，commit 前 SIGKILL 后关闭父连接、重新打开仍只见 v2，保护副本可读，重试成功进入 v3，复验通过。不是断电／COMMIT 写盘中断或从保护副本恢复的验收。 |
| pdf-isolation | 1 通过。实际内核／broker／library／模型 HTTP／Node IPC 装配，计算入口替换为明确忙循环夹具；库查询、状态和无关会话继续响应，停止后再次真实解析同一 PDF 成功且原字节保留。双宿主 UI 部分仍未运行。 |
| 文件／库保护 | 全量及相关组合覆盖并发内容保护、身份变化、移动回收、未知结构操作、备份副本、材料撤权、版本、原字节与批次部分成功。Windows ACL 专用用例在 Linux 跳过。 |
| OpenSpec／diff／lint | strict validate 及 diff 空白检查通过。lint 曾发现迁入 import 顺序、测试格式和 finally 中显式 throw，修正后全仓通过，仍有原平台测试等 5 warning／31 info；新增 PDF 文件另经 Biome 检查通过。 |

较早全量 kernel 中，一项测试内部直接启动了隔离 Vite 服务；调用前漏查了该测试，服务随测试完成关闭。该误触违反当时“不得启动开发服务器”的执行边界，已在主对话说明；随后全量入口明确排除它。用户后来明确批准两项授权后，才运行本轮 UI／开发 smoke／live 验收。首轮 UI 与独立 Vite 重启用例并行，共用预打包缓存，页面加载遇到 504 Outdated Optimize Dep；停止首轮并按创建 PID 清理服务，串行重跑恢复正常，不修改业务断言来绕过加载失败。源码和目录包入口 smoke 在并行负载下曾超出默认 5 秒断言等待；协议本已允许 10 秒生命周期加 3 秒认证，测试改为引用这两个期限，产品行为不变。最后目录包 4 项通过，24.4 秒；源码入口完整串行复验也为 4 项通过，24.5 秒。

默认 peer 容量依据见开发说明：64 普通／8 控制等待，2 MiB 帧；受控 1 KiB 样本发送 72 帧、70,079 字节，约 3 ms。共同进程容量样本为 4 对控制／执行单元加 8 等待，启动约 222 ms、收尾约 34 ms（20 ms 测试升级期限）。这些是本机受控容量依据，不是框架内存、真实网络或跨平台性能承诺。

## 审查与问题处理

协议防漂移经独立只读复核，修复同键不同载荷、实例赋值及注册投影放宽、多操作泛型丢失参数关联、联合元组可变等问题；构造和 register 双向相容检查、声明保留的 invariant 绑定及只读关联元组已纳入真实 tsc 负例。公共 broker 不执行领域授权或业务顺序，不承担宿主资源调度。

恢复独立审查的三处问题（反序列化保护范围、诊断失败泄漏 checkpoint claim、120 条用例损坏非活动尝试）已修复并复核关闭。方案未退回框架选型，没有新增通用工具台账。

会话 scratch 独立复核又发现首轮失败后误继承旧目录、祖先链接造成会话共用、非摘要资源缺失漏报。修复为创建事务登记隔离资格、内部目录逐层拒绝链接、成功写入资源登记及结构化框架引用的有界核查。复核中补修合法空文件误报、用户消息卸载前缀、合并引用上限及旧清单不确定性丢失窗口；最终静态复核关闭，父方真实故障与正常反例均通过。旧清单无法可靠核对时保守提示，状态跨重启保留，不猜测自由文本中的文件名。

连续压缩真实用例先复现第二轮历史未追加，根因是 SDK `Uint8Array` 经普通 JSON 桥失去字节类型。上传／下载改为声明派生的内部操作和 base64 适配后，同一历史保留首轮约束并追加第二轮约束；丢失历史仍保留摘要及工具证据并提示核查。测试仅在受控子进程覆盖 SDK profile，缩小默认压缩窗口，未增加生产测试开关。

本轮停止／容量独立审查共发现五项并复核关闭：controller 退出误作实际停止、子实例未登记及核查父资格、Agent PDF 循环等名额、停止未知误报 cancelled、撤权登记写入失败跳过停止。对应故障实跑见上表。对无法确认实际停止的进程保留占用与未知；测试故障遗留进程由测试按其已知创建归属回收，生产不凭旧 PID 随意终止。

框架默认补齐中断工具时使用笼统 cancelled 文本，不能表达所属收据的实际不确定性。当前先用旧完整结果补图；未确认效果明确带 outcomeUnknown 和原收据引用，未受理操作由最新意图重新决定。没有新增第二份事实账本。PDF 关闭测试曾在 load 进入前取消，未覆盖声称的运行中断；改为等待实际开始信号后复验通过。

以上为限定范围审查，不代替 8.5 的最终整体审查、真实模型及目标平台验收。

逐项文件桥及 health 独立复核发现并关闭两项：失联中的在途工具误记普通错误、写后结果编码失败误报 unavailable；真实文件后暂停及非法字节结果反例通过。项目窄端口独立复核发现并关闭一项：错误解析已移动的预期报告父目录，导致无关编辑失败；恢复旧范围及身份核查，真实生产接线复验通过。项目内部映射也触发 TS2589／2590，按既定方案保留逐键 schema 引用；生成器改为 Node 24 直接装载声明，避免依赖已经过期的类型文件完成编译。

本轮独立复核指出并修复：Zod 输出模式将默认参数变成必填、模型结束事件允许空 output、能力停止未知被降级为 cancelled，以及 await 项目检查后通过无 signal 端口新受理结构修改。前两项经静态复核关闭并由真实图缺省参数场景验证；停止分已登记与尚未登记两个真实忙循环窗口，父推进另在能力调用边界保存未知标记；取消场景核查实际目录和操作记录均未产生。已受理文件的进展与关联仍无 abort 地收尾。停止夹具曾在进入忙循环前杀 controller，PID 自行退出，不能作为停止未知证据；改为等待实际 busy 消息后，两种窗口均通过。

分发检查另发现 ASAR 路径和 SDK 自带嵌套运行代码被打包器遗漏，先复现实际 Node 导入与 Electron 引导失败，再保留原文件解包并经实际目录包复验。没有替换框架、升级依赖或增加第二套业务台账。

最终独立审查发现项目移动后 harness 与 research 缓存旧目录仓储。真实磁盘测试先复现旧目录被重建，再验证宿主项目替换钩子协调原执行收尾、关闭所属仓储、清除初始化与待关联缓存，并在新目录重新绑定。复核又指出自动续轮等待配置时绕过旧资源检查，以及根／子尚未登记便停止未知的窗口：共同 schedule 入口现在拒绝旧资源并释放准入名额；停止未知复用原 run_instances 保存 instance/run/host/parent 归属，不猜 PID、不覆盖已登记或已退出记录。三种真实 busy／controller 丢失故障均拒绝释放项目仓储，最终独立静态复核通过。没有新增通用台账或改变 checkpoint 恢复方案。

## 未完成事项与下一步

继续 `openspec instructions apply --change migrate-runtime-architecture --json`，沿同一 tasks／delivery 推进。

1. 本次 Linux 范围内无剩余实施或必要验收任务，34/34。最后内核全量、目录包 smoke／CLI PDF、双宿主准确计时及真实模型验收结果已收齐；审查发现均已修复并复核。
2. 用户已确认本次目标为 Linux，三平台 CI 保留；Windows／macOS 的真实分发、文件保证和进程树尚未验收，公开声称支持前仍需相应实际验收。目录包仍要求系统 Node 24，不附带 Node 程序。
3. 真实模型独立及 UI 合成样本均通过，独立审查已收口，八份正式规格已同步；保持另一会话的决议及接口约束，只修正与已实施状态冲突的链接和说明。
4. 迁包前已有的 ProjectBackend 长单行分页截断仍为已知遗留；未混入本次架构迁移修复或通过依据，后续应核对正文分页契约再处理。真实科研充分性、签名发布、SSH、插件及通用多 Agent 功能沿原范围另行验收或实施。

未归档、未提交，不把 CLI 工件状态或已存在的构建产物当作最终交付。
