# 实际交付与交接

## 当前状态与成果

### 主分支接收及原生归属后的复验

2026-10-24，用户要求 dev 合入三工作树成果并完成收尾、不再分派。PR #13 固定头 `ccc60cab56c959fcc81dec23434e68c7e722a0f7` 已以 `607dd19` 保留原提交接收，GitHub 状态 MERGED。主线后续的原生进程归属修复见领域交接 delivery；本项文件／写作修复保持，不重新打开已归档工作域变更。

在原生归属提交 `a8f1947` 的真实 [CI 40054938577](https://github.com/leike0813/Scholoom/actions/runs/40054938577) 中，Windows 完整内核 **385 通过、12 既有跳过，30.4 分钟**，没有原先的状态等待失败；原生专项 **15 通过、1 跳过，34 秒**。这只是本次实际运行，不推断此前不稳定的唯一原因。Windows smoke **4 通过、2 失败、1 既有跳过**：开发生命周期仍卡旧库 UI 入口；另一个 Electron 入口在 5 秒内未找到一级标题，尚待诊断。UI／打包未到达。原日志 `/tmp/scholoom-r5-windows-native-job.log`。

同次 Linux 内核 **390 通过、5 失败、2 跳过**，五项属于新原生控制路径的故障注入与旧根 PID 推断，修复及新验收由领域变更记录；macOS 原生专项 **14 失败、2 通过**，kqueue 假设不成立。用户已决定保留 macOS 全功能目标，先规划系统服务／隔离环境，公共基础尚不验收。不能以本次 Windows kernel 通过宣称三平台 CI 或分发完成，3.1 继续保留待办；没有删除断言、放宽等待或跳过旧库 UI。

安装夹具修正后的 `bf051e7` / [CI 40058485995](https://github.com/leike0813/Scholoom/actions/runs/40058485995) Windows 原生专项 **16 通过、1 跳过，30.6 秒**，含中文和空格安装路径；完整内核 **386 通过、1 失败、12 跳过，30.2 分钟**。失败是 `tests/kernel/development-execution.spec.ts` 的开发宿主 SIGKILL 场景 60 秒超时，smoke 未到达；并非前一轮同样的标题失败，也不能据此关闭旧 smoke 待办。日志 `/tmp/scholoom-r5-windows-bf051e7.log`，远端 trace 已保留。最新接续保护源码 `cb7eb06` 的 CI 仍在进行，Linux／Windows 原生专项通过，完整平台结果尚待完成。主线本机完整内核 397 通过／2 跳过、末轮接续修正后 45/45、双宿主 8/8 及最终 Linux 包入口 4/4 的分阶段证据见领域 delivery，不把本机证据替代 Windows／macOS。

### 原工作树交付

本变更基于 dev `23e68c8`，实施 PR #10 暴露的跨平台公共缺陷清理，主要源码已提交推送至 `001cab8`，审查入口为 [PR #13 → dev](https://github.com/leike0813/Scholoom/pull/13)。原工作树交付止于可审查 PR，当时整条 CI 未通过：Windows 执行状态等待未稳定（PR 2项失败、同代码 push 23项失败），Linux／macOS smoke 仍受旧库 UI 入口阻断。保留原记录和验证待办；当前接收状态以上方主分支记录为准。

- 写作产物根、目录浏览及项目准入使用相同真实路径表示；保留根外链接及私有目录拒绝。创建前拒绝私有根，不留下新目录。
- 创建候选通过 `r+` 句柄执行原有 fsync；原子发布、依据核验、收据和效果未知处理保留。
- 受管子进程增加 PATHEXT／COMSPEC，以及后续真实错误要求的 APPDATA。ESM 子进程入口使用 file URL；项目移动夹具经既有生命周期钩子释放目标 harness／research，再关闭 project 存储，原执行继续被持有，旧实例端口仍须拒绝。
- editor 私有记录由实例拥有目录准备及同路径读写协调，保留首次 ACL 设置和每次写入前 bigint dev／ino／非链接核对；工作空间释放清缓存，首次准备失败清除失败缓存，当前请求仍报错。目录替换后不在新目录落盘，不通过忽略 EPERM 或重试掩盖失败。该保护不监测同一目录身份上的外部 ACL 修改。
- BibTeX 夹具用双花括号保护题名大小写；监听注入和重定位断言使用真实路径。不改 locale、超时、跳过条件或原精确行为断言。

实现路径与 [design.md](design.md) 的流程图及序列图一致。范围和完成判据见 [proposal.md](proposal.md)，任务以 [tasks.md](tasks.md) 为准。

## 实际验证

本机为 Linux，Node 24.12.0、pnpm 11.10.0、Quarto 1.9.37；全程复用已有依赖，未安装、升级或删除依赖。测试使用隔离临时目录和本轮进程；模型 HTTP 为既有 loopback 受控响应，真实文件、SQLite、子进程与内部接线均未替代。

| 检查 | 实际结果与证据 |
| --- | --- |
| 修改前原有 editor-runtime 两项及目录浏览 | 3/3 通过，说明普通路径未覆盖别名根 |
| 新增／扩展别名回归，修改前 | 2/2 失败：合法产物被拒绝、私有 profile 出现在浏览列表；`test-results/cross-platform-alias-red` |
| 修复后同一回归 | 2/2 通过，含根外链接拒绝、私有目录拒绝及无创建副作用；`test-results/cross-platform-alias-green` |
| `pnpm lint` | 通过；74 项既有 warning、35 项 info，未禁用规则 |
| `pnpm check:architecture` | 通过，13 模块、198 文件、0 findings、0 granted exceptions |
| `openspec validate fix-cross-platform-file-and-writing-behavior --strict` | 通过 |
| `pnpm test:kernel` 指定 editor、editor-runtime、project-files、file-watch、resource-creation、resource-access、project-runtime-relocation、literature-attachments、literature-integration、research-capabilities、development-execution、execution-secrets 共 12 文件 | 70/70 通过，3.2 分钟；命令及逐项结果见 `/tmp/scoped-r5-regression.log`，产物 `test-results/cross-platform-regression` |
| `pnpm typecheck`、`pnpm build` | 均通过，包含共享模块、内核及 Electron 前端构建；日志 `/tmp/scoped-r5-typecheck.log`、`/tmp/scoped-r5-full-build.log` |
| smoke 隔离路径后续修正：`pnpm exec playwright test tests/smoke/development.spec.ts --grep 'two renderer instances' --output test-results/cross-platform-isolation` | Linux 1/1 通过，37.6 秒；真实启动两个隔离 renderer／内核，命令日志 `/tmp/scoped-r5-isolation.log`；仅收尾本轮进程 |
| smoke 后续修改的 `biome check`、`tsc --noEmit -p tsconfig.tools.json` | 均通过；只修改路径期望，无源码变化，未重复全仓构建 |
| Windows 后续源码修复：共享构建、editor tsc、tools tsc、lint／架构／OpenSpec | 通过；沿用已有依赖；日志 `/tmp/scoped-r5-records-build.log`、`/tmp/scoped-r5-final-lint.log` |
| 后续定向 `editor-runtime`、`editor`、`resource-access`、`execution-secrets` | Linux 25/25 通过，1.5 分钟；真实编译与目标重开保留，日志 `/tmp/scoped-r5-records-regression.log` |
| 独立审查修正后的 editor-runtime | Linux 7/7 通过，5.5 秒；含首次失败后显式重试、目录替换拒绝及65／66轮原缓存断言；`/tmp/scoped-r5-records-final.log` |
| 最终工作空间准备缓存释放收尾 | Linux editor-runtime 7/7 通过，5.2 秒，editor tsc／Biome 通过；`/tmp/scoped-r5-records-cleanup.log`。仅清除已结束工作空间的内存准备记录，停止未知时磁盘诊断仍保留；该收尾及文档提交的最新 CI 不冒记为完成 |
| Windows 剩余两项 harness 用例在本机定向复跑 | Linux 2/2 通过，21 秒；`pnpm test:kernel tests/kernel/harness-recovery.spec.ts tests/kernel/harness.spec.ts --grep 'an empty saved scratch\|Agent structure tools' --output test-results/cross-platform-harness-diagnosis`；日志 `/tmp/scoped-r5-harness-diagnosis.log`。没有修改其断言、超时或 harness 实现 |

远端基线为 [dev CI 39976414916](https://github.com/leike0813/Scholoom/actions/runs/39976414916)：Linux 380 通过、1 失败；macOS 369 通过、12 失败；Windows 320 通过、51 失败、12 既有跳过。根因与源日志见 [investigation.md](investigation.md)。不能用 Linux 结果代替 Windows fsync、命令查找或 macOS 系统别名验证。

最终主要源码的实际 PR CI 为 [40047684957](https://github.com/leike0813/Scholoom/actions/runs/40047684957)，代码 SHA `001cab8`。三平台均已通过 lint、架构、typecheck、build 和写作工具链准备，写作工具沿用原 CI 声明：Quarto 1.9.37 及 TinyTeX／latexmk／caption；本轮没有修改 CI 配置或本机依赖。

| 平台／job | kernel | smoke／后续步骤 |
| --- | --- | --- |
| Linux / 120733041163 | 383 通过、2 既有跳过，16.3 分钟 | 5 通过、1 失败、1 既有 live 跳过；失败为等待旧库授权入口；UI／打包未到达 |
| macOS / 120733041310 | 383 通过、2 既有跳过，17.8 分钟 | 5 通过、1 失败、1 既有 live 跳过；隔离路径修正已通过，失败同为旧库授权入口；UI／打包未到达 |
| Windows / 120733041407 | 371 通过、2 失败、12 既有跳过，35.8 分钟 | 本轮写作、目录、记录、创建、重开回归通过；两项 harness 仍在5秒后为 running；smoke／UI／打包未到达 |

Windows 本轮具体验收：history／full-cache 原66／65轮分别18.9／18.0秒通过；目录替换及首次失败后恢复264毫秒通过；真实 Quarto HTML／PDF／DOCX 分别16.8／17.4／6.5秒通过；目标实例重开和旧端口拒绝10.5秒通过。原 fsync、收据 rename、APPDATA 及目标移动错误在本轮对应回归中不再出现。日志为 `/tmp/scoped-r5-001cab8-{linux,mac,win}.log`，远端由上述 CI 保留。中间失败运行及真实差异见 [investigation.md](investigation.md) 的“Windows 后续实跑”，不以本轮结果抹掉旧失败。

同代码 push [40047681750 / Windows job 120733032189](https://github.com/leike0813/Scholoom/actions/runs/40047681750) 为350通过、23失败、12既有跳过，39.4分钟。本轮具体验收同样通过：缓存24.4／23.2秒，HTML／PDF／DOCX 20.9／16.7／8.3秒，目标实例重开10.4秒；但多项 harness、会话、材料及真实模型回归停在短状态等待，不能称 Windows 整体稳定。原日志 `/tmp/scoped-r5-001cab8-win-push.log`，失败定义由该CI保留，不只报告较好的一次。

两平台 smoke 的 `development.spec.ts:408` 等待 helper 中已移除的“文献库授权与备份”，失败页面快照已是当前库列表且没有该入口。保留180秒上限及原断言，不补功能、不跳过或绕过授权；沿用户暂缓的库 UI 方案等待确认。初次诊断产物在 `/tmp/scoped-r5-fixed-linux-artifacts`，后续同样失败可由本轮日志核对。真实 live 模型、完整 UI、目标平台分发包及安装恢复不在通过范围内。

## 审查与问题处理

原生独立 Agent 分别静态审查初版权限边界、后续 EditorRecords／完整目标释放及 APPDATA；未发现可确认的访问范围扩大、私有目录泄露、秘密继承或保存保护退化。初版仅关 project DB 的准备被真实 Windows EPERM 证伪，已改用既有生命周期钩子释放全部目标仓储；原源执行持有与旧端口拒绝断言保留，并经本轮 Windows 实跑。ESM 只改变模块说明符，文件系统参数仍为本机路径。

后续独立审查发现首次目录准备失败会永久缓存 rejected Promise。已修正为当前错误继续抛出、仅删除对应失败准备项；审查复核关闭该 P2，同一真实回归验证显式下一请求成功，本轮 Windows 也通过。

## 未完成事项与下一步

PR #13 已在 dev 接收，3.1 保留未勾选，整体 CI 未绿。原两项及 23 项 Windows 状态等待失败在 `a8f1947` 的完整内核中未复现，但不据一次运行认定历史不稳定的原因。最新生产源码及安装路径夹具的实际跨平台复验继续以主分支记录和 CI 为准。

当前未关闭的是 Windows 开发宿主 SIGKILL 场景超时、旧库 UI 入口验收，以及此前 Windows Electron 入口在 5 秒内未找到一级标题。已读取实际 trace：SIGKILL 场景先在 `model.requests.length` 的 5 秒等待中得到 0，尚未执行 owner SIGKILL，随后清理持续至总计 60 秒；调查应从模型请求前的 run／worker／模型准入及清理等待开始，不能把场景名当作停止阶段失败的证据。前一轮标题失败没有页面快照或 renderer 加载原因，同样不能认定超时太短。续做先核对最新 CI，沿实际 run／tool records、进程身份及模型请求诊断，保留原断言与上限；标题若再现再核对实际窗口、页面加载和 renderer 错误。库 UI 实施仍待原方案确认，不改走 API 假装用户入口通过。macOS 完整归属由领域变更第 5 组继续规划，保留全功能目标；本项未归档，七域仍待公共基础验收，本轮不再分派工作树任务。
