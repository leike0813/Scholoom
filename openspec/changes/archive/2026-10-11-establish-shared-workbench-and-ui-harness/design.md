# 实现设计

## 方案与接口

保留同一 renderer 与 main 的既有加载机制。`Workbench` 使用 assistant-ui ExternalStoreRuntime、Thread／Message／Composer primitives；消息由唯一外部 adapter 提供，Composer 持有草稿。工作台 session 输入包含状态、材料、当前选择、操作回调和 adapter；它是界面接缝，不是内核协议或另一套执行引擎。

默认 session 未连接且禁用发送。开发场景 `?scenario=ui-foundation` 通过 DEV 判断与动态导入加载样例来源；样例仅保存最新两条消息及材料选择，发送时生成固定回复并复制当前材料名称。重置分别清空来源消息／选择和 Composer 草稿。真实内核接入时替换来源并经 packages/client 取得事实，不复制 Workbench。

不添加独立聊天 runtime、云连接、模拟内核或通用 harness 包。样例和 UI 的本地类型不冒充领域 DTO。既有 six-row 输入高度和中性样式保留；CSS 合并为一份工作台样式。

## 文件变化

- 新增 renderer `workbench/Workbench.tsx`、`workbench/session.ts`、`scenarios/ui-foundation.tsx`；修改 `main.tsx`／`styles.css`；删除 `OrcaUiPrototype.tsx`／`orca-ui-prototype.css`，迁入已有输入高度。
- 修改桌面 package.json／根 package.json／pnpm-lock.yaml，固定 assistant-ui，增加共享 UI 测试脚本。
- 新增 `tests/ui/fixture.ts`／`workbench.spec.ts` 和 `playwright.ui.config.ts`；UI 配置复用原 smoke 配置的公共设置，分别运行 ui-browser、ui-electron，fixture 提供相同 Page。修改原 smoke 和 CI，保持 smoke 独立运行构建产物；UI 测试 Vite 服务独占 127.0.0.1:5174，日常服务为 5173。Electron UI 场景加载测试 Vite URL。
- 新增 `.gitattributes`，与 `.editorconfig` 一起声明 LF；保留现有内容，仅通过内置编辑工具规范参与检查的文本换行。
- 更新 AGENTS.md、docs/development.md、README.md 和续接记录；操作细节只在开发说明集中维护，脚本是命令事实源。

## 验证与风险

运行 OpenSpec validate、lint、typecheck、build、三项现有 smoke 与双宿主共享交互测试。CI 安装匹配的 Chromium headless shell，在已有三平台矩阵运行相同脚本，Linux 继续使用 Xvfb。

语义定位检查未连接、纯空白、材料快照、无材料、最新结果、重置／刷新和生产不启用样例；不新增静态指令文本断言或像素 snapshot。本机 Orca 核对实际标签、交互、截图、HMR 和用户标注路径，服务不可用不算通过。

保留本会话已有未提交改动和 Windows 实测记录；不操作真实研究数据或提交代码。依赖 API 与宿主组合以实跑为准；远端 CI 尚未运行时明确记录。最终风格、真实模型与内核接线由后续功能承接。
