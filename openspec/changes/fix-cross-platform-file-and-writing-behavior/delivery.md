# 实际交付与交接

## 当前状态与成果

本变更基于 dev `23e68c8`，实施 PR #10 暴露的跨平台公共缺陷清理。按用户当前授权直接执行并向 dev 发 PR；不合入，不实施库 UI，不重开已归档变更，不修改另外两个活动 change。

- 写作产物根、目录浏览及项目准入使用相同真实路径表示；保留根外链接及私有目录拒绝。创建前拒绝私有根，不留下新目录。
- 创建候选通过 `r+` 句柄执行原有 fsync；原子发布、依据核验、收据和效果未知处理保留。
- 受管子进程仅增加 PATHEXT／COMSPEC 两个必要系统环境。ESM 子进程入口使用 file URL；项目移动夹具先释放目标存储，原执行继续被持有，旧实例端口仍须拒绝。
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

远端基线为 [dev CI 39976414916](https://github.com/leike0813/Scholoom/actions/runs/39976414916)：Linux 380 通过、1 失败；macOS 369 通过、12 失败；Windows 尚未结束。根因与源日志见 [investigation.md](investigation.md)。本分支修复后的三平台结果待推送核对；不能用 Linux 结果代替 Windows fsync、命令查找或 macOS 系统别名验证。

## 审查与问题处理

原生独立 Agent 静态审查覆盖四个源码文件及别名、旧实例、秘密隔离回归，未发现可确认的访问范围扩大、私有目录泄露、秘密继承或保存保护退化。确认目标 DB 关闭后重开仍产生新实例，旧端口拒绝断言保留；Windows 实际行为仍须 CI 验证。主线程核对所有 diff，ESM 只改变模块说明符，文件系统参数仍为本机路径。

## 未完成事项与下一步

本机验证与审查已完成。下一步提交推送，创建面向 dev 的 PR，核对本次实际三平台结果并更新本记录。平台未运行、失败及流水线未到达的步骤应分别保留；库 UI 入口方案及其他领域功能不属于本变更。
