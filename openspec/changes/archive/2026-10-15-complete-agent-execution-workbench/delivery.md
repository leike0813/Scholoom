# 实际交付与交接

## 当前状态与成果

本 change 已完成实现、独立审查及最终 `pnpm check`；任务状态以 [tasks.md](tasks.md) 为准。用户要求起草并实现下一 change；未安装依赖、提交、归档或操作用户日常内核，原有 AGENTS.md 修改和参考 PDF 保留。

已核对 [design.md](design.md) 的变更总览和时序图：真实工具调用在 wrapToolCall 观察，经持久 messages JSON、共同协议／客户端、统一 projection 进入 dock 与 overlay；成果通过已有文件 tab 打开。

| proposal 完成判据 | 实现入口与结果 |
| --- | --- |
| 持久真实工具事实 | `messageSchema.tool`、`Harness.execute`、`ProjectBackend`；稳定调用与执行身份，输入／输出各上限 16,384 个 UTF-16 单元并标明截断，失败、成功与未知分别持久保存 |
| 一致可操作界面 | `projection.ts`、`ToolCall.tsx` 与双形态输入器；真实工具详情、项目／模型／权限和成果打开，overlay 成果入口可点击，文件实际内容可读且草稿保留 |
| 验证与回归 | `pnpm check` 全链路通过；内核 41、smoke 4、双宿主 UI 35 项通过，必要独立审查与修复复核完成 |

新增协议字段为可选，不迁移既有 JSON；旧工具记录保留历史说明，不伪造输入。科研方法／能力调用 P3d 仍沿路线图作为下一 change，不将本次视为整个阶段完成。

## 实际验证

环境：Linux，Node 24.12.0、pnpm 11.10.0，既有 Chromium 与真实 Electron。模型替身仅位于 loopback Anthropic HTTP 边界，内部图、工具、文件、数据库、WebSocket 和工作台均为真实实现。测试数据与内核配置隔离，仅由既有 fixture 管理本轮进程。

| 命令／检查 | 实际结果与范围 |
| --- | --- |
| `openspec validate complete-agent-execution-workbench --strict` | 通过；图另经人工核对名称、连线与文字一致性，未运行独立 Mermaid 渲染器 |
| `pnpm lint`、`pnpm typecheck`、`pnpm build` | 最终版本全部通过，lint 检查 82 个文件；格式通过 stdin 生成差异并用 apply_patch 应用 |
| `pnpm test:kernel` | 最终 41 通过、1 默认跳过；覆盖生命周期、文件保护、并行工具状态、持久详情、取消／恢复和预览边界 |
| `pnpm test:kernel tests/kernel/harness.spec.ts` | 审查修正后 10 通过；含并行成功／失败归属、输入输出截断、完整磁盘成果、取消与重启 unknown、原接续与补登记 |
| `pnpm test:smoke` | 最终 4 通过，覆盖独立 CLI、真实 Electron、preload、关窗重接和隐藏宿主 |
| `pnpm test:ui` | 最终 35 通过、1 跳过，仅浏览器适用的静态引导安全检查不在 Electron 重复；两宿主均核对工具详情、失败、刷新、成果磁盘内容、草稿、受控延迟新建会话及原工作台行为 |
| `pnpm check` | exit 0，全链路通过；验证后未再修改源码或测试 |

最终截图为 `test-results/ui/harness-user-configures-ed-40e23-real-persisted-Agent-result-ui-{browser,electron}/harness-{tools,tools-dark,result}.png`。已实际查看两宿主的深色工具详情与浅色成果文件页，以及浏览器浅色工具详情；真实内容、状态、输入上下文、成果入口与草稿可读，原三区布局保持。后续测试运行可能替换同一路径。

## 审查与问题处理

- 独立原生子代理直接核对协议和执行改动，发现并修正：内部暂存目录 SDK 将结构化错误包装为成功；恢复先写 streaming 覆盖已确认失败。前者增加真实图错误回归；后者先检查防重放记录，保留已有失败和预览。复核未发现新的可触发问题。
- 并行工具使用 AsyncLocalStorage 各自接收后端错误，不匹配错误文案；测试确认普通正文包含 `Error:` 仍读取成功，同时失败写入不覆盖既有文件。
- UI 实跑发现成果按钮被 overlay 遮挡，已将同一来源成果节点在两种形态中分别放到可操作位置。修正上下文可访问语义、字号 token 与窄区域换行。
- Electron trace 确认新建会话请求尚未返回时，输入已写入旧草稿，随后 draftKey 切换清空界面。创建期间复用 assistant-ui isDisabled，先切换新会话再解除禁用；迟到创建不抢回用户新选择，失败恢复原输入。独立复核确认 SDK 的输入与发送禁用契约，最终由延迟回执 e2e 验证。
- 首次测试曾错误期待 Anthropic 请求带 `is_error` 字段；已核对当前适配器不发送此字段，改为核查实际失败内容和持久结构化状态。未为该细节修改供应商适配器。

## 未完成事项与下一步

本 change 无剩余实施项，保留为已完成、未归档变更。当前阶段下一步为路线图 P3d：最小方法加载、输入校验、能力调用身份、执行尝试与实际交付检查，后续独立 change 承接。

本轮未运行真实付费模型、三平台分发或科研质量验收。工具预览不是完整输出或副作用证明，unknown 仍需核查；日常驻留内核需要用户选择时机重启才能加载新代码。
