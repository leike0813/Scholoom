# 调查依据

## 当前事实与复用选择

- 两种入口已指向 `apps/desktop/src/renderer`；main 可加载 `ELECTRON_RENDERER_URL`，现有 preload 只暴露平台。问题在于 `main.tsx` 的开发原型分支，不需要另建 UI 包或启动框架。
- 现有 Playwright 1.63.0／Electron 44.5.1 smoke 检查 CLI、preload 与隐藏宿主，保留这些宿主检查；共享交互用例复用 Playwright Page 和条件等待。
- 2026-10-11 核对 npm 官方 registry：`@assistant-ui/react@0.15.27` 为 MIT，React peer 支持 18／19。官方 ExternalStoreRuntime 文档支持外部消息、发送回调和禁用发送；Thread／Composer primitives 提供消息投影、草稿与输入操作。固定版本安装后核对其实际类型和实现，不使用另一个模型 runtime 或云服务。
- Windows 实测见 `.scratch/scholoom-foundations/research/orca-ui-windows-validation.md`；用户主动发送结构化标注、同页操作、HMR 与截图可用。显式工作区／标签操作是本轮可复用路径。
- `.editorconfig` 要求 LF，Windows `core.autocrlf=true` 导致初始 Biome 失败；应声明仓库换行约定并保留已有未提交内容。

来源：#12／#20 及既有 assistant-ui 复用调查；https://www.assistant-ui.com/docs/runtimes/custom/external-store 与 https://registry.npmjs.org/@assistant-ui/react/0.15.27。

## 结论与承接

无改变已确认方案的阻塞项。版本集成、隔离样例、生产禁用、双宿主交互及本机 Orca 实跑在实施中验收；静态资料不代表这些已通过。CI 使用同一场景，但远端三平台结果以实际运行记录为准。
