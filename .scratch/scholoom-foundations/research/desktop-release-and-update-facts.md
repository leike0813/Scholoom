# 桌面分发与更新事实核查

核查日期：2026-10-04。用于 [#15 验证与发布纪律](../issues/15-validation-and-release-discipline.md)；仅浏览官方文档，未安装、构建、配置发布服务或运行更新。

## 已选工具提供的能力

- [electron-builder v26 发布文档](https://www.electron.build/v26/docs/publish/)提供 GitHub Releases 发布器、更新元数据和草稿发布流程，CLI 的 `--publish never` 可以明确禁止构建时上传。项目 `origin` 指向 `leike0813/Scholoom`，但本次未查询仓库可见性、权限或创建远程工件；建议渠道不表示发布条件已具备。
- [electron-builder v26 更新文档](https://www.electron.build/v26/docs/features/auto-update/)说明 `electron-updater` 支持 GitHub Releases 等来源和 Windows NSIS、macOS DMG、Linux AppImage 等目标；macOS 更新要求应用签名及配套 ZIP 产物。工具还生成更新元数据；开发模式中的更新界面检查不能替代已安装应用的更新验收。
- [v26 AppUpdater API](https://www.electron.build/v26/docs/api/electron-updater.class.appupdater/)提供下载和退出安装的开关及显式安装入口；实际接入时必须核对采用版本的默认行为。Scholoom 独立内核及兼容宿主的停止、任务暂停、数据保护与重启属于本项目接线责任，updater 的桌面退出行为不证明这些工作已完成。

## 文档版本边界

[无版本更新文档](https://www.electron.build/docs/features/auto-update/)页顶标记 next（v27）尚未发布，并指向 v26 稳定文档。本轮依稳定文档核查，不将 next 的新 API、默认行为或平台策略作为已选版本的能力承诺。实际依赖版本由实现时核对。

## 方案与后续验证

优先 GitHub Releases、初期手动安装更新，以及按需接入 `electron-updater` 是待用户确认的维护方案。自动更新需要在真实旧版到新版的已安装应用上检查下载、签名与资源、任务暂停／恢复、内核与宿主重启及 Schema 变更；网络失败和更新失败需要诊断与可用恢复路径。
