# 实际交付与交接

## 当前状态与成果

本 change 已完成约定实施与 Linux 本机验收，任务进度见 [tasks.md](tasks.md)。保留 change 工件，尚未同步 main specs、归档或提交 Git；未切换分支或回滚用户改动。

用户已明确批准固定依赖安装、锁文件更新，并批准本次剩余授权事项。依赖安装使用 `--ignore-scripts`，末次仅将现有 `@lezer/highlight@1.2.5` 声明为直接依赖，使用离线安装；React、Electron 和 CodeMirror state 基线未升级。UI 测试服务器使用已批准的临时 127.0.0.1:5174 入口与隔离配置，由既有夹具收尾。

### 成果入口

- `packages/protocol/src/editor.ts`：工具诊断、转换、书目、渲染受理／状态／取消、分块产物和显式导出的同源契约。
- `packages/editor`：独立人工转换及编译、必要输入快照、有界调度、持久回执、版本检查、最后成功产物与缓存；项目能力经 broker 接入，不装配 harness、会话或模型。
- `packages/platform/src/command*.ts`、`apps/kernel/src/manual.ts`：复用进程准入、独立进程树控制器、输出和时限保护；取消后确认停止，等待名额后再次检查授权。
- `apps/desktop/src/renderer/src/workbench/editor/`：CodeMirror 共享撤销与独立视图位置；真实 Quarto 可视编辑；草稿轻预览、保存版本排版、受限 HTML、共同 PDF 查看器及导出；按稿件、实际依赖及祖先配置筛选刷新。
- 既有 `Workbench.tsx`、`project-ui.tsx`、`file-document.ts`、TabGroups 和 session：接入模式、分屏、保存及稳定文件身份；待转换正文在页面退出或卸载前保存恢复记录，多个视图核对记录身份后发布，迟到结果不能覆盖新正文。
- `styles.css`、`docs/ui-design/README.md`：浅深主题语法颜色、紧凑编辑状态及独立滚动；完整 HTML 排版在两种主题下保持纸白背景。
- `docs/development.md`、初设工作台链接和决策票 #39：同步实际能力、验证入口与已确认边界。

Quarto 固定提交、许可及宿主适配见 [UPSTREAM.md](../../../packages/editor/UPSTREAM.md)。保留必要源码、图片、样式和 Pandoc Lua，浏览器包按需加载；临时调查目录不是产品依赖。

已核对 [design.md](design.md) 的模块图和保存／排版时序：工作台、人工宿主、broker、项目文件与受控命令均已真实接通，科研执行边界保持原约定。

| proposal 完成判据 | 证据与结论 |
| --- | --- |
| 真实文件树、编辑、模式切换、保存重开与过期保护 | 双宿主写作、恢复和既有文件工作台通过；保存中新输入、外部冲突、目录重命名、回收／恢复及共享预览保留正文 |
| 无会话、无模型的产品入口生成四类实际产物 | 写作用例未创建会话或配置模型；QMD HTML iframe 显示实际正文，DOCX 导出读取实际字节；QMD PDF 与多文件 TeX PDF 经控件预览、导出并读取文件 |
| 连续更新、依赖、失败／取消／超时／退出诊断及旧成果保护 | 实际编译、重启核查和受控故障测试通过；停止未知不冒充成功，不发布半成品或重放遗留编译 |
| 内核、转换、双宿主、类型、构建、架构和交付记录 | 必要定向检查通过；全仓既有 lint 错误和未验收平台见下文，不将它们记为通过 |

## 实际验证

环境：Linux，Node 24.12.0，Quarto 1.9.37、配套 Pandoc 3.8.3、latexmk 4.87 和已有 MiKTeX。没有安装或升级这些编译工具。

### 静态检查与构建

- `openspec validate add-research-writing-editor --strict` 通过。
- `pnpm build:shared`、`pnpm -r typecheck`、`node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json` 通过；末次语法颜色调整后另跑 desktop 类型检查。
- `pnpm --filter @scholoom/desktop build` 通过，末次 renderer 构建约 94 秒。可视编辑器分为约 11 MB 未压缩的独立 chunk，首次打开按需加载。
- `node scripts/check-architecture.ts`：13 模块、170 文件、0 findings、0 exceptions。
- 变更代码的定向 Biome check 检查 45 个文件，0 错误、1 个既有文件树选择器顺序警告；`git diff --check` 通过。此前全仓 Biome check 在未修改的 library 组件等文件上失败，未越界修理，也未声称全仓 lint 或根 `pnpm check` 全绿。

### 内核与独立组件

- `editor-runtime.spec.ts + editor.spec.ts + platform-processes.spec.ts + process-admission.spec.ts`：17 项通过。使用真实工具生成 QMD HTML／PDF／DOCX、多文件 TeX PDF，重新读取 DOCX；验证工程钩子不执行、原始 HTML 与越界图片过滤、完整分块、导出冲突和失败保留旧 PDF。
- `architecture.spec.ts + editor-runtime.spec.ts + manual-application.spec.ts + project-files.spec.ts`：20 项通过，其中 runtime 与前一批重叠；真实人工 RPC、条件保存、并发、结构变化、回收及架构守卫继续通过。
- 增补重启核查后，单独重跑 `editor.spec.ts -g 'actual html'` 通过：遗留回执变为 interrupted，不重放编译，原操作身份与最后成功产物仍可查询。
- 受控 runtime／进程故障测试覆盖队列替换、发布前取消、排队撤权、未知收尾、输出边界、缓存淘汰和满额更新；这些调度边界使用依赖替身，不声称全部来自真实工具故障。
- 末次 `editor-source.spec.ts`：1 项通过，实际 React 与 CodeMirror 验证共享撤销、光标映射和重开、只读与保存快捷键。252000 字节 TypeScript 样本的单键输入到下一帧约 2.6 ms，见 [source-latency.json](../../../test-results/kernel/editor-source-source-views-32019-pped-cursor-after-reopening/source-latency.json)。
- 独立 Chromium 调查夹具曾接入真实 VisualEditor 和隔离 ManualApplication，插入表格、项目引文、交叉引用及图片并写回；重新读取 Pandoc AST 核对 Cite 语义，远端图片请求和页面错误均为零。正式维护入口为下列仓库 UI 测试。

### 浏览器与真实 Electron

在同一 `playwright.ui.config.ts`、真实工作台组件、客户端及内核接线上分批通过，共 18 个宿主用例：

| 测试文件 | 双宿主通过数 | 核对行为 |
| --- | --- | --- |
| `tests/ui/file-explorer.spec.ts` | 10 | 临时标签与草稿、文件传输、外部刷新、跨项目复制／替换、一万行窗口化及并行响应 |
| `tests/ui/file-workbench.spec.ts` | 2 | 保存中新输入、轻预览、目录改名、回收／恢复、冲突、主题及长稿与 Agent 并行 |
| `tests/ui/writing-editor.spec.ts` | 2 | 查找、跳行、可视表格／引文／图片／交叉引用、公式及组合引文页码保留、刷新恢复、即时模式切换、保存、HTML、书目变化自动更新、DOCX 和未知语法保护 |
| `tests/ui/writing-editor-recovery.spec.ts` | 2 | 挂起转换期间只读、刷新恢复、项目切换后转换失败仍保留正文、恢复后可继续编辑；磁盘不被隐式保存 |
| `tests/ui/writing-editor-pdf.spec.ts` | 2 | 无会话／模型的 QMD PDF 与多文件 TeX PDF 预览、导出及实际文件字节 |

实际入口为：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.ui.config.ts tests/ui/writing-editor.spec.ts tests/ui/writing-editor-recovery.spec.ts tests/ui/writing-editor-pdf.spec.ts tests/ui/file-workbench.spec.ts tests/ui/file-explorer.spec.ts
```

上述用例分批执行并在对应修改后定向重跑，并非同一次命令的 18 项总计。源码主题调整后再次运行独立源码测试和双宿主完整写作路径；PDF 用例在排除额外诊断页面干扰后重跑通过。

261267 字节工作台样本的输入／取消反馈分别为浏览器约 3.1／750.1 ms、Electron 约 4.6／709.4 ms。Agent 边界使用现有受控模型服务器；写作和排版用例没有模型。该测量只用于确定性输入与取消反馈，不代表科研质量或整项科研执行速度。

末次浅深主题截图保留在 `test-results/ui/writing-editor-scientific--5d826-s-and-renders-saved-content-{ui-browser,ui-electron}/`，截图禁用有限动画，避免误读主题切换中间帧。测试结果目录为生成工件，后续测试可能覆盖。

## 审查与问题处理

后端独立审查发现并修复：原始 HTML 越界读取、等待项并发遗失、取消与发布竞态、排队撤权、嵌套 TeX 引用目录、探测命令尚未收尾即清理、引用转换吞掉停止未知、缓存满额更新和发布中断漏计。最终限定范围复核未发现剩余 P1／P2。

前端独立审查推动修复：刷新或失败卸载时丢失尚未转换的正文、异步载入仍可输入、初始化失败后错误开放编辑、旧保存删除新恢复记录、多视图重复恢复、旧视图占用未释放，以及路径变化时读到过期恢复参数。共享文稿核对恢复记录和转换归属；初始化及已有视图读取实时记录。最终限定范围复核未发现剩余确定 P1／P2，真实刷新与失败切项目回归通过。

实跑中另处理导航 flush 回调稳定性、图片替代文字、每帧工具栏刷新、独立视图位置、深色源码颜色、排版纸面对比度及编辑状态溢出。测试清理自己的临时项目，避免影响后续“移出最近列表”的断言。

中途有冷启动超时、Chromium `ERR_NETWORK_CHANGED`、额外诊断页面切换共享项目及依赖热更新错误遮罩；停止干扰、完成依赖链接并重新启动夹具后，受影响场景重跑通过。没有通过放宽性能阈值或删除行为断言掩盖失败。长稿独立测试曾遇 CDP 多行整块 insertText 超时，改以标准 paste 事件准备样本，再测单键输入；未把该次灌入超时记为通过。

## 完成边界与后续

本 change 没有剩余实施阻塞。全仓既有 lint 错误仍存在；仅验证 Linux 开发／构建环境，尚未做 macOS、Windows、签名分发包或三平台安装／恢复验收。

编辑上限继续为 256 KiB，转换 AST、编译输入、进程日志及产物均有界。缓存按项目最多 256 MiB／64 份，允许有界提交余量并保护最后成功、最近读取及在途导出；停止未知的工作目录与 owner.json 保留供核查，不自动重放。

原生 TeX 支持已验证的静态多文件包含与书目路径，复杂宏生成依赖、任意 graphicspath 和扩展名推导未作全面验收。可视图片按视图有界缓存，替换图片后可重开视图；完整排版按已登记依赖及祖先 Quarto 配置更新，无关项目文件变化不触发该稿件编译。没有语言服务器、终端、科研代码执行、自定义可执行工程、共同库引文写入或连续精确原文定位的新增承诺。

临时调查脚本 `/tmp/scholoom-visual-check.mjs`、缓存 bundle 及 Quarto 上游调查目录保留为排查依据，可由系统清理；实际运行只依赖仓库实现与构建资源。隔离 UI 服务器／内核和测试进程由本轮夹具收尾，不停止其他用户进程。
