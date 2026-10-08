# 执行任务

## 1. 工作区与共享契约

- [x] 1.1 初始化 pnpm、严格 TypeScript、Biome 和共享 protocol/client 包，安装依赖并通过类型及 lint 检查。

## 2. 三个运行入口

- [x] 2.1 建立独立 Node CLI 和两个 electron-vite 应用，拓扑构建成功；工作台及宿主保持独立入口。
- [x] 2.2 使用 Playwright 核对实际 Node CLI、Electron renderer/preload和宿主内部页面，smoke 通过并清理本轮应用。

## 3. 工程入口与整合交付

- [x] 3.1 增加独立 electron-builder 目录包入口及三平台 CI，运行本机目录包检查；README、开发说明、许可与 AGENTS 对应实际命令。
- [x] 3.2 完成相关检查、独立整合审查并处理实际问题；按运行结果填写 delivery.md，说明已完成边界与后续入口。

## 续做入口

本变更已完成，实际验证、独立审查及范围见 delivery.md。后续业务实现按新变更开展。
