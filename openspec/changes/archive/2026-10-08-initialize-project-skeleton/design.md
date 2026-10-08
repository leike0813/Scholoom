# 实现设计

## 方案与接口

采用五个 pnpm workspace 包。packages/protocol 集中 JSON-RPC 基础 schema/DTO 与协议版本，类型从 JSON Schema 推导；packages/client 定义共同连接配置边界，暂不提供虚构服务。apps/kernel 通过独立 Node CLI 提供帮助与运行时信息，引用协议版本；apps/desktop main 管理窗口，sandbox preload 提供窄环境标识，renderer 使用 React DOM；apps/zotero-host 有独立 main 与隐藏内部页面，暂不加载插件。

共享包与内核用 tsc 构建 ESM，构建按工作区拓扑顺序；工作台与宿主用 electron-vite 构建 CJS main/preload及浏览器资源。根脚本统一类型、Biome、构建和 Playwright Electron smoke；各包保留独立入口。单独工作台浏览器入口复用 renderer。electron-builder 为两个 Electron 应用生成独立的目录包；这些是骨架布局检查，不是包含全部受管工具的可发布产品。

## 文件变化

新增根 package.json、pnpm-workspace.yaml、锁文件、tsconfig.base.json、biome.json、.gitignore、.editorconfig、.nvmrc、LICENSE、README.md；五包新增清单、tsconfig及最小源码，Electron应用增加构建／打包配置。新增 tests/smoke 与 Playwright配置、docs/development.md、.github/workflows/checks.yml。修改 AGENTS 增加实际工程入口，地图记录此次实施。

## 验证与风险

安装后运行格式／lint、各包类型检查、拓扑构建、Node CLI及真实Electron smoke。测试只断言启动、preload与内部页面等可观察边界，不锁定精确文案或布局。Linux本地与CI复用xvfb-run，Windows/macOS CI复用同一包脚本。Electron仅由限定smoke启动并关闭，不启动devserver。目录包检查分别核对两个app入口。CI配置不表示远端三平台已通过。

## 待办边界

共同WebSocket app-server、单内核发现、持久任务与域能力、兼容宿主监督、选定组件集成及完整分发由后续功能变更实现。此处不提供假成功实现，也不为空领域创建目录树。
