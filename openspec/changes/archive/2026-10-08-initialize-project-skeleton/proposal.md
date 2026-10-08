# 初始化项目骨架

## Why

产品与工程基础已经确认，但仓库只有决策与临时原型，没有正式应用、包结构或可重复构建入口。本次需要将已选进程职责和工具链落实为最小可构建骨架，使后续 Agent 能在一致的边界和检查入口上开展业务实现，并明确当前骨架与尚待实现的科研能力之间的范围。

## What Changes

- 初始化 pnpm workspace：独立 Node 内核、Electron 工作台、独立 Electron 兼容宿主、共享协议与客户端包。
- 提供严格 TypeScript、React 工作台、electron-vite 构建与 electron-builder 的独立打包入口。
- 提供类型、格式／lint、构建与实际入口 smoke 检查，以及 Windows／macOS／Linux CI。
- 增加项目 README、开发说明、AGPL 许可和必要项目约束。

## 完成判据

依赖可安装且有共同锁文件；五个包能够类型检查和构建；Node CLI 独立运行；Electron 工作台与兼容宿主的实际启动入口接受 smoke 检查。检查不依赖启动开发服务器，工作台不包含虚构的科研能力。分别保留打包工具入口及未完成分发条件。

## Capabilities

### New Capabilities

- `development-foundation`：仓库开发、构建与真实入口检查约定。

## 决策与授权依据

按 #09／#12／#14／#15／#20 已确认方向执行。用户本轮明确要求初始化骨架，并明确允许安装依赖及完成验证；不启动开发服务器、不提交代码。模型政策与科研效果评价仍由 #22／#21 承接。
