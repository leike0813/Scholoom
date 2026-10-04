# 第六轮重启闭环证据

结论见[第六轮报告](../../../../research/zotero-host-restart-results.md)，命令见[原型 README](../../README.md)。

- `final/`：最终控制运行 `/tmp/scholoom-restart-experiment-UEt9E4`。首次阶段 `/tmp/scholoom-host-prototype-8T6DGE`、恢复阶段 `/tmp/scholoom-host-prototype-RxuJT2` 使用同一安装树／profile／data。包含独立停机条目、父子关系、目录集合与恢复对象核对，作为本轮最终结论依据。
- 根目录的 `restart-results.json`／`before-restart.json` 和 `initial/`／`resumed/`：较早通过运行 `/tmp/scholoom-restart-experiment-oAEX7n`，保留作对照；当时尚未加入最终的独立恢复对象与目录集合检查。
- `reader-regression/`：普通 Chromium 阅读路径的第五轮回归，运行 `/tmp/scholoom-host-prototype-DPY0Bi`，主链路和浏览器检查通过。
- `before-sidebar-fix/`：真实 Electron 恢复阶段 `/tmp/scholoom-host-prototype-qCnOkK` 的原始失败，保存状态读回通过，但侧栏被旧适配条件关闭后书签改名失败。
- `earlier-failed-trials.json`：其他试跑目录、阶段退出与失败索引，原始临时目录保留。

两阶段各 4 项主链路与 6 项 Electron 交互检查通过；主链路包含窗口检查汇总，不能相加为独立兼容功能数量。Electron 页面经 preload／主进程 IPC 使用真实文献接口；Playwright 仅提供页面和模块资源、驱动交互。截图由实际 Electron 窗口生成。

初始阶段的 restart-expected.json 是正常退出前的保存状态。最终原插件 sidecar 和材料文件保存在 final/resumed；同一库被继续修改，因此不能把最终文件误认为第一次退出时的书签内容。

没有保存短期 RPC token、完整库、第三方宿主／XPI／Electron 二进制或 PDF.js 构建产物。退出日志仅保留相关节选；原包生命周期仍有错误，正常关闭和数据核对通过不等于完整生命周期兼容。
