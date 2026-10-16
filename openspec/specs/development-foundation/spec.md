# development-foundation Specification

## Purpose

为 Scholoom 提供可重复的正式开发基础，使编码 Agent 能从确定的应用与共享包入口检查类型、构建产物和验证真实启动，并沿同一套脚本在目标平台继续实施与定位问题。

## Requirements

### Requirement: 工作区应用边界

仓库 SHALL 在同一个 pnpm workspace 中提供独立内核、工作台、Zotero 兼容宿主及共享 protocol/client 包。

#### Scenario: 独立内核入口
- **WHEN** 开发者构建工作区并用系统 Node 调用内核 CLI
- **THEN** CLI 输出支持的帮助或运行时信息，且不启动 Electron

#### Scenario: 独立 Electron 应用
- **WHEN** 工作台与兼容宿主完成构建
- **THEN** 两者分别具有自己的 main 入口和 renderer 资源

### Requirement: 可重复开发检查

仓库 SHALL 提供一致的类型、lint 与格式、构建、实际应用入口 smoke 及共享 UI 交互检查命令；浏览器和 Electron 复用同一份稳定交互场景。

#### Scenario: 工作台和宿主真实启动
- **WHEN** smoke 套件针对构建后的应用运行
- **THEN** 它启动真实 Electron，检查工作台 preload、renderer 及宿主内部页面，并关闭自己启动的应用进程

#### Scenario: CI 复用本地检查
- **WHEN** 仓库 CI 在 Linux、Windows 或 macOS 上运行
- **THEN** 它使用声明的依赖锁文件及本地检查所用的工作区脚本

#### Scenario: 双宿主交互验证
- **WHEN** 开发者运行共享 UI 检查
- **THEN** 同一场景分别驱动 Chromium 页面和真实 Electron 窗口，测试服务与日常实例隔离，失败保留诊断

### Requirement: 可操作的真实开发入口

`pnpm dev:browser` 和 `pnpm dev:desktop` SHALL 通过共同工作台与客户端接入真实科研内核，支持已实现的项目、文件、会话、科研能力、文献库、附件及阅读业务。默认调试配置 SHALL 为仓库 `.scholoom-dev/debug/`，支持 SCHOOLOOM_DATA_DIR 覆盖；结束调试 SHALL 保留配置和业务数据。真实命令及双宿主操作 SHALL 有可重复验证，受控响应限于外部模型和远程依赖边界。

#### Scenario: 双入口操作共同业务
- **WHEN** 用户运行两个 dev 命令并选择相同调试配置
- **THEN** 两端通过同一内核操作业务，用户操作产生的持久化事实和成果可由另一端读回

#### Scenario: 下一轮调试
- **WHEN** 全部调试进程结束后重新运行 dev 命令
- **THEN** 启动当前构建的新内核实例，并读取保留的配置和业务数据

#### Scenario: 真实模型业务交付
- **WHEN** 显式运行真实模型 UI 验收并注入 MiniMax 凭据
- **THEN** 研究指令从工作台进入内核，实际读取合成材料、执行工具并保存成果，另一宿主可打开成果；不以固定模型回复代替该项验收

### Requirement: Agent 上手与日常 UI 协作

仓库 SHALL 从 AGENTS.md 指向集中开发说明，说明正式工作台、状态接线和标注协作路径；实际命令以工作区脚本为准。

#### Scenario: 新 Agent 开始开发
- **WHEN** 编码 Agent 从项目入口读取执行约定
- **THEN** 能找到共享实现与启动验证入口，并在该工作台演进功能，而不另建日常原型、消息控制器或事实权威

#### Scenario: 接收用户标注
- **WHEN** 用户发送浏览器元素标注
- **THEN** Agent 核对当前项目实际标签和代码，在共享实现修改并验证；未知或未运行的结果如实记录

### Requirement: 明确骨架范围

仓库 SHALL 描述已实现的开发入口，并明确尚未实现的业务和运行时分发能力。

#### Scenario: 开发者依说明开始工作
- **WHEN** 开发者遵循仓库开发说明
- **THEN** 命令与实际脚本对应，初始入口不被描述成已完成的科研或 Zotero 插件能力