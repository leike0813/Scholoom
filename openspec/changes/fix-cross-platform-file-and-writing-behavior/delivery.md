# 实际交付与交接

## 当前状态与成果

本变更基于 dev `23e68c8`，实施 PR #10 暴露的跨平台公共缺陷清理。实现已提交推送为 `b894d01`，审查入口为 [PR #13 → dev](https://github.com/leike0813/Scholoom/pull/13)。按用户当前授权直接执行并向 dev 发 PR；不合入，不实施库 UI，不重开已归档变更，不修改另外两个活动 change。

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

远端基线为 [dev CI 39976414916](https://github.com/leike0813/Scholoom/actions/runs/39976414916)：Linux 380 通过、1 失败；macOS 369 通过、12 失败；Windows 320 通过、51 失败、12 既有跳过。根因与源日志见 [investigation.md](investigation.md)。不能用 Linux 结果代替 Windows fsync、命令查找或 macOS 系统别名验证。

修复后实际 PR CI 为 [39981909728](https://github.com/leike0813/Scholoom/actions/runs/39981909728)，代码 SHA `b894d01`。三平台均已通过 lint、架构、typecheck、build 和写作工具链准备：

| 平台／job | kernel | smoke／后续步骤 |
| --- | --- | --- |
| Linux / 120511081728 | 382 通过、2 既有跳过，16.4 分钟 | 5 通过、1 失败、1 既有 live 跳过；失败为等待旧库授权入口；UI／打包未到达 |
| macOS / 120511081838 | 382 通过、2 既有跳过，15.6 分钟 | 4 通过、2 失败、1 既有 live 跳过；隔离测试路径断言已按真实路径后续修正，另一个仍为旧库授权入口；UI／打包未到达 |
| Windows / 120511081448 | 340 通过、32 失败、12 既有跳过 | 多项执行状态等待失败；原 fsync 已无 EPERM；仍有 APPDATA、收据 rename 和目标移动失败，smoke／UI／打包未到达 |

同代码 push Windows [39981865053](https://github.com/leike0813/Scholoom/actions/runs/39981865053) 则为 366 通过、6 失败、12 既有跳过；后续测试路径提交 `5245169` 的 Windows [39986421464](https://github.com/leike0813/Scholoom/actions/runs/39986421464) 为 363 通过、9 失败、12 既有跳过。三份结果均保留，差异及可确认根因见 investigation 的“Windows 后续实跑”。本次 APPDATA、完整目标释放及 EditorRecords 修复尚需新 CI，以上旧结果不代表后续代码已通过 Windows。

两平台 smoke 的 `development.spec.ts:408` 等待测试 helper 中的“文献库授权与备份”，失败页面快照已是当前库列表且没有该入口；保留 180 秒上限及原断言。Linux 诊断产物在 `/tmp/scoped-r5-fixed-linux-artifacts`，真实日志为 `/tmp/scoped-r5-fixed-{linux,mac}.log`，远端由上述 CI 保留。该 UI 入口属于用户暂缓的库 UI 方案，本轮不补功能、不改为跳过或绕过授权。macOS 隔离测试正、负项目期望同时 realpath，修复误拒绝并让排除断言实际核对另一项目；后续修正只在 Linux 实跑，macOS 重跑结果不得冒记。

## 审查与问题处理

原生独立 Agent 静态审查覆盖四个源码文件及别名、旧实例、秘密隔离回归，未发现可确认的访问范围扩大、私有目录泄露、秘密继承或保存保护退化。确认目标 DB 关闭后重开仍产生新实例，旧端口拒绝断言保留；Windows 实际行为仍须 CI 验证。主线程核对所有 diff，ESM 只改变模块说明符，文件系统参数仍为本机路径。

后续独立审查覆盖 EditorRecords、目标释放测试准备及 APPDATA，发现首次目录准备失败会永久缓存 rejected Promise。已修正为当前错误继续抛出、仅删除对应失败准备项，并扩展同一真实回归验证显式下一请求成功。其余指定范围未发现问题；仍以实际 Windows 验证为准。

## 未完成事项与下一步

本机验证与审查已完成，代码已推送并创建 PR。下一步核对本次实际三平台结果并更新本记录。平台未运行、失败及流水线未到达的步骤应分别保留；库 UI 入口方案及其他领域功能不属于本变更。
