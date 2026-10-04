# 三平台签名与构建约束事实

核对日期：2026-10-04。仅采用 electron-builder v26 稳定版文档（未引入页顶标注的 next/v27 结论）与 Electron 官方 Code Signing 教程。本轮只读文档，未安装依赖、未运行构建、未签名、未做法律判断，也不涉及证书价格与更新服务选型。

## 分发与平台行为

- [Electron 签名指南](https://www.electronjs.org/docs/latest/tutorial/code-signing)建议公开分发的 Windows／macOS 应用签名，并说明未签名应用仍可分发，但用户运行时需要额外手动步骤。macOS 正常发布链路包括签名和公证，准备条件包含开发者账户及 macOS／Xcode 环境。此指南提供 Windows 传统证书和云签名入口；本票不选择证书供应商，也不将其摘要当作完整证书政策调查。
- 同一指南指出，macOS 的 Squirrel.Mac 自动更新要求签名；Keychain 访问等系统行为也受签名一致性影响。手动安装包启动成功不能证明自动更新或相应系统集成已经可用。
- [electron-builder macOS v26](https://www.electron.build/v26/docs/mac/)列出 DMG／ZIP 等目标、x64／arm64／universal 架构，以及 Hardened Runtime、entitlements 和公证配置。文档建议按目标架构使用对应硬件或 CI 矩阵构建；携带额外二进制的应用还需落实这些产物的签名配置。Scholoom 的独立 Node、兼容宿主和渲染工具必须在实际分发包中核对。
- [Windows v26](https://www.electron.build/v26/docs/win/)与 [Linux v26](https://www.electron.build/v26/docs/linux/)提供各自的安装包与归档目标。分发格式、CPU 架构、签名及所需凭据按实际支持范围选择；本次不据目标列表承诺所有格式均已支持。

## 对本项目的影响

主 Agent 复核后保留与当前决策有关的约束。构建产物存在、签名工具执行成功及实际目标系统上的安装／运行各有不同证据；验收须检查用户得到的分发包、内嵌工具和相应 OS 行为。本轮未证明三平台发布链路可用；具体凭据及费用由用户另行授权，签名与证书政策在实际发布前再按所选渠道核对。

## 来源

- [electron-builder macOS (v26)](https://www.electron.build/v26/docs/mac)
- [electron-builder Windows (v26)](https://www.electron.build/v26/docs/win)
- [electron-builder Linux (v26)](https://www.electron.build/v26/docs/linux)
- [Electron Code Signing](https://www.electronjs.org/docs/latest/tutorial/code-signing)
