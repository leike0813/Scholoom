# 实际交付与交接

## 当前状态与成果

状态栏及用户确认的成果归位续做已完成必要验证，任务进度见 tasks.md。全库 lint 的既有错误和一次未复现的 Electron 草稿恢复失败保留在下文，不能据此宣称全库检查全部通过。

- 中间至右侧共用状态栏，与左下内核状态区同为 40px，Agent overlay 留在上方；两主题及侧栏折叠复用共同组件。
- 标准接口在 `workbench/statusbar.ts`，React 接入在 `StatusBarContext.tsx`；执行、通知和信任三个内置贡献使用同一服务。工作台实例和贡献者隔离，旧句柄释放后不能覆盖新条目。
- 通知由 `business-session.tsx` 提供结构化投影；详情复用 Menu，恢复、补交和刷新使用原共同客户端。项目信任状态项打开现有居中弹窗。
- 设计、开发说明和 AGENTS 的接入入口已同步；职责及数据流与 design.md 变更总览一致。成果归位将正文 Message 增加可选 runId 并在 harness 写入，复用已有 Artifact 及工具执行标识；没有数据库迁移或依赖变化。
- tab 顶部及消息流末尾的独立成果列表已移除。`projection.ts` 将成果归入同执行最后一条已加载回复，无正文时归入明确关联的工具结果；`MessageContent.tsx` 中打开成果沿原文件身份及 tab 路径，保存／登记通知与 `ArtifactNotice.tsx` 核查动作进入底栏详情。

proposal 四项完成判据分别由双宿主布局测试、真实通知操作与切换／草稿回归、纯服务生命周期测试、项目访问弹窗测试覆盖。普通受限项目重开沿既有信任规则，失败、取消及重新打开经双宿主验证。实现与 design.md 的模块图一致。

## 实际验证

本轮在 Linux、Node 24.12.0、pnpm 11.10.0 及项目锁定工具链下运行，UI 经 Xvfb；内部接线真实，模型回归使用现有受控模型服务及合成项目，不调用真实外部模型。

| 命令／检查 | 实际结果 |
| --- | --- |
| `openspec validate add-workbench-statusbar --strict` | 通过 |
| `pnpm build` | 全部 workspace 构建通过 |
| `pnpm --filter @scholoom/desktop build` | 最终源码再次构建通过 |
| `pnpm typecheck` | 全部 workspace 与 tools 类型检查通过 |
| `pnpm check:architecture` | 通过，0 findings |
| `pnpm exec playwright test --config playwright.kernel.config.ts tests/kernel/statusbar.spec.ts` | 5 项通过：排序、更新、清理、动作及实例隔离 |
| 修改的 15 个源码／测试文件的 `pnpm exec biome check <文件列表>` | 最终检查通过，11 个 CSS specificity 警告，无错误 |
| 全库 `pnpm lint`／`biome check . --max-diagnostics=0` | 未通过：21 个已有错误，涉及未修改的题录库组件等；未扩大范围修复 |
| 浏览器定向状态栏测试 | 2 项通过，覆盖 Esc、overlay、两主题、960px 及内核区对齐 |
| 双宿主定向关键批次 | **14 项通过**：信任失败／取消／重试、harness、状态栏、可视区域边界；命令见下文 |
| Electron 会话与工作台补全批次 | 21 项通过、1 项按宿主跳过、1 项草稿恢复失败；原因及复测见下文 |
| 原 CLI shutdown 用例双宿主重复两次 | 4 项通过，未修改草稿实现 |
| 最终状态栏与活动会话 CLI shutdown 验收，双宿主各重复两次 | **12 项全部通过** |

成果归位续做的验证（下列构建与检查在本次新增源码之后执行，不沿用基础实现的构建作为证据）：

| 命令／检查 | 实际结果 |
| --- | --- |
| `pnpm build:shared` | 通过，含 protocol、harness 和 kernel |
| `pnpm --filter @scholoom/desktop build` | 通过 |
| `pnpm --filter @scholoom/desktop typecheck` 与 `pnpm exec tsc --noEmit -p tsconfig.tools.json` | 通过；新增测试起初误用根目录不可解析的包别名，改用现有测试的源码类型入口后通过 |
| 本轮 12 个源码／测试文件的 `pnpm exec biome check <文件列表>` | 通过，无错误或警告 |
| `pnpm exec playwright test --config playwright.kernel.config.ts tests/kernel/message-artifacts.spec.ts tests/kernel/statusbar.spec.ts` | 8 项通过：多执行同路径、最后回复唯一归属、历史工具回退、历史分页不串入及状态栏生命周期 |
| `pnpm exec playwright test --config playwright.kernel.config.ts tests/kernel/harness.spec.ts --grep 'real graph reads\|failed artifact registration'` | 2 项通过：真实消息执行标识、登记失败保留文件及重启后幂等补齐 |
| `pnpm check:architecture`、OpenSpec strict validate、`git diff --check` | 通过 |
| 成果归位与状态栏双宿主 UI 批次 | **8 项全部通过（2.4 分钟）**，两宿主均覆盖成果打开、登记失败／重试、草稿保护、通知键盘交互及布局 |

```sh
xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/harness.spec.ts tests/ui/statusbar.spec.ts --grep 'user invokes|user configures|status bar' --output test-results/artifact-placement
```

UI 续做沿真实内核、文件、成果记录与共同客户端，外部模型由原受控 HTTP 服务替代。在隔离合成项目的 SQLite 中临时安装与内核回归相同的登记失败 trigger，确认文件保存但登记待核查；RPC gate 制造首次核查拒绝，移除 trigger 后沿真实 RPC 重试成功。验证失败留在详情、不重复增加通知、草稿保留、打开入口属于结果消息、收起或重载时顶部无独立成果区。没有修改用户数据库。截图位于 `test-results/artifact-placement/`；已检查浏览器成果文件页，顶部直接由 tab 开始，保存状态位于底栏。

已通过的关键批次：

```sh
xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/statusbar.spec.ts tests/ui/harness.spec.ts tests/ui/file-workbench.spec.ts --grep 'status bar|user invokes|user configures|late send|busy conversation|pending project asks' --output test-results/statusbar-final
```

Electron 补全批次与最终验收命令：

```sh
xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/conversation.spec.ts tests/ui/workbench.spec.ts --project ui-electron --output test-results/workbench-final
xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/workbench.spec.ts --grep 'CLI shutdown' --repeat-each=2 --output test-results/draft-retry
xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/statusbar.spec.ts tests/ui/workbench.spec.ts --grep 'status bar|CLI shutdown' --repeat-each=2 --output test-results/statusbar-acceptance
```

运行 UI 时使用 `playwright.ui.config.ts` 的隔离配置、5174 端口及本轮受管内核；不接入用户文献或项目。截图、trace 和独立配置位于 `test-results/`，作为本地诊断工件保留，不纳入 Git。跨平台分发包及真实科研模型效果不在本次验证范围。

## 审查与问题处理

- `gpt-6-luna` 独立只读核对注册、StrictMode、旧句柄、动作更新、切换清理和 Menu 关闭／焦点机制，未发现实质问题；纯服务测试通过。
- 首轮归档用例在重载恢复会话前点击了初始零通知入口，随后正常的 scope 切换清理弹层。改为等待实际归档摘要后操作；原场景已实跑通过，保留会话隔离。
- 曾将会重建 shared 包的全仓类型检查与 UI 重叠启动，已中止该轮并先完成构建／类型检查，再启动干净双宿主批次。中止后只停止由该批次创建且已核对 cwd 的 Vite 进程。
- 长批次在已跑完浏览器场景及前三项 Electron 会话场景后收到 SIGTERM，中断原因未确认。浏览器两项旧 harness 断言仍寻找页面全局 alert，现已改从通知详情核对错误、验证旧会话错误不污染新会话，并在关键批次双宿主实跑通过；其余浏览器场景通过。剩余 Electron 场景改为单独批次。
- 960px 截图发现骨架最小宽度会裁掉右侧通知，右组改为粘附可视右边缘；新增完整入视口断言，两宿主通过。信任保存改由确认弹窗单独承接错误，失败不增加全局通知，两宿主通过。已核对 `test-results/statusbar-final/` 的浅色截图，底边与通知数量均可见。
- Electron 补全批次中，CLI shutdown 用例在停止内核后仍保留草稿，重试后一次出现空草稿。独立只读调查未确认根因或与本变更的因果关系；`ComposerDraft` 和原草稿保存逻辑未改。原用例两宿主各重复两次均通过。该用例原先依赖前序场景留下的会话选择，现显式创建并选择会话，以覆盖确定的活动会话恢复；最终与状态栏测试合跑两宿主各两次，12 项全部通过。原失败 trace 保留于 `test-results/workbench-final/`，不将其表述为已定位修复。
- 成果归位的接口和异步路径由 `gpt-6-luna` 独立只读审查，未发现确定性问题；核对了多轮／历史分页、文件身份重新解析、切换时的过期结果和核查失败重试。首次 scout 因角色固定模型不受账户支持而启动失败，使用 default 角色的 gpt-6-luna 完成辅助调查，未由失败的委派提供验证结论。

## 未完成事项与下一步

本变更及成果归位续做无剩余实施任务；未提交、未归档，未安装依赖。全库 lint 仍有 21 个未修改文件中的既有错误；基础状态栏 CSS 有 11 个非阻断警告。上述偶发草稿失败的原因仍未确认，后续若复现，应从保留的 trace 和活动会话选择／重连时序调查，基础状态栏的重复验收均通过。验证范围为 Linux 上的浏览器与 Electron，不代替三平台分发包验收。
