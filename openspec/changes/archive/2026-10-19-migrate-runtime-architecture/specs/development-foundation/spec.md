# Spec Delta

## MODIFIED Requirements

### Requirement: 工作区应用边界

仓库 SHALL 在同一个 pnpm workspace 中提供独立内核、工作台、Zotero 兼容宿主及共享 protocol/client 包。内部模块 SHALL 以具有明确导出的私有 workspace 包组织；现有入口 SHALL 按依赖图构建并包含其依赖闭包，不依赖未声明的跨包实现引用。文献与项目模块 SHALL 在不加载 harness 的情况下可独立组合使用。

#### Scenario: 独立内核入口
- **WHEN** 开发者构建工作区并用系统 Node 调用内核 CLI
- **THEN** CLI 输出支持的帮助或运行时信息，且不启动 Electron

#### Scenario: 独立 Electron 应用
- **WHEN** 工作台与兼容宿主完成构建
- **THEN** 两者分别具有自己的 main 入口和 renderer 资源

#### Scenario: 独立组合文献与项目
- **WHEN** 开发者在不加载 harness 的情况下组合文献库与项目模块
- **THEN** 两者经各自明确导出完成装配并可用，无需加载 harness

### Requirement: 可重复开发检查

仓库 SHALL 提供一致的类型、lint 与格式、构建、实际应用入口 smoke 及共享 UI 交互检查命令；浏览器和 Electron 复用同一份稳定交互场景。包之间的依赖方向、循环、私有路径引入及未经许可的系统访问 SHALL 由同一份机器可读策略驱动的依赖守卫检查，违约报告具体依赖边并失败；守卫 SHALL 以能实际触发各违约类型的夹具验证。迁移期间的临时例外 SHALL 只登记具体依赖边并在对应迁入完成后移除；CI 与本地 SHALL 使用同一策略与检查入口。

#### Scenario: 工作台和宿主真实启动
- **WHEN** smoke 套件针对构建后的应用运行
- **THEN** 它启动真实 Electron，检查工作台 preload、renderer 及宿主内部页面，并关闭自己启动的应用进程

#### Scenario: CI 复用本地检查
- **WHEN** 仓库 CI 在 Linux、Windows 或 macOS 上运行
- **THEN** 它使用声明的依赖锁文件及本地检查所用的工作区脚本

#### Scenario: 双宿主交互验证
- **WHEN** 开发者运行共享 UI 检查
- **THEN** 同一场景分别驱动 Chromium 页面和真实 Electron 窗口，测试服务与日常实例隔离，失败保留诊断

#### Scenario: 架构策略违约被拒
- **WHEN** 某个包的依赖违反机器可读策略，如反向依赖、循环、私有路径引入或未经许可的系统访问
- **THEN** 检查失败并指出具体违约依赖边，真实违约夹具均能被拒绝

#### Scenario: 临时例外随迁入移除
- **WHEN** 迁移期间某条依赖边尚未按目标方向接入而登记为临时例外
- **THEN** 例外只覆盖该具体依赖边，并在对应迁入完成后移除
