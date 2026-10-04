# 确定 Orca UI 调试 harness 与 Electron e2e 验收

Labels: wayfinder:grilling
Type: grilling
Mode: HITL
Status: resolved
Assignee: 本会话 Codex；与用户讨论开发入口及 Electron e2e（2026-10-04）
Parent: [Scholoom：产品与工程基础决策地图](../map.md)
Blocked by: 09, 12, 14

## Question

怎样利用 Orca 内置浏览器，让编码 Agent 能运行、观察和调试 Scholoom 的实际工作台，并在关键接线形成后建立可持续维护的 e2e 框架？

沿用[已确认的工程纪律](14-agent-development-discipline.md)：Orca 用于日常 UI 调试，关键流程首次能从入口经过实际领域执行、持久化到产物时开始建立 e2e，单元测试不能代替接线验收。依据领域与进程架构、前端及工具链，选择浏览器开发入口、真实领域服务接入、Electron 原生行为验证及场景组织。保持同一份业务与 UI 实现，区分纯布局样本、真实接线和真实模型效果。

以[当前能力核查](../research/orca-ui-and-researchspec-dogfooding.md)为起点。Orca 已实测简单页面快照、点击与 console，截图仍有空白问题；仅有命令或文档支持不等于可用。比较 Playwright／WebdriverIO 等适合真实 Electron 的候选，确定实际页面、应用观察、异步状态、错误定位以及实例和日志隔离的验证安排。实际接入验证随业务实现开展，框架选择及验收范围见 Answer。

落实已确认的 e2e 建立时机，选择框架、数据准备、稳定的语义定位与等待、失败诊断及本地／CI 运行方式。确定性 e2e 可在外部模型边界使用受控响应，内部核心接线保持实际实现；本票细化具体边界和场景，真实模型效果由 dogfooding 验证。用有代表性的实际行为验收，避免固定等待、精确 UI 文案或大范围视觉 snapshot 成为脆弱条件。

本票决定调试与测试安排，不代替真实 Agent dogfooding。应用代码、依赖安装、开发服务器及工作树操作在后续具体实现方案与已有授权内执行。

## Answer

用户于 2026-10-04 分两轮回复“采纳”，确认 Q1–Q6。本票改为决策讨论票并 resolved；结论是已确认的开发与验收方案，实际运行验证随业务实现落实。

### 开发入口与框架（Q1–Q2）

同一 React 工作台提供浏览器开发入口，经共同客户端与本地 WebSocket 连接真实 Node 内核，供 Orca 日常探索。文件选择、系统集成等原生操作由窄宿主适配承接；preload、桌面生命周期及 OS 交互在真实 Electron 中验收。布局样本可独立展示，实际业务调试沿同一领域实现。

优先 Playwright Test，同时承载浏览器场景与真实 Electron 场景，复用 locator、条件等待、fixture 和 trace。接受其 Electron API 仍为 experimental 的维护风险，先验证固定 Playwright／Electron 组合的启动、窗口、preload 和诊断。WebdriverIO 的 Electron service 保留为有具体接入障碍时的替代候选。两者都有开发及打包入口能力，静态候选核对不等于运行验证。main 检查与最终分发设置配对核对；原生 dialog 返回值可在确定性场景替换，OS 对话框另行验收。

事实依据见 [Playwright 自动化调查](../research/playwright-electron-harness-facts.md)与 [WebdriverIO 核对](../research/webdriverio-electron-harness-facts.md)。具体版本组合由实际实现核对。

### 测试边界、隔离与诊断（Q3）

确定性 e2e 运行实际内核、文件、数据库及所需兼容宿主，只在外部模型／远程依赖边界按场景提供受控响应；真实模型研究效果由 [#21](21-agent-dogfooding-and-evaluation.md)验收。测试数据初始化可用公开领域接口，关键动作从用户入口驱动，并核对实际持久化或产物。

每轮使用独立应用配置、文献库、项目与输出目录，明确端口、实例和进程归属；场景结束只停止本轮拥有的执行单元，保留必要失败诊断。按语义定位和可观察状态等待，关联浏览器 trace、main／preload／内核／宿主日志。

### 首轮实际验证范围（Q4）

在首条业务链路形成时开始验证以下实际行为：

- 同一工作台在浏览器和真实 Electron 中，通过共同客户端连接实际内核；从用户操作到持久化或产物可核对。
- 工作台关闭后任务继续，重新接入能读回实际状态。
- 一次异步失败能从页面定位到相关进程日志。
- Orca 页面观察与截图能力在实际入口复核，Playwright 同时检查真实窗口和 preload。

新增场景随已实现的关键行为扩展，覆盖全流程产品要求。布局页或模拟内核的成功不代替业务接线结果。

### 本地与 CI（Q5）

采用同一套场景、数据准备及诊断逻辑，本地提供浏览器与 Electron 两个运行入口；CI 首先在 Linux 具备所需显示服务的环境中运行真实 Electron，失败保留 trace 与相关进程日志。跨平台组合、打包产物检查和发布标准由 [#15](15-validation-and-release-discipline.md)统一确定。

### 结束条件与未验证项（Q6）

本票收束为调试与验收方案，实际接入验证随业务实现开展。当前没有业务代码；实现路线继续由用户决定启动时机，本票完成不自动触发实现规划。

实际开发入口、Playwright／Electron 固定版本组合及 CI 尚未接入或运行；既有 Orca 简单页面探针只覆盖快照、交互和 console，空白截图问题仍需在实际入口复核。上述首轮业务接线、任务延续、重接与诊断均待实际验收。

本次未安装依赖、创建应用代码、启动服务器或运行 Electron／Orca。决策完成不表示 harness 已通过，也不为关闭本票另建脱离实际应用的演示原型。

## Comments

- 2026-10-04：按地图顺序领取本票；#09／#12／#14 均已 resolved。主 Agent 核对 Playwright 官方能力，MiniMax 子 Agent 调查 WebdriverIO，主 Agent 复核调查事实。
- 2026-10-04：用户第一轮回复“采纳”，确认 Q1–Q3；第二轮回复“采纳”，确认 Q4–Q6。完整决定集中在 Answer，本票转为 grilling 并 resolved，实际运行验证随业务实现承接。
