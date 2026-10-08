# 调查依据

## 当前事实与复用选择

仓库尚无正式应用代码、包清单、测试或构建入口；既有 .scratch 原型保持独立。#09 确认三个进程入口和共同协议，#12 确认五包 pnpm 组织；#14／#15／#20 提供按影响验证、三平台构建和真实 Electron 入口原则。

本机 Node 24.12.0、pnpm 11.10.0；Node 24 为受支持 LTS。[Node 发布表](https://nodejs.org/en/about/previous-releases)。electron-vite 5.0.0 的 npm peerDependencies 接受 Vite 5/6/7，当前 Vite 8 不在范围内；采用 Vite 7.3.6 与 plugin-react 5.2.0。React 19.3.0、Electron 44.5.1、electron-builder 26.15.3、TypeScript 7.0.2、Biome 2.5.15、Playwright 1.63.0 来自本轮 npm registry 元数据核对，实际安装及构建另行验证。Node 类型沿 Node 24，而非当前 latest 的 26。

[electron-vite 官方入口](https://electron-vite.org/guide/)提供 main/preload/renderer 独立构建；[electron-builder](https://www.electron.build/configuration/)支持各应用独立配置。工作台使用 React DOM。构建与 smoke 使用实际产物；无需为此启动开发服务器。

## 影响方案的未知项与实验

只验证版本组合能否安装、五包类型与构建、CLI 独立运行、真实 Electron 能否加载工作台／preload 以及宿主内部页。失败只定位该接线；全部通过即结束本轮。不以空白应用启动证明科研能力、协议服务或插件兼容。使用 Playwright 的真实 Electron 实例进行检查，Linux 无显示时由 xvfb-run 承载。

## 结论与承接

实际安装时发现 electron-builder 26.15.3 调用了 `@electron/get` 3.0.0 未导出的缓存枚举；[3.1.0 上游记录](https://github.com/electron/get/releases/tag/v3.1.0)确认新增 cacheMode API。在 `pnpm-workspace.yaml` 对该依赖使用定向 overrides 约束 `^3.1.0`，由锁文件固定实际版本。Electron 自身从 42 起改为按需下载运行时，根脚本使用官方 `install-electron` 提供显式安装，见 [上游说明](https://www.electronjs.org/blog/electron-42-0)。

足以开始骨架初始化。数据库、Agent harness、阅读／编辑、图谱与 Zotero 10 插件在相应业务变更中按已确定组件接入；本轮不预安装全部产品依赖。独立 Node 二进制、Quarto、uv、原生模块、签名与三平台分发包实际验收在发布实现中落实。
