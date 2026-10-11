# 工作台通用 UI 与工件交互复用调查

调查日期：2026-10-11。范围是 React DOM 工作台的通用 UI、布局、表格与长列表、Markdown/数学展示、差异、图表/图谱和交互辅助组件；不含学术可视编辑器与 PDF 阅读器。

本文是官方文档、源码入口、LICENSE 和发布/维护记录调查，不是安装、集成、无障碍审计、运行测试或性能测试。官网示例可运行不等于 Scholoom 产品契约已满足。版本不作为选型结论；依赖采用时应按当时发布版重新锁定和核对许可证。

## PRD 需求映射

| PRD 需求 | 对通用组件的含义 | 事实源/责任 |
|---|---|---|
| [工作台布局与导航](../../../docs/prd/workbench.md#布局与导航) | Agent/文献/写作/审查预设；面板调整、折叠、分栏、保存和恢复；切换不改变任务及草稿 | 内核持久任务；工作台保存布局与局部草稿 |
| [指令、材料和对象选择](../../../docs/prd/workbench.md#指令材料和对象选择) | 输入目标、接收者、材料标签；报告/图表可选结构对象或框选区域 | Scholoom 对象身份、定位和待发指令 |
| [查看结果与审查](../../../docs/prd/workbench.md#查看结果审查与用户介入) | 显示实际应用差异、理由、执行者；需要时局部接受、撤销、追踪剩余事项 | 内核事实记录；界面不能将消息当作应用结果 |
| [阅读和材料定位](../../../docs/prd/workbench.md#阅读和材料定位) | 普通列表/图表对象可回到稳定材料版本和坐标；图件图片区域框选不伪装为结构语义 | 来源版本及定位契约由领域模块管理 |
| [布局及高频更新约束](../../../docs/prd/README.md#七个逻辑模块)、[质量与验证](../../../docs/prd/constraints-and-validation.md#质量与验收目标) | 可访问交互、订阅清理、按会话/窗口有界刷新；性能需用代表数据实测 | UI 只取当前视图范围与必要增量 |
| [已定技术路线](../../../docs/prd/constraints-and-validation.md#已定技术路线) | TypeScript、React DOM；assistant-ui 为 Agent 通用交互底座；图谱路线 Graphology + d3-force + Sigma；源码编辑器另属 CodeMirror 6 范围 | 本报告不能推翻已确认决定，只列实施前的候选核验和缺口 |

## 已有调查结论与边界

- [Agent UI 复用评估](agent-ui-reuse-evaluation.md)已支持 assistant-ui ExternalStoreAdapter/Runtime：Scholoom 保留内核协议、持久任务和会话、恢复与权限语义，需实现消息投影和适配器。Paseo 用于面板组织参考；其 RN Web 与应用状态不等于 React DOM 可直接导入组件。
- [工件交互参考](workbench-artifact-interaction-reference.md)确认对象选区随指令传递、Agent 修改可直接应用并显示差异的产品参考；其撤销不会自动通知 Agent、整文件恢复会覆盖后续编辑，不能代替 Scholoom 的撤销契约。
- [技术约束](../../../docs/prd/constraints-and-validation.md#已定技术路线)已选 Graphology、d3-force、Sigma.js v3 稳定路线；本报告仅补充替代和访问/定位责任，不建议重新选型。
- 下表维护证据取自官方仓库主页/API、官方发行页或 npm 官方 registry；截至调查日期访问。维护时间证明有近期活动，不证明维护质量。未对逐项源码做运行检查。

## 候选与判断

共 17 组候选。图表库和轻量交互控件按用途合并为对照组；组内方案是相互替代项，不建议全部引入。状态“推荐”表示值得用于对应边界的首选/优先原型，不表示产品已集成；“备选”“仅借鉴”“不推荐”给出范围原因。

### 1. assistant-ui：既定 Agent UI 方向

- **能力/接入：** `@assistant-ui/react` 组件与 runtime；用 ExternalStoreAdapter 映射 Scholoom 有界消息投影、状态、发送/取消和审批回调。重点源码：`packages/core/src/runtimes/external-store/`、`packages/ui/`。
- **官方依据：** [External Store 文档](https://www.assistant-ui.com/docs/runtimes/custom/external-store)、[源码](https://github.com/assistant-ui/assistant-ui)。LangGraph runtime 走其 SDK/server，并非 Scholoom JSON-RPC adapter。
- **许可/维护：** 根 LICENSE 为 MIT，核心 React 包免费；npm 官方 registry 中 `@assistant-ui/react` 发布记录到 2026-10-10。
- **运行/耦合：** React DOM 浏览器/Electron renderer。消息投影、恢复、任务权限事实仍归本项目；不接入其会话/后端模型。
- **判断：推荐。** 沿已确认方向，未集成或运行验收。

### 2. Radix Primitives：无样式控件原语

- **能力/接入：** 按需组合 Dialog、Popover、Tabs、Menu、Tooltip、ScrollArea 等 primitives；不是完整视觉组件库。源码分布在各 primitive package。
- **官方依据：** [文档](https://www.radix-ui.com/primitives/docs/overview/introduction)、[源码](https://github.com/radix-ui/primitives)。
- **许可/维护：** LICENSE 声明 MIT，免费；Radix 官方包 registry 更新至 2026-10-09。
- **运行/耦合：** React DOM 浏览器/Electron renderer。不含主题和布局；原语提供常见键盘/ARIA 行为，但组合后焦点与读屏仍需检查。
- **判断：推荐候选。** 适合自有样式组件作为底层；和 Base UI 二选一。

### 3. Base UI：无样式 React 控件

- **能力/接入：** 带状态、键盘交互和组合部件的基础控件，按需用于 Scholoom 自有组件。
- **官方依据：** [Quick start](https://base-ui.com/react/overview/quick-start)、[源码](https://github.com/mui/base-ui)。
- **许可/维护：** 根 LICENSE 为 MIT，免费；官方 registry 记录最近发布于 2026-10-09。
- **运行/耦合：** React DOM/Electron renderer；不含完整设计系统。与 Radix 重叠，不应一起引入。
- **判断：备选。** 和 Radix 比较现有控件、focus/keyboard 与 Electron 渲染表现；不凭新旧或流行度裁决。

### 4. shadcn/ui：复制到应用的组件源码

- **能力/接入：** CLI 将组件源码生成到应用，再由项目持有和修改；常见组件依赖 Radix/Base UI 等，不是单一运行时组件层。
- **官方依据：** [文档](https://ui.shadcn.com/docs)、[源码](https://github.com/shadcn-ui/ui)。
- **许可/维护：** 仓库根 [LICENSE.md](https://raw.githubusercontent.com/shadcn-ui/ui/main/LICENSE.md) 为 MIT，免费；该许可不自动覆盖商业 Blocks、字体、图标或第三方资产，按使用项核对。源码仓库截至 2026-10-10 有更新。
- **运行/耦合：** React DOM。复制降低封装锁定，也把组件更新和安全修复维护转给 Scholoom。
- **判断：备选/仅作源码起点。** 采用时记录具体文件和逐项许可；不把 CLI 生成视为已验证设计系统。

### 5. Dockview：IDE 式停靠布局

- **能力/接入：** `dockview-react` 提供网格/嵌套布局、tab/group 拖放、浮动组、popout、splitter resize、布局序列化/恢复；通过 panel API 注册组件并读写布局。
- **官方依据：** [typedocs 与 quick start](https://dockview.dev/typedocs/)、[企业版发布说明](https://dockview.dev/blog/dockview-enterprise/)、[许可及功能对照表](https://dockview.dev/docs/overview/licence/)、[源码](https://github.com/dockview/dockview)。
- **许可/维护：** 官网 `LICENCE.md` 指明 `dockview-core`、`dockview`、`dockview-react`、Vue/Angular 包均 MIT、免费；`dockview-enterprise` 专有商业授权，按开发者/年计费，应用数不限，密钥到期前发布的版本可继续使用。官网发布说明日期为 2026-08-07。
- **免费/商业功能：** 公开版有 docking、保存恢复、React、ARIA/标签、读屏公告和常规键盘焦点导航。Enterprise 增加多行/固定标签、高级搜索/最近使用溢出、DnD compass、smart guides、自动隐藏/贴边组、layout history、空间键盘导航和 keyboard docking；可免费试用 30 天，生产部署需要商业许可证。
- **运行/耦合：** React DOM/Electron renderer；typedocs 列 React 16.8–19。布局 schema、未知 panel、版本迁移和小窗口降级由应用负责；库的无障碍能力仍需组合测试。
- **判断：保留为完整 docking 候选。** 当前 resize/fold/save 可先用更小的 react-resizable-panels；若需要任意面板重排，Dockview 免费版覆盖主要需求，没有许可未知这一阻碍。

### 6. FlexLayout：停靠面板模型

- **能力/接入：** React tabsets、拖放、模型和 JSON 序列化；核心源码 `src/` 及 React bindings。
- **官方依据：** [Wiki](https://github.com/caplin/FlexLayout/wiki)、[源码](https://github.com/caplin/FlexLayout)。
- **许可/维护：** 根 LICENSE 为 MIT，免费；v0.11.1 于 2026-09-26 发布。
- **运行/耦合：** React DOM；保存状态与库 JSON schema 耦合，升级需考虑旧布局迁移；复杂交互仍须可访问性验收。
- **判断：备选。** 若需要停靠布局且 Dockview 条款不合适，可对照；不与 Dockview 同时引入。

### 7. react-resizable-panels：分栏与 resize

- **能力/接入：** 当前 v4 API 使用 `Group`、`Panel`、`Separator`，支持常见分栏、折叠、键盘调整与百分比布局存取；接入时以 v4 文档为准。
- **官方依据：** [Group API](https://react-resizable-panels.vercel.app/props/group)、[Separator API](https://react-resizable-panels.vercel.app/props/separator)、[持久布局示例](https://react-resizable-panels.vercel.app/examples/persistent-layout)、[源码](https://github.com/bvaughn/react-resizable-panels)。
- **许可/维护：** 根 LICENSE MIT，免费；npm registry 发布记录到 2026-10-10。
- **运行/耦合：** React DOM/Electron renderer；不支持任意停靠/浮动。应用保存预设、校验旧布局并处理窄窗口。
- **判断：推荐先原型。** 覆盖当前 resize/fold/save 需求，若没有明确重排需求，不引入完整 docking manager。

### 8. TanStack Table：表格模型

- **能力/接入：** headless 行/列模型、排序、过滤、分页、选择和列可见性；React adapter 配合自绘表格。
- **官方依据：** [文档](https://tanstack.com/table/latest)、[源码](https://github.com/TanStack/table)。
- **许可/维护：** 根 LICENSE MIT，免费；`@tanstack/react-table` registry 发布记录到 2026-10-08。monorepo release 不直接等于目标包版本。
- **运行/耦合：** React DOM 浏览器/Electron；不含虚拟化、完整 UI 或后端查询。过滤/排序需转为有界领域查询。
- **判断：有条件推荐。** 文献/任务网格复杂到原生表格不够时采用；避免加载整个文献库来筛选。

### 9. TanStack Virtual：可视区列表

- **能力/接入：** headless 虚拟窗口，React adapter 只渲染可见行与 overscan。
- **官方依据：** [文档](https://tanstack.com/virtual/latest)、[源码](https://github.com/TanStack/virtual)。
- **许可/维护：** 根 LICENSE MIT，免费；`@tanstack/react-virtual` registry 发布记录到 2026-10-09。
- **运行/耦合：** React DOM/Electron renderer；动态行高、滚动锚点、列表语义与容器由应用接线。它不限制订阅频率或投影计算。
- **判断：按测量推荐。** 长消息/文献/执行流需要时采用；普通短列表不增加虚拟化成本。

### 10. Zustand：本地 UI store

- **能力/接入：** 轻量 store、selector 订阅与 React hooks；可放跨面板草稿、选中对象、布局局部状态。
- **官方依据：** [文档](https://zustand.docs.pmnd.rs/)、[源码](https://github.com/pmndrs/zustand)。
- **许可/维护：** 根 LICENSE MIT，免费；v5.0.15 于 2026-08-13 发布。
- **运行/耦合：** React DOM/Electron renderer；selector 要窄、卸载要清订阅；不能持有任务、审批或文献权威状态。
- **判断：有条件备选。** 只有状态真跨组件且 React context 不清晰时加入，不因远端实时数据而自动采用。

### 11. TanStack Query：请求/响应缓存

- **能力/接入：** query cache、请求去重、重试、失效与 observer；适用于有明确请求/响应语义的服务。
- **官方依据：** [文档](https://tanstack.com/query/latest)、[源码](https://github.com/TanStack/query)。
- **许可/维护：** 根 LICENSE MIT，免费；`@tanstack/react-query` registry 发布记录到 2026-10-02。monorepo release 需按目标包核对。
- **运行/耦合：** Node/浏览器、React adapter；不提供 JSON-RPC 重连、游标补齐、订阅清理或事件去重。
- **判断：不推荐作为订阅必需层。** 少量快照请求可独立评估；避免与 client 建两套缓存权威和失效规则。

### 12. Markdown、数学与安全渲染栈

- **能力/接入：** react-markdown 将 Markdown 转 React；remark-math 解析公式；rehype-katex 输出 KaTeX 节点；rehype-sanitize 在 AST 上按 schema 过滤。源码分别在各官方仓库的 package 目录。
- **官方依据：** [react-markdown](https://github.com/remarkjs/react-markdown)、[remark-math](https://github.com/remarkjs/remark-math)、[rehype-katex](https://github.com/rehypejs/rehype-katex)、[KaTeX](https://github.com/KaTeX/KaTeX)、[rehype-sanitize](https://github.com/rehypejs/rehype-sanitize)。
- **许可/维护：** react-markdown、remark-math、rehype-katex、KaTeX、rehype-sanitize 为 MIT，免费。registry 最近发布记录：react-markdown 2025-03-07、remark-math 2023-09-19、rehype-katex 2024-08-19、KaTeX 2026-10-01、rehype-sanitize 2023-08-26；较久未发布的插件需评估支持/兼容范围，不把 unified 活动等同于所有插件。
- **运行/耦合：** React DOM；KaTeX CSS/字体需随应用提供。raw HTML 默认关闭；长消息/流式未闭合标记重排与滚动锚点待原型验证。
- **判断：推荐文本展示。** 不涵盖学术可视编辑；安全顺序与 HTML 策略见后文。

### 13. DOMPurify：HTML 字符串净化

- **能力/接入：** 对 HTML 字符串/DOM 清理；仅在产品确需 raw HTML 时放在最终可信渲染出口。多数 Markdown 用 rehype-sanitize AST 路径更贴近 pipeline。
- **官方依据：** [源码与 README](https://github.com/cure53/DOMPurify)，其中提供 DOM/Node 用法及配置边界。
- **许可/维护：** MPL-2.0 OR Apache-2.0，免费；官方仓库活跃。实际发行版许可证需随版本复核。
- **运行/耦合：** 依浏览器 DOM；Node 端需要兼容 DOM 实现，避免 renderer 与服务端净化行为不一致。KaTeX 类名/样式可能被 schema 删除，需最小扩展。
- **判断：仅在启用 HTML 时采用。** raw HTML、用户和 Agent 输出均不可信；限制危险 URL、SVG、事件属性和外链资源。

### 14. CodeMirror 6 merge：文本 diff

- **能力/接入：** `@codemirror/merge` 提供 unified diff 与 side-by-side merge view，适合纯文本/Markdown/代码前后版本。
- **官方依据：** [参考手册](https://codemirror.net/docs/ref/#merge)、[迁移后的源码](https://code.haverbeke.berlin/codemirror/merge)、[README](https://code.haverbeke.berlin/codemirror/merge/raw/branch/main/README.md)。GitHub 旧仓 README 指向此上游位置，不是并入 CodeMirror 主仓。
- **许可/维护：** 迁移后 README 声明 MIT；`@codemirror/merge` registry 发布记录到 2026-06-09。GitHub 镜像仓归档不能单独说明上游停止维护，应跟踪新源码站与 npm 包。
- **运行/耦合：** 浏览器/React DOM 需 wrapper；它不理解研究段落语义、对象身份、批注、局部授权或撤销保护。
- **判断：推荐作纯文本底层。** 工件差异聚合、接受/撤销事实和 Agent 通知由 Scholoom 自己负责。

### 15. 科学图表展示：ECharts / Vega-Lite / Plotly.js

- **能力/接入：** ECharts 提供 canvas/SVG 与 `series/dataIndex` 事件；Vega-Lite 用字段、selection/参数和信号描述 mark；Plotly.js 提供科学图种与 trace point 索引。点击均须由 Scholoom 映射到稳定业务键。
- **官方依据：** [ECharts](https://echarts.apache.org/en/option.html)、[事件](https://echarts.apache.org/en/api.html#events)、[Vega-Lite](https://vega.github.io/vega-lite/)、[Plotly.js](https://plotly.com/javascript/)、[Apache ECharts 源码](https://github.com/apache/echarts)、[Vega](https://github.com/vega/vega)、[Plotly](https://github.com/plotly/plotly.js)。
- **许可/维护：** ECharts Apache-2.0；Vega/Vega-Lite BSD-3-Clause；Plotly.js MIT，库均免费；托管/商业产品另计。registry 发布记录：ECharts 2026-05-19、Vega-Lite 2026-10-08、Plotly.js 2026-10-05。
- **运行/耦合：** 浏览器/Electron renderer；图表不保证无障碍，需数据表/键盘旁路；按需打包和测规模。科研 Python 生成的 PNG/SVG/PDF 是既有工件，JS 图表库不提供其代码/来源或编辑语义。
- **判断：原型对照 Vega-Lite 与 ECharts。** 前者字段/mark 语义显式，后者交互表达灵活；Plotly 仅在目标图种明确需要时备选。定位保存 source/version + row key + series/field，不能只存像素。

### 16. 图结构与图声明：Graphology/Sigma、Cytoscape、Mermaid

- **能力/接入：** Graphology 是图数据结构/算法，Sigma 是 WebGL 网络渲染；Cytoscape.js 集图算法和交互渲染；Mermaid 将文本声明渲染成流程图。
- **官方依据：** [Graphology](https://graphology.github.io/)、[Sigma](https://www.sigmajs.org/)、[Cytoscape.js](https://js.cytoscape.org/)、[Mermaid](https://mermaid.js.org/)、[Sigma 源码](https://github.com/jacomyal/sigma.js)。
- **许可/维护：** 仓库 LICENSE 为 MIT、免费。源码更新时间：Graphology 2026-09-02、Sigma 2026-10-09、Cytoscape 2026-10-06、Mermaid 2026-10-10；Graphology npm 发布记录较早，为 2025-01-26，应关注发布节奏与源码变化差异。
- **运行/耦合：** 浏览器/Electron；Sigma WebGL 受 GPU/driver 影响；图大时限制投影和更新，键盘/读屏需节点列表/详情旁路。
- **判断：推荐沿既定 Graphology+d3-force+Sigma 路线。** Cytoscape 仅在确需其内置算法时备选；Mermaid 用于流程图，不当作自由科研图谱。

### 17. 交互辅助：React Hook Form、Ajv、cmdk、react-arborist、快捷键

- **能力/接入：** React Hook Form 管复杂表单；Ajv 校验 JSON Schema（不含 UI）；cmdk 提供键盘命令菜单；react-arborist 提供虚拟化树；少量快捷键可由集中 handler 处理。
- **官方依据：** [RHF](https://react-hook-form.com/docs)、[Ajv](https://ajv.js.org/guide/getting-started.html)、[cmdk](https://github.com/dip/cmdk)、[react-arborist](https://github.com/jameskerr/react-arborist)、[react-hotkeys-hook](https://github.com/JohannesKlauss/react-hotkeys-hook)。
- **许可/维护：** npm metadata/仓库声明均为 MIT，免费；registry 发布记录：React Hook Form 2026-09-26、Ajv 2026-04-24、cmdk 2025-03-14、react-arborist 2026-10-11、react-hotkeys-hook 2026-06-26。cmdk 发布较早，采用前确认维护预期；各精确发布版 LICENSE 复核。
- **运行/耦合：** React DOM/Electron。树控件不提供文件系统、权限或文献导航领域语义；命令菜单/快捷键须验证焦点和键盘冲突。
- **判断：按缺口选用。** Ajv 对已有 JSON Schema 有直接价值；普通表单先用 React；cmdk 等全局命令需求明确再加；树只有节点量需要虚拟化时评估。

## 状态、订阅和有界更新建议

- 不要因 WebSocket 就自动同时引入 Zustand 和 TanStack Query。内核快照与通知由共同 client 管；视图只订阅当前任务/会话/窗口，切页时取消上个订阅，组件卸载清监听器，重连用快照/游标覆盖读取间隙，避免构建第二套全量事件历史。
- React 局部状态/context 足以管理单页面状态；若草稿、选中对象、分栏和临时指令确实被多处共享，再用 Zustand selector store。状态 store 不持有远端领域真相。
- TanStack Query 适合明确的请求/响应缓存边界。对于持续通知，须设计 query cache 更新与订阅事件去重/失效语义，否则它只会增加两套缓存一致性负担。
- 虚拟列表只能限制 DOM 节点数，不会限制内核推送频率或投影计算。消息更新应批量/合并到可视刷新节奏，并保留稳定锚点；重计算送 Worker，不堵 React 主线程。
- Docking JSON、组件状态与内核任务身份分开持久化。布局加载校验未知 panel、版本迁移、窗口过窄和旧布局降级；切换布局保留草稿靠应用状态模型，不依赖布局库状态。

## 安全、无障碍与跨平台核查

- Markdown/Agent 输出及导入文档一律视为不可信。建议 pipeline 为 `remark-parse → remark-gfm/math → rehype-katex → rehype-sanitize → React`，禁用 raw HTML。仅当产品确需 HTML 时才增加 raw HTML 解析，并让 sanitizer 在最终 HTML sink 前执行；测试 `javascript:`、事件属性、SVG、data URL、外链图片和畸形/流式输入。KaTeX 白名单按其官方配置最小扩展，禁止无审查地放开 `style`/未知 class。
- 文件链接应走应用对象 URI/受控打开接口，不让 Markdown 任意访问 `file:`、本机路径或 renderer bridge。链接协议白名单、远程图片加载和 CSP 属应用策略；库默认设置不是安全边界。
- Radix/Base UI 的原语可提供 ARIA/键盘基础，不证明组合后合格。检查焦点返回、Dialog/Popover 读屏、缩放、高对比、减少动画；图表同时给可聚焦数据表/摘要，拖动面板提供键盘 resize。
- React DOM/Electron Chromium renderer 大多可用；WebGL 图谱依 GPU/driver 能力并需降级；Node-PTY 具有原生构建/ABI 和平台限制，只有产品要交互终端时才考虑 xterm.js + node-pty。当前 PRD 未要求工作台集成终端，科研程序在受管执行进程运行，因此**不纳入候选依赖**；日志/运行状态组件即可。
- Windows/macOS/Linux 的 Chromium 与键盘组合键、字体、滚动、窗口尺寸和 GPU 行为仍需实际 Electron 分发包验收。npm 的浏览器兼容声明不代替目标 Electron 版本测试。xterm.js/node-pty 只有在 PRD 增加交互终端需求时才另行研究；目前工作台通过受管任务查看运行状态/日志，不要求嵌入 shell，故不计入候选组。

## 最值得做的原型与验收

1. **Radix vs Base UI + react-resizable-panels（如布局范围扩大再对比 Dockview）**：键盘仅用 Tab/方向键完成开关、聚焦、分隔区 resize；读屏可辨面板名/状态；窄窗口降级；保存后重开恢复尺寸、折叠状态与预设；未知旧 panel 不导致整个布局丢失。检查草稿/任务身份在四种预设切换后保持。
2. **assistant-ui 外部 store + 流式 Markdown/KaTeX**：模拟增量消息、工具活动、取消和重连；流式未闭合 Markdown 不丢末尾文本，滚动位置行为稳定；换会话后无旧 listener 更新；长历史 DOM 与每次投影只随可视窗口/选中会话增长；恶意 HTML/链接不能创建脚本、导航本机文件或外发资源。
3. **Vega-Lite vs ECharts 对象到数据定位**：点击 series/mark 后 UI 显示稳定对象名和源数据记录/字段，可回到正确版本；筛选、排序或重新布局后定位仍正确；只有图片标注时明确显示为区域指令，不出现虚假的“已选图元”语义；键盘可选择同一数据项。
4. **TanStack Virtual + 表格模型（仅在真实量级需要时）**：以代表规模长会话和文献列表更新/切换；DOM 数量受可视区限制、滚动锚点不跳、筛选不触发全库读取、离开页面后订阅停止。达到需求不意味着所有列表都必须虚拟化。

## 自研职责不能由库替代

Scholoom 仍须定义并维护：任务/Agent/会话身份和权限；JSON-RPC 快照、增量、重连补齐、订阅范围与清理；消息/工具/审批/产物的领域投影；布局版本与迁移；对象选择、材料引用、版本/坐标、图表 mark 到数据行的稳定映射；工件差异的应用状态、局部接受、撤销保护后续编辑及通知 Agent；Markdown 危险功能策略；键盘快捷键冲突、焦点和图表非视觉替代；性能采样及三平台实际验收。

上述候选可省去通用组件的实现，不会替 Scholoom 建立科研对象语义。调查未进行依赖安装、原型集成、运行/屏幕阅读器测试、三平台 Electron 实测或许可证法律意见；shadcn/ui 商业 Blocks/第三方资产范围及部分上游依赖的传递许可证仍应在采用前单独确认。
