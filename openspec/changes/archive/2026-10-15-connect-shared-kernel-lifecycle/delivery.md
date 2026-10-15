# 实际交付与交接

## 当前状态与成果

路线图 P1 已实施，沿本会话批准的方案交付，任务进度见 [tasks.md](tasks.md)。未提交、归档或发布。实现路径与 [design.md](design.md) 的模块总览及停机时序一致；连接状态契约见 [kernel-lifecycle/spec.md](specs/kernel-lifecycle/spec.md)。

| proposal 完成判据 | 实际成果与依据 |
| --- | --- |
| 同配置单实例、不同配置隔离 | 独立 Node 驻留内核按规范化目录持有 SQLite OS 锁，原子发布发现记录；真实进程测试覆盖并发、路径别名、配置隔离、崩溃释放和并发重启。 |
| GUI 关闭后续留、重新接回 | CLI 提供 start/status/stop；Electron 经纯 Node 引导与共享客户端接入。真实原生关窗和应用退出后 CLI 仍能查询，重开接回同一实例。 |
| 错误可辨、有界恢复、不替换存活实例 | protocol 提供 Schema、DTO 和运行时校验；client 关联请求、认证及有界退避，不重放操作。真实协议与 UI 测试覆盖认证／协议错误、暂时断线、存活不可达、退出后手动启动。 |
| 明确停机、退出确认、未知结果 | 停机受理及广播与实际退出分开；CLI／session 经只读状态查询确认退出。测试覆盖多客户端、超时、断线、迟到状态和首次连接期间停机，未知结果不当作成功，也不自动拉起。 |
| 必要检查、审查与平台边界 | Linux 全套检查及独立审查完成；三平台 CI 使用同一检查入口，Windows/macOS 未在本机实跑。 |

浏览器和 Electron 共用 Workbench、session 与事件路径，连接变化保留当前草稿。工作台提供重试、状态查询及影响所有客户端的停机确认；科研指令发送仍不可用，开发样例保持显式隔离。README、开发说明、项目 AGENTS.md 和检查配置已同步。

Vite 引导限制本机同源请求且禁止缓存。静态、public 和模块加载路径核对真实路径及 Vite 文件访问规则，阻止运行凭据通过直接路径、目录链接或改名文件链接被读取。Electron 仅暴露受限 bootstrap IPC，并检查调用来源。

## 实际验证

执行环境：Linux，Node 24.12.0、pnpm 11.10.0、Electron 44.5.1、Playwright 1.63.0。所有生命周期和 UI 检查使用独立数据配置；只操作本轮拥有的进程与样本，不访问真实研究数据。

最终整合命令 `xvfb-run -a pnpm check` 退出码为 0：

| 检查 | 最终结果 |
| --- | --- |
| pnpm lint | 通过，47 个文件，无诊断 |
| pnpm typecheck | 共享包、应用及工具配置通过 |
| pnpm build | 全部包及应用通过 |
| pnpm test:kernel | 17 通过 |
| pnpm test:smoke | 4 通过 |
| pnpm test:ui | 21 通过、1 跳过；Vite 安全边界用例只在浏览器项目执行，Electron 项目跳过对应重复项 |

合计 42 项通过。各套检查的最近运行状态保存在忽略的 `test-results/{kernel,smoke,ui}/.last-run.json`。已查看浏览器与 Electron 的 `connected-workbench.png`，确认真实连接状态和工作台布局；截图位于对应 `test-results/ui/workbench-default-…-ui-{browser,electron}/`。

测试使用真实 CLI、锁、发现、服务、认证、客户端、宿主接线及组件。网络代理只控制传输故障或延迟；受控服务清理用于制造停机确认超时，不替代内核业务实现。测试结束后确认本轮内核与 Vite 进程均已退出，临时 public 链接已清理。

OpenSpec 严格校验和 `git diff --check` 通过。Mermaid 图经图文与语法人工核对；OpenSpec 校验不验证图的渲染。Windows/macOS CI 已接入同一组脚本，但本次没有它们的实际运行或分发包证据。

## 审查与问题处理

独立原生 reviewer 对关键接口、认证、锁与发现、并发恢复、停机状态及 Vite 凭据边界进行只读审查。反馈修复后复查，最终确认既定范围内的 findings 均已闭合；最终测试由主 Agent 执行。

- 状态探测改为只读查询，避免争用启动锁造成启动饥饿；过期发现与并发重启在预算内重读。
- 停机通知后的状态受到保护，断线、迟到查询以及连接成功／失败均不能覆盖 stopping 或结果未知；退出仍由宿主查询确认。
- Vite 保护扩展到真实路径、模块 raw 导入和普通 public 路由，并复用公开文件访问规则；相应绕过场景在浏览器实跑。
- Electron 测试原有 close 等待会挂起，fixture 改为原生关窗／退出并核对捕获的进程退出，同时验证后台续留。
- Windows 若文件符号链接创建遇到 EPERM，测试明确注明该项未验证并跳过依赖该链接的变体；目录 junction 验证仍保留。该分支经静态复查，未在 Windows 实跑。

上述修复已纳入最终检查。未保留未解释的失败或审查发现。

## 未完成事项与下一步

本变更约定范围内没有剩余实现任务。P1 不包含 Agent／模型执行、研究任务、领域数据持久化、插件运行或独立 Node 产品分发；连接成功不表示这些能力已经接入。页面刷新不保存草稿，当前 session 内的重连和状态切换保留草稿。

Node 24.12.0 的 node:sqlite 仍为实验性 API，运行时会发出告警。单实例锁要求本地文件系统，不适用于 NFS。Windows/macOS 实跑及实际分发包验收仍须按验证纪律另行取得证据。

后续实施沿路线图下一阶段与正式决议起草变更；如需归档或提交，另按用户授权执行。归档时 delta 已同步到主规格：新建 `kernel-lifecycle` 规格，并按 delta 更新 `ui-workbench-foundation` 的共享工作台与样例隔离要求。无关的未跟踪文件未纳入本次提交。
