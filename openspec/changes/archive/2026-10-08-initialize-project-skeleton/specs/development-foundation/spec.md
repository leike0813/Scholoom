# Spec Delta

## Purpose

为 Scholoom 提供可重复的正式开发基础，使编码 Agent 能从确定的应用与共享包入口检查类型、构建产物和验证真实启动，并沿同一套脚本在目标平台继续实施与定位问题。

## ADDED Requirements

### Requirement: 工作区应用边界

仓库 SHALL 在同一个 pnpm workspace 中提供独立内核、工作台、Zotero 兼容宿主及共享 protocol/client 包。

#### Scenario: 独立内核入口
- **WHEN** 开发者构建工作区并用系统 Node 调用内核 CLI
- **THEN** CLI 输出支持的帮助或运行时信息，且不启动 Electron

#### Scenario: 独立 Electron 应用
- **WHEN** 工作台与兼容宿主完成构建
- **THEN** 两者分别具有自己的 main 入口和 renderer 资源

### Requirement: 可重复开发检查

仓库 SHALL 提供一致的类型、lint 与格式、构建和实际应用入口 smoke 检查命令。

#### Scenario: 工作台和宿主真实启动
- **WHEN** smoke 套件针对构建后的应用运行
- **THEN** 它启动真实 Electron，检查工作台 preload、renderer 及宿主内部页面，并关闭自己启动的应用进程

#### Scenario: CI 复用本地检查
- **WHEN** 仓库 CI 在 Linux、Windows 或 macOS 上运行
- **THEN** 它使用声明的依赖锁文件及本地检查所用的工作区脚本

### Requirement: 明确骨架范围

仓库 SHALL 描述已实现的开发入口，并明确尚未实现的业务和运行时分发能力。

#### Scenario: 开发者依说明开始工作
- **WHEN** 开发者遵循仓库开发说明
- **THEN** 命令与实际脚本对应，初始入口不被描述成已完成的科研或 Zotero 插件能力
