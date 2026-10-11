# 开发基础变更

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Agent 上手与日常 UI 协作

仓库 SHALL 从 AGENTS.md 指向集中开发说明，说明正式工作台、状态接线和标注协作路径；实际命令以工作区脚本为准。

#### Scenario: 新 Agent 开始开发
- **WHEN** 编码 Agent 从项目入口读取执行约定
- **THEN** 能找到共享实现与启动验证入口，并在该工作台演进功能，而不另建日常原型、消息控制器或事实权威

#### Scenario: 接收用户标注
- **WHEN** 用户发送浏览器元素标注
- **THEN** Agent 核对当前项目实际标签和代码，在共享实现修改并验证；未知或未运行的结果如实记录
