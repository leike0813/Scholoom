# 实际交付与交接

## 当前状态与成果

P3d 完成交付。内置 `scholoom.material-analysis` 1.0.0 可摘要发现、按需读取，普通方法加载不建任务或调用。明确能力入口核对声明、输入、read/write/send 授权，使用父执行的同一模型实例与安全文件工具；运行时自动记录调用身份、独立尝试、方法/输入、实际读取与产物及交付检查。

用户可在既有工作台要求读取 input.md 并保存分析报告，展开真实工具详情查看 invocationId、delivery、issues 和 notAssessed，再从共同成果入口打开实际文件。共同客户端提供 `research.methods`、`research.method` 和每页默认25/上限100条的 `research.attempts`。记录随项目数据库备份与独立副本恢复，不依赖旧 transcript。

完成判据对应：工作台路径由浏览器/Electron 实跑；无效输入和权限在能力执行前拒绝；缺实际读取或报告不误报交付；原调用重试增加尝试，报告与材料身份复核；取消等待在途实际文件操作退出；进程中断保留文件及记录且不自动执行。执行 completed、交付 usable 和科研充分性 notAssessed 分别表达。

实际接线与 [design 的变更总览及执行时序](design.md) 一致。按独立审查结果增加了实际工具 Promise 等待、尝试级回执命名空间、读取身份复核及保存时 expectedFileId 保护；没有新增单篇分析专用执行流程、任务或多 Agent。

## 实际验证

环境：本机 Linux，Node v24.12.0、pnpm 11.10.0，锁定依赖；外部模型仅为本机合成 Anthropic HTTP 响应。图、模型调度、工具、文件、SQLite、WebSocket 客户端、工作台及 Electron 均真实接线。

| 检查 | 实际结果与范围 |
| --- | --- |
| `pnpm typecheck` | 最终修改后通过，含全工作区及测试/工具类型检查 |
| `pnpm build` | 最终修改后通过；方法正文/声明/来源随内核复制，桌面与兼容宿主构建成功 |
| 改动范围 `pnpm exec biome check` 与 `git diff --check` | 11 个源码/配置范围通过，无格式/静态错误 |
| `pnpm test:kernel` | 较早整合轮60通过、1个真实 MiniMax 用例按显式开关跳过；后续审查修正用下行复验 |
| `pnpm test:kernel tests/kernel/research-capabilities.spec.ts tests/kernel/harness.spec.ts tests/kernel/harness-limits.spec.ts tests/kernel/project-files.spec.ts` | 最终修正后33通过，其中科研能力11项；含实际文件备份/恢复、原调用并发、固定目标、有效读取、持锁保存取消与真实进程终止 |
| `xvfb-run -a pnpm exec playwright test --config playwright.ui.config.ts tests/ui/harness.spec.ts` | 8通过，浏览器/Electron 共用路径；随后最终构建后再以 `--grep 'declared research capability'` 复验2通过 |
| `xvfb-run -a pnpm exec playwright test` | 最终构建后4通过，含 CLI、sandbox preload、关窗续留与重新接入及兼容宿主入口 |
| `openspec validate establish-research-capability-runtime` | 通过；Mermaid 图已静态核对，与实际职责/状态一致，未做独立渲染验收 |
| `pnpm lint` | 全仓失败11项错误，来自本步未修改且与起点一致的4个工作台文件；详见 artifacts 的独立记录 |

一次较早的完整 harness UI 轮出现7通过、Electron 新能力用例报告等待超时；当时测试与声明/构建更新重叠，该轮不作为通过依据。停止并发更新后同一完整套件8通过，最终构建后的双宿主能力复验也通过，未以增加超时或跳过用例掩盖该失败。

测试记录位于 `test-results/`（可再生成）；最终构建日志 `/tmp/scholoom-research-build.log` 为本机临时证据。稳定回归留在 `tests/kernel/research-capabilities.spec.ts` 与 `tests/ui/harness.spec.ts`，模型替身留在既有 `tests/model-server.ts`。所有测试配置、材料、备份和输出隔离，按夹具停止本轮进程。

## 审查与问题处理

独立审查直接核对规格、代码与内存探针，发现并修复：

- LangGraph 可提前抛取消，实际 IO 尚未退出：跟踪真实后端及自定义工具 Promise，父执行和能力尝试退出前等待结清。真实阻塞保存测试验证取消期间仍为 cancelling/running，保存退出后才发布取消终态。
- currentPath 与异步读回之间可发生身份替换：读回核对 fileId，替代文件不能满足交付或原调用输入。
- 父/子模型可复用供应商工具 ID：能力回执使用持久 attemptId 命名空间；合成响应刻意复用同一 ID，真实图与客户端测试通过。
- 越界空页被算作已读材料：有效非空返回才登记使用，空页不满足输入核对。
- 重试期间报告被移走、同名新文件被修改：固定原 reportFileId，并将身份传入共同保存接口的保护范围；实际 A/B 文件回归证明错误保存被拒绝，两份正文保留。

最后独立复核确认以上反例均已处理，无未解决审查项。方法来源提交与 AGPL 许可记录见内置内容 SOURCE.md，未引入旧应用运行依赖或新依赖。

## 未完成事项与下一步

本 change 范围内无未完成实现。全仓 lint 基线见 [artifacts 记录](../../../../artifacts/2026-10-16-workbench-lint-baseline.md)，不等于本模块静态检查失败。真实 MiniMax 效果、完整科研充分性与三平台成品分发未验证，不声称通过。

按路线图继续 P4a 本地文献库；P4c 的完整 Digest 复用本共同入口，用户/项目方法管理、派生与启用沿 P5a。持续目标尚未完成；之后仍按创建/apply-ready、实现、归档/提交逐步推进。现有用户实施与提交授权持续有效。
