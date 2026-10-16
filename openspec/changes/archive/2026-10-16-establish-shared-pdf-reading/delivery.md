# 实际交付与交接

## 当前状态与成果

2026-10-16 完成交付。用户已批准固定版依赖方案，并明确要求“完成当前change后停止”；本轮只完成 `establish-shared-pdf-reading`，同步正式规格、归档提交后停止，不启动下一变更。

- protocol 统一 PDF 页信息／有界取文、共同阅读记录及修订的输入输出；client 为 PDF 与带位置的保存提供35秒等待，其余调用沿原时限。
- `LiteratureCatalog` 是 GUI／Agent 的共同权威，保存稳定身份、可信作者、原材料版本、摘录、说明、修订及逻辑移除。创建原输入幂等重放不会覆盖后续更正；更正／移除核对原修订，旧修订可查询。
- 库 v3 迁移前保留独立数据库副本，记录和历史沿既有备份及独立恢复保存。失效原件仍可读取摘录与更正说明，新材料不会继承旧页码。
- `PdfReading` 在读取快照前取得容量，单 Worker、最多8项等待、受理起30秒，快照及交付前材料复查共用截止时间；Agent 取消信号贯穿排队、取文与带位置保存。超时／停机拒绝结果，Worker 终止后继续后续请求。
- `PdfReader` 使用 EmbedPDF 2.15.1，在既有 tab 提供翻页、缩放、搜索及选区。高亮／书签先进入共同草稿，确认保存后投影；笔记、更正、历史、移除与未知回执核查复用 `ReadingRecordsPanel`。共同坐标包含材料自带旋转，SDK 原页坐标通过公开转换函数往返。
- 当前材料记录每页25条，高亮投影随当前记录列表页更新；不读取全库或整份材料的全部记录。选区结束后才取文，高频选区变化不会反复重绘空候选。
- 阅读材料与说明草稿独立于会话和项目文件布局；跨项目切换沿原 group.id 保留 PDF。关闭 tab 清订阅及自有 BlobURL，SDK 负责自身 registry／engine，实际 Worker 归零。
- WASM、七类常规后备字体与实际包内许可随构建提供。关闭外部 UI／签名字体和默认印章清单，双宿主在外网请求被阻止时通过。开发、架构、UI 设计、路线图及初设的 PDF 部分已引用正式契约；EPUB／网页仍属后续 P4b。

[design](design.md) 的共同 catalog、Worker、viewer 与本地资源路径均已接通；受控模型仅替换远程供应商边界，未替换内部领域或持久化实现。

| proposal 判据 | 实际依据 |
| --- | --- |
| 1：双宿主真实阅读 | 从附件打开，搜索独立已知文字，实际鼠标选择两页文字，包含90度旋转页 |
| 2：共享成果及无窗口 Agent | 高亮／书签／笔记落库，关闭重开及内核重启读回；真实 RPC／受控模型工具读取第二页和用户批注并保存会话作者的笔记 |
| 3：修订、版本和撤权 | 旧修订冲突、未知创建重放、失效材料保留摘录、新版本隔离及异步撤权拒绝均有实际测试 |
| 4：恢复及原件保护 | v2迁移前副本、记录／历史独立恢复与恢复后原库后续成果保留；核对原PDF实际字节 |
| 5：验证与审查 | 下列检查通过；审查提出的两项生命周期问题已修复并补回归，最终无未处理实质问题 |

## 实际验证

环境为 Linux、Node v24.12.0，仓内固定的 Electron 44.5.1／EmbedPDF 2.15.1。使用隔离配置、项目、合成材料和输出；未调用真实供应商，未使用用户文献。

| 命令／操作 | 结果 |
| --- | --- |
| `pnpm lint` | 132个文件通过 |
| `pnpm typecheck` | 全仓通过；最后新增的 UI 验证另以 `pnpm exec tsc --noEmit -p tsconfig.tools.json` 通过 |
| `pnpm build` | 全仓通过，renderer 实际含 WASM、七份字体及 MIT／PDFium／OFL 许可 |
| `pnpm test:kernel` | 92通过，1跳过（真实供应商开关） |
| `xvfb-run -a pnpm test:smoke` | 4通过，含真实 Electron sandbox preload、关闭窗口不停止内核与重连 |
| `xvfb-run -a pnpm test:ui tests/ui/pdf-reading.spec.ts tests/ui/reading-records.spec.ts tests/ui/attachments.spec.ts tests/ui/library.spec.ts tests/ui/file-workbench.spec.ts` | 12通过，浏览器／Electron各6项 |
| `openspec validate establish-shared-pdf-reading --strict` | 通过 |
| `openspec validate --specs` | 11通过；两个 delta 的新增正文均与正式规格逐段核对，无 delta 标题残留 |
| `git diff --check` | 通过 |

最终日志在 `/tmp/scholoom-pdf-{lint-final,typecheck-final,build-final,kernel-final,smoke-final,ui-final}.log`。测试定义和夹具保存在仓内，日志不是唯一依据。

- `tests/pdf-fixture.ts` 的两个页面独立预置正文为 “Scholoom PDF evidence 42” 和 “Second page controlled result 73”；页尺寸不同，第二页含90度旋转。标准 PDF 工具核过夹具正文，测试不以新模块的输出生成预期。
- 内核覆盖分段续取、页／偏移／区域越界、旋转尺寸、无文字层、损坏及加密材料、容量拒绝、停止、超时后续读和材料变化。截止时间通过受控触发预算验证，不宣称实跑了30秒重负载或 WASM 硬内存配额。
- 真实 HTTP 模型夹具通过实际 harness 工具调用 PDF 与记录入口，核对用户高亮、Agent 会话作者、持久身份及撤权后的模型请求拒绝；没有阅读窗口依赖。
- UI 实际核对搜索、两页选区摘录、旋转后共同坐标与 SDK 投影原页坐标、明确保存、跨项目会话／说明草稿、关闭重开不重复创建、失效原件禁用定位、原始字节及 SDK Worker 清理。外部 HTTP 请求被阻止，未出现 CDN 请求或 pageerror。
- 既有记录 UI 场景覆盖保存期间继续输入、关闭重开后的迟到回执、未知结果精确核查／原输入重试、冲突草稿、旧修订及移除。
- 主 Agent 实际查看了双宿主的记录截图和清除临时选区后的持久高亮截图。`test-results/ui/pdf-reading-*/` 包含 `pdf-reader-{loaded,search,rotated,projected-highlight,records}.png`。

## 审查与问题处理

记录持久化及原有记录 UI 已分别经过独立只读审查；后续 PDF 内核、授权／版本保护、旋转映射、资源清理及跨项目 tab 合并另行复核。审查者不代替主 Agent 的真实运行验收。

发现并解决：

1. SDK 2.15.1 空文字页的 extractText 可能读取未初始化缓冲。Worker 先通过公开 getPageGeometry 判空，无文字层现在明确返回 hasText=false；合成回归实际通过。
2. 独立审查发现交付前材料复查在30秒预算之外，且 harness 停机信号未传到 PDF。复查移入同一受管任务，信号贯穿工具调用和分段读取；补验复查超时、取消及等待者恢复，相关12项通过并纳入全量结果。
3. 离线验证发现禁用工具栏仍会加载默认印章 manifest；已同时清空 manifests／libraries，并关闭 defaultLibrary。Worker 资源 URL 转为本地绝对地址。
4. 旋转页实测发现 SDK 未旋转坐标与内核页坐标不同。保存和投影使用公开 rotateRect／restoreRect 互逆映射；独立矩形核对0／90／180／270度，双宿主实际核对90度页面。
5. 双宿主 pageerror 检查发现手动销毁与 SDK 自身清理重复。核对 SDK lifecycle 后删除手动 destroy，最终错误列表为空且关闭后 Worker 为0。共同 PDF 从项目布局缓存中分离，实际跨项目会话验证保持原材料及草稿。

## 未完成事项与下一步

本变更约定范围无未完成任务。按用户要求在归档、提交后停止；未启动 EPUB／网页或任何下一变更，不将整个 P4b 或项目路线图标为完成。

已知边界：无 OCR、密码流程、PDF 写回及跨版本位置迁移；后备字体只打包常规字重，不保证所有缺字／语言完全复原。没有运行真实供应商科研验收、极端负载或三平台实际分发包验证；本机双宿主结果不代表这些范围。
