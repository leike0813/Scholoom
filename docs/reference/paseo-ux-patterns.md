# paseo UX 参考：功能组织与交互行为

上一份 [`paseo-ui-patterns.md`](paseo-ui-patterns.md) 解决的是「长什么样」——token 字面值、控件几何、
交互契约的常量。本文解决另一半：**功能怎么组织、用户点了会发生什么**。

## 如何使用本文

1. **只写源码里读到的客观事实**，每条带 `路径:行号`。读不到写 `unverified — 需确认`，不猜不省略。
2. **本文不改本项目任何代码**。对照表给的是方向，不是待办任务；采纳与否由设计裁决。
3. **本文与几何、色值互不重叠**。需要 px 与 hex 时去 `paseo-ui-patterns.md`；
   需要图册实测色值时去 [`codex-atlas-specs.md`](codex-atlas-specs.md)。

章节导航：1 信息架构与导航 · 2 会话与运行生命周期 · 3 控件点击后的交互效果 · 4 键盘与文本输入模型 ·
5 状态、反馈与能力页面的信息组织 · 6 跨切片的可迁移做法 · 7 与本项目的差距总表 · 8 路径索引 ·
附录 复核方法。

## 为什么 UX 部分只分析 paseo，不分析 Codex

Codex 图册是 16 张**静态帧**，且其中 6 张是官方裁切图。按图册自己的声明（第 18 页）：

> 公开静态图片无法验证悬停、键盘操作、动态刷新性能和真实尺寸。

单帧能证明的只有「某时刻屏幕上有什么」，证明不了：

- 点击后的状态迁移（哪一步打开哪一层、关闭顺序、焦点去向）
- 悬停、按压、禁用、加载中、失败中的可见差异
- 快捷键、焦点顺序、右键菜单、拖拽
- 多步流程的中途退出与恢复

本仓库 [`codex-atlas-specs.md`](codex-atlas-specs.md) 已经在 16 节的「不可推断」栏把这些逐条标出来了，
文末 D 表把它们登记为缺口。所以 **Codex 侧的 UX 无可信来源可分析**，硬写就是编。

需要说明的是：图册仍能提供**信息架构**层面的线索（哪块区域长期存在、状态与对象如何相邻），
这部分已经并入 `codex-atlas-specs.md` 的各节「画面结构」栏，本文不再重复。

paseo 是可读源码，行为、状态机、注册表、门控条件都能逐行核对，所以 UX 只做它。

---
## 1. 信息架构与导航

### 1.1 整体模型

paseo 的导航分三层，各层用不同的表达方式，彼此不混：

1. **全局路由**是 expo-router 的文件路由。`packages/app/src/app/` 下的文件树就是路由表，屏幕逻辑放在 `packages/app/src/screens/`，route 文件只做参数解析和重定向。两级栈：根栈（`app/_layout.tsx:885-912`）→ host 栈（`app/h/[serverId]/_layout.tsx:35-43`）。
2. **工作区内部导航**（tab / pane / 侧栏视图）不走路由，落在 `stores/workspace-layout-store.ts` 的内存 + AsyncStorage 布局里。切工作区是改布局 key，不是换路由；换路由只在跨 host 或进出会话列表时发生。
3. **命令面板**是一条与前两层都正交的第三条通道：任何模块把自己的动作「贡献」进同一个注册表，由面板统一排序渲染。

边界：`keyboard/` 归别的切片，`agent-stream/` 的渲染归别的切片；此处只写「什么能被打开、在哪儿打开、怎么被找到」。

### 1.2 屏幕地图

| 路由文件 | 渲染的 screen | 入口职责 |
| --- | --- | --- |
| `app/index.tsx:19` | `StartupSplashScreen`（`:3` 引入） | 冷启动落点。`resolveStartupRoute`（`:35`）在宿主注册表就绪前返回 `splash`，就绪后返回 `redirect` |
| `app/h/[serverId]/index.tsx:14` | `StartupSplashScreen` 或 `<Redirect>` | host 内落点。`:23-25` 在 serverId 为空或选择未 hydrate 时渲染 splash，`:27-38` 用 `resolveHostIndexRoute` 重定向到上次工作区或 open-project |
| `app/h/[serverId]/workspace/[workspaceId]/index.tsx` | `WorkspaceScreen`（`screens/workspace/workspace-screen.tsx:402`，`memo` 包了 3896 行） | 工作区主屏：pane 树、tab 条、composer、右侧 Explorer |
| `app/h/[serverId]/agent/[agentId].tsx:13` | `AgentRouteResolutionView` 或跳转 | 只做「agent → 所属 workspace」的解析，解析成功后转发（见下节） |
| `app/new.tsx:14` | `NewWorkspaceScreen`（`screens/new-workspace-screen.tsx:1628`） | 建工作区草稿。参数 `serverId/dir/name/projectId/draftId`（`:15-26`），`:27-33` 用这五项 JSON 成 `screenKey`，`:35-38` 注释说明草稿的编辑会话刻意活在 shell 之上，避免跨紧凑断点时丢失 |
| `app/open-project.tsx:4` | `OpenProjectScreen`（`screens/open-project-screen.tsx:26`） | 添加/选择项目。无 host 前缀的全局版 |
| `app/h/[serverId]/open-project.tsx:5` | 无 | `:6` 标注 `COMPAT(hostOpenProjectRoute)`，直接重定向到全局版 |
| `app/sessions.tsx:4` | `SessionsScreen`（`screens/sessions-screen.tsx:63`） | 历史会话列表，带搜索（`:24` 200ms 防抖）与 host 过滤 |
| `app/h/[serverId]/sessions.tsx:4` | 无 | `:5` 标 `COMPAT`，重定向到全局版 |
| `app/schedules.tsx:4` | `SchedulesScreen`（`screens/schedules-screen.tsx:55`） | 定时任务 |
| `app/welcome.tsx:3` | `WelcomeScreen`（`components/welcome-screen`） | 首个 host 配对前的欢迎页 |
| `app/pair-scan.tsx` | 内联相机页 | 扫码配对 |
| `app/settings/index.tsx:8` | `SettingsScreen view={{kind:"root"}}` | `:11-13` 宽屏直接重定向到 `general` 分节，紧凑布局才渲染根视图 |
| `app/settings/[section].tsx` | `SettingsScreen view={{kind:"section", section}}` | 宽屏设置分节；`isSettingsSectionSlug` 校验 slug（`:13`） |
| `app/settings/hosts/[serverId]/index.tsx:4` | 无 | `:9` 无 serverId 回设置根，`:12` 否则重定向到 `connections` 分节 |
| `app/settings/hosts/[serverId]/[hostSection].tsx:7` | `SettingsScreen view={{kind:"host", serverId, section}}` | `:11` `normalizeHostSectionSlug` 兜底到 `connections` |
| `app/settings/hosts/[serverId]/projects/index.tsx` / `[projectId].tsx` | `ProjectSettingsScreen`（`screens/project-settings-screen.tsx:101`） | 项目级设置；`project-settings-screen.tsx:94` 的 props 带 serverId + projectId |
| `app/settings/hosts/[serverId]/plugins/[pluginId]/[screenId].tsx:7` | `SettingsScreen view={{kind:"plugin",…}}` | 插件贡献的设置页 |
| `app/h/[serverId]/settings.tsx:5` | 无 | 旧路径重定向 |
| `app/h/[serverId]/plugin/[pluginId]/[surfaceId].tsx`、`…/[contributionKind]/[contributionId].tsx` | 插件 surface | 插件贡献的工作区内表面（注册在 host 栈 `h/[serverId]/_layout.tsx:41-42`） |
| `app/projects-screen` 无独立路由 | `screens/projects-screen.tsx:24` | 只被设置侧栏渲染：`ProjectsScreen({serverId})` 是 props 组件不是 route |

值得记的一条结构决定：**设置的所有层级共用一个 `SettingsScreen`**，靠 `view` 判别联合切换内容（见下节），而不是每个分区一个 screen 文件。

### 1.3 路由模型

**路由是文件路径 + 路径参数**，没有独立的路由表。所有 URL 由 `utils/host-routes.ts` 的 builder 生成（`:349` `buildHostWorkspaceRoute`、`:375` `buildHostAgentDetailRoute`、`:423` `buildSessionsRoute`、`:427` `buildSchedulesRoute`、`:431` `buildOpenProjectRoute`、`:464` `buildNewWorkspaceRoute`、`:546-582` 设置系列），反向解析在 `:254` `parseServerIdFromPathname`、`:267` `parseHostAgentRouteFromPathname`、`:290` `parseHostWorkspaceRouteFromPathname`。工作区 id 是**不透明串**，进路径前 `encodeWorkspaceIdForPathSegment`（`:190`）编码、出路径 `decodeWorkspaceIdFromPathSegment`（`:202`）解码。

**栈的渲染由 `navigation/themed-stack.tsx` 统一包一层**。`ThemedStackBase:36-42` 的 `screenLayout` 给每个 screen 内容套 `AppearanceStyleBoundary`，`:43` 注释说明这是为了让主题切换只 remount screen 内容、不动 navigator 与 screen 容器；`nestedNavigatorScreens`（`:13`、`:37-41`）是例外名单——内容本身是另一个 navigator 的路由不再套，否则会把子 navigator 一起 remount。根栈的名单就是 `h/[serverId]`（`app/_layout.tsx:885`）。屏幕选项统一 `headerShown:false, animation:"none"`（`app/_layout.tsx:881-884`、host 栈 `:8-11`），并用 `Stack.Protected guard={storeReady}`（`app/_layout.tsx:895`）把「store 未就绪」表达成「这些路由还不存在」，而不是让它们各自去判空。

**设置导航**用判别联合表达，不用 query：`navigation/settings-navigation.ts:13` 的 `SettingsView = plugin | root | section | host | project` 五个变体，由各 route 文件从路径参数构造。`returnFromSettings:28-41` 定义返回语义——`root` 优先回到上次工作区，回不去才 `replace` 到 open-project；其余按 kind 算出父路由再 `dismissTo`，所以设置页的返回是**弹栈**不是重算路由。

**`agent-route-resolution` 的「解析中」为什么必须存在**：`app/h/[serverId]/agent/[agentId].tsx` 收到的 URL 只有 `serverId + agentId`，而工作区屏幕需要 `workspaceId`。这个映射要向 host 查（`screen` 的 `lookup` 字段），查之前无法决定渲染什么。`navigation/agent-route-resolution.ts:11-20` 把结论做成一个穷举的判别联合，`resolveAgentRoute:22-51` 按优先级短路：

| 条件 | 结果 | 依据 |
| --- | --- | --- |
| serverId 或 agentId 为空 | `invalid` | `:26-28` |
| 缓存里有 workspaceId | `resolved` | `:30-33`（先归一化 `normalizeWorkspaceOpaqueId`） |
| host 不在线 | `waitingForHost`（带 connectionStatus） | `:35-37` |
| 查到但 workspaceId 为空 | `notFound` | `:39-44` |
| 查询报错 | `lookupError`（带 error） | `:46-48` |
| 其余（查询在飞） | `fetchingAgent` | `:50` |

只有 `waitingForHost | fetchingAgent | lookupError` 三个 kind 有对应视图（`agent-route-resolution-view.tsx:13-15` 的 `VisibleAgentRouteResolution`）。这一层的价值是：离线不是错误、查不到不是错误，「重试」按钮只在真的失败时出现（`:52` 分支），主机连不上时给的是「打开主机管理」而不是重试（`:26` 收 `onManageHost`，`:101` 那个按钮绑到它）。

**跨 host 跳工作区要 pop 而不是 push**。`navigation/workspace-route-navigation.ts` 记了两个模块级常量（`:13` `ROOT_HOST_ROUTE_NAME = "h/[serverId]"`、`:14` `HOST_WORKSPACE_ROUTE_NAME`）和一个模块级 `pendingIntent`（`:26`）：导航容器还没 ready 时先把意图挂起，`registerWorkspaceRouteNavigationRef:28-43` 在 `ready` 事件里 flush。`findStackWithMountedRouteName:50-100` 递归找「已经挂载了目标 route 的那个栈」，找到且焦点不在 host 根路由时，`:106-141` 直接 dispatch `POP_TO` 回到 host 根；`:134-137` 注释点明 `pop: true` 是为了不把 React Navigation 的 `?pop=true` URL 痕迹留给浏览器路由规范化器。找不到就退回 `deps.dismissTo`（`:160`）。结果是：在同一 host 内反复切工作区，栈不会越堆越深。

### 1.4 命令面板：贡献式注册

这是本项目完全没有的能力，重点写组织方式。

**注册项**（`command-center/contributions.ts`）分两类 presentation（`:20-36`）：`action`（`title` / 可选 `subtitle` / 可选 `sectionTitle` / 可选 `icon` / 可选 `shortcutKeys`）和 `choice`（`path: readonly [string, ...string[]]` / `icon` / `selected` / `testId`）。共有的基座是 `CommandCenterContributionBase:10-17`：`id`、`group`、`groupRank`、`rank`、`keywords`、`visibility`（`"always"` 或 `"query"`）、`run()`。`choice` 的语义是「一行可勾选的状态」，`action` 是「一行可点的动作」。

**注册表**（`registry.ts`）的三个机制：

1. **owner = (sourceId, token)**（`contributions.ts:45-48`）。`sourceId` 命名空间化 id（`registry.ts:22` 拼成 `` `${sourceId}:${id}` ``），`token` 是 Symbol 世代标记。`replace:76-92` 与 `remove:93-98` 都要求 token 匹配才生效——迟到的 effect cleanup 不会误删新一代注册。
2. **快照 = 不可变数组**。`publish:49-69` 每次重建 contributions 数组、查重（`:57-59` 命中就 throw）、按 `compareContributions:26-31` 排序（groupRank → group 字典序 → rank → id），然后 `sameContributions` 比引用；没变就**不通知监听者**。`useSyncExternalStore`（`provider.tsx:31-34`）消费它。
3. **按 enabled 开关**。`provider.tsx:36-58` 的 `useCommandCenterActions({sourceId, enabled, actions})`：`enabled` 为假时 `remove(owner)`，effect 清理时也 `remove(owner)`。所以「当前没有 agent」这件事不需要贡献项自己判断。

**谁贡献什么**：

| 模块 | 注册点 | 内容 |
| --- | --- | --- |
| 根 | `CommandCenterRootActions`（`root-registration.tsx:110`，挂在 `app/_layout.tsx:604`） | 全局动作：加项目（`:140`）、新建工作区（`:160`，`visibility:"always"`）、导入会话（`:186`）、home、sessions、schedules、快捷键、设置、分组切换等。`:121-122` 注释说明 `useSidebarViewStore` 用窄 selector 是故意的——整店订阅会在 host 过滤每次协调时重注册全部根动作 |
| 分组切换 | `buildGroupingContribution`（`root-contributions.ts:19`） | 一个 contribution 同时切换 `project`/`status` 两种模式。`:18` 注释：标题**永远写你不在的那个模式**（`groupByStatus` / `groupByProject`），所以它不可能读起来像一个空操作 |
| 工作区 | `useWorkspaceCommandCenterActions`（`workspace-registration.tsx:164`，挂在 `app/_layout.tsx:605`） | `buildWorkspaceCommandCenterContributions`（`workspace-contributions.ts:574`）产出 tab 导航（`:266` 上一个/`:275` 下一个/`:284` 关当前/`:296` 重命名/`:351` 关左侧…）、pane 操作（`:398` 右分屏、`:416-445` 焦点四向、`:448-477` 移动 tab 四向、`:480` 关 pane）、新建（`:536` agent / `:550` terminal / `:562` browser）、工作区管理（`:594` 置顶、`:609` 重命名、`:619` 复制路径、`:634` 复制分支、`:649` 显示 setup、`:668` 切换 Explorer、`:686` 切换专注模式） |
| Agent 控件 | `useAgentControlCommandCenterActions`（`agent-control-registration.tsx:83`，按 agent 挂载） | `buildAgentControlContributions`（`agent-control-contributions.ts:306`）把模型、思考档、模式、plan、fast 变成 `choice` 组。`:17-23` 的 `GROUP_RANK`（1 / 1.1 / 1.2 / 1.3 / 1.4）就是排序。`:115-138` 的 `buildContributions` 把「组 × 选项」展平成 contribution，`run` 里带 `if (!choice.selected)` 守卫，已选中的项点了不做事 |
| 插件 | `PluginCommandCenterActions`（`app/_layout.tsx:606`） | 插件贡献 |

这些 contribution 都不直接执行副作用，而是 `keyboardActionDispatcher.dispatch({id, scope})`（`workspace-contributions.ts:272` 等）或调 store 动作。命令面板是**同一个动作的第二入口**，不是唯一入口——所以快捷键和菜单行为不会分叉。

**排序与过滤**（`command-center/results.ts`）：

- `scoreSearchFields:142-150` 把匹配分成两级：`visible` 字段（用户看得见的文字）命中算 `fieldRank 0`，只命中 `hidden`（keywords）算 `1`（`:8-13`）。**先比命中了哪些字段，再比匹配质量**（`compareCommandCenterScores:28-30`）。
- 匹配按 token 走，每个 token 必须在某个字段里出现；`:131-140` 注释说明这样 token 顺序无关，且只可能扩大结果集。子序列匹配限制在单个词内，所以 `lbl dsgn` 能找到 "Label as Design"，`labdes` 不能跨词拼。
- `buildContributionSections:235-291`：无 query 时**完全不重排**，保留注册表顺序（`:279-280`）；`visibility:"query"` 的项在无 query 时被跳过（`:243`）。有 query 时按分数排，组取最高分（`:266-268`）。
- 内建行（workspace / agent / file）走 `filterAndRankBuiltInResults:215-233`，**空 query 直接取前 5**（`:204` `DEFAULT_CATEGORY_RESULT_LIMIT`），由调用方给的 `tiebreak` 决定同分次序（`:210-213` 注释：等待输入的 agent 因此排在同样匹配的空闲 agent 前面）。
- 分区有 band：贡献分区 band 0，钉住的内建分区 band 1（`:4-7`），`compareResultSections:186-196` 先比 band 再比分。
- `projectCommandCenterRows:294` 把 section 摊平成行 + 累积 offset；`preserveActiveResultId:336` / `moveActiveResultId:344` 处理高亮项在重排后的存活与上下移动。

**作用域切换**只有两态：`keyboard-shortcuts-store.ts:6` 的 `CommandCenterScope = "files" | null`。`command-center.tsx:290-295` 在 `scope === "files"` 时**只**显示文件结果，否则把贡献区、文件区、内建区顺序拼接。文件搜索是异步的（`:258` 仅在 `scope==="files"` 或有 query 时启用 daemon 搜索），所以注释（`:270-272`）说明文件行没有客户端分数，排序靠别的手段。

### 1.5 侧栏导航模型

`sidebar-nav/model.ts` 把「侧栏顶部/底部的固定入口」建模成**有序、可隐藏、可持久化的项列表**，而不是硬编码的 JSX。

**建模**（`model.ts:10-13`）：两个 section（`header` / `footer`），每个 section 的内建项 id 及其默认顺序写死在 `BUILTIN_SIDEBAR_ITEM_IDS` 里——`header` 是 `["new-workspace","history","search","schedules"]`，`footer` 是 `["usage"]`。`SidebarNavItem`（`:39-42`）是 `BuiltinSidebarNavItem`（`kind/key/id/visible`）与 `PluginSidebarNavItem`（`kind/key/group/visible`）的联合；插件组和内建项**共用一个序列**，所以插件入口可以被用户拖到内建项之间。持久形状只有两字段（`:20-23`）：

```ts
interface SidebarNavPreference { key: string; visible: boolean }
```

数组顺序即显示顺序。key 用 `plugin:${pluginId}:${contributionId}`（`:79-82`），内建项的 key 就是它自己的 id——两类因此可以放在同一份偏好数组里。

**这一点要修正任务描述里的说法**：`model.ts` 里**没有**图标字段和徽标字段。图标来自渲染侧的 id→组件映射 `BUILTIN_ROWS`（`components/sidebar/sidebar-nav-rows.tsx:61`，按下标 `<Row key={item.key}>` 选组件，图标在 `SidebarNewWorkspaceRow` 这类组件里以 `icon={Plus}` 传下去，`:105`）。文案来自 `BUILTIN_LABEL_KEYS`（`model.ts:43-49`），快捷键徽标来自 `BUILTIN_SHORTCUT_ACTIONS`（`:60-66`）——`:53-59` 注释说明侧栏行和设置里的 Appearance 行都从这里读，两处不会对某个快捷键属于哪个项产生分歧。默认可见性由 `HIDDEN_BY_DEFAULT`（`:72`，当前只有 `usage`）决定。

**解析算法** `resolveSidebarNavItems:93-136`：先按 preferences 的顺序放「当前可用的」键（插件组在 `groupsByKey` 里就放插件项，否则若是本 section 的内建 id 就放内建项），再把没被 preferences 提到的内建项按默认顺序补上，最后把没被提到的插件组补上。**关键在写回**：`toPreferences:143-166` 让「已解析的项在前，暂时不可用的旧键（如断连插件）在后」，`:139-141` 注释写明原因——否则一次无关的编辑会把用户暂时看不见但仍想保留的项抹掉。`setSidebarNavItemVisible:169-179` 与 `moveSidebarNavItem:181-195` 都过 `toPreferences` 返回，移动只在数组内做 splice，边界直接返回原状。

**持久化与可见性**：`use-sidebar-nav-items.ts:14-17` 把 section 映射到 `AppSettings` 的两个字段（`header→sidebarNavItems`、`footer→sidebarFooterItems`），`:35-38` memo 解析，`:40-72` 的两个回调都走 `updateSettings(current => …)` 并在 updater 里**重新解析一次**再改，保证并发写不会基于陈旧 items。消费者三处：`sidebar-nav-rows.tsx:41`（header 渲染）、`left-sidebar.tsx:480`（footer）、`settings/sidebar/sidebar-nav-section.tsx:158`（设置里的开关与上下移）。`sidebar-nav-rows.tsx:42-44` 记了一条渲染规则：全部隐藏时连分组边框都不渲染。

侧栏里另外三件持久化的事，分属三个 store：

| store | 存什么 | 键与版本 |
| --- | --- | --- |
| `sidebar-order-store.ts` | `projectOrder`、`pinnedWorkspaceOrder`、`workspaceOrderByProject`（`:7-17`） | `"sidebar-project-workspace-order"`，version 1，`:181-191` |
| `sidebar-collapsed-sections-store/index.ts` | `collapsedProjectKeys`、`collapsedWorkspaceGroupKeys`、`collapsedPinned`（`state.ts:3-7`） | `"sidebar-collapsed-sections"`，`serializeCollapsedProjects` 落盘（`index.ts:41`），`merge` 合并（`:42-43`） |
| `sidebar-view-store.ts` | 分组模式、host 过滤、标签过滤（`:24` `SidebarGroupMode`、`:46-52` 持久 schema） | `"sidebar-view"`，version 7（`:9`），`migrateSidebarViewState` 处理旧 `hostFilter` 单值 |

`sidebar-order-store.ts:60-65` 的注释值得抄：view key 内嵌项目路径，路径以空格结尾会产生一个 trim 之后永远匹配不上的 key，于是「写入 → 认为缺失 → 再写」的死循环；所以 `dedupeKeys:66-79` **去重和去空但不 trim**。

### 1.6 面板注册表

新增面板要改的地方，正好说明这套模型分了几层。

**第 1 层 · manifest（纯数据，`panels/panel-manifest.ts`）**。`PanelManifest:25-35` 声明 `kind`、`supportedHosts`（`main` / `explorer`，`PaneHost:4`）、`showCloseButton`、`singleton`、`compactSheet`、`resourceKey(target)`。`manifests:43-158` 是一个 `satisfies PanelManifestByKind` 的字面量表，key 必须覆盖 `WorkspaceTabTarget["kind"]` 全部变体——**新增 kind 时编译器会先报错**。

三个由 manifest 派生的行为函数：

- `panelSupportsHost:167-172`：`host === "sheet"` 时看 `compactSheet !== null`，否则查 `supportedHosts`（`:27` 注释：sheet 从不出现在列表里，能在 sheet 渲染等价于有 `compactSheet` 规则）。
- `panelCanLaunchInPane:181-183`：singleton 且同 pane 已有该 kind 时拒绝。`changes_tree` 与 `files` 标了 `singleton: true`（`:97`、`:105`）且 `supportedHosts:["explorer"]`。
- `panelResourceKey:188-191`：返回 `` `${target.kind}:${manifest.resourceKey(target)}` ``。**这是「同一个东西」的判定标准**，见后文。

`compactSheet` 可以是常量，也可以是函数（`CompactSheetRule:17-24`）：`agent` 用函数（`:60-66`）——工作区根 agent 留在 tab 条里（`null`），其他 agent 在紧凑布局下开成 sheet 且 `openAsTab:true`。函数签名收一个 `PanelTargetFacts`（`:13-15`，目前只有 `isWorkspaceRootAgent`），注释（`:11-12`）说明这些事实住在布局之外、由工作区惰性解析。

**第 2 层 · registry（kind → 实现，`panels/panel-registry.ts`）**。`PanelRegistration:38-45` = manifest + `component` + 可选 `presentation` + `useDescriptor(target, context)`。`definePanel:75-90` 强制二选一：要么给 `presentation`（静态 label/subtitle/tooltip/icon，`:31-37`），要么给 `useDescriptor`（动态，如 agent 面板的运行中状态与状态色桶）；两个都不给会 `invariant` 失败（`:81`）。`PanelDescriptor:16-23` 是渲染侧真正消费的东西：`label / subtitle / tooltip / titleState("ready"|"loading") / icon / statusBucket`。

注册是**惰性**的：`ensurePanelsRegistered`（`register-panels.ts:21-38`）用一个 `panelsRegistered` 布尔做幂等，调用点在消费侧 4 处——`workspace-pane-content.tsx:59`、`workspace-tab-presentation.tsx:55`、`sheet-tabs.tsx:163`、`workspace-tabs/launcher/index.tsx:110`。

**第 3 层 · 面板状态**。`pane-context.tsx:11-26` 的 `PaneContextValue` 是面板与布局之间的唯一通道：`serverId / workspaceId / host / tabId / target / state / fileNavigationRevision`，加一组动作 `openTab / openPreferredTarget / openTargetToSide? / closeCurrentTab / retargetCurrentTab / setCurrentTabState / openFileInWorkspace / openImportSheet`。面板自己的局部状态走 `usePanelState`（`panels/use-panel-state.ts:6-18`）：**一个 zod schema + 默认值**，存到 pane 的 `state`（随 tab 持久化），解析失败回落到默认值。

**新增一个面板要改的完整清单**：
1. `workspace-tabs/model.ts:36-53` 的 `WorkspaceTabTarget` 联合加变体；
2. `stores/workspace-layout-storage.ts:12-62` 的 `WorkspaceTabTargetStorageSchema` 加 zod 变体（strict schema，不加会静默丢字段导致布局被重置）；
3. `panels/panel-manifest.ts:43` 的 `manifests` 加条目；
4. `panels/xxx-panel.tsx` 写组件 + `definePanel` 导出 registration；
5. `register-panels.ts:23-37` 加一行 `registerPanel`。

**怎么渲染**：宿主与面板实现解耦。`workspace-panel-host.tsx` 只认 descriptor，不知道具体面板；`workspace-pane-content.tsx:60-64` 才 `getPanelRegistration(tab.kind)` 取组件。

**宿主契约里有一条常驻上限**：`workspace-panel-host.tsx:110-115` 把 `cap: 3` 传给 `useMountedTabSet`，另有 `retainedTabIds` = `useModifiedPanelTabIds`（`:104-108`）。即**每个 pane 最多常驻 3 个面板实现，但被改过的 tab（`panel-instance-attributes.ts:11-14` 的 `modified` 标记）永不卸载**——否则用户正在编辑的编辑器会被 LRU 踢掉。

### 1.7 工作区布局持久化

**存的东西**。`stores/workspace-layout-actions.ts:15-35` 定义树：`SplitPane{id, tabIds, focusedTabId, hidden?}` / `SplitGroup{id, direction, children, sizes}` / `SplitNode` 二选一 / `WorkspaceLayout{root, focusedPaneId, parentTabIdByTabId?}`。`parentTabIdByTabId` 记的是「谁链出了我」，用于紧凑布局下 sheet 的层级栈。

store 的完整状态面在 `stores/workspace-layout-store.ts:126-214`（接口），其中**进内存但不落盘**的有：`sheetsByWorkspace`（`:135` 注释：刷新后回到 tab 条）、`layoutMode`（`:128`，由 app shell 一次性发布）、`hiddenAgentIdsByWorkspace`、`focusRestorationByWorkspace`。**落盘**的是这些（`:2123-2146` 的 `partialize`）：

`layoutByWorkspace` / `pinnedAgentIdsByWorkspace`（Set→Array）/ `splitSizesByWorkspace` / `explorerSidebarWidthByWorkspace` / `explorerPaneIdByWorkspace` / `sidePaneIdByWorkspace` / `pullRequestTabAutoOpenedByWorkspace`。

**怎么存**。名字 `"workspace-layout-state"`（`:2118`），version 2（`:226`），存储是 `createValidatedPersistStorage(AsyncStorage, WorkspaceLayoutPersistedStateSchema)`（`:2120`）——**zod 严格校验的 persist**，校验不过整份丢弃（`:2148-2151` 返回 `currentState`）。schema 在 `workspace-layout-storage.ts`，含 `:40-44`、`:102-114` 若干条 `COMPAT` 字段：旧版字段照收不误，注释（`:106-107`）点明持久键名**不能改名**——schema 是 strict，改名会让所有既有 blob 校验失败并连带清空它描述的布局。

`merge:2147-2200` 是真正的恢复逻辑：逐 workspace `stripEphemeralTabsFromLayout`（`:2161`）先扔掉易失 tab，再 `restoreWorkspaceLayout`（`:2160`）归一化树，再 `ensurePersistedExplorerSidebarPane`（`:2168`）补回 Explorer pane。`partialize:2123-2131` 落盘前同样先 `normalizeLayout` + `stripEphemeralTabsFromLayout`，`:2126-2127` 注释：commit diff tab 指向的是 rebase 后的 sha，留到下次打开就是错的，所以宁可丢弃。

**谁负责写**。`workspace-layout-actions.ts` 是纯函数层——`normalizeLayout:1024`、`findPaneById:1052`、`findPaneContainingTab:1069`、`collectAllTabs:1091`、`collectAllPanes:1099`、`openTabInLayoutFocused:1431`、`revealTargetInLayout:1459`、`closeTabInLayout:1521`、`splitPaneInLayout:1915`、`reconcileWorkspaceTabs:2429` 等，全部 `(input) => 下一份布局 | null`，不碰 store。`workspace-layout-store.ts` 是唯一持久的写入者（`createWorkspaceLayoutStore:942`）。`workspace-layout-constants.ts` 只有一行 `MIN_SPLIT_SIZE = 0.1`；`workspace-layout-ids.ts:14-17` 是 id 生成源（`crypto.randomUUID` 优先，降级 `Date.now()-random`），**id 生成被抽成可注入的 `WorkspaceLayoutIdSource`**，为的是测试里能拿到确定 id。

### 1.8 标签与视图打开路径：「一个对象可在多处打开」

这题的核心是 paseo 把「打开」拆成了四个独立问题，各由一个文件回答。

**问题 1：这个 target 和已有的哪个 tab 是同一个东西？**
判定函数 `findExistingTabForTarget`（`workspace-layout-actions.ts:1402-1408`）不比 target 字段，比 **`panelResourceKey`**——也就是「kind + 该 kind 的身份字段」（`agent` → agentId，`file` → path，`plugin` → `pluginId:panelId:agentId`，见 `panel-manifest.ts:143-147`）。新 tab 的 id 也由此**确定性地**生成（`buildDeterministicWorkspaceTabId`，`workspace-tabs/identity.ts:194`；`new_tab` 因为没有身份而显式 throw，`:195-197`）。

**问题 2：已经开着的时候，新的一次「打开」该干什么？** 三个 intent（`workspace-layout-store.ts:100` `WorkspaceTabOpenIntent = "new" | "reveal" | "background"`）：

| intent | 语义 | 位置 |
| --- | --- | --- |
| `new` | 永远新建一个独立 tab 实例 | `createTabInLayout:1453-1456` 注释就写着 "Always allocates an independent tab instance" |
| `reveal` | 找等价 target，找到就带到用户眼前，找不到才建 | `revealTargetInLayout:1458-1475` |
| `background` | 找等价 target 并更新它的 target，**不切焦点**；没有才建且 `focus:false` | `openTabInLayoutBackground:1502-1519` |

**问题 3：找到了已经开着的 tab，要不要把它搬到新位置？** 这是 `placement` 的全部内容，`workspace-layout-actions.ts:115-126` 的四态：

- `{mode:"pane", paneId}` —— 「pane 局部操作」：新 tab 开在这里，**已有 tab 也搬过来**（`:116-117`）；
- `{mode:"prefer", paneId}` —— 「隐式打开」：新 tab 开在这里，**已有的留在用户放的地方**（`:118-119`）；
- `{mode:"focused"}` —— 用户正在焦点 pane 里工作；
- `{mode:"ambient"}` —— 没有用户参与（reconcile 之类）。

`:105-114` 的注释解释了 `pane` 与 `prefer` 的区别为什么必须存在：从某个 pane 的 `+` 菜单打开 Changes，是断言「放在这里」；agent 输出里的文件链接只是对新 tab 有意见，**绝不能把用户特意挪过去的 tab 拽走**。`revealExistingTab:1477-1500` 就是这条规则的执行点——只有 `mode === "pane"` 才可能迁移，否则一律 `focusTabInLayout`。

**问题 4：谁来调这些？** `workspace-tabs/open-beside.ts` 把它包成四个语义入口：

- `openPreferredWorkspaceTarget:87-97` —— 读「这个来源偏好在主区还是侧区」的持久偏好（`preferences[source]`），再转 `openWorkspaceTargetAtLocation`；
- `openWorkspaceTargetAtLocation:99-127` —— 显式指定位置。`:110` 只有 `layoutMode === "split-panes"` 时侧区才存在（`canOpenBeside:40-43`）；`:112-114` 侧区打开且该 target 尚不存在时才 `ensureSidePane`；`:115-119` 否则若给了 `parentTabId` 就落到**那个 tab 所在的 pane**，而不是当前焦点 pane；
- `openPreferredWorkspacePreview:129-182` —— 从树里选东西时复用目的地 pane 里那个「未被修改的预览」。`canReplacePreview:66-85` 限死可替换条件：`working_diff` 只能替换 `working_diff`；`file` 只能替换 `file` **且该 tab 未被标记 modified**（`:79-83` 读 `getPanelInstanceAttributes(...).modified`）。sheet 是天然单槽，不需要预览 tab（`:140-146`）；
- `openWorkspaceTargetBeside:184-202` —— 用户显式「在侧边打开」。没有分屏时退化成普通打开（`:190-192`）。

`workspace-tabs/open-supporting-view.ts` 在这之上定义「语义目的地」：`openWorkspaceChanges:42-54`（紧凑布局 → Explorer 视图 `changes`，否则按 `diffs` 偏好开 `working_diff` target）、`openComposerChanges:56-63`（composer 里的 Changes 只做 reveal，不抢焦点）、`openWorkspacePullRequest:65-76`、`autoOpenWorkspacePullRequest:78-120`（后台加一次 PR tab，`placement` 由回调惰性求值——`:87-91` 说明已经存在 PR tab 就返回 `{}`，所以检测逻辑永远不会把用户留下的 tab 重新定位）。

**「一个对象可在多处打开」的三个配套机制**：

- **deck / retention**（`screens/workspace/workspace-deck-retention.ts`）解决「多个工作区同时挂着」。`WORKSPACE_DECK_MAX_MOUNTED_WORKSPACES = 10`（`:3`）、`WORKSPACE_DECK_INACTIVE_TTL_MS = 10 分钟`（`:4`）；`resolveWorkspaceDeckRetentionLimit:10-12` 在原生端把上限压到 1。`reconcileRetainedWorkspaceSelections:69-113` 的规则：活动项永远排第一且 `inactiveSince: null`（`:94-96`）；非活动项首次见到就打上时间戳（`:102`），超过 TTL 丢弃（`:103-105`）。`getNextWorkspaceDeckExpirationDelay:115-138` 让调用方能排一个定时器而不是轮询。`orderWorkspaceSelectionsForStableRender:140-146` 按 key 排序只为稳定渲染。`shouldKeepWorkspaceDeckEntryMounted:161-173`：workspace 列表还没 hydrate 时**一律保持挂载**——否则切过去的瞬间会闪空白。
- **retention（tab 级）** 解决「一个 pane 里太多 tab」。`use-mounted-tab-set.ts:31-51` 的 `deriveMountedTabLru` 顺序：活动 tab → `retainedTabIds`（被改过的）→ 上一次 LRU 的其余项，上限 `cap`。`useLayoutEffect:72-74` 才提交新的 LRU，避免渲染中途就丢掉上一个。
- **bulk-close** 解决「一次关一批，但有的关是真删除、有的只是关视图」。`workspace-bulk-close.ts:5-11` 的分类：`archiveAgentTabs`（要归档 agent）/ `layoutOnlyAgentTabs`（子 agent，只关布局）/ `terminalTabs`（要杀终端）/ `otherTabs`。`classifyBulkClosableTabs:52-81` 按 target.kind 分派，`resolveAgentCloseKind` 决定 agent 归哪一类。`buildBulkCloseConfirmationMessage:83-121` 按「哪几类非空」七选一拼句子，措辞由 `BulkCloseConfirmationLabels` 注入（`:12-24`，默认英文文案在 `:22-37`）。执行 `closeBulkWorkspaceTabs:123-188` 的顺序很重要：先关 layout-only tab（`:135-148`，每个独立 try），再把归档/杀终端**合并成一次 daemon 调用**（`:150-158` `client.closeItems`），最后 `Promise.all` 关所有布局 tab。

**agent tab 的自动开合**在 `workspace-tabs/agent-visibility.ts`：`deriveWorkspaceAgentVisibility:17-48` 分出 `activeAgentIds`（未归档且属于本工作区）与 `autoOpenAgentIds`（其中还是工作区根 agent 的），两者作为 `WorkspaceTabSnapshot`（`:50-69`）交给 `reconcileTabs`。`shouldPruneWorkspaceAgentTab:93-107` 的注释是关键一条：`agentsHydrated` 为 false 时**不剪**，否则首帧会把所有 agent tab 当成孤儿删掉。

**tab 条的宽度算法**在 `screens/workspace/workspace-tab-layout.ts:55-108`（几何数值见 ui-patterns 文档，这里只记行为）：先算可用宽度与 tab 固定开销，`:79-81` 若连「每个 tab 都压到最小宽」都放不下则**全部置最小宽并置 `requiresHorizontalScrollFallback: true`**，否则按比例压缩到最小宽（`:82-91`），最后每项的 `showLabel = width > tabChromeWidth`（`:101`）——放不下文字时只留图标。`retainWorkspaceTabMeasuredWidth:33-39` 对测量值做 1px 容差抖动过滤，避免拖拽手柄抖动。

**Explorer 侧栏本身也是一个导航容器**（`workspace-tabs/explorer-sidebar.ts`）：三个视图 `changes | files | pr`（`:10`），每个映射到一个 tab target（`:13-17`）。`resolveExplorerSidebarPresentation:26-33` 按形态返回 `overlay`（紧凑）/ `dock`（宽但不能分屏）/ `pane`（能分屏）；`usesCompactExplorerSidebar:35-38` 就是 `!== "pane"`。同一个 Changes 入口因此在三种形态下落到三个不同地方。

### 1.9 工作区选择与恢复

**上次工作区**存的是不透明选择 `{serverId, workspaceId}`（`stores/last-workspace-selection.ts:3-6`），键 `"paseo:last-workspace-route-selection"`（`:8`），schema 是 strict 且两字段都 `trim().min(1)`（`:18-21`）。`createLastWorkspaceSelectionStore:37` 是**手写的外部 store**（`listeners` 集合 + `revision` 计数），不是 zustand——因为它要在路由层早于任何 React 树的地方可用。`remember:50-66` 有两处细节：`:64` 注释明确「workspaceId 是不透明的，不要把这个持久值解析回路径」；`:65` 写盘失败静默（`.catch(() => {})`）。`hydrate:68-94` 用 revision 快照判断「读盘期间有没有被写过」——有就不覆盖内存值；读到的值校验失败则 `storage.clear()`（`:78-80`）。

`stores/navigation-active-workspace-store/index.ts` 是它的 React 门面：`useActiveWorkspaceSelection` 从 pathname + params 现场解析（`navigation.ts:70-83` `parseActiveWorkspaceSelection`：先试路径解析，只在 pathname 是 `/` 时才回退到 query 参数，`:78-80`）。`navigateToWorkspace:85-130` 里有一处延迟：`shouldDeferAgentOpen:94-96`——目标 workspace 还没在会话 store 里解析出来、或布局还没 hydrate 时，**先不预热 agent tab**，否则会写进一个错误的 workspaceKey。

**归档**是「关掉一个工作区」的两段式：`workspace/workspace-archive.ts:82` `archiveWorkspaceOptimistically` / `:103` 归档多个；返回类型里有 `WorkspaceArchiveFailure`（`:23`）。批量归档前先逐个做风险确认：`workspace/project-workspace-archive.ts:19-42` 对 `workspaceKind === "worktree"` 的项调 `confirmRiskyWorktreeArchive`，用户拒绝的那条直接不进 `confirmed` 列表——确认是**逐个**的，不是「全有或全无」。

**恢复**只取文件名与导出符号：`workspace-recovery/model.ts` 的 `WorkspaceRecoveryModel:14-29` 是一个七态判别联合（`idle / checking / needsHostUpgrade / recoverable{phase:ready|restoring|failed, error} / unsupportedAction / unavailable / inspectionFailed`），`resolveWorkspaceRecoveryModel:62` 从 `enabled/connected/hasClient/hasServerInfo/supportsRecovery/inspection/restore` 推出；`SupportedWorkspaceRecoveryAction:8` 只承认 `"unarchive" | "restore"` 两种动作，其余落到 `unsupportedAction`。它和 `screens/workspace/workspace-route-state.ts:5-28` 的 `WorkspaceRouteState`（`ready / reconnecting / unreachable / loading / missing / needsHostUpgrade / archived / recoveryUnavailable / recoveryInspectionFailed`）串在一起：**路由本身有一个状态机**，不是「有数据渲染、没数据转圈」。

### 1.10 与本项目对照

| paseo 做法（路径:行） | 本项目现状（路径:行） | 影响 | 建议（方向） |
| --- | --- | --- | --- |
| 路由 = 文件树，screen 与 route 文件分离（`app/_layout.tsx:885-912`；`screens/*-screen.tsx`） | 无路由层。`Workbench.tsx:65-108` 用一个 `useState` 装全部 tab 组 | 加新页面只能加 `TabKind` 和占位组件；无法深链，无法前进后退 | 若短期内不做 URL 路由，至少把「有哪些视图」从 `TabKind:7` 的联合里抽成一份带 id 的注册表，让新视图只在一处登记 |
| 工作区布局是一棵可持久化的 split 树（`workspace-layout-actions.ts:15-35`；`workspace-layout-store.ts:2123-2146`） | `Workbench.tsx:65-108`：`groups` 纯内存；`projectGroups` 是 `useRef(new Map())`（`:70-71`），项目间切换时手动切分/合并 | 切换项目会丢分组结构；窗口刷新后一切归零 | 把 tab 组布局序列化到一个 localStorage 键（项目已有 `drafts.ts:15-26` 的 localStorage 封装可复用）；布局结构与具体 tab 内容分开存，前者长期、后者可丢弃 |
| `WorkspaceTabPlacement` 四态区分「搬过去」与「留在原地」（`workspace-layout-actions.ts:115-126`） | `TabGroups.tsx:79-93` 的 props 只有 `onActivate/onClose/onSplit/onView`，没有「打开位置」概念 | 同一材料从两个 pane 打开只能重复开 tab，没有 reveal 语义 | 先实现「同 target 复用已有 tab 并聚焦」这一条，再考虑 placement 分态 |
| `panelResourceKey` 作为「同一性」判据（`panel-manifest.ts:185-188`） | `Workbench.tsx` 里 tab 的身份是调用方给的 `id` 字符串（`TabGroups.tsx:8-14`），无统一身份函数 | 同一文件被两处打开会产生两个 id 完全不同的 tab，无法互相定位 | 定义一个 `tabIdentity(tab): string`（`reader:<fileId>` / `settings` 之类），先只用于去重 |
| 面板 manifest 强制声明 host / close / singleton（`panel-manifest.ts:25-35`，`satisfies` 保证不漏） | `TabGroups.tsx:7` 的 `TabKind` 只有 5 个值；渲染靠 `renderSettings/renderLibrary/renderPdf/renderFile` 四个可选 prop（`:85-90`） | 新增视图要改 `TabGroups` 的 props、`kindLabels`、`kindIcons`、以及 `Workbench` 的调用点，至少 4 处 | 把这四处收进一个 `TabKind → {label, description, icon, render}` 的声明表 |
| 每个 pane 最多 3 个常驻实现 + modified tab 永不卸载（`workspace-panel-host.tsx:104-115`） | 无此概念，全部 tab 同时渲染（`TabGroups.tsx:136-180`） | tab 变多后编辑器实例全部常驻 | 先给「modified」打标记（例如渲染器打开且未关闭），再谈 LRU |
| 贡献式命令面板注册表（`registry.ts:44-99`、`provider.tsx:36-58`） | 不存在。`grep` 全仓无 `CommandPalette`/`命令面板` | 所有动作只能绑在按钮上；侧栏项一多就无法检索 | 见下 |
| 侧栏导航项是「有序 + 可隐藏 + 可持久」的模型（`sidebar-nav/model.ts:93-136`、`use-sidebar-nav-items.ts:14-17`） | `ProjectNavigation.tsx:398` `ProjectNavigator` 的条目直接写死在组件树里 | 想让用户隐藏某类入口只能改代码 | 若条目数即将增长，先把「id + 可见性 + 顺序」抽成一份持久偏好 |
| 面板/工作区侧栏的折叠与顺序分别由三个 persist store 承担（`sidebar-order-store.ts:7-17`、`sidebar-collapsed-sections-store/index.ts:17-22`、`sidebar-view-store.ts:46-52`） | `Workbench.tsx:53-59` 的 `leftCollapsed / rightCollapsed / agentExpanded / leftWidth / rightWidth / dockHeight` 全是 `useState`，刷新即失 | 用户每次重开窗口都要重排 | 三区折叠状态是最容易持久化的一块（无 schema、无版本），可先落 |
| 设置用一个 screen + `view` 判别联合表达全部层级（`navigation/settings-navigation.ts:15`，`settings-screen.tsx:1081`） | 设置是 `TabKind` 的一个值（`TabGroups.tsx:7`、`Workbench.tsx:253` `openTab({id:'settings',kind:'settings'})`），只有一层 | 设置继续加深就要么继续堆组件，要么改成路由 | 现有形态下，把设置内容抽成 `SettingsSection` 注册表而非继续往一个组件里加 |
| 宽屏/紧凑用路由重定向表达（`app/settings/index.tsx:11-13`） | 无断点分化的导航表达；`Workbench.tsx` 三区固定 | 窄窗口没有替代入口 | 三区可折叠（`docs/ui-design/README.md:18-53` 已写）比响应式重定向更省事 |
| 路由状态机显式列出 9 态（`workspace-route-state.ts:5-28`） | 无对应层；`AgentDock`/`AgentOverlay` 只区分展开与否 | 断连/恢复中/不可恢复没有固定表达位 | 状态表达归 ux-state 切片，此处只记「paseo 把它挂在路由上」 |
| zod 严格校验的 persist + COMPAT 字段（`workspace-layout-storage.ts:97-115`） | 唯一的持久化是 `drafts.ts:15-26` 的 localStorage 文本，无 schema、无版本 | 布局一旦持久化，改结构就是破坏性升级 | 真要持久化布局时，从第一天就上版本号与迁移函数；paseo 的 COMPAT 字段注释（`:102-114`）是现成模板 |

**命令面板的最小可迁移路径**（本项目完全没有，建议按这个顺序拆）：

1. 先定 `Contribution` 类型（照 `contributions.ts:10-36` 的字段：`id/group/groupRank/rank/keywords/visibility/run/presentation`），但只用 `presentation.kind === "action"`，先不做 `choice`。
2. 建一个注册表，只做「按 sourceId 替换 / 按 sourceId 移除 / 订阅快照」三件事（`registry.ts:76-98` 的 `replace`/`remove` 加 `provider.tsx:31-34` 的 `useSyncExternalStore`）。`owner.token` 的世代标记在 React StrictMode 下是必需的，不是过度设计。
3. 排序只抄 `results.ts` 的两层：groupRank → rank → id（`registry.ts:26-31`），以及 visible/hidden 的 fieldRank（`:142-150`）。`Intl.Segmenter`、逐字节流那些属 agent-stream 切片。
4. 第一个贡献源选「侧栏入口」，因为它的 id 集合最小且已有清单（`sidebar-nav/model.ts:10-13`）。第二个选「设置分区」，id 来自 `settings/[section].tsx` 的 slug 集合（`utils/host-routes.ts:508`）。

注意 `root-registration.tsx:121-122` 的那条教训：贡献列表要挂在**窄 selector** 上。挂整店订阅的话，任意一次无关状态协调都会重建全部贡献项，命令面板在用户打字时会被重排。

### 1.11 未核实项

- `screens/agent/agent-ready-screen-bottom-anchor.ts` 整个 `screens/agent/` 目录只有这一个文件（导出 `RouteBottomAnchorIntent:3`、`deriveRouteBottomAnchorIntent:8`、`deriveRouteBottomAnchorRequest:25`），没有名为 `AgentScreen` 的组件。它属于 agent 路由的底部锚定逻辑，疑似归 agent-stream 切片，本节未展开 —— 具体分工 unverified，需确认。
- `workspace-tabs/launcher/`（`index.tsx` + `internal/`）是 tab 新建器的 UI（`:110` 调 `ensurePanelsRegistered`），本节未读其内部结构 —— 新建 tab 的可选项集合如何组织，unverified，需确认。
- `panels/agent-panel-descriptor.tsx` / `draft-panel-descriptor.ts` 是两个动态 `useDescriptor` 的实例，本节只引用了契约（`panel-registry.ts:36-43`）未读实现 —— descriptor 里 `statusBucket` 的取值域与渲染方如何用它着色，unverified，需确认。
- `command-center/workspace-search.ts` / `workspace-file-search.ts` / `workspace-shortcuts.ts`：只确认了它们被 `workspace-registration.tsx:52-54` 导入且 `CommandCenterScope = "files" | null`（`keyboard-shortcuts-store.ts:6`）；工作区内搜索与文件搜索各自的能力边界 unverified，需确认。
- `constants/layout.ts` 里 `supportsDesktopPaneSplits` 的判定条件（`explorer-sidebar.ts:35` 调用）未读 —— 什么宿主能力决定能不能分屏，unverified，需确认。
- **与任务简报的两处偏差，以读到的为准**：(1) `sidebar-nav/model.ts` 不含图标与徽标字段，图标在渲染侧的 `BUILTIN_ROWS` 映射（`components/sidebar/sidebar-nav-rows.tsx:61`），徽标来自 `BUILTIN_SHORTCUT_ACTIONS`（`model.ts:60-66`）；(2) 本项目无障碍语义不止 `AgentOverlay.tsx:102` 的 `role="dialog"` 与 `:118` 的 `aria-live="polite"` —— `TabGroups.tsx:141` 有 `role="tablist"`、`:147` `role="tab"`、`:150` `aria-selected`、`:177` 的拆分按钮有 `aria-label`，`:46-75` 有完整的 WAI-ARIA tabs 方向键循环；`ProjectNavigation.tsx:98` 有 `role="status"`、`:357` 有 `role="alert"`。简报里「无集中快捷键注册表」「无命令面板」「无 popover/dialog 原语」这几条本次 grep 与阅读均已复核，成立。

## 2. 会话与运行生命周期

本节只写「一次会话从建立到结束、一次运行从发送到收尾」这条线上用户能看见的行为。控件几何、色值、滚动锚点与虚拟化的实现细节不在这里，见 `docs/reference/paseo-ui-patterns.md` 第 4、6 节。

---

### 2.1 整体模型

paseo 的「会话」不是一段聊天记录，而是一个 **Agent 对象**。三层归属固定：`ProjectDescriptor`（项目）→ `WorkspaceDescriptor`（工作区／工作树）→ `Agent`（会话）。Agent 上有 `parentAgentId`，所以子任务是同一层里的另一个 Agent，而不是会话里的一个消息块（`stores/session-store.ts:100`、`stores/session-store.ts:172-181`、`stores/session-store.ts:105-130`）。

一次运行叫一个 **turn**。关键设计是：turn 的存活性（`TurnLiveness`）与 Agent 的进程状态（`AgentLifecycleStatus`）是**两套正交的状态**。Agent 可以是 `running` 但此刻没有活跃 turn（例如后台工作刚结束、或被取消正在等 daemon 确认），turn 也可以已关闭但消息还在飞。UI 因此不把「转圈」直接绑到 lifecycle status 上，而是走一层 `TurnPresentation`（`timeline/turn-liveness.ts:6-13`、`timeline/turn-liveness.ts:50-71`）。

流的内容本身是一棵**投影**：daemon 端是带 `epoch`/`seq` 游标的权威时间线，渲染层把它切成 `agentStreamTail`（近端常驻）与 `agentStreamHead`（向上分页的历史）两段物化数据（`stores/session-store.ts:402-403`）。草稿、队列、待审批三条「用户已经做但 daemon 还没确认」的状态各存在不同地方，提交成功后才与流合并——这是本节最值得抄的结构。

---

### 2.2 会话对象模型

**Agent 的字段**（`stores/session-store.ts:72-103`）：

| 字段 | 作用 | 备注 |
|---|---|---|
| `status: AgentLifecycleStatus` | 进程状态 | 枚举见下 |
| `turn: TurnLiveness` | 当前 turn 存活性 | 与 status 独立维护 |
| `parentAgentId: string \| null` | 子 agent 的父指针 | `null` 即工作区根会话 |
| `requiresAttention` / `attentionReason` | 需要用户注意 | `attentionReason` ∈ `"finished" \| "error" \| "permission"` |
| `attentionTimestamp` | 何时进入注意态 | 用于排序 |
| `pendingPermissions: AgentPermissionRequest[]` | 待审批请求 | 参与状态桶计算 |
| `currentModeId` / `availableModes` / `model` / `thinkingOptionId` | 运行参数 | 运行中可改，见第四节 |
| `runtimeInfo?: AgentRuntimeInfo` | daemon 侧实际生效的值 | 与上面的「配置值」并存，见 `stores/session-store.ts:63-69` |
| `lastUsage` / `lastError` | 上一轮的用量与错误 | 供恢复提示 |
| `archivedAt` | 归档时间 | 非空即从目录剔除 |
| `labels: Record<string,string>` | 用户标签 | 自由 KV |
| `cwd` / `workspaceId` / `projectPlacement` | 归属 | 决定侧栏分组 |
| `persistence: AgentPersistenceHandle \| null` | 落盘句柄 | 归档后可恢复 |

`AgentLifecycleStatus` 只有五个值：`initializing`、`idle`、`running`、`error`、`closed`（`packages/protocol/src/agent-lifecycle.ts:1-7`）。

**SessionState**（`stores/session-store.ts:377-439`）是「一台 daemon（serverId）下的全部会话状态」，按用途分块：

| 块 | 字段 | 性质 |
|---|---|---|
| 连接 | `client`、`clientGeneration`、`viewedTimelineSync` | 引用不参与序列化 |
| 水位 | `hasHydratedAgents`、`hasHydratedWorkspaces`、`hasWorkspaceDirectorySnapshot` | 用来决定空态还是骨架屏 |
| 流 | `agentStreamTail`、`agentStreamHead`、`agentTasks` | tail 近端 / head 历史双段 |
| 时间线游标 | `agentTimelineCursor`、`agentTimelineHasOlder/HasNewer`、`agentTimelineOlderFetchInFlight` | 每一项都是 `Map<agentId, …>` |
| 提交中 | `messageSubmissions: Map<agentId, MessageSubmissionRecord[]>` | 未被 daemon 确认的用户消息 |
| 目录 | `agents`、`agentDetails`、`workspaces`、`projects` | `agentDetails` 存不在活跃列表但仍可见的会话 |
| 排队 | `queuedMessages: Map<agentId, Array<{id,text,attachments}>>` | 运行中排队的消息 |
| 审批 | `pendingPermissions: Map<key, PendingPermission>` | 按 agent 二次索引 |

**增删改查入口**全部是 `SessionStoreActions`（`stores/session-store.ts:449-626`），只有 `set*` 一族，没有暴露原始 `set`。典型流程：daemon 目录同步用 `setAgents` / `setAgentDetails`（`stores/session-store.ts:560-567`），删除一个 agent 时 `removeFromDirectory` 一次清掉 agents / agentDetails / queuedMessages / initializingAgents / pendingPermissions / agentLastActivity，并顺带清掉该 agent 的草稿（`runtime/directory-sync/internal/agent-store.ts:153-179`）；只有实体删除才销毁流数据（`runtime/directory-sync/internal/agent-store.ts:181-191`）。

**hooks 层只覆盖工作区**：`stores/session-store-hooks/index.ts` 全部导出都是 `useWorkspace*`、`useProject*`、`useWorkspaceStructure` 一类（`stores/session-store-hooks/index.ts:36-164`），底层是 `useStoreWithEqualityFn` + `fast-deep-equal` 的相等函数表（`stores/session-store-hooks/selectors.ts:30-35`）。**没有 agent 级的 hooks 封装**——组件直接 `useSessionStore((state) => …)` 自己切 Map，例如 `composer/index.tsx:1590-1597` 直接遍历 `pendingPermissions` 判断当前 agent 是否被卡在审批上。

---

### 2.3 一次 turn 的状态机

**turn 状态只有两个 phase**（`timeline/turn-liveness.ts:6-13`）：

```
idle { cancellationRequestId: null | number }
open { turnId, startedAt, cancellationRequestId: null | number }
```

`cancellationRequestId` 不是 phase，而是叠在两态之上的一个「取消正在飞行中」标记——这样取消按钮可以显示 loading 而不必发明第三个 phase。

**迁移事件**六种（`timeline/turn-liveness.ts:15-21`，归约见 `timeline/turn-liveness.ts:102-126`）：

| 事件 | 载荷 | 效果 |
|---|---|---|
| `snapshot` | `activeTurn: ActiveTurnIdentity \| null` | 有 turn 则 open（合并 startedAt），否则 idle |
| `stream_open` | `turn: ActiveTurnIdentity` | 同上，必定 open |
| `stream_close` | `turnId: string \| null` | 回到 idle；**若传入的 turnId 与当前 open 的 turnId 不同则忽略**（`timeline/turn-liveness.ts:74-82`，用于丢弃乱序到达的旧 close） |
| `cancellation_started` | `requestId` | 写入 `cancellationRequestId`，重复 requestId 幂等 |
| `cancellation_settled` | `requestId` | requestId 不匹配则忽略，否则清空 |
| `destructive_close` | — | 无条件回 idle（会话被删时用） |

`openTurn` 对同一个 `turnId` 保留最初的 `startedAt`，对不同 turnId 重置，并把 `cancellationRequestId` 清零（`timeline/turn-liveness.ts:84-100`）。

**呈现层**（`timeline/turn-liveness.ts:50-71`）：`resolveTurnPresentation(liveness, hasActiveSubmission)` 返回 `{isActive, isCancelling, startedAt, turnId}`。phase 不是 open 时，`isActive` 退回「是否有正在提交的未确认消息」——所以「刚按了发送、daemon 还没回」这一小段窗口里 UI 已经在转圈。

**状态 → 可见表达的映射**分两级。

第一级，Agent 状态压成 5 个桶（`packages/protocol/src/agent-state-bucket.ts:22-35`），判定是**严格优先级短路**：

| 顺序 | 条件 | 桶 |
|---|---|---|
| 1 | `pendingPermissionCount > 0` 或 `attentionReason === "permission"` | `needs_input` |
| 2 | `status === "error"` 或 `attentionReason === "error"` | `failed` |
| 3 | `status === "running"` | `running` |
| 4 | `requiresAttention` | `attention` |
| 5 | 其余 | `done` |

第二级，桶到可见标记（`components/agent-status-dot.tsx:33-41` → `utils/status-dot-color.ts:19-32`）：`needs_input` 用 warning、`failed` 用 danger、`running` 用 running、`attention` 用 success、`done` 只有在 `showDoneAsInactive` 时才用 border，否则**返回 null 即不渲染**（`utils/status-dot-color.ts:29-31`）。`AgentStatusDot` 对非法 status 直接返回 null（`components/agent-status-dot.tsx:26-32`）。

同一条优先级链还有一份**折叠版**（`utils/sidebar-agent-state.ts:22-30`）：项目行折叠时 `running` 压过 `attention`，而**平铺版**（`utils/sidebar-agent-state.ts:36-42`）把 `attention` 排在 `running` 前。两份顺序刻意不同，注释写明理由。

**事实行**（`panels/agent-facts-line.ts:18-35`）把模型、思考档位、模式、上下文占用拼成一行 ` · ` 分隔的字符串，全部复用各自控件的解析函数（`resolveAgentModelSelection`、`resolveModeLabel`、`formatContextUsage`）；agent 尚无模型时整行返回 `null`（`panels/agent-facts-line.ts:27-28`）。

**turn 的分组**靠 `turnId`（`agent-stream/turn-membership.ts:7-14`）：两侧都有 turnId 时按 turnId 相等判断；缺 turnId 的老数据退回「不是 user_message 就算同 turn」的旧规则。另外有一个更宽的 `continuesResponse`（`agent-stream/turn-membership.ts:18-22`），用于「一次可见回复可以跨多个 turn」的 system 注入场景。

---

### 2.4 发送与打断

#### 3.1 提交四态

`submitAgentInput` 是唯一的提交入口，返回四种结果（`composer/submit.ts:3`）：

| 结果 | 触发 | 副作用 |
|---|---|---|
| `noop` | 内容全空且无外部内容无附件且不允许空提交（`composer/submit.ts:33-38`）；或 `canSubmit` 为假（`composer/submit.ts:40-42`） | 无 |
| `queued` | `isAgentRunning && !forceSend`（`composer/submit.ts:44-51`） | 入队；`submitBehavior !== "preserve-and-lock"` 时**立即清空输入与附件** |
| `submitted` | RPC 成功（`composer/submit.ts:53-66`） | 先清空（让时间线行与 composer 同步）→ 清错误 → `setIsProcessing(true)` → 成功后 `clearDraft("sent")` |
| `failed` | RPC 抛错（`composer/submit.ts:67-81`） | **把文本与附件原样回填**，写 `sendError` 文本，`setIsProcessing(false)` |

回填（`composer/submit.ts:68-71`）是这条路径的核心：用户输入的东西不会因为一次网络失败消失。

#### 3.2 发送键 / 取消键

- 运行中发送键**变成取消键**：`submitLoadingPressHandler = isAgentRunning ? handleCancelAgent : undefined`（`composer/index.tsx:2377`）。
- 独立的 `ComposerCancelButton`（`composer/index.tsx:1074-1110`）：图标在 `isCancellingAgent` 时从方块换成 loading spinner（`composer/index.tsx:1086-1090`），`accessibilityLabel` 随之在 `cancelingAgent` / `stopAgent` 之间切换（`composer/index.tsx:1083-1085`），断线或已在取消中则 disabled（`composer/index.tsx:1096`）。几何见 ui-patterns。
- 取消的实际流程（`composer/index.tsx:1875-1897`）：先调 `cancelComposerAgent`（守卫：不在运行 / 已在取消 / 未连接 → 返回 null，`composer/actions.ts:177-185`），拿到非 null 才 `beginAgentCancellation` 拿一个自增 `requestId`（`runtime/host-runtime.ts:2460-2464`，它把 `cancellation_started` 打进 turn 状态机），RPC 的 `finally` 里 `settleAgentCancellation`（`runtime/host-runtime.ts:2466-2468`）。请求期间输入框重新获得焦点（`composer/index.tsx:1896`）。

#### 3.3 queue → interrupt 降级

运行中发送有三种语义：`interrupt`（打断当前 turn）、`steer`（并入当前 turn）、`queue`（排队）（`packages/protocol/src/messages.ts:1204-1205`、`composer/input/state.ts:6`）。

**有待审批时 `queue` 被强制降级为 `interrupt`**：

```
resolveActiveSendBehavior(sendBehavior, hasPendingPermission)
  sendBehavior === "queue" && hasPendingPermission → "interrupt"
  其余原样返回
```
（`composer/input/state.ts:8-13`，调用点 `composer/index.tsx:1590-1601`。）

理由是硬的：agent 正卡在一个权限弹窗上等你，点发送再排到队尾，等于让消息永远不会被消费。**降级发生在发送路径之前，不是之后。**

#### 3.4 队列生命周期

| 动作 | 实现 | 后果 |
|---|---|---|
| 入队 | `queueComposerMessage`（`composer/actions.ts:245-261`） | 追加到 `queuedMessages[agentId]`，返回带 `id` 的条目 |
| 改队列消息 | `editQueuedComposerMessage`（`composer/actions.ts:274-291`） | **从队列移除并把内容回填到 composer**，供用户改完重发 |
| 立即发送队列项 | `sendQueuedComposerMessageNow`（`composer/actions.ts:306-336`） | 先出队再发；失败时**把条目放回队首**（`composer/actions.ts:321-325`） |
| 自动出队 | `drainQueuedAgentMessage`（`runtime/host-runtime.ts:2396-2450`） | 每次只取队首一条，同 key 并发去重（`runtime/host-runtime.ts:2397-2398`），agent 仍在初始化则不动作（`runtime/host-runtime.ts:2403`） |

**drain 的触发点**是两处：目录同步观察到 agent 停止运行（`runtime/host-runtime.ts:1785`、`runtime/host-runtime.ts:2294`），以及时间线响应被判定为「权威同步完成」且 `agent.turn.phase === "idle"` 时（`timeline/viewed-timeline-sync.ts:250-252`）。

drain 时发的是 `activeTurnBehavior: "steer"` 而不是 `interrupt`，注释写明：agent 刚空闲的那一瞬可能自己起了新 turn，steer 会把消息折进那个 turn 而不打断它（`runtime/host-runtime.ts:2429-2433`）。

#### 3.5 草稿生命周期（本节重点）

**保存维度**（`stores/draft-keys.ts:25-35`）：

```
有 draftId → `draft:${serverId}:${draftId}`     // 新工作区 / fork 的临时草稿
无 draftId → `agent:${serverId}:${agentId}`     // 普通会话，按 agent 存
```

即草稿按 **server × agent**（会话）存，另有一条按 **server × draftId** 存的一次性草稿通道（`stores/draft-keys.ts:3-4`、`stores/draft-keys.ts:9-16`）。

**记录结构**（`stores/draft-store/state.ts:26-31`）：

```
DraftRecord { input: {text, attachments}, lifecycle, updatedAt, version }
lifecycle ∈ "active" | "abandoned" | "sent"      // state.ts:24
```

草稿不只是文本——**附件也存**（`stores/draft-store/state.ts:18-21`）。附件有 zod schema 分六种（image / file / workspace_file / forge_issue / forge_change_request / github_* / plugin resource），迁移到 v5（`stores/draft-store/state.ts:9`、`stores/draft-store/state.ts:96-140`）。

**什么时候变 active**：编辑文本时，若新记录既无文本也无附件，直接置 `abandoned`（`stores/draft-store/state.ts:35-49`）。附件变更走 `saveDraft`，结果为空同样落到 `clearDraftInput({lifecycle:"abandoned"})`（`composer/draft/input-draft.ts:137-155`）。

**什么时候被丢弃**：

| 触发 | 实现 |
|---|---|
| 发送成功 | `clearDraft("sent")`（`composer/submit.ts:64`、`composer/index.tsx:1412`、`composer/index.tsx:1441`、`screens/new-workspace-screen.tsx:1163`） |
| 内容清空 | `clearDraftInput({lifecycle:"abandoned"})`（`composer/draft/input-draft.ts:148`） |
| agent 被删 | `clearDraftInput({draftKey: buildDraftStoreKey(...)})`（`runtime/directory-sync/internal/agent-store.ts:172-174`） |
| **TTL** | 非 active 记录超过 `FINALIZED_DRAFT_TTL_MS = 5 分钟` 被 GC 掉（`stores/draft-store/state.ts:10`、`stores/draft-store/state.ts:237-251`） |

注意 `applyClearDraftRecord` **不是删除记录，而是清空内容 + 打上终态标记**（`stores/draft-store/state.ts:253-268`）。记录留着是有意的：GC 要同时看队列消息、流里的用户图片和 workspace 附件，判断某个附件还有没有被引用（`stores/draft-store/index.ts:190-203`、`stores/draft-store/index.ts:205-217`、`stores/draft-store/index.ts:143-181`）。删记录就直接丢掉这个信息了。

**写入节流**：正文编辑在 web 上走 `AfterPaintPublication`，一帧一次（`composer/draft/input-draft.ts:157-171`）；落盘按 `DRAFT_PERSIST_INTERVAL_MS = 200` 节流，且调度器可注入以便测试（`stores/draft-store/persistence.ts:3`、`stores/draft-store/persistence.ts:37-95`）。页面隐藏或 `pagehide` 时强制 flush（`composer/draft/input-draft.ts:203-225`）。草稿 key 变化时异步 hydrate 并把恢复的文本以 `TextReplacement` 灌回编辑器（`composer/draft/input-draft.ts:227-244`）。

---

### 2.5 运行中可做什么

| 动作 | 入口 | 调用 | 后果 |
|---|---|---|---|
| 打断 | 取消键 / `agent.interrupt` 快捷键（`composer/index.tsx:551-554`、`composer/index.tsx:611-612`） | `client.cancelAgent(agentId)`（`composer/actions.ts:181`） | turn 进 cancelling，等待 daemon 确认 |
| 排队追问 | `queue` 模式发送 | 排队，等 idle 自动 drain | 见 3.4 |
| 折入当前 turn | `steer` 模式 | 发送时带 `turnId`（`composer/actions.ts:206-210`） | 不打断，消息并入正在跑的 turn |
| 切模型 | composer 模型选择器 | `client.setAgentModel(agentId, modelId)` + `mergeProviderPreferences` 双写（`composer/agent-controls/index.tsx:1625-1645`） | daemon 生效 + 本地偏好持久化；失败 `toast.error` |
| 切模式 | 模式控件 | `client.setAgentMode(agentId, modeId)`（`composer/agent-controls/mode-control.tsx:288-294`） | **daemon 会返回一个 notice**，用 `showProviderNoticeToast` 展示「下次生效」之类的提示（`utils/provider-notice-toast.ts:4-18`） |
| 切特性 | feature 开关 | `client.setAgentFeature(agentId, featureId, value)`（`composer/agent-controls/index.tsx:1703-1727`） | 与切模型同样的双写模式 |
| 加上下文 | 附件 / 文件拖入 / `@` 引用 | 写入 draft 的 attachments | 提交时随消息发出 |
| 归档 / 删除会话 | 侧栏菜单 | `client.archiveAgent` / `client.deleteAgent`（`contexts/session-context.tsx:755-779`） | 归档只从目录移除，删除才销毁流 |
| 重启 host | 设置 | `client.restartServer(reason)`（`contexts/session-context.tsx:781-792`） | 断开并重连 |

**两个值得注意的取舍**：

1. 运行中的 agent 是**某一个 provider 的进程**，所以 profile 只允许该 provider 的（`composer/agent-controls/index.tsx:1651-1653`）。
2. 切模型 / 模式 / 特性**都不是纯 UI 操作**，都是「RPC + 本地偏好」双写。RPC 失败只 toast，不回滚本地偏好（`composer/agent-controls/index.tsx:1639-1642`）。这条契约值得照抄：**每个控制器的持久化顺序与失败语义一致，用户在别处看到的状态不会飘。**

---

### 2.6 工具调用的三级展开

#### 投影结构

`buildToolCallPresentation` 是唯一的投影入口（`tool-calls/presentation.ts:55-90`），输入 5 个工具状态（`executing | running | completed | failed | canceled`，`tool-calls/presentation.ts:14`）加一个 `ToolCallDetail` 判别联合（`packages/protocol/src/agent-types.ts:215-303`，含 shell / read / edit / write / search / fetch / worktree_setup / sub_agent / plain_text / plan / unknown）。

输出（`tool-calls/presentation.ts:28-40`）：

| 字段 | 决定什么 |
|---|---|
| `displayName` / `summary` | 一行摘要的两段文本 |
| `errorText` | 失败原因 |
| `icon` | 由 `resolveToolCallIcon(toolName, detail)` 决定 |
| `isLoadingDetails` | 运行中但 detail 还没到 → 显示骨架屏 |
| `hasDetails` | detail 是否「有内容」 |
| `canOpenDetails` | `hasDetails \|\| isLoadingDetails`（`tool-calls/presentation.ts:86`）——**加载中也允许展开**，只是展开是骨架 |
| `openFilePath` | 从 detail 里抽出来的文件路径（`utils/extract-tool-call-file-path`） |
| `isPlan` / `planOutcome` | plan 工具的特例，outcome 从 status + `metadata.approved` 推出来（`tool-calls/presentation.ts:92-98`） |

「有内容」的定义是逐类型的（`utils/tool-call-detail-state.ts:73-107`），不是简单判空——比如 search 详情要求 query 非空或 filePaths / webResults / annotations 任一非空数组。这一层挡住了「展开后一片空白」的失败模式。

#### 三级路径

| 级别 | 形态 | 触发 | 用户能做什么 |
|---|---|---|---|
| L0 摘要行 | `ExpandableBadge`，显示 `displayName` + `summary` + 图标（`components/message.tsx:3195-3206`） | 常驻 | 读到「做了什么、结果是什么」；点右侧文件路径直接打开 |
| L1 就地展开 | 宽屏：`ToolCallDetailsContent` 内联在消息流里（`components/message.tsx:3153-3168`）。窄屏：底部 sheet（`components/tool-call-sheet.tsx:73-121`） | `canOpenDetails` 为真才给 `onToggle`（`components/message.tsx:3199`） | 看输入/输出/错误分段；展开状态会回报给流（`onInlineDetailsExpandedChange`，`components/message.tsx:3137-3151`） |
| L2 独立面板 | 文件面板 / working_diff / changes_tree / commit_diff（`panels/diff-panel.tsx:241-254`） | `openFilePath` 存在且上层提供了 `onOpenFilePath`（`components/message.tsx:3099-3105` → `agent-stream/view.tsx:500-502`） | 在面板里长驻查看、可滚动、可切模式 |

**plan 特例**：`isPlan` 且 detail 是 plan 时，整个 badge 被 `PlanCard` 取代（`components/message.tsx:3182-3190`），不进入 badge 折叠模型。审批 UI 自己持有 pending 计划的呈现，但流模型里保留原始 tool 条目，这样审批解决后卡片能回到原位（`tool-calls/detail-level/projection.ts:20-37`）。

**详情折叠等级**是一个用户设置：`ToolCallDetailLevel` 三档，`detailed` 时全部原样渲染，`overview` 时先过滤（滤掉 `ExitPlanMode` 与运行中的 `plan_approval`）再按 `buildOverviewGroup` 分组（`tool-calls/detail-level/projection.ts:39-72`）。

**diff 面板自身也有一份被 zod 校验的持久状态**（`panels/changes/state.ts:4-35`）：文件树可见性、文件／目录折叠集合、commit 区折叠、加上已经从 schema 里 transform 掉的 `mode` / `baseRef` / `layout` / `wrapLines` / `hideWhitespace`（注释标了兼容期截止 2026-11-21）。默认值 `commitsCollapsed: true`（`panels/changes/state.ts:31-35`）。

---

### 2.7 子 agent

paseo 有**两种子 agent 来源**，在 UI 层被压成同一个行类型（`subagents/select.ts:40`）：

| 来源 | 标识 | 含义 |
|---|---|---|
| `PaseoSubagentRow` | `kind: "paseo"`（`subagents/select.ts:9-20`） | 自己管的 Agent，有真实 title，没有独立描述 |
| `ProviderSubagentRow` | `kind: "provider"`（`subagents/select.ts:23-38`） | provider 自己 fork 出来的子会话，**`title` 是子 agent 类型（"Explore"、"general-purpose"，会重复），`description` 是这次的任务** |

**行的命名规则**：有 `description` 用 description 命名，没有才退回 title——因为 fan-out 里 title 会重复（`subagents/track-presentation.ts:26-45`）。

**状态映射**：paseo 行看 `turn.phase === "open"` 才算 running，否则用 lifecycle status；provider 行经 `providerSubagentLifecycleStatus` 把 `running→running`、`failed→error`、其余 `→idle`（`subagents/track-presentation.ts:9-15`、`subagents/provider-store.ts:64-69`）。

**呈现**：一行 pill + 一个行列表。pill **不做最紧急状态折叠**——混合 fan-out 里红点旁写「1 failed」而子任务还在跑，用户会以为整个 fan-out 停了；所以每个出现的状态各占一段带自己的计数（`subagents/track-presentation.ts:62-88`）。全部子 agent 都结束时 pill 退回「打开会看到什么」的措辞（`subagents/track-presentation.ts:91-94`）。行上提供归档进度与归档失败两个状态位（`subagents/track.tsx:143-157`）。

**打开方式**：provider 行开 `{kind:"provider_subagent", parentAgentId, subagentId}` 面板，paseo 行开 `{kind:"agent", agentId}`（`subagents/opens-in-sheet.ts:5-9`）。开成 tab 还是底部 sheet 取决于当前工作区布局（`subagents/opens-in-sheet.ts:12-28`）——已经开成 tab 的子 agent 点进去是**切到那个 tab**，不是再开一个 sheet。

**关闭策略**：有 `parentAgentId` 的子 agent 关 tab 只关布局不归档；根会话关 tab 直接归档（`subagents/close-tab-policy.ts:5-12`）。

**批量归档**：`isFinishedSubagent` 对两种来源各有一组终态判断（`subagents/archive-finished.ts:37-39`），`archiveFinishedSubagents` 一次处理全部，paseo 行走 `client.archiveAgent`，provider 行走 `dismissProviderSubagents`（`subagents/archive-finished.ts:12-20`）。

**结果回流**：paseo 子 agent 的产物以父流里一个 `type: "sub_agent"` 的 tool call detail 出现，携带 `subAgentType` / `description` / `childSessionId` / `log` / `actions[]`（`packages/protocol/src/agent-types.ts:286-297`），与普通工具调用共用同一套三级展开。provider 子 agent 的时间线是**独立拉取**的：`panels/provider-subagent-panel.tsx:161-177` 订阅，`panels/provider-subagent-panel.tsx:179-207` 向上分页，渲染用 `readOnly` 的 `AgentStreamView`（`panels/provider-subagent-panel.tsx:256-267`）——**子 agent 的对话不能在里面发送**。面板本身递归：一个 provider 子 agent 还能有子 agent（`subagents/select.ts:104-116`），仅当调用方传入 `nestingSupported` 才做子级筛选，缺省直接返回空（`subagents/select.ts:107`）。

**重连一致性**：provider 子 agent 的 update 在断线重连后**不会重放**，所以重订阅后必须重新 list 一遍父级（`subagents/provider-store.ts:107-113` 的注释与 `resyncProviderSubagents`）。

---

### 2.8 timeline 与 agent 流

**timeline 是权威源，流是物化。** 游标（`timeline/session-stream-reducers.ts:32-36`）：

```
TimelineCursor { epoch, startSeq, endSeq, retainedRanges?: TimelineLoadedRange[] }
```

`epoch` 变化意味着历史被作废；`retainedRanges` 记录已加载但不连续区间，`mergeTimelineCoverage` 会把相邻区间合并（`timeline/session-stream-reducers.ts:74-104`）。页面侧另存一份带 `hasOlder` 的 cursor state（`stores/session-store.ts:303-316`）。

**取数策略**是纯函数（`timeline/timeline-sync-plan.ts`），四种计划：

| 计划 | 用途 |
|---|---|
| `planTimelineTailFetch`（`:47`） | 首屏 / 强制替换 |
| `planTimelineCatchUpAfter`（`:38`） | 已知缺口后补 |
| `planTimelineResumeFetch`（`:58`） | 有 range 就 after 补，没有就退化成 tail |
| `planTimelinePromptJump`（`:75`） | 跳转到某条：往前多取半页并带 `mergeWindow`，保证目标不在窗口边缘 |

**归约**是纯函数，输出显式决策而不是改状态（`timeline/session-stream-reducers.ts:163-176`）：`commit: "apply" | "discard"`、`older`、`initResolution`、`clearInitializing`、`sideEffects`、`acknowledgedClientMessageIds`。副作用只有两种（`timeline/session-stream-reducers.ts:43-45`）：`catch_up`（发现序号缺口要补）和 `flush_pending_updates`。

**本地发出但未确认的消息**通过 `messageSubmissions` 参与归约：`sendingClientMessageIds` 传进去（`timeline/session-stream-reducers.ts:160`），时间线确认后返回 `acknowledgedClientMessageIds` 把它们撤下（`timeline/session-stream-reducers.ts:174`、`timeline/session-stream-reducers.ts:269`）。这就是「按了发送立刻出现气泡、daemon 确认后才算真」的机制。

**流条目的判别联合**（`types/stream.ts:81-90`）：`user_message` / `assistant_message` / `thought` / `tool_call` / `todo_list` / `notification` / `compaction` / `plugin`。每条都带 `turnId?` 与 `timelineCursor?: {epoch, seq}`（`types/stream.ts:719-722`）。工具调用分 `source: "agent"` 与 `source: "orchestrator"` 两条来源（`types/stream.ts:759-761`），状态枚举也因此不同（`types/stream.ts:736-737`）。

**每轮耗时**由 `deriveStreamTurnTiming` 从条目时间戳现算，不落盘（`timeline/turn-time.ts:129-145`）。

---

### 2.9 runtime 与斜杠命令

#### 8.1 运行时

连接状态 5 态（`runtime/host-runtime.ts:90`）：`idle | connecting | online | offline | error`；agent 目录另有独立的 6 态（`runtime/host-runtime.ts:122-129`）：`idle | initial_loading | revalidating | ready | error_before_first_success | error_after_ready`。**目录状态与连接状态分开**，因为「连上了但目录还没拉到」和「连不上」要说的不是一回事（`runtime/host-runtime.ts:161-174`）。

快照里还有 `clientGeneration` 与 `connectionEpoch` 两个单调计数器，用来识别「旧连接的迟到响应」（`runtime/host-runtime.ts:130-145`）。

对 UI 暴露的动作入口只有一层薄封装（`runtime/host-runtime.ts:2460-2496`）：`beginAgentCancellation` / `settleAgentCancellation` / `acceptAgentSnapshot` / `archiveAgentSnapshot` / `restoreAgentSnapshot` / `acceptWorkspaceSnapshots`。

#### 8.2 斜杠命令：发现与执行

命令表是纯数据（`client-slash-commands/index.ts:17-40`），两条：

| 命令 | 别名 | kind | execution |
|---|---|---|---|
| `/exit` | `/quit`、`/q` | `archive-agent` | `immediate` |
| `/clear` | `/new` | `replace-agent-with-draft` | `immediate` |

别名与主名进同一张 Map（`client-slash-commands/index.ts:42-48`）。**发现**：`resolveClientSlashCommand({text, hasAttachments})`——有附件直接返回 null（`client-slash-commands/index.ts:52-54`），必须以 `/` 开头，且斜杠后**不能有空白**（`client-slash-commands/index.ts:60-62`），所以 `/clear 后面` 不匹配。`execution: "immediate"` 表示识别后立即执行、不进消息流。

**执行**发生在提交路径**最前面**，早于附件编码与 RPC：`handleSubmit` 先查客户端命令，再查插件命令，都不匹配才真发（`composer/index.tsx:1699-1716`）；排队路径 `handleQueue` 同样先查（`composer/index.tsx:1952-1965`）。命令执行成功后 `handleSubmit` 直接 return，**输入框内容不会被清**（因为 `sendMessageWithContent` 没被调用，`clearDraft` 也就没触发）——这是「immediate」的字面含义。

`/clear` 用 `buildDraftAgentSetup` 把当前 agent 的 provider / cwd / mode / model / thinking / featureValues 打包成一个新 draft 目标（`client-slash-commands/index.ts:64-81`），所以「清空重来」不丢执行上下文。

---

### 2.10 与本项目对照

| paseo 做法（路径:行） | 本项目现状（路径:行） | 影响 | 建议（方向，不排期） |
|---|---|---|---|
| turn 存活性与 lifecycle status 分离，`cancellationRequestId` 叠加在两态之上（`timeline/turn-liveness.ts:6-13`） | `run.state` 单枚举 `queued\|running\|cancelling\|cancelled\|completed\|failed\|interrupted`（`packages/protocol/src/business.ts:24`），前端只判前三态（`workbench/business-session.tsx:247`） | 「已发未确认」窗口没有表达；取消中与运行中视觉上同构 | 保留七态协议不变，渲染层补一层类似 `TurnPresentation` 的派生，把「正在取消」从「正在运行」里拆出来 |
| 提交四态 `noop/queued/submitted/failed`，失败回填文本与附件（`composer/submit.ts:3`、`:67-81`） | 失败时把原文拼回草稿（`workbench/business-session.tsx:303-305`）；但**没有 noop/queued 两态**，发送路径不分流 | 运行中连发会直接打给内核，没有队列语义 | 引入结果判别联合而不是布尔，把「空提交」与「排队」显式化 |
| `queue` 在有待审批时降级为 `interrupt`（`composer/input/state.ts:8-13`） | 无队列也就无从降级 | 若将来接审批，队列消息会静默卡住 | 降级判定放在发送路径之前，与审批状态解耦成纯函数 |
| 队列 idle 自动 drain，且用 `steer` 而非 `interrupt`（`runtime/host-runtime.ts:2429-2433`、`timeline/viewed-timeline-sync.ts:250-252`） | 无 | — | 若做队列，drain 触发点绑「turn 结束」而不是「请求返回」 |
| 草稿按 server×agent 存，附件一并持久化，三态 lifecycle + 5 分钟 TTL（`stores/draft-keys.ts:25-35`、`stores/draft-store/state.ts:24`、`:10`） | `localStorage` 存纯文本，key 为 `directory\|projectId\|sessionId` 拼接，空串即删（`workbench/drafts.ts:9-31`）；**另有 `pending` 键存整份发送载荷用于失败重放**（`workbench/business-session.tsx:269-305`） | 附件不随草稿保留；失败重放靠独立的 pending 键，与草稿是两套机制 | 草稿记录升级为 `{text, attachments, lifecycle}`；失败重放并入草稿记录而不是第二个键 |
| 清空草稿是「标记终态 + 等 TTL」而非立即删除，因为附件 GC 要看引用（`stores/draft-store/state.ts:253-268`、`stores/draft-store/index.ts:143-181`） | 删键即删 | 附件无引用追踪，清理时机无从判断 | 引入时先做 lifecycle 标记，GC 是后续步骤 |
| 写入按帧发布 + 200ms 落盘节流，页面隐藏强制 flush（`composer/draft/input-draft.ts:157-171`、`stores/draft-store/persistence.ts:3`） | 每次 `writeDraft` 同步写 `localStorage`（`workbench/drafts.ts:21-31`） | 高频输入时同步 IO | 加一个尾随节流，落盘间隔 ≥200ms |
| 草稿 key 变化时异步 hydrate 并以替换语义灌回编辑器（`composer/draft/input-draft.ts:227-244`） | `subscribeDraft` 只做同 key 变更通知，不做跨 key 恢复（`workbench/drafts.ts:33-40`） | 切会话后草稿恢复需调用方自行读取 | 恢复逻辑集中到一处，切换会话走同一条 hydrate 路径 |
| 每条流条目都带 `turnId` 与 `timelineCursor`（`types/stream.ts:719-722`），turn 分组按 turnId（`agent-stream/turn-membership.ts:7-14`） | 消息经 `ExternalStoreAdapter` 转成 `ThreadMessageLike`，无 turn 概念（`workbench/session.ts:70`） | 无法把「一次运行」框起来，也无法按轮计算耗时 | 在协议层给消息加 turn 标识，是后续分轮统计与折叠的前提 |
| 工具调用投影统一产出 `canOpenDetails`，加载中也可展开（`tool-calls/presentation.ts:86`） | `<details>` 原生折叠，无 loading 态（`workbench/shell/ToolCall.tsx:5-30`） | 展开后可能短暂空白 | 保留原生 `<details>`，补一个「详情未到」占位 |
| 工具调用三级展开，L2 落到独立 diff 面板（`components/message.tsx:3199`、`panels/diff-panel.tsx:241-254`） | 只有两级：`<details>` 内联，无「打开到面板」（`workbench/shell/ToolCall.tsx:5-30`） | 文件改动只能在消息里看，无法长驻审阅 | `openFilePath` 已有现成的路径抽取思路可参考（`utils/extract-tool-call-file-path.ts`） |
| 「有内容」按 detail 类型逐个判定，挡住空白展开（`utils/tool-call-detail-state.ts:73-107`） | 无条件渲染 `<pre>{view.input}</pre>`（`workbench/shell/ToolCall.tsx:19`） | 可能出现空输入区 | 折叠前判空 |
| 切模型/模式/特性 = RPC + 本地偏好双写，失败只 toast（`composer/agent-controls/index.tsx:1625-1645`、`composer/agent-controls/mode-control.tsx:288-294`） | `ExecutionContext` 的模型下拉只在有 `onModelChange` 时渲染，纯展示（`workbench/shell/InstructionComposer.tsx:28-35`、`:49-58`） | 执行上下文只读 | 一旦接上真实切换，沿用「RPC + 偏好」双写与统一失败 toast |
| daemon 返回 notice（如「下次生效」）并单独展示（`utils/provider-notice-toast.ts:4-18`） | 无 toast 层 | 「已提交但未生效」无处可说 | 补 toast 层时把这类 notice 作为一个 variant |
| 运行中发送键变取消键，取消中换 spinner 并 disabled（`composer/index.tsx:2377`、`composer/index.tsx:1083-1096`） | 取消是 dock 里的独立文字按钮「取消执行」，与发送键并存（`workbench/shell/AgentDock.tsx:92-97`） | 用户可能同时看到两个可点按钮 | 合并为同一位置的形态切换 |
| 取消用自增 `requestId` 配对 started/settled（`runtime/host-runtime.ts:2460-2468`） | `session.cancel` 无请求配对（`workbench/business-session.tsx:311-315`） | 重复点击无法去重 | 加请求 id 或至少一个 in-flight 标志 |
| 队列立即发送失败时把条目放回队首（`composer/actions.ts:321-325`） | 无队列 | — | 与队列一并引入 |
| 子 agent 结果以 `sub_agent` tool call 回到父流，与普通工具同路径展开（`packages/protocol/src/agent-types.ts:286-297`） | 无子 agent 概念 | — | 暂不适用 |
| provider 子 agent 面板 `readOnly`，不能在其中发送（`panels/provider-subagent-panel.tsx:266`） | 无 | — | 暂不适用 |
| 斜杠命令在提交路径最前置执行，`immediate` 模式不进消息流（`composer/index.tsx:1699-1705`） | 无命令解析 | — | 若加命令，注册表放在提交函数第一行，别做成输入框监听 |
| 斜杠命令发现要求「`/` 后无空白」且有附件时不匹配（`client-slash-commands/index.ts:52-62`） | 无 | — | 与上同批实现 |

---

### 2.11 未核实项

- `unverified — 需确认`：`stores/session-store.ts` 里 `agentDetails` 与 `agents` 的确切分工（从 `runtime/directory-sync/internal/agent-store.ts:126-134` 推断为「不在活跃列表但仍可见的会话」，未找到注释或文档确认）。
- `unverified — 需确认`：`timeline/turn-time.ts` 里 `durationMs` 为 `null` 的具体条件（只看到字段声明 `timeline/turn-time.ts:4-8`，未追到赋值分支）。
- `unverified — 需确认`：paseo 是否对草稿设置总量上限。源码只见过期清理（`stores/draft-store/state.ts:237-251`），未见条数或字节数上限。
- `unverified — 需确认`：`agent-stream/view.tsx:1410` 附近的 `PermissionRequestCard` 审批超时行为（15s）本次未读，属审批状态表达，归 `ux-state` 节。

## 3. 控件点击后的交互效果

本节只写行为：按下、悬停、聚焦、点外面、Esc、选中之后发生什么。控件几何（`control-geometry.ts`）与色值不在此，见 `paseo-ui-patterns`。

paseo 的控件行为有一条贯穿的主线：**按下反馈由被点的东西自己拥有，弹层由被弹出的东西自己拥有**。两者都落在同一组共享 primitive 上（`components/ui/`），而不是散在业务组件里。

### 3.1 按下反馈（PressHighlight）

**是变色叠加，不是缩放。** `PressHighlight` 在原生侧画一层绝对定位的覆盖层，覆盖层的 `opacity` 由手势驱动的 shared value 从 0 拉到 1（`components/ui/press-highlight.native.tsx:84-86`、`:104-110`）。没有任何 `transform: scale`。

覆盖层而不是直接改 pressable 的背景，原因写在注释里：Reanimated 操作的节点不能同时承载调用方的主题样式（`press-highlight.shape.ts:27-36`）。因为覆盖层不继承任何东西，圆角必须从 pressable 自己的 `style` 上复制过来，否则圆角行按下时闪出一个方块（`press-highlight.shape.ts:37-47` 的 `CORNER_PROPERTIES`、`:54-72` 的 `resolveHighlightCorners`）。

**形状不可配置**：只有 `highlightStyle` 可配，它只表达「高亮涂什么色」，形状永远取自 pressable 自己的 style（`press-highlight.types.ts:14-24`）。若 style 是随 press 状态解析的函数，`resolveHighlightCorners` 直接返回 `{}` 不猜形状（`press-highlight.shape.ts:57-59`）。

**手势细节**：`maxDistance(8)` + `shouldCancelWhenOutside(true)`（`press-highlight.native.tsx:93-94`）——手指移出超过 8px 或滑出控件即取消高亮。`.enabled(disabled !== true && highlightStyle != null)`（`:92`），不传 `highlightStyle` 时整个手势不注册（`:132-134`）。这个手势**只管视觉**；激活、取消、无障碍、长按回调仍归 `Pressable`（`:87-88`、`:126-130`）。没有节流——一个 shared value，`onBegin`/`onFinalize` 各一次。

**Web 侧退化**：`.tsx` 版本直接把 `highlightStyle` 丢弃，只渲染裸 `Pressable`（`press-highlight.tsx:6-11`）。Web 的按压反馈交给 CSS/浏览器，不走这套。

**影响范围很窄**：全仓只有 3 个文件 import 它（`components/ui/context-menu.tsx:31`、`components/ui/floating-action-button.tsx:5`、`components/sidebar-workspace-list.tsx:119`），全是「长按会弹出东西的行」——侧栏项目行、工作区行、FAB。也就是说：**可长按的行才需要按压高亮**，普通按钮不用。

### 3.2 按钮（Button）

尺寸档位 `xs / sm / md / lg`，`md` 为默认（`components/ui/button.tsx:30`、`:173-180`）。几何来自 `createControlGeometry`，不在此。

按下与禁用都是**透明度**，不换色：

| 状态 | 可见差异 | 位置 |
|---|---|---|
| 按下 | `opacity: 0.85` | `button.tsx:133-135`、`:223` |
| 禁用 | `theme.opacity[50]`（变淡） | `button.tsx:136-138`、`:224` |
| loading | 左侧图标换成 spinner | `button.tsx:45-50` |

**禁用是「变淡 + 真的不可点」双份**：`disabled={disabled || loading}`（`:188`、`:266`），即 loading 也走不可点路径。无障碍上同时写 `disabled` 与 `busy`（`:244`）。

ghost 变体是唯一有 hover 差异的：hover 时文字从 muted 变 foreground（`:156-158`、`:209`、`:238`），图标同步从 `foregroundMuted` 切到 `foreground`（`:250-256`）。

按钮**不使用 PressHighlight**，也不做 scale，按下即 `opacity 0.85`。

### 3.3 图标按钮 chrome

`iconButtonChromeStyle` 把四种状态压成同一个高亮：active / hovered / pressed / open 任一为真就上 `interactionHighlight` 背景（`components/ui/icon-button-chrome.ts:76-83`、`:146-148`）。即**菜单打开着的时候按钮保持高亮**，不需要额外状态。禁用只降透明度（`:149-151`）。

`useIconButtonChromeStyle` 是给 Pressable / TooltipTrigger / DropdownMenuTrigger 共用的同一个回调签名（`:43-65`），所以一个图标按钮换成菜单触发器时外观不变。容器可以用 `IconButtonChromeProvider` 把整组图标动作切成 `header-island` 形态（`:38`、`:41`、`:56-59`），此时强制 large 尺寸与圆形命中区。

`icon-color.ts` 只有两个主题色映射：muted 与 extraMuted（`:3-9`）。

### 3.4 Tooltip

**默认延迟 0**（`components/ui/tooltip.tsx:231`），即 hover 即开，无节流无冷却。`delayDuration <= 0` 时直接 `setOpen(true)`，不排队（`:294-305`）。菜单项的 tooltip 是唯一显式给延迟的地方：250ms，且 `enabledOnMobile={false}`（`menu/menu-item.tsx:374`）。

**触发分两种模式，由平台决定**（`:250-252`）：

| 环境 | 触发方式 | 开关 |
|---|---|---|
| Native 或紧凑视口 | 按下（`openOnPress`） | `enabledOnMobile`，默认 false（`:232`） |
| 宽视口 | hover / 键盘聚焦 | `enabledOnDesktop`，默认 true（`:231`） |

在宽视口点击 tooltip 触发器会**关闭**而不是打开（`:353-366`：`openOnPress` 为假时走 `close()`），避免点击时误开。

**键盘下唤出有一套输入模态判定**：模块级 `lastInputWasKeyboard` 由 window 上的 `keydown` / `mousedown` / `pointerdown` / `touchstart` 捕获阶段监听维护（`:66-78`），只有键盘驱动的 focus 才开 tooltip（`:81-82`、`:334-343`）。目的是：模态关闭后程序性把焦点还给触发器时不冒泡出 tooltip。触屏上等价物是 `openOnPress`。

**关闭条件**：hover out（`:326-332`）、blur（`:345-351`）、原生上点击遮罩（`:547` 的 `tooltip-dismiss`）。悬停进出还额外挂了 pointer/mouse 双通道，因为 RNW 的 hover 行为跨环境不稳（`:377-386`）。

**定位**跟随触发器：`measureInWindow` + 自算坐标，尺寸测量落地前停在 `-9999` 屏外（`:465-467`、`:503-510`）。放不下时翻到反方向（`:131-146`）。Web 走 `Portal` + `position:fixed`，注释说明是刻意避开 RN 的 `<Modal>`——它内部用 `<dialog>` 会抢焦点并打断 hover（`:520-538`）；原生才用 `Modal`。淡入淡出 80ms（`:523-524`、`:550-551`）。

### 3.5 HoverCard

**与 tooltip 的区别是可交互**：tooltip 的 surface 是 `pointerEvents="none"`（`tooltip.tsx:521-522`），hover card 是真 `View` + 可点内容，且 pointer 从触发器移到卡片上时卡片保持打开。为此专门做了安全区跟踪器（`components/ui/hover-card.tsx:228-237` → `hooks/use-hover-safe-zone.ts:18-58`）：safe zone 覆盖触发器 + 内容 + 两者之间的桥接矩形，pointer 离开才起关闭计时，重新进入取消。

**延迟**：`CLOSE_GRACE_MS = 100`（`:35`、`:109-117`），打开**无延迟**（`openNow` 直接 `setOpen(true)`，`:119-125`）。

**只在 web 存在**：非 web 直接返回 children，内容永不挂载（`:69`）。

关闭条件多到值得列全：

| 触发 | 行为 | 位置 |
|---|---|---|
| pointer 离开触发器/卡片 | 100ms grace 后关 | `:109-117` |
| `Esc` | 关闭并把焦点还给触发器 | `:131-137` |
| 在触发器按 `ArrowDown`/`Enter`/`Space` | 打开并把焦点移进卡片第一个可聚焦元素 | `:138-151` |
| 焦点移到卡片内 | 取消待关闭 | `:185-186` |
| 文档滚动（事件目标不在卡片内） | 立即关 | `:210-213` |
| `window.resize` | 立即关 | `:218` |
| `disabled` 变 true | 立即关 | `:239-244` |

键盘焦点与鼠标焦点被刻意区分：只有 `:focus-visible` 的焦点能维持卡片打开（`:105-109`、`:110-112`），因为按钮按下后会失焦而指针还在卡上。

**跟随目标而非固定位置**，但 `flipHorizontal: true`（`:353`），因为 hover card 允许水平翻边；菜单子菜单则相反，方向预先定死（见下）。

`workspace-hover-card.tsx` 是唯一使用方：`placement="right"`、`role="menu"`，紧凑视口下整个不渲染（`:60-64`）。卡片内的分支名/路径行是可点的 `Pressable`，点击复制并在 2s 内换成对勾（`:201-207`、`:230-238`）。

### 3.6 菜单体系

一套引擎（`components/ui/menu/`），两种呈现（宽屏锚定 popover / 紧凑底部 sheet），两种触发器形状（`dropdown-menu.tsx` 按下、`context-menu.tsx` 右键或长按）。

**菜单项词汇**：`MenuItem` / `MenuLabel`（组标题）/ `MenuSeparator`（分隔线）/ `MenuHint`（键值行）/ `MenuTextField`（菜单内输入框）/ `MenuSubTrigger`（`menu/index.ts:11-37`）。分组靠 `MenuLabel` + `MenuSeparator` 显式表达，没有自动分组。垂直节奏由页级 `MenuPage` 独占，行只管自己的填充（`menu-item.tsx:66-79`）。

**禁用项的表达**：三重。视觉 `opacity: 0.5`（`menu-item.tsx:490-492`）；`Pressable disabled`（`:346`）；以及 DOM 上的 `data-menu-disabled="true"`，因为键盘导航靠这个属性跳过（`:332-334`、`:451`）。另外 pending/success 也走禁用路径（`:277-279`）。

**键盘移动**（`menu-overlay.tsx:437-476`，挂在 window 捕获阶段的 overlay keydown）：

| 键 | 行为 |
|---|---|
| `ArrowDown` / `ArrowUp` | 在 `[data-menu-item]:not([data-menu-disabled])` 里循环 |
| `Home` / `End` | 首项 / 末项 |
| `Enter` / `Space` | 对当前焦点项 `click()` |
| `Esc` | 关闭整个菜单 |

菜单打开时自动把焦点落到第一个可用项（`menu-overlay.tsx:302-311`）。Tab 键被焦点陷阱循环（`lib/overlay-root.ts:175-197`）。

**打开后焦点自动落在第一项**（`:300-311`），关闭后焦点回到触发器（`overlay-root.ts:228-234`）。整条链路通过 `useWebOverlayRegistration`（`overlay-root.ts:260-290`）注册，并按 layer 排序保证只有最上层拿键盘（`:165-197`）。

**关闭条件**：点遮罩（`menu-overlay.tsx:371-379`，遮罩还挂了 `onContextMenu: onClose`）、`Esc`（`:439-443`）、选中项后（`menu-context.ts:130-152`）、以及**所属面板失活时**——菜单跟着打开它的面板一起死，而不是隐藏着下次切回来时复活（`menu-surface.tsx:132-139`）。`setOpen(false)` 同时把 submenu 路径清空、锚点清零，保证下次从根页重开（`menu-context.ts:120-128`）。

iOS 上选中后不立刻执行，而是等 250ms 让 UIKit 拆完 surface 再跑回调（`menu-context.ts:28`、`:141-157`）。`closeOnSelect={false}` 可保留菜单（submenu 用它，`menu-sub.tsx:94`）。

**submenu 展开方向固定为右**：`side="right" align="start" offset={-SUBMENU_OVERLAP}`（`menu-surface.tsx:328-330`，`SUBMENU_OVERLAP = 5`）。注释写明重叠而不是留缝的原因：留缝会出现一条两边都不属于的 backdrop 条带，每个像素都是误关的机会（`menu-surface.tsx:61-66`）。子菜单不画遮罩（`:334`），且打开路径上**每一层**都渲染成独立 flyout，所以多级子菜单直接堆叠（`menu-surface.tsx:216-230`）。

悬停开合有延迟：停留 90ms 开（`:54`、`:186-188`），离开后 260ms 才关（`:59`、`:190-197`）。**含输入框的 submenu 页设 `hoverIntent: false`**，此时既不由悬停打开，打开期间整张 surface 都不再因悬停关闭（`:77-84`、`:236-249`）。

紧凑形态是底部 sheet，一次只显示一页，返回用 header（`menu-surface.tsx:346-420`），带返回键 + 深度面包屑（`:414-419`）。sheet 形态**必须**是 sheet，因为 `BottomSheetTextInput` 离开 sheet 读不到上下文（`menu-item.tsx:143-152`）。

**两个触发器包装**：`dropdown-menu.tsx` 全是 re-export（`:23-36`），零逻辑。`context-menu.tsx` 有真实逻辑：右键（web）与长按（native）都走 `openAtEvent`，锚点设为事件坐标的零尺寸矩形（`:130-148`），且右键会 `preventDefault` + `stopPropagation`（`:169-181`）。默认紧凑形态是 sheet（`:50-56`）。触发器本体是 `PressHighlight`，所以长按行按下有高亮（`:214-227`）；`contextOnly` 时退化成一个只挂 `onContextMenu` 的 `View`（`:194-212`）。

`dropdown-trigger.tsx` 是 select 外观的下拉触发器：按下 `opacity 0.85`、禁用降透明度（`:90-98`、`:129-134`），尺寸直接复用 button 的几何。`toolbar-label-trigger.tsx` 走 icon-button 那套高亮逻辑，hover/pressed/open 任一为真即高亮，文字同步从 muted 变 foreground（`:166-184`）。

### 3.7 焦点与键盘弹层

**焦点陷阱与焦点归还**统一在 `lib/overlay-root.ts`，不在 `components/ui/` 里：

- 打开时捕获当前 `document.activeElement` 作为归还目标（`:283-289`）
- 下一帧若焦点仍不在 scope 内，强制落到 scope 第一个可聚焦元素；菜单优先找 `[data-menu-item]`（`:133-139`、`:141-160`）
- Tab / Shift+Tab 在首尾循环（`:181-198`）
- `focusin` 逃逸时重新拉回，但延到 microtask，给新挂载的更高层 overlay 让路（`:144-160`）
- 关闭时 `entry.restoreFocus.focus()`（`:239-242`）
- IME 合成键不参与：`event.isComposing` 直接放行（`:165-172`）

**hover 类弹层声明 `manageFocus: false`**（`hover-card.tsx:162`），只拿键盘优先权、不动焦点。

**滚动锁定**：无独立的滚动锁实现。sheet 靠 `@gorhom/bottom-sheet` 自己接管；`keyboard-dismiss.ts` 只做一件事——弹层打开时 `Keyboard.dismiss()` 三次（同步 + rAF + 150ms 定时），因为一次不足以压住正在收起中的键盘（`components/ui/keyboard-dismiss.ts:4-16`）。菜单与 combobox 都在打开时调用它（`menu-context.ts:115`、`combobox.tsx:1535`）。

**Esc 关闭**：菜单在 overlay keydown 里自己处理（`menu-overlay.tsx:439-443`）；hover card 自己在 document keydown 里处理（`hover-card.tsx:131-137`）；combobox 走同一套 `dispatchDesktopKey`（`combobox.tsx:889-893`）。原生 sheet 走 Android 硬件 Back（`isolated-bottom-sheet-modal/back-press.ts:11-16`，非 Android 直接不订阅，因为 react-native-web 的 BackHandler 一订阅就报错）。

**Portal 落点**：web 全部进 `getOverlayRoot()`（`lib/overlay-root.ts:26-38`）——一个 `position:fixed; inset:0; pointer-events:none` 的 `#overlay-root` 容器，z 分层 `floating 10 / modal 20 / toast 10000 / tooltip 20000`（`:45-50`）。菜单、tooltip、hover card、toast、web 端 modal 都往这里挂（`tooltip.tsx:535`、`hover-card.tsx:380`、`toast-host.tsx:214`、`adaptive-modal-sheet.tsx:711`、`menu-overlay.tsx:509`）。原生走 `Modal`。

`bottom-sheet-scope.tsx` 只有一个布尔 context（`:3-11`），作用是让 `ScrollView`（`scroll-view.tsx:28-41`）与 `SheetAwareTextInput`（`text-input/sheet-aware.tsx:36-51`）知道自己在 sheet 里换成 Gorhom 版本。

### 3.8 模态与底部抽屉（AdaptiveModalSheet）

**按视口宽度二分，不是按内容**（`components/adaptive-modal-sheet.tsx:510`、`:616`）：

| 条件 | 呈现 | 拖拽关闭 |
|---|---|---|
| `useIsCompactFormFactor()` 为真 | 底部 sheet，snapPoints 默认 `["65%","90%"]` | 是（`:653`） |
| 桌面 + web | 全屏遮罩 + 居中卡片（`role="dialog" aria-modal`） | 否 |
| 桌面 + 原生 | 走 sheet 但 `enablePanDownToClose={false}`、两个 pan 手势都关、无 handle | 否（`:728-730`） |

点击遮罩关闭（`:688-695`）。桌面 web 分支在 `visible` 转 false 后**不立刻卸载**，而是等 `WEB_EXIT_DURATION_MS = 160` 让退出动画跑完再 `onDismiss`（`:224`、`:604-614`）。

sheet 与原生 dialog 共用 Gorhom 全局栈（`presentation: "push" | "replace"`），注释说明独立的 RN Modal 会让 root 持有的兄弟 dialog 无法 present（`:714-717`）。新 sheet 打开时先 `Keyboard.dismiss()`，否则下层 sheet 的键盘会盖住新 sheet 的控件（`:544-549`）。

安全区填充是单独一层：有 footer 时归 footer，没有时归内容（`adaptive-modal-sheet-layout.ts:13-28`），注释强调它不能替换调用方自己的 padding（`adaptive-modal-sheet.tsx:523-528`）。

`isolated-bottom-sheet-modal/` 解决的是「内容被传送到 portal 另一侧后 context 全部失效」——`contextBridge` 是必填 prop 且允许显式传 `null`（`isolated-bottom-sheet-modal/index.tsx:63-65`、`:18-35`）。可见性用一个四相状态机（`closed / presenting / presented / dismissing`，`visibility-tracker.ts:34`）而非 `visible` 布尔，因为关闭有拖拽、遮罩、Back 三条路，且 `handleSheetDismiss` 与 `syncDesired(false)` 的语义相反：前者是「portal 拆完了」，后者是「所有者不要了」（`visibility-tracker.ts:119-135`）。`enableDismissOnClose={false}` 时关闭只是滑下去停在 index -1，内容不卸载，所有者可否决（`index.tsx:45-53`）。`SheetHostScope` 让 sheet 渲染在作用域自己的 host 上，从而读到作用域内的 context，同时仍进全局栈（`host-scope.tsx:20-31`）。

### 3.9 Toast

`DEFAULT_DURATION_MS = 2200`（`components/toast-host.tsx:54`）。`error` 单独给 3200（`:113`），`copied` 用 success 变体（`:108-112`）。

**不堆叠**：状态是 `ToastState | null` 而非数组（`:69`），新 toast 直接替换旧的（`:93-102`）。位置 `app-shell` 时贴在顶栏下方，`panel` 时贴在面板顶部（`:187-189`），居中、限宽（`:271-284`）。

**可交互 = 悬停暂停**：`onHoverIn` 暂停计时并记下剩余时长，`onHoverOut` 用剩余时长续上（`:165-178`、`:206`）。没有关闭按钮，卡片本体是 `Pressable` 但只绑 hover（`:242-252`）。

**成功与失败同形**：同一个卡片、同一套几何，variant 只改描边色与默认图标（`:229-251`、`:299-307`）。error 用三角警告图标而非叉号（`:236-238`），与 `alert.tsx` 的 error 用 `XCircle` 不一致（`alert.tsx:28`）——两处 minor 不一致。无障碍用 `accessibilityRole="alert"`（`:205`）。Android 上可选走系统 Toast，此时绕过自绘（`:86-91`）。

### 3.10 表单

**label 与控件的关系是视觉邻近，不是语义关联**：`Field` 把 label 渲染成一行 `Text`，控件是它的兄弟节点，不是 `<label for>`（`components/ui/form-field.tsx:57-67`）。控件的无障碍名由调用方各自负责（`SearchField` 用 placeholder 兜底，`search-field.tsx:68`；`SelectField` 拼成 `"label (value)"`，`select-field.tsx:299`）。

**错误表达是替换而非追加**：`error` 存在时 `hint` 被换掉，两者共用同一个槽位（`form-field.tsx:39-55`）。错误文本单行截断（`:42`）。控件本体**不**变红——`error` 只到文本层。控件的错误态边框要靠调用方自己传（如 `FormTextInput` 的 chrome 由 `resolveControlInteractionStyles` 按 hovered/focused/disabled 决定，与 error 无关，`form-field.tsx:192-212`）。

块级错误/提示用 `alert.tsx`：`accessibilityRole="alert"`（`:68`），四个变体各有图标（`:24-29`），`success` 变体刻意不加彩色描边（`:41-44`），children 作为动作区渲染（`:75-80`）。

**搜索框**（`search-field.tsx`）：聚焦只改描边与底色，不改内边距，避免前置图标位移（`:32-38`、`:106-109`）；`outlineWidth: 0` 因为浏览器焦点环会和自己的聚焦描边叠（`:115-118`）。清空按钮仅在 `value.length > 0` 时出现（`:74`），点击走 `replaceText("")` + `onChangeText("")` 双写，保证内部 ref 与受控值同步（`:52-55`），`hitSlop={8}` 扩大命中区（`:80`）。清空后**不自动重新聚焦**。

**Combobox 键盘模型**（`combobox.tsx:867-896`，桌面/web）：

| 键 | 行为 |
|---|---|
| `ArrowDown` / `ArrowUp` | 循环移动 activeIndex，**首尾回绕**（`combobox-keyboard.ts:1-18`） |
| `Enter` | 选中 activeIndex 项；无高亮时默认选第一项（`:540-547`） |
| `Escape` | 关闭并清空搜索词（`:889-893` + `:1345-1349`） |

打开/搜索词/选中值变化时重算初始高亮：无搜索词时落在当前选中项上，否则落在 fallback（`:897-915`、`:592-618`）。activeIndex 变化时把该项滚进视口（`autocomplete.tsx:138-160`，且 rAF 延后一帧）。选项为空时列表整体换成空态文案（`combobox.tsx:376-378`）。搜索排序分两档：label/id 命中优先，其次才查 description/searchText，后者 tier 加 99（`combobox-options.ts:18-29`）。

`combobox-trigger.tsx` 自己维护 `focused` 状态并交给 style 回调（`:52-70`），与 pressed/hover 并列成三态。`autocomplete.tsx` 是一个更轻量的无浮层版本，只负责把选中项滚进视口 + 三种占位态（loading / error / empty，`autocomplete.tsx:216-241`）。

`text-input/` 的 web 实现包了一层 IME 保护：`compositionstart/end` 期间抑制 `onChangeText`，结束时用 DOM `value` 补发一次（`text-input/text-input.web.tsx:83-110`）。`replaceText` 直接写 DOM `input.value` 并同步内部 ref（`:72-79`），这是搜索框清空能立刻生效的原因。

### 3.11 开关 / 分段控件 / 徽标 / Spinner

**Switch 是唯一有真实动画的控件**：轨道色与滑块色都用 `interpolateColor` 在 progress 上插值，滑块位移 `translateX = progress * thumbTravel`，progress 是 `withTiming(0|1, {duration: 180, easing: inOut(ease)})`（`components/ui/switch.tsx:28`、`:45-54`）。按下时 `event.stopPropagation()` 防止触发行内其他动作（`:84-91`），`hitSlop={8}`。禁用降透明度（`:142-144`）。无障碍同时给 `accessibilityRole="switch"`、`accessibilityState.checked`、`aria-checked`（`:104-107`）。

**SegmentedControl 无动画**：选中态是静态背景填充，按下是静态底色，两者与 hover 底色同色（`segmented-control.tsx:123-131`）。hover/pressed 只在**未选中**时生效（`:126-127`），避免与选中态混淆。点击已选中项不触发 `onValueChange`（`:118-122`）。每段是独立 `Pressable` 而非 radiogroup，角色是 `button` + `aria-selected`（`:139-143`）。

**StatusBadge 纯静态**（`status-badge.tsx:174-199`），无交互无动画，四个变体各一套底色+文字色（`:218-243`）。**LoadingSpinner** 只是 `ActivityIndicator` 的透传（`loading-spinner.tsx:156-158`），动画由平台提供——**不受 `prefers-reduced-motion` 控制**（paseo 全仓没有该媒体查询）。

### 3.12 滚动

**ScrollView 是一层"是否在 sheet 里"的分派**（`components/ui/scroll-view.tsx:26-43`），不是滚动行为本身：不在 sheet 里就原样返回 RN `ScrollView`；在 sheet 里，竖向换 Gorhom 的 `BottomSheetScrollView`（让 sheet 跟着滚），横向换 RNGH 的 `GestureScrollView` + `disallowInterruption`。**web 版本（`scroll-view.web.tsx:3`）完全不做这件事**，直接 re-export RN，因为 web dialog 各断点都用普通滚动，也免得把原生手势依赖拉进 web 依赖图。

**滚动条何时出现**（`overlay-scrollbar/`）：paseo 在 web 上自绘 overlay 滚动条而不是用系统条。出现条件是 `contentSize - viewportSize > 0`（`geometry.ts:32-40`），滑块尺寸 `viewport²/content`，下限 36px（`:1`、`:42`）。静止时 `opacity 0.4`，hover 或拖拽中变 1（`overlay-scrollbar.tsx:145-155`），宽度 8px 但命中区 12px 且外扩（`:9`、`:135-144`）。**没有自动隐藏**——只要可滚就一直在。原生用 `scrollbarWidth: "thin"`（`styles/web-scrollbar.ts:1`）。

拖拽是 pointer 事件手工实现的：pointerdown 记起点，window 上跟 pointermove/pull/cancel（`overlay-scrollbar.tsx:50-92`），带 `touchAction: none` + `userSelect: none`（`:142-143`）。还有一条「用户向上滚」的回调，用于把跟随滚动锚点解除（`:76-79`）——**这条是 agent 流底锚点机制的一部分，不属于滚动条本身**。

**嵌套滚动**：由 `ScrollableCodeSurface` 显式开启，两层都开（`scrollable-code-surface.tsx:110-114`，`nestedScrollEnabled`）。

**横向滚动边界提示**：代码块横向滚到头/尾时，在对应侧叠一层渐变遮罩。`EDGE_EPSILON = 1` px 判定贴边（`horizontal-scroll-boundary.tsx:77`），左右遮罩透明度是 `Number(offset > 1)` 与 `Number(offset + viewport < contentWidth - 1)` 的派生值（`:62-67`），遮罩 `pointerEvents="none"` 不挡滚动（`:153`、`:160`）。渐变用 SVG，颜色跟随下方表面（surface0 或 sidebar，`backdrop` prop 决定，`:102-103`、`:149`）。

**Autocomplete 与 Combobox 的滚动跟随**是手写而非虚拟化：`getAutocompleteScrollOffset` 算目标 offset，变化小于 1px 不滚（`autocomplete.tsx:138-160`）；options 在上方时 `scrollToEnd` 且 rAF 再补一次（`combobox.tsx:813-818`）。两者都用 `scrollEventThrottle={16}`（`autocomplete.tsx:267`）。

---

### 3.13 与本项目对照

| paseo 做法（路径:行） | 本项目现状（路径:行） | 影响 | 建议（方向） |
|---|---|---|---|
| 按下高亮是叠加层 + 手势取消，`maxDistance 8`（`press-highlight.native.tsx:92-100`） | `styles.css` 全文件**无 `:active` 规则** | 点下去与松手之间零视觉反馈，长按/拖拽类操作无法确认已生效 | 先给可长按的行加 `:active` 背景；不需要引入手势层 |
| Button 按下 `opacity 0.85`、禁用 `opacity 50`（`button.tsx:133-138`） | `.btn:disabled { color: var(--text-tertiary); cursor: default }`（`styles.css:460-463`）；`.send-btn:disabled { opacity: 0.4 }`（`:496-499`） | 两套禁用表达并存，不一致 | 统一到透明度，色彩留给文字层级 |
| loading 走 `disabled` 路径 + `accessibilityState.busy`（`button.tsx:188`、`:244`） | `.btn[aria-busy="true"]::after` 用伪元素画 spinner（`styles.css:464-479`） | 伪元素 spinner 不占布局宽度，加载时按钮宽度会跳 | 改成固定尺寸的绝对定位或 inline 元素 |
| 图标按钮把 active/hovered/pressed/open 合并成一个高亮（`icon-button-chrome.ts:76-83`） | `.icon-btn:hover` 只有 hover（`styles.css:356-359`） | 菜单展开、拖拽中、选中态无持久高亮 | 给 `.icon-btn` 补 `[aria-expanded="true"]` / `[aria-pressed="true"]` 高亮，与 hover 同色 |
| Tooltip 默认 0 延迟、hover/键盘聚焦唤出、pointer-events none（`tooltip.tsx:231`、`:521`、`:334-343`） | 无 tooltip 层（全仓无 tooltip 组件） | 纯图标按钮只能靠 `aria-label` 说明用途，看不到 | 图标按钮较多的话值得引入；触发走 CSS `:hover` + `:focus-visible` 即可，不必照搬输入模态判定 |
| HoverCard 有 100ms grace + 安全区跟踪（`hover-card.tsx:35`、`:222-231`） | 无 | — | 若加 tooltip，grace 期不能省，否则 trigger 与 tip 之间会闪 |
| 菜单一套引擎两种呈现 + `data-menu-disabled` 键盘跳过（`menu-overlay.tsx:451`、`menu-surface.tsx:328-334`） | 无弹出菜单；`.menu` 是 `ActivityPane.tsx:208` 里的 `<nav>` 静态列表（`styles.css:523-548`），无 `role="menu"` | 溢出操作只能靠面板常驻按钮 | 先定「溢出菜单」是否需要；若需要，键盘模型照 `menu-overlay.tsx:437-476` |
| submenu 固定右侧 + 5px 重叠 + 90/260ms 悬停延迟（`menu-surface.tsx:328-330`、`menu-surface.tsx:54-66`） | 无 | — | 同上 |
| 焦点陷阱 + 焦点归还 + 顶层 overlay 优先拿键盘（`overlay-root.ts:181-198`、`:217-234`） | 无弹层。`AgentOverlay.tsx:102` 有 `role="dialog"` 但无 `aria-modal`、无 Esc、无焦点归还 | 覆盖层打开后 Tab 会跑到背景里 | 引入第一个真弹层时必须同时做焦点陷阱与归还，别分两步 |
| `keyboard-dismiss.ts:4-16` 打开时压键盘三次 | 无 | — | 弹层少时不必 |
| 自绘 overlay 滚动条，静止 0.4 / hover 1，命中区 12px（`overlay-scrollbar.tsx:145-155`、`:135-144`） | 无自定义滚动条，靠系统 | Windows 上滚动条较宽，视觉与设计稿不符；且始终可见 | 若要统一外观，`::-webkit-scrollbar` 够用，不必重写拖拽 |
| 横向滚动边界渐变遮罩（`horizontal-scroll-boundary.tsx:62-67`） | 无；`.tree__item` 等列表无横向滚动提示 | 横向溢出的区域被截断，用户不知道能滚 | 代码/表格类面板加 CSS 渐变遮罩即可 |
| Switch 用 `withTiming` 180ms 插值色与位移（`switch.tsx:28`、`:45-54`） | 无 switch 组件 | 设置项的开关状态是瞬时跳变 | 引入时用 CSS `transition` 即可 |
| SegmentedControl 无动画、按压/选中同底色（`segmented-control.tsx:123-131`） | `.tab--active` 静态填充（`styles.css:860`） | 已一致 | — |
| Toast 不堆叠、hover 暂停、error 3200ms（`toast-host.tsx:54`、`:113`、`:165-178`） | 无 toast 层 | — | 需要时按「单条替换 + 可暂停」起步 |
| Form 的 error 替换 hint，控件本体不变红（`form-field.tsx:39-55`） | 表单控件散落，未见统一 Field 包装 | 校验反馈位置随实现而异 | 抽一个 Field 包装先统一槽位 |
| SearchField 聚焦只改描边、`replaceText("")` 双写清空（`search-field.tsx:106-109`、`:52-55`） | 未见独立 search field 组件 | — | 若加，聚焦不得改内边距 |
| Combobox 键盘首尾回绕 + Enter 无高亮选首项（`combobox-keyboard.ts:1-18`、`combobox.tsx:540-547`） | 无 combobox | — | — |
| web 端 hover 依赖 pointer 事件而绕开 RN `<Modal>`（`tooltip.tsx:520-538`、`scroll-view.web.tsx:3`） | 无 `popover` / `<dialog>` / `showModal`（实测确认） | 一旦引入弹层，`<dialog>` 的焦点与顶层语义会与既有布局冲突 | 用普通 fixed 层 + 自己的焦点管理，不要直接用 `<dialog>` |
| 全仓无 `prefers-reduced-motion`（`switch.tsx` 动画、`loading-spinner.tsx` 均不受控） | **有** `styles.css:401-404`，但只覆盖 `.dot--run` | 本项目这一点比 paseo 强 | 保持；新增动画时把新规则一并写进该媒体查询 |

### 3.14 未核实项

- `unverified — 需确认`：菜单在 Android 上是否走 `BottomSheetModal` 的 Back 键路径（我只读了 `back-press.ts:11-16` 与 `visibility-tracker.ts:60-67` 的订阅逻辑，没有跑起来验证）。
- `unverified — 需确认`：`PressHighlight` 在 web 上退化后，被它包裹的行（侧栏工作区行、`.web`）按下时到底有没有任何反馈——`.tsx` 版本丢弃 `highlightStyle`，但底层 `Pressable` 在 RNW 上是否自带 `:active` 我没有验证。
- `unverified — 需确认`：`floating.tsx` / `FloatingSurface` 内部是否还有额外的 hover/press 处理，我只把它当作渲染容器读，未逐行。
- `unverified — 需确认`：`overlay-root.ts` 的 layer 排序在多层嵌套菜单 + modal 同时存在时的实际顺序，只有 `WEB_SURFACE_PLANE` 与 `OVERLAY_Z` 的字面定义（`:45-50`）。
- 本项目侧：`styles.css` 无 `:active` 是全文 grep 结果（0 命中）；`role="menu"`、`onContextMenu`、tooltip/toast 层、`<dialog>`/`showModal` 均实测不存在。`prefers-reduced-motion` 存在于 `styles.css:401`，与任务简报中「同样缺」的表述不一致，以读到的为准。

## 4. 键盘与文本输入模型

### 4.1 整体模型

paseo 的键盘不是「各处监听 `keydown`」，而是四层收敛的结构：

1. **声明层**：`keyboard/keyboard-shortcuts.ts:259-1173` 一个 `SHORTCUT_BINDINGS` 常量数组，76 条绑定，纯数据（`id`/`action`/`combo`/`when`/`payload`/`help`），不含任何 React。
2. **匹配层**：`resolveKeyboardShortcut`（`keyboard-shortcuts.ts:1541`）是纯函数，输入 event + context + chordState，输出 match 与下一个 chordState。
3. **派发层**：`route-shortcut.ts` 把 `action` + `payload` 翻译成路由或 `dispatch`，`keyboard-action-dispatcher.ts:127-171` 再按优先级在注册的 handler 里找一个能处理的。
4. **展示层**：`buildKeyboardShortcutHelpSections`（`:1706`）与 `resolveShortcutKeysForAction`（`:1630`）从**生效绑定**推导出要画的键位，所以改键之后帮助面板、命令面板、提示徽标三处一起变。

一处关键设计：**匹配与展示共用同一个 `parseBindingChord` 与 `buildEffectiveBindings`**。展示层不是另抄一份默认键位表，而是从当前真正生效的 `combo` 派生（`:1593-1602`），因此用户改键后界面不会继续宣称出厂键位。

边界：这套东西只在桌面 Web 启用。`keyboard/availability.ts:9-14` 的 `keyboardShortcutsAvailable` 就是 `!isNative && !isCompact`，移动端整条链路不挂载（`hooks/use-keyboard-shortcuts.ts:65`、`:388`）。

### 4.2 快捷键注册表

`packages/app/src/keyboard/keyboard-shortcuts.ts`（1763 行）

| 事实 | 值 | 位置 |
|---|---|---|
| 绑定条数 | 76 条（脚本按 `    id: "` 计数，`grep -c` 为 76） | `:259-1173` |
| 覆盖的 action 数 | 37 个 `KeyboardActionId` | `keyboard/actions.ts:19-58` |
| 派发层的 action 数 | 52 个 `KeyboardActionId`（含无键位的命令面板专用项） | `keyboard/keyboard-action-dispatcher.ts:6-58` |
| 重复 combo | 仅 `Alt+Digit` 一处，靠 `desktop: true/false` 互斥 | `:563`（web）、`:591`（desktop） |

76 条不是 76 个功能。绝大多数功能在 mac / 非 mac / web / desktop 四套里各有一条或多条，靠 `when` 互斥共存。最典型的是工作区跳转：`Cmd+Digit`（mac+desktop，`:537`）、`Ctrl+Digit`（非 mac+desktop，`:550`）、`Alt+Digit`（纯 web，`:563`）。

#### 1.1 `ShortcutWhen` 门控字段

定义在 `:69-83`，判定在 `matchesKeyboardShortcutContext`（`:1333-1357`）。

| 字段 | 类型 | 含义 | 判定行 |
|---|---|---|---|
| `mac` | `boolean` | `true` 仅 mac，`false` 仅非 mac | `:1338` |
| `desktop` | `boolean` | `true` 仅桌面，`false` 仅 web | `:1339` |
| `editable` | `false` | **只写 `false`**。文本编辑面获得焦点时禁用 | `:1340-1345` |
| `terminal` | `false` | **只写 `false`**。终端获得焦点时禁用 | `:1346` |
| `commandCenter` | `false` | **只写 `false`**。命令面板打开时禁用 | `:1347` |
| `focusScope` | 单值或数组 | 限定作用域 | `:1348-1355` |

三个「只写 `false`」的字段是刻意的反向布尔：语义是「在什么情况下这条绑定**不该**生效」，因为默认值（文本框可编辑、终端可输入）是多数场景，不写就等于不门控。

`editable: false` 覆盖面比字面意思宽：判定时命中 `focusScope === "message-input"` **或** `"editable"`（`:1342-1343`）。也就是说它同时把消息输入器和任意 `<input>/<textarea>/<select>/contenteditable` 都算进去。作用域由 `keyboard/focus-scope.ts:31-81` 的 `resolveKeyboardFocusScope` 从 `event.target` + `document.activeElement` 两个候选元素推断，共 6 种：`terminal` / `message-input` / `command-center` / `editable` / `browser` / `other`（`actions.ts:1-7`），判定靠 DOM 标记 `[data-testid='terminal-surface']`、`.xterm`、`[data-testid='command-center-panel']`、`[data-testid='message-input-root']`（`focus-scope.ts:41-77`）。

**一个反直觉的规则**：`editable: false` 在用户改键后会被自动摘掉（`withoutDefaultComboGuard`，`:1261-1266`）。注释写明：`editable: false` 描述的是**默认 combo**，不是这个 action。pane-focus 默认带这个守卫，是为了让 `Cmd+Shift+Arrow` 在输入框里保持选文本；用户一旦改了键，这条描述就失效了，继续留着会让用户在设置里挑的键「在输入框里死活不触发」。平台、命令面板、终端、focusScope 四个守卫则保留，因为它们描述的是 action 本身和它在哪儿合理。

#### 1.2 冲突处理：三层，各有各的规则

**第一层：binding 数组内的同 combo 冲突。**
`resolveInitialChordStep`（`:1422-1472`）按数组顺序遍历，第一条命中的即胜出：

```
if (!singleComboMatch) {
  singleComboMatch = buildMatchFromBinding(binding, event);   // :1455-1457
}
```

**多步 chord 优先于单步。** 同一条前缀上如果有任何 binding 是多步 chord，单步 match 会被丢弃，返回 `match: null` + `preventDefault: true` + 进入 step 1（`:1462-1470`）。测试 `keyboard-shortcuts.test.ts:585` 明确覆盖：把 `Ctrl+Shift+T` 改成 `Ctrl+W S` 后，按 `Ctrl+W` 不触发 `workspace.tab.close.current`，而是等第二步。这是为了避免「用户正在敲两步 chord 的中间态被别的单键抢走」。

**第二步的裁决是 `break` 而不是「继续找更好的」**（`:1508-1511`），按候选顺序第一条走完的赢。

**chord 超时 1500ms**：`CHORD_TIMEOUT_MS`（`:1378`），超时回调把 chordState 清空。

**修饰键自身不参与匹配**（`resolveKeyboardShortcut` 首段，`:1552-1554`）：浏览器在每个含修饰键的组合之前会先发一次修饰键自己的 `keydown`，若不拦会把等待中的 chord 退回第一步。判断用 `isModifierKeyCode`（`shortcut-string.ts:180-182`，集合在 `:181-191`）。

**第二层：`action` → 具体 handler 的冲突。**
`keyboard-action-dispatcher.ts:144-170`：候选先按 `actions.includes(action.id)` → `enabled` → `isActive?.()` 过滤，然后排序 `priority` 降序，**同 priority 时 `registeredAt` 降序**（`:153-158`），也就是后注册的先试。第一个 `handle()` 返回 `true` 的赢。

`hooks/use-keyboard-action-handler.ts:18-38` 的注释把这里最容易踩的坑写得很直白：**不要每次渲染都重新注册**。`registerHandler` 会递增注册序号，一个频繁重渲染的控件（比如运行中 agent 的 mode 控件）会因此排到另一个前面，抢走按键、在错误的界面上生效。所以 hook 只在 `(handlerId, priority, actions 内容)` 变化时注册，`handle`/`isActive` 从 ref 实时读，`enabled: true` 恒定挂上、把真实开关折进 `isActive` 里实时判定（`:44-60`）。

**handlerId 是身份不是标签**（`keyboard/handler-id.ts:1-33`）：dispatcher 每个 id 只保留一个 handler，id 撞车时后者顶掉前者，被顶掉的那个在整个挂载期内静默失去键盘。workspace 面板身份因此由 `name:serverId:workspaceId[:paneId]` 拼成，paneId 必须带 workspace 命名空间（每个 workspace 的主 pane 都叫 `"main"`）。

**第三层：注册表 vs 显示层的不一致。** `getBindingIdForAction`（`:1566-1581`）按数组顺序找第一条 help.id 匹配且平台匹配的绑定。这意味着**同一个 help id 有多条平台绑定时，「用户改的是哪一条」由数组顺序决定**。改键存的是 binding id，`help` 的 `label`/`section` 只是给人看的。

#### 1.3 `combo` 书写规范与跨平台修饰键映射

书写规范定义在 `keyboard/shortcut-string.ts`。

**格式**：`Mod1+Mod2+KeyPart`，`+` 分隔；多步 chord 用**空格**分隔（`parseChordString`，`:151-153`：`s.split(" ").map(parseShortcutString)`）。所以 `"Ctrl+W S"` 是两步，`"Cmd+Shift+O"` 是一步。

`parseShortcutString`（`:89-147`）只认 5 个修饰键 token：`Cmd`→`meta`、`Ctrl`→`ctrl`、`Alt`→`alt`、`Shift`→`shift`、`Mod`→`mod`（`:98-111`）。`Mod` 是跨平台抽象，**不能与 `Cmd`/`Ctrl` 同时出现在一个 combo 里**——`matchesCombo` 在 `combo.mod` 为真时会按当前平台选 `metaKey` 还是 `ctrlKey`，然后又反查 `!!combo.ctrl !== event.ctrlKey`，两个都写必然有一个平台永远不匹配（`:1311-1320`）。实际绑定里没有一个用 `Mod`，全用显式 `Cmd`/`Ctrl` + `when.mac` 显式分叉；`Mod` 只保留给用户改键的输入路径（`parseShortcutString` 收，`comboStringToShortcutKeys` 画成 `mod`，`:206-210`）。

**键名表** `KEY_MAP`（`:16-64`）覆盖：26 个字母（映射到 `KeyX` + 小写 `key`，`:16-19`）、10 个数字（含 `shiftedKey` 符号位，`:21-34`）、标点符号（各带 `code` + `key` + `shiftedKey`，`:37-46`）、`Space`/`Enter`/`Backspace`/`Escape`/方向键/`Tab`/`Delete`/`Home`/`End`/`PageUp`/`PageDown`/`Insert`（`:47-61`）、`F1`-`F12`（`:63-65`）。`SHORTCUT_KEY_NAMES` 导出整个词表（`:71`），供改键录制 UI 遍历，避免手抄一份样本。

`Digit` 是**通配键**：`:35` 单独一行 `KEY_MAP["Digit"] = { code: "Digit" }`，没有 `key`。匹配时 `parseDigit`（`:1269-1284`）从 `event.code` 的 `DigitN` / `NumpadN` 前缀取数，限定 1-9，最后兜底看 `event.key` 是否是字符 `1`-`9`。所以 `Cmd+Digit` 一次绑定覆盖 9 个跳转，help 里用 `defaultDisplayKeys: ["mod", "1-9"]` 声明（`:541`）。

**`repeat: false`**（`ShortcutBinding` 字段，`:107`）：`parseBinding` 在 `:1199-1206` 把 `repeat = false` 只挂到 chord 的**最后一步**，匹配时 `combo.repeat === false && event.repeat` 则不匹配（`:1326-1327`）。用于 `Shift+Tab` 循环 mode、voice-toggle 这类长按会出事的键。

**`preventDefault` / `stopPropagation`**：`buildMatchFromBinding`（`:1410-1420`）默认两者都是 `true`。`agent-interrupt`（Escape，`:1140-1152`）显式两个都设 `false`——中断不该吞掉事件，同一个 Escape 可以继续被别的层（如编辑器）处理。

**跨平台字母/符号匹配的坑，代码里逐条处理**（`matchesKeyOrCode`，`:1286-1308`），这几条是可迁移性最强的部分：

- `combo.key` 为空（只有 `code`）→ 纯 code 比较。
- `combo.shift === true` 且有 `shiftedKey` → `event.key` 等于 shifted 字符也算（`:1292-1294`）。
- **非拉丁布局**：录制到西里尔字母（如 KeyB 上的 `и`）时存的是物理 A-Z 键。派发时若 `combo.key` 是单个小写字母、`event.key` 是任意 Unicode 字母且不是小写拉丁，就回落到 `event.code` 比较（`:1296-1300`）。这样非拉丁用户能触发自己录的键，但 Dvorak 这类拉丁布局**不会**因此在同一物理键上多出一条绑定。
- **macOS Option 改写 `event.key`**：Option+T → `†`，Option+[ → `“`。所以带 `alt` 的字母/括号绑定只能按 `code` 匹配（`:1302-1304`）；但**不带 alt 的绑定保持 key 优先**，否则 Dvorak 上的 Cmd+V（物理 Period）会变成触发 Cmd+·（`:1303-1305`）。
- `codeFallback: true`（只有 `Space` 和 `Enter` 有，`:45-46`）→ 允许用 code 兜底。

`normalize-display-chord.ts` 是**纯展示层**的兜底，不是解析：`:13-27` 处理 `keys={[]}` 这种会被包成 `[[]]` 的陷阱（空数组 truthy，空徽标会被画出来），以及 chord 中含空步骤时返回 `null`。

#### 1.4 `help` 段与设置页 / 帮助面板的关系

数据结构三层：`ShortcutSectionId`（`:56`，5 个：`general` / `workspaces` / `tabs-panes` / `layout` / `agent-input`）→ `KeyboardShortcutHelpSection`（`:58-62`）→ `KeyboardShortcutHelpRow`（`:42-53`）。

**`help` 是可选的**，76 条里 74 条有，两条没有：

| 无 help 的绑定 | action | combo | 位置 |
|---|---|---|---|
| `sidebar-toggle-right-ctrl-backquote` | `sidebar.toggle.right` | ``Ctrl+` `` | `:949` |
| `message-input-dictation-confirm-enter` | `message-input.action` | `Enter` | `:1153` |

这两条是**故意不暴露成可改键行**的。第二条尤其关键：`Enter` 在听写确认时要被抢走，但它不是一条用户可配置的绑定——测试 `keyboard-shortcuts.test.ts:917` 名为「does not expose Enter send behavior as rebindable shortcut rows」。第一条是 web 端的右键栏切换兼容键，没有独立 label。

**排序不跟定义顺序走**。`SHORTCUT_HELP_ROW_ORDER`（`:156-208`）为 5 个 section 各列一份显式顺序数组，注释写明理由（`:153-155`）：打开这个面板的人想找的那个键应该在 section 顶部，而不是沉底。`buildKeyboardShortcutHelpSections` 的 `rank()` 把不在数组里的 row 排到末尾（`:1747-1751`），但**单元测试 `:874` 会因为新增快捷键没登记位置而失败**，所以不存在「静默沉底」。

**section 顺序**在 `SHORTCUT_HELP_SECTION_ORDER`（`:129-135`），注释「most-reached-for first」。

**help 行去重**用 `rowKey = ${help.section}:${help.id}` 的 `seenRows`（`:1719-1725`）。同一个 help id 被多条平台 binding 共享，只出一行，键位取**第一条平台匹配**绑定派生的（`getDefaultKeysForAction`，`:1604-1617`）。所以 help id 才是「用户看到的那一行」，binding id 才是「存改键的那一条」，两者用 `getBindingIdForAction`（`:1566`）连接。

**`defaultDisplayKeys` 只在 combo 表达不了语义时用**（`ShortcutHelp` 注释，`:88-95`）：只有两种情况——`Digit` 通配键（显示 `1-9`）和 `Shift+?`（Shift 由字符本身隐含）。其余一律从 combo 派生，**所以改键后帮助面板显示的是新键位而不是出厂键位**。改键路径上 `buildEffectiveBindings` 会把 `defaultDisplayKeys` 摘掉（`:1245-1251`），逻辑和 `editable` 守卫一致。

**三个消费面**：

| 消费面 | 入口 | 数据来源 |
|---|---|---|
| 快捷键帮助弹层 `Shift+?` | `components/keyboard-shortcuts-dialog.tsx:30-41` | `buildEffectiveBindings(overrides)` → `buildKeyboardShortcutHelpSections` → `filterShortcutHelpSections` |
| 设置页快捷键区 | `screens/settings/keyboard-shortcuts-section.tsx:339` | 注意这里直接用 `DEFAULT_BINDINGS`（`:339` 没传第二参），**列表里的键位是出厂值，改键后的实际值由每行的 `resolveShortcutKeysForAction` 单独取** |
| 单个徽标提示 | `hooks/use-shortcut-keys.ts:9-21` | `resolveShortcutKeysForAction(actionId, overrides, platform)` |

帮助弹层的搜索（`keyboard/shortcut-help-search.ts:9-88`）做了别名展开：mac 上 `mod`/`meta` 同时接受 `cmd`/`command`，`alt` 接受 `option`；非 mac 上 `mod`/`ctrl` 接受 `ctrl`/`control`，`meta` 接受 `win`/`windows`（`:11-27`）。而且**按 combo 逐个展开、不 flatten**（`:36-38` 注释）——多步 chord flatten 后组合数爆炸，还会给用户根本不会同时按的键组编出别名。

### 4.3 注册与持久化

**能改键。** 但 `stores/keyboard-shortcuts-store.ts` **不是持久化层**——这是个常见的命名误导，需要先纠正。它只有 81 行，存的是**运行期 UI 状态**（`:11-16`）：`commandCenterOpen` / `commandCenterScope` / `shortcutsDialogOpen` / `capturingShortcut` / `altDown` / `cmdOrCtrlDown` / `showShortcutBadges` / `sidebarShortcutWorkspaceTargets`。

其中 `showShortcutBadges` 是长按修饰键后侧栏浮出数字跳转徽标：`SHORTCUT_BADGE_DELAY_MS = 150`（`:5`），修饰键按下 150ms 后才显示，松开立刻隐藏（`updateBadgeTimer`，`:31-49`）。

**真正的持久化分三层：**

**① 存储适配**（`hooks/use-keyboard-shortcut-overrides.ts`）：
- key `@paseo:keyboard-shortcuts-overrides`…实际是 `:12` `const STORAGE_KEY = "@paseo:keyboard-shortcut-overrides"`，底层 AsyncStorage。
- 读取走 `readValidatedJson` + zod schema `z.record(z.string(), z.string().nullable())`（`:15`、`:77`）——即 `Record<bindingId, comboString | null>`。
- react-query `QUERY_KEY = ["keyboard-shortcut-overrides"]`，`staleTime: Infinity, gcTime: Infinity`（`:30`）。改键是本地状态，不做重取。
- `hasOverrides = Object.keys(overrides).length > 0`（`:42`）驱动「Reset all」按钮的可用性。

**② 写入队列**（`keyboard/shortcut-override-store.ts:51-93`）：这是全文最值得抄的一段工程细节。`enqueue`（`:55-60`）把所有写操作串成一条 Promise 链，且**链条本身吞掉 rejection**（`tail = run.then(noop, noop)`，`:59`）以免一次失败卡死后续。注释（`:36-50`）列出不做排序会坏在哪两处：

- 同一 binding 的两次改动交错，先一次失败回滚会把后一次已持久化的值也盖掉。
- 「Reset all」的 `remove` 和用户随后一次改键的 `write` 竞态，导致刚改的键被删。

失败时 `cache.write(prev)` 整图回滚（`:72-76`），因此回滚仍然是一次整体还原。代价写在注释里（`:48-50`）：连点两次时第二次要等一个存储往返才更新行——但每次改动都来自设置页的一次点击，队列深度不超过两三个。

`withOverride`（`:96-107`）用解构删 key 而不是展开，因为 **`null`（已解绑）和 key 不存在（用默认）是两个不同状态**，展开无法删除。

**③ 界面录制**（`screens/settings/keyboard-shortcuts-section.tsx`）：

| 操作 | 实现 | 位置 |
|---|---|---|
| 开始录制 | `startCapture(bindingId)` + `setCapturingShortcut(true)`（写进全局 store） | `:347-355` |
| 录制中吞键 | `window.addEventListener("keydown", handleKeyDown, true)`，**捕获阶段**，逐个 `preventDefault()` + `stopPropagation()` | `:370-397` |
| 退格删上一步 | 无修饰键的 `Backspace` → `capturedCombos.slice(0, -1)` | `:379-383` |
| 只按修饰键 | `keyboardEventToComboString` 返回 `null`（`shortcut-string.ts:245-247`），改写 `heldModifiers` 实时显示 | `:385-388` |
| 保存 | `capturedCombos.join(" ")`（空格即 chord 分隔符） | `:358-365` |
| 丢失焦点 | `useIsFocused()` 变 false 即 `cancelCapture()` | `:367-371` |
| 屏蔽桌面缩放快捷键 | `menu.setCapturingShortcut(true)`，让 `Cmd+-` 被录下来而不是缩放窗口 | `:406-414` |

**录制期间全局快捷键引擎整体静默**：`useKeyboardShortcuts` 的 keydown 里检查 `store.capturingShortcut` 就直接 return（`hooks/use-keyboard-shortcuts.ts:326-329`）。同时录制自身用了捕获阶段监听，等于抢在全局监听之前——即使那一行检查失效，顺序也仍然正确。

**冲突校验：没有。** 保存路径（`:358-365`）直接 `setOverride`，不检查新键是否和别的 binding 撞。后果是运行时由第一层规则兜底：数组里先声明的 binding 赢（`:1455-1457`），用户新绑的键静默失效。「已解绑」和「解绑后恢复默认」在 UI 上是两个不同的动作（`onClearOverride` → `clear` 写 `null`，`onRemoveOverride` → `remove` 删 key，`:418-424`），对应设置行菜单里的 X 与 ↺ 两个图标（`:50-52`）。

**改键时保存的是 binding id，不是 action id**（`:365` `setOverride(capturingBindingId, ...)`）。这条约束反过来限制了重命名：`keyboard-shortcuts.ts:265-268` 的注释记着 `agent-new-cmd-shift-o-mac` 这个 id 在 `Cmd+Shift+O` → `Cmd+O` 的迁移中被**故意保留**，因为用户存的自定义键是按 id 索引的，改 id 会在升级时静默丢掉。

**index 载荷的特殊处理**：`normalizeCapturedShortcutCombo`（`:1214-1218`）——用户把 `Cmd+Digit` 改成 `Cmd+3` 时，若该 binding 的 payload 是 `{type:"index"}`，把结尾数字还原成 `Digit`。否则工作区跳转立刻从「跳 1-9」退化成「只跳第 3 个」。

**数字徽标的诚实性约束**（`getWorkspaceIndexJumpModifierKey`，`:1674-1704`）：徽标只在「当前生效的 `workspace.navigate.index` 绑定仍是单个基于 `Digit` 通配的 combo、且恰好只有一个修饰键」时显示。解绑、改成具体数字、多步 chord、需要两个修饰键——四种情况一律返回 `null`，因为徽标会宣称比快捷键实际能做的更多。副作用是 `key === badgeModifierKey` 永不成立（`event.key` 不可能是 `null`），徽标就永远不出现；同理 `badgeModifierKey` 变化时主动 `resetModifiers()`（`use-keyboard-shortcuts.ts:126-130`），否则按住修饰键改键会让徽标卡住到 blur。

### 4.4 快捷键目标订阅

paseo **没有**「注册表 + target 节点」的 DOM 事件委托式结构，而是**反向注册**：谁想响应某个 action，谁自己向全局 dispatcher 注册一个 handler。

**注册端**：`hooks/use-keyboard-action-handler.ts:39-62`。注册时机与新鲜度保证见上文冲突处理第二层。

**作用域的两条通道：**

**通道 A —— handler 注册（`dispatcher`）。** 走 `route-shortcut.ts:37-63` 的 `PASSTHROUGH_DISPATCH`，action id 直接映射到 `{id, scope}`，scope 是 `"global" | "message-input" | "sidebar" | "workspace"`（`keyboard-action-dispatcher.ts:1`）。派发时遍历所有注册 handler，scope 只用于 handler 自己判断是否该响应。

**通道 B —— 状态订阅（store）。** 这一条更巧，绕过了「快捷键怎么找到当前该响应哪个组件」的问题。

**`components/workspace-shortcut-targets-subscriber.tsx`（27 行，headless）**：从 `useSidebarModel()` 拿到 `shortcutModel.shortcutTargets`，直接塞进全局 store 的 `sidebarShortcutWorkspaceTargets`（`:11-18`）。禁用时置空（`:12-15`），卸载时也置空（`:20-24`）。**它自己不渲染任何东西**（`return null`，`:26`）。

然后 `routeKeyboardShortcut` 拿到这份列表：`workspace.navigate.index` 用 `ctx.sidebarShortcutTargets[payload.index - 1]` 绝对定位（`route-shortcut.ts:126`），`workspace.navigate.relative` 用 `getRelativeSidebarShortcutTarget` 做相对跳转（`:142-148`），两者都把 index/delta 翻译成具体的 serverId/workspaceId，再走 `navigate-workspace`（`use-keyboard-shortcuts.ts:164-170`）。**列表为空时一律返回 `NONE`**（`:127`、`:140`）——这正是折叠/隐藏态下快捷键自然失效的机制。

所以：**当前该响应的是谁，不由快捷键引擎去查询 DOM，而是当前可见的那批组件把「我的身份」推给引擎**。侧栏折叠、状态分组折叠、Pinned 折叠、focus mode 时列表为空，`Cmd+3` 自然落到 `workspace.navigate.index` 的其它分支而不是跳到一个看不见的行。

**`components/workspace-pin-shortcut-handler.tsx`（9 行）是同一思路的最小版本**，注释写明了理由（`:3-5`）：pin 快捷键原本挂在侧栏行上，行没渲染（折叠的分组、focus mode）快捷键就消失。现在它独立成一个 headless 组件调 `useGlobalWorkspacePinAction()`，**放在自己组件里而不是根布局，是为了不让每次 pin 切换都重渲染整个 app shell**。

`use-global-workspace-pin-action.ts:10-40` 是作用域语义最清楚的一例：

- 「活跃工作区」定义为**路由选择**，不是获得焦点的那块 pane。注释（`:16-19`）说明今天二者等价（pane 属于被路由的工作区；`/settings` 解析不出选择，正好让 handler 禁用），但如果将来 pane 跨工作区就要重新审视。
- 投影字段刻意收窄到 `{id, pinnedAt}`（`:30-33`），否则 pin 状态变化会被 `gitRuntime`/`diffStat` 的每次 tick 带着重渲染。
- `id` 是投影值而非直接用路由 id，因为路由带的是**不保证等于** descriptor id 的不透明 workspace id（`:26-30`）。
- 没找到 workspace 时 `pinnedAt: null` 单独表达不了，得靠字段为 `null` 这个事实（`:24`）。

### 4.5 输入控件的键盘优先级

只写**顺序**，Enter 的具体判定条件见 ui-patterns 文档第 5 节。

**全局 keydown 的五道前置闸（`hooks/use-keyboard-shortcuts.ts:313-361`）：**

| 序 | 条件 | 行为 | 位置 |
|---|---|---|---|
| 0 | `shouldHandle()`：`document.visibilityState !== "visible"` 或无 `document` | 整个快捷键系统不响应 | `:131-137`、`:314-316` |
| 1 | `dispatchTopWebOverlayKeyDown(event)` 返回 `true` | **最顶层浮层先拒绝**，然后 `stopImmediatePropagation()`，全局快捷键完全不参与 | `:320-323`、`lib/overlay-root.ts:165-192` |
| 2 | `isImeComposingKeyboardEvent(event)` | 直接 return。IME 确认候选的 Enter 不得变成发送消息 | `:326-329`、`utils/keyboard-ime.ts:1-6` |
| 3 | `store.capturingShortcut` | 直接 return（正在录制快捷键） | `:325-328` |
| 4 | `Escape` + `pathname.startsWith("/settings")` + 非移动端 + `hasActiveWebOverlay()` | 直接 return，让设置页浮层自己处理 Esc | `:333-340` |
| 5 | `Shift` 键且当前 alt/cmd 状态为真 | 复位修饰键状态（收起数字徽标） | `:346-352` |
| 6 | — | `resolveKeyboardFocusScope` → `resolveAndPerformShortcut` | `:353-361` |

**IME 判定的两形态**（`utils/keyboard-ime.ts:5`）：`Boolean(event.isComposing) || event.keyCode === 229`。后者是老 WebKit / Android 的合成中间态回退。

**浮层吞键的两级**（`lib/overlay-root.ts`）：
- 顶层的 `getKeyHandler()` 先吃（`:186-189`）。吃掉后 `stopImmediatePropagation()`，捕获阶段全局监听再也收不到。
- `Tab` 的焦点循环由浮层自己实现（`:170-185`）：算出 scope 内可聚焦元素，首尾各补一次 wrap，并优先落到 `[data-menu-item="true"]` 的第一项（`focusFirstElement`，`:132-141`）。
- 浮层堆叠顺序是 `(layer, order)` 字典序（`getTopWebOverlay`，`:104-110`），不是 DOM 顺序。
- 浮层吞键**也先让 IME 过**：`event.isComposing || event.key === "Process"` 直接 return `false`（`:167-169`），注释说明 modal 不能在浏览器提交组合文本前把 IME 候选确认变成浮层快捷键。
- `handleWebOverlayKeyDown` 是同一函数的 fallback 窗口监听（`:195-203`），给没走快捷键引擎的键兜底。

**Esc 的多级顺序，从先到后：**

| 级 | 处理者 | 触发条件 | 位置 |
|---|---|---|---|
| 1 | `dispatchTopWebOverlayKeyDown` | 顶层浮层的 keyHandler | `use-keyboard-shortcuts.ts:320` |
| 2 | 设置页路径短路 | `Escape` + `/settings` + 有浮层 → 全局**不处理** | `:333-340` |
| 3 | `agent-interrupt` binding | `when: {commandCenter: false, focusScope: ["message-input", "other"]}` | `keyboard-shortcuts.ts:1140-1152` |
| 4 | 消息输入器内部 | 见下 | `composer/index.tsx` |

第 2 条在 `routeKeyboardShortcut` 里还有一层：`agent.interrupt` 若发生在 `/settings` 且非移动端，**根本不派发给 agent，而是被改写成 `navigate-last-workspace`**（`route-shortcut.ts:180-187`）——Esc 在设置页是「回到上一个工作区」，不是中断。这一点很有意思：同一个 binding 在不同路由下语义不同，而差异写在路由层而不是拆成两条 binding。

第 3 条的 `dispatch` 落到 handler 后还有第四级：`composer/index.tsx:551` 先判 `isPaneFocused`（不在 pane 内直接 return false），再对 `agent.interrupt` 先问 `runKeyboardAction("dictation-cancel")`。

第 3 条的两个关键点：`commandCenter: false` 保证命令面板开着时 Esc 归命令面板；`focusScope: ["message-input", "other"]` **明确排除** `terminal`、`editable`、`command-center`、`browser`——所以在终端或任意输入框里按 Esc 不会误中断 agent（测试 `keyboard-shortcuts.test.ts:409` 名为「leaves Escape to an editable field」）。它的 `preventDefault: false` + `stopPropagation: false`（`:1147-1148`）意味着中断之后事件继续往下传，同一个 Esc 可以被编辑器之类的消费。

第 4 条 `composer/index.tsx:552`：`messageInputRef.current?.runKeyboardAction("dictation-cancel")` 返回 `true` 就 return——**听写中 Esc 取消听写，不中断 agent**。落到 `composer/input/state.ts:164-170`：`dictation-cancel` 只在 `isDictationRecording()` 为真时执行，否则返回 `false`，事件继续下沉。

**composer 内部 Enter 的四段顺序**（`composer/input/input.tsx:410-437`，此处只列结构）：
1. `isImeComposingKeyboardEvent` → return（`:411`）。
2. `onKeyPressCallback`（补全浮层）先问，吞掉就 return（`:413-420`）——**弹层优先于发送**。
3. `key !== "Enter"` / `!submitOnEnter` / `shiftKey` 才继续（`:422-425`）。
4. 运行时 `Cmd/Ctrl+Enter` 走 alternate（排队），否则默认发送（`:427-436`）。

第 2 步的 `onKeyPressCallback` 就是 `use-agent-autocomplete.ts` 传进来的 `onKeyPress`——补全面板用上下键 + Enter 选中，选中一次 Enter 不应该既选中又发消息。

**改键捕获的优先级同样靠捕获阶段**（`keyboard-shortcuts-section.tsx:394` `addEventListener("keydown", handler, true)`）。

### 4.6 斜杠命令

`client-slash-commands/index.ts` 只有 81 行——paseo 的**客户端**斜杠命令就 2 条（`:17-40`）：

| name | aliases | kind | execution |
|---|---|---|---|
| `/exit` | `quit`, `q` | `archive-agent` | `immediate` |
| `/clear` | `new` | `replace-agent-with-draft` | `immediate` |

字段定义在 `:5-15`：`aliases` / `description` / `descriptionKey`（i18n key）/ `argumentHint` / `kind` / `execution`。

**清单如何生成。** 不是一份静态表，是四个来源在补全面板打开时合并（`use-agent-autocomplete.ts:213-227` → `plugins/client-slash-commands/model.ts:15-44`）：

1. **built-in**：`CLIENT_SLASH_COMMANDS`
2. **plugin**：`pluginCommands`
3. **provider**：运行时向 host 拉的 `commands`（`use-agent-commands-query`，`use-agent-autocomplete.ts:6-9`）

**provider 命令不参与补全**，只作为 inline skill 场景的独立集合：`filterInlineSkillCommandEntries` 只保留 `source === "provider" && kind === "skill"`（`:79-82`、`utils/agent-command-autocomplete.ts:79-82`）。补全列表里 root 命令 = built-in + plugin + provider（`:217-227`），但 `activeSlashCommand.position === "inline"` 时换成只列 provider 的 skill（`:229-231`）。

**同名冲突：built-in 赢**，plugin 命令被丢弃并 `console.warn`（`model.ts:31-36`、`use-agent-autocomplete.ts:220-225`）。provider 命令的 `name` 若已被 built-in 或 plugin 占掉，也静默不入列（`model.ts:38-40`）。alias 同样占位（`model.ts:26-29`）。

**何时显示。** `findActiveSlashCommand`（`utils/agent-command-autocomplete.ts:87-117`）从**光标位置往前找最后一个 `/`**，逐个回退检查：

- `/` 前一个字符必须是空白或位置 0（`:100-103`）——所以 `foo/bar` 里的斜杠不触发。
- `/` 之后的 query 不能含 `/ 空白 换行 制表 " '`（`INVALID_SLASH_COMMAND_QUERY_CHARS`，`:85`）。
- 命中即返回 `SlashCommandRange {start, end, query, position}`，`position` 由 `slashIndex === 0 ? "start" : "inline"` 决定（`:111-112`）。

命令补全面板可见性 = `activeSlashCommand !== null`（`use-agent-autocomplete.ts:388`），mode 解析 file 优先于 command（`:263-269`）。若 command 模式下 `canLoadCommands` 为假（无 serverId，或无 agentId 且非草稿态）则整体不显示（`:281-289`）。

**补全如何过滤。** `filterAndRankCommandAutocompleteEntries`（`utils/agent-command-autocomplete.ts:51-76`）：

- query 为空 → 原样返回全部。
- 否则用 `scoreTextFields(query, [name, ...aliases])`（来自 `@getpaseo/protocol/search/text-match`）打分，分数为 null 的丢弃；按分数排序，同分按 `name.localeCompare`（`:67-72`）。
- 再过一道 `orderAutocompleteOptions`（`components/ui/autocomplete-utils`，`use-agent-autocomplete.ts:239`）。

**与普通输入如何区分。** 触发字符是 `/`，且必须行首或前有空白。真正的分界在**提交时**（`resolveClientSlashCommand`，`client-slash-commands/index.ts:42-59`）：

| 条件 | 行为 | 行 |
|---|---|---|
| `hasAttachments` | **直接返回 `null`** —— 有附件时不认斜杠命令，按普通文本发送 | `:44-46` |
| 不以 `/` 开头（trim 后） | `null` | `:47-49` |
| 命令名含空白 | `null` → **客户端命令不允许带参数** | `:51-54` |
| 名字或别名表里没有 | `null` | `:57` |

**是否可带参数**：客户端命令**不可**（`:52` 的 `/\s/` 检查）。plugin 命令**可以**——`resolvePluginClientSlashCommand`（`model.ts:46-56`）用 `/^\/([^\s]+)(?:\s+([\s\S]*))?$/` 解析出 `args`。这是两种命令模型的分界。

**是否可带附件**：一律不允许，`hasAttachments` 时两个 resolver 都返回 `null`（`index.ts:44-46`、`model.ts:47`）。

**`execution` 两种模式**：`"immediate"` 与 `"insert"`。`runClientSlashCommand`（`composer/index.tsx:1403-1407`）第一行就是 `if (command.execution !== "immediate") return false`，即 `"insert"` 模式由调用方回退到普通提交。当前两条客户端命令都是 `immediate`。

**提交时的判定顺序**（`composer/index.tsx:1696-1711`）：先客户端命令（`resolveClientSlashCommand`）→ 再 plugin 命令（`resolvePluginClientSlashCommand`）→ 都没命中才走普通发送。`immediate` 命令执行前会先做完整的发送清理（`:1409-1415`）：blur、清草稿、清输入、清附件选择器、重置抑制状态、清错误。失败只写 `setSendError`，不抛。

**补全面板选中后如何回填**：`applySlashCommandReplacement`（`utils/agent-command-autocomplete.ts:119-124`）——替换 `[start, end)` 区间，若该命令在文本末尾则补一个尾随空格（`:123`）。

### 4.7 语音输入

**不是「只有麦克风权限与音量反馈」，是有完整听写与实时语音对话两条独立链路。** 但需要说清楚：**两条链路都不参与键盘事件的调度**——它们只是作为 `message-input.action` 的 payload kind 被派发。

**听写（dictation，压->转->文本）**

- `dictation/dictation-stream-sender.ts`（355 行）是一个**非 React 状态机**，职责写在类注释里（`:40-47`）：维护 base64 PCM 分段的有序缓冲、按 `dictationId` 起停流、按 `seq` 补发缺失段、finish/cancel。设计上**发送保持同步、无内部异步互斥锁**（`:49-51`），这样 enqueue 不会因 in-flight await 或合并逻辑漏掉一次 flush。
- 上限 `MAX_CHUNKS_PER_FLUSH_TURN = 128`，排空空闲超时 `DICTATION_DRAIN_IDLE_TIMEOUT_MS = 30_000`（`:6-7`）。
- 音频格式常量 `PCM_DICTATION_FORMAT = "audio/pcm;rate=16000;bits=16"`（`hooks/use-dictation.shared.ts:34`）。
- 状态机只有 4 态：`"idle" | "recording" | "uploading" | "failed"`（`use-dictation.shared.ts:3`）。
- `DictationStreamSender` 的接口注释说明服务端要 ack：`dictation_stream_ack` 消息类型 + `acknowledgedSeq`（`:12`、`:62`）。
- 录音期间**输入框被设为不可编辑**：`composer/input/input.tsx:1994` `editable={!isDictating && !isRealtimeVoiceForCurrentAgent && !disabled}`。这是对键盘输入影响最大的一处——不是「边听边打字」，而是直接锁死。
- 粘贴同样被拦（`:472`）：`!isConnected || disabled || isDictating || isRealtimeVoiceForCurrentAgent` 时不处理。
- UI 层 `components/dictation-controls.tsx`（404 行）按状态给不同控件：未激活只有一个 Mic 按钮（`:66-77`），激活后是音量条 + 计时 + 取消/确认（`:80-97`）。失败态 `handleCancel` 换成 `onDiscard`（`:46`），并额外给出重试。计时格式 `formatDuration`（`:27-30`）。

**录音期间对键盘输入的影响**——只有 3 条，全部通过 `message-input.action` 的 kind 派发（`route-shortcut.ts:78-88`）：

| 键 | binding | kind | 行为 | 位置 |
|---|---|---|---|---|
| `Cmd/Ctrl+D` | `message-input-dictation-toggle-*` | `dictation-toggle` | 录音中 → 标记转写待发 + 确认；否则开始录音 | `:1116-1139`；`composer/input/state.ts:171-180` |
| `Escape` | `agent-interrupt` 的兄弟路径 | `dictation-cancel` | 录音中 → 取消听写；否则事件继续下沉去中断 agent | `composer/index.tsx:552`、`state.ts:164-170` |
| `Enter` | `message-input-dictation-confirm-enter`（**无 help，不可改键**） | `dictation-confirm` | 录音中 → 标记转写待发 + 确认；否则返回 `false` 让 Enter 走正常发送 | `:1153-1159`；`state.ts:146-153` |

关键设计：`dictation-confirm` 和 `dictation-cancel` 的 handler 都是 `if (actions.isDictationRecording()) {...} return false`——**不录音时返回 `false`，让同一个键落到它的原始用途**。一个 `Enter` 同时是「确认听写」和「发送消息」，靠返回布尔决定谁赢。

**实时语音（voice）**

- `voice/voice-runtime.ts`（953 行），7 态：`disabled / starting / listening / submitting / waiting / playing / stopping`（`:31-39`）。
- 与听写不同，它是**全双工**：agent 回复走 TTS 分句播放，**下一句要等上一句放完**（`:16-18`），所以句间有短停顿。为此有「思考音」提示音 `THINKING_TONE_MIN_SILENCE_MS = 1500`（`:15-16`）——只在静音超过句间空隙之后才响，因为那是用户无法解释的等待。
- VAD 参数集中在 `voice/realtime-voice-config.ts`（14 行，注释解释每个值的取舍）：`volumeThreshold: 0.12`（头戴麦输入音量低，阈值放低以免要求用户大声说话）、`confirmedDropGracePeriodMs: 1000`（避免词内正常停顿被判停）、`silenceDurationMs: 2000`（让「思考停顿」不结束轮次）、`speechConfirmationMs: 120`、`detectionGracePeriodMs: 700`、`interruptGracePeriodMs: 1000`（延迟语音起始打断，忽略瞬时噪声）。
- 音量是**独立遥测通道**：`DISPLAY_VOLUME_PUBLISH_INTERVAL_MS = 120`、`DISPLAY_VOLUME_CHANGE_EPSILON = 0.02`、attack `0.35` / release `0.18`（`:20-24`）。即 120ms 节流、变化小于 0.02 不发、起音比收音快一倍。
- 键位：`Cmd+Shift+D` voice-toggle（`:1090-1115`）、`Space` voice-mute-toggle（`:1161-1172`）。Space 的 `when` 是 `focusScope: "other"` + `repeat: false`——只在非编辑区触发，且长按不触发。
- **Space 的绑定有平台特殊性**：`keyboard-shortcuts.ts:1161` 这条**没有 mac/non-mac 分叉**，而其他几乎所有全局键都分叉。原因是 Space 在 web 上是页面滚动键，不能直接占用；这一条整体上是 web-first 的写法。
- 语音模式下同一个麦克风按钮承担两个语义（`composer/input/input.tsx:922-933`）：实时语音激活时点击 = 静音切换（`toggleMute`），否则听写中点击 = 取消，未激活 = 开始。图标也随之切换（`VoiceButtonIcon`，`:320-336`：录音中 `Square` 填充、静音 `MicOff`、常态 `Mic`）。

**音量反馈组件** `components/volume-meter.tsx`（207 行）：3 个点，各自相位的无限循环脉冲（`:63-88` 用 `withRepeat(withSequence(withTiming(...)))`），`isMuted` 时全部脉冲固定为 1、不动画（`:56-61`）。几何按 `variant`/`orientation` 分四档（`:31-44`）。这套 Reanimated 写法在 Electron + Web 下应替换为 CSS keyframes 或 WAAPI——见「不可直接迁移」。

### 4.8 与本项目对照

**先纠正一处现状偏差。** 任务说明写的是「只有 `Workbench.tsx` 与 `SessionList.tsx` 里的局部 `keydown` 监听」，实测是 **4 处**：

| 位置 | 监听内容 |
|---|---|
| `apps/desktop/src/renderer/src/workbench/Workbench.tsx:215-233` | 文档级 `document.addEventListener('keydown', ...)`，**冒泡阶段**。Escape 收 Agent overlay、`Ctrl/Cmd+B` 切左栏（带 Alt 切右栏）、`Ctrl/Cmd+\` 分屏 |
| `apps/desktop/src/renderer/src/workbench/SessionList.tsx:42-53` | 文档级 `document.addEventListener('keydown', onKey, true)`，**捕获阶段**，但 `onKey` 内有 `stopPropagation()`（`:44`）——它在捕获阶段就已经拦下 Escape，Workbench 的冒泡监听收不到 |
| `apps/desktop/src/renderer/src/workbench/shell/TabGroups.tsx:153`（`tabKeyDown`，`:49-74`） | React `onKeyDown`，元素级：Enter/Space 激活、←/→/Home/End 在 tab 间循环 |
| `apps/desktop/src/renderer/src/workbench/shell/InstructionComposer.tsx:76-90` | React `onKeyDownCapture`，元素级：`Ctrl/Cmd+Enter` 发送，**已检查 `!event.nativeEvent.isComposing`** |

最后一条与任务说明的差异值得记下：Scholoom 的发送键已经做了 IME 合成检查，和 paseo `composer/input/input.tsx:411` 是同一个意识。

| paseo 做法（路径:行） | 本项目现状（路径:行） | 影响 | 建议（方向，不排期） |
|---|---|---|---|
| 声明式绑定表 `keyboard/keyboard-shortcuts.ts:259-1173`（76 条，纯数据） | 快捷键散落在 4 个组件的事件回调里（`Workbench.tsx:215`、`SessionList.tsx:42`、`TabGroups.tsx:49`、`InstructionComposer.tsx:76`） | 无法回答「这个键绑到哪了」，也无法统一改键或做帮助面板；改一个键要读 4 个文件 | 建一个 `shortcuts.ts`，只放 `id/action/combo/when` 纯数据，事件监听只留一处。paseo 的 `resolveKeyboardShortcut`（`:1541`）是可直接照搬形状的纯函数 |
| 捕获阶段单点监听 `use-keyboard-shortcuts.ts:390-391`（`window`, `true`） | 监听挂在 `document` 上、且**阶段不统一**（`Workbench.tsx:231` 冒泡、`SessionList.tsx:49` 捕获） | 同一按键在不同区域走不同路径，优先级靠 prop 树偶然决定 | 统一为单个捕获阶段监听，一次算出结果再分发 |
| 冲突裁决：`priority` 降序 + 同优先级后注册者先试 `keyboard-action-dispatcher.ts:151-158` | 无冲突概念——两个监听各管各的 | 将来加全局层时会静默互相抢键 | 若引入全局层，采用「优先级 + 后注册优先 + 第一个处理成功者胜出」这一条即可，无需整套 dispatcher |
| 「改键后清掉 `editable: false` 守卫」`keyboard-shortcuts.ts:1261-1266` | 无改键能力 | — | 只在真做改键时才需要，可不做 |
| 作用域注册（组件把身份推给引擎）`workspace-shortcut-targets-subscriber.tsx:11-18`、`workspace-pin-shortcut-handler.tsx:6-8` | 快捷键绑在具体组件上（`TabGroups.tsx:153`），组件不渲染则快捷键消失 | 与 paseo 修过的 pin 快捷键 bug 同一类问题，只是我们还没撞上 | 保持现状即可；等出现「行折叠时快捷键失效」再上这套 |
| focusScope 六态判定 `focus-scope.ts:31-81` | 无作用域概念 | `Ctrl/Cmd+B` 在输入框里也会触发（`Workbench.tsx:220-225` 只看 ctrl/meta，不看 target） | 至少加一条：target 在输入类元素内时跳过全局键。这是 paseo `editable: false` 门控（`keyboard-shortcuts.ts:1340-1345`）的最小子集 |
| IME 优先 `utils/keyboard-ime.ts:5`、`composer/input/input.tsx:411` | 已在 `InstructionComposer.tsx:80` 检查 `isComposing` | 一致 | 保持。新增全局键时沿用同一判断 |
| 浮层吞键优先于全局键 `lib/overlay-root.ts:165-192` | `AgentOverlay.tsx` 无键盘处理；Esc 由 `Workbench.tsx:216-219` 收，`SessionList.tsx:42-46` 抢 | Esc 的归属靠两个监听器的阶段差偶然达成 | 若新增浮层，把 Esc 收敛到一处按 z 序/挂载序判定，别再靠捕获-冒泡 |
| 有帮助面板与设置页改键 `keyboard-shortcuts-dialog.tsx:30-41`、`keyboard-shortcuts-section.tsx:333-425` | 无帮助面板、无改键 | 用户无从发现已有快捷键 | 先做只读帮助面板（成本低、直接抄 `buildKeyboardShortcutHelpSections` 的分组 + 排序思路）；改键是后一步 |
| 绑定 id 稳定、改键不丢 `keyboard-shortcuts.ts:265-268` | 无 | — | 一旦上改键，id 就必须是不可变字符串 |
| 命令面板吞键 `keyboard-shortcuts.ts:1347` | 无命令面板 | — | 无需处理 |
| 有 slash 命令补全 + 分级解析 `utils/agent-command-autocomplete.ts:87-117`、`client-slash-commands/index.ts:42-59` | 无 slash 命令 | — | 无需处理。若将来加，注意 `hasAttachments` 与「是否允许带参数」是两个独立开关 |
| 无语音、无听写 `voice/`、`dictation/` | 无 | — | 无需迁移。本节录音期间锁死输入框的做法（`input.tsx:1994`）若将来做可作为参考 |
| 移动端不挂快捷键 `keyboard/availability.ts:9-14` | 纯桌面，无此分支 | — | 无需处理 |

### 4.9 不可直接迁移

| paseo 做法 | 位置 | Electron + Web 下的等价 |
|---|---|---|
| Reanimated `useSharedValue` + `withRepeat(withSequence(withTiming))` 驱动音量点脉冲 | `components/volume-meter.tsx:48-88` | 用 CSS `@keyframes` + `animation-delay` 分相位，或 WAAPI |
| AsyncStorage 存快捷键改键 | `use-keyboard-shortcut-overrides.ts:12,66-68` | Electron 用主进程配置文件或 `localStorage`；若走主进程，`shortcut-override-store.ts:51-93` 的**串行写入队列**逻辑与存储无关，值得原样抄 |
| `Keyboard.dismiss()` + `requestAnimationFrame` + `setTimeout(150)` 三重兜底 | `components/ui/keyboard-dismiss.ts:8-10` | RN 专有（软键盘），Web/Electron 无对应物，忽略 |
| `focusScope` 靠 RN 的 `data-testid` / `.xterm` DOM 标记推断 | `keyboard/focus-scope.ts:41-77` | 机制可迁移（本项目也是 DOM），但要改成 `closest('input,textarea,[contenteditable]')` 这类选择器 |
| `accessibilityRole` / `accessibilityLabel` 写在 RN 组件上 | `dictation-controls.tsx:72-74`、`volume-meter.tsx` 无 | Web/Electron 用 `role` + `aria-label`。本项目此语义已铺开：`LibraryPanel.tsx` 23 处 `aria-label` + 7 处 `role="alert"`、`ProjectNavigation.tsx` 15 处 `aria-label` + `role="status"`/`aria-busy`、`shell/TabGroups.tsx:141-150` 完整 WAI-ARIA tabs、`shell/AgentOverlay.tsx` 的 `role="dialog"` 与 `aria-live="polite"`。差距在**门控式语义**（`aria-expanded`、`role="menu"`、`aria-keyshortcuts`），不在基础标签 |
| `desktop/browser/shortcuts` 把快捷键策略下发给内嵌 webview（`browser-shortcut-input` 事件） | `use-keyboard-shortcuts.ts:372-383`、`desktop/browser/shortcuts` | 本项目无内嵌 webview，忽略 |

### 4.10 未核实项

- `references/paseo/packages/app/src/keyboard/availability.test.ts`、`focus-scope.test.ts` 等测试文件只读了 `describe/it` 名单，未逐条读断言内容。
- `desktop/browser/shortcuts`（`buildBrowserKeyboardPolicy` / `shouldPublishBrowserShortcutPolicy`）未读实现，只确认了它在 `use-keyboard-shortcuts.ts:77-81,113-127` 被调用。Webview 快捷键透传机制在本项目无对应物，未展开。
- `voice/voice-runtime.ts` 只读了前 60 行（类型与常量），其 953 行主体（音频引擎交互、TTS 分句播放）未读。本节关于 voice 的陈述仅覆盖状态机形状、VAD 常量与音量遥测节流参数。
- `composer/index.tsx:552` 的 `runKeyboardAction("dictation-cancel")` 处在 `routeKeyboardShortcut` → dispatcher 之后的 handler 内（读到 `:544-559`），但该 handler 的注册者与 `isPaneFocused` 的判定来源未追。
- `handle-web-overlay` 的 `getKeyHandler` 由谁注册、各浮层返回什么，未读（`lib/overlay-root.ts` 只读了 99-203 行）。

## 5. 状态、反馈与能力页面的信息组织

本节只写「非 happy 状态怎么被表达」与「能力类页面怎么组织信息」。几何与色值见 `paseo-ui-patterns`，快捷键表见对应章节；此处只在影响状态表达时提及。

**一条贯穿全仓的原则**：paseo 把「非 happy」几乎全部做成**纯函数**（`resolveXxx(input) => state`），组件只负责按 state 选视图，`*.test.ts` 直接对纯函数断言。这样状态矩阵可以脱离渲染验证。本项目目前的状态分支大多内联在组件 JSX 里（`workbench/business-session.tsx:485-516` 一段里塞了 error / run.error / 执行状态三个分支），可测试性与可枚举性都弱一档。

---

### 5.1 空态

paseo 的空态分四类，各有明确读者。

**引导型空屏（写给用户）**：`components/welcome-screen.tsx:169` `WelcomeScreen` 是首次启动、没有任何在线 host 时的整屏。标题 `onboarding.title` + 副标题 + 行动按钮组 + 设置入口 + 版本号。行动按钮是**按平台动态生成**的：web / Fdroid 只给「直连 / 粘贴配对链接」，native 多一个「扫码」，Electron 再插一个「远程 SSH」——插入位置在 `welcome-screen.tsx:264-273` 的 `actions.splice(1, 0, ...)`。每个按钮带 `primary` 标记决定视觉层级（`WelcomeActionButton`，`welcome-screen.tsx:346-366`）。

**关键点：空态可被自动跳过。** `welcome-screen.tsx:182-185` 有个 effect：一旦 `useAnyHostOnline` 发现任意 host 在线，立刻 `router.replace(buildOpenProjectRoute())`。即「页面还没点任何按钮，只要连上了就跳走」。`useAnyHostOnline`（`welcome-screen.tsx:126-163`）取的是**最早**连上的那个 host（`lastOnlineAt` 最小值）。

**列表型空态（写给用户，但占列表体内的位置）**：`components/sidebar/empty-states.tsx:39` `SidebarFilterEmptyState` 与 `:64` `SidebarProjectEmptyState`。注释写得很明确（`empty-states.tsx:31-35`）：空态是 **body 不是 screen**——渲染在列表自己的滚动容器里、在它已有的 section header 之下。理由是：header 带着显示菜单的触发器，如果空态顶替整个列表，筛选掉最后一行会连带关掉用户正在用来筛选的那个菜单。

另一个细节（`empty-states.tsx:42-52`）：筛选空态的「清除」按钮**清掉所有可能致空的筛选**（`clearLabelFilter` + `clearProjectFilters`），因为卡片文案里不指名是哪个筛选生效了——只撤销一个会让按钮看起来像坏了。

**启动器空态（写给模型/用户的中间层）**：`panels/new-tab-panel.tsx:132` `NewTabPanel` 是「新建 tab」面板，本身没有「空」概念——它的全部内容就是 `useWorkspaceTabLaunchCatalog` 返回的分组（`:136`）。目录在 `workspace-tabs/launcher/index.tsx:100-268`：

- 内建项按 `purpose` 排序，`PRIMARY_LAUNCH_ORDER` = agent / terminal / changes / diff / files / browser / pullRequest，`SUPPORTING_LAUNCH_ORDER` 把 changes 提到最前并把 agent 降到 files 之后（`workspace-tabs/launcher/internal/catalog.ts:1-19`）。
- 可见性来自能力位而非用户设置：`launcher.showChanges` / `showBrowser` / `showPullRequest` / `terminalDisabled`（`launcher/index.tsx:131-186`），再经 `panelSupportsHost` 过滤（`:190-193`）。
- 插件面板作为第二个分组追加（`pluginItems`，`:196-216`），终端 profile 作为第三个分组并带一个「编辑」accessory 按钮跳设置页（`:225-243`）。
- 空组在 menu 模式下被剔除：`surface === "menu"` 时按 `panelCanLaunchInPane` 过滤，空组直接不出现在结果里（`:246-251`）。

**「空提交」不是空态而是契约**：`screens/new-workspace-empty.ts:5` `isEmptyWorkspaceSubmission` 判定「文本空且无附件」，`:21` `runCreateEmptyWorkspace` 对这种提交**静默建一个空 workspace 再跳进去**——不发消息、不弹错。这个文件只有这两个函数，全部逻辑在 model 层，组件无分支。

**Setup 面板的空态**：`panels/setup-panel.tsx:340` `SetupPanelBody` 里有三种非命令态——`blocked` 先走 `BlockedSetupNotice`（`:117`，一个 `Alert variant="warning"` 带「运行 setup」按钮）；`isWaiting`（无 snapshot 或 running 且无命令）转圈 + `workspace.setup.waiting` 文案（`:355-359`）；`hasNoSetupCommands`（completed 但命令与日志皆空）给一句纯文案（`:360-370`）。

**行为表**

| 触发 | 行为 | 落点/副作用 | 位置 |
|---|---|---|---|
| 首次启动且无在线 host | 整屏引导，按钮按平台增删 | 打开直连/扫码/粘贴/远程 SSH 弹层 | `components/welcome-screen.tsx:169,217-280,289-343` |
| 任一 host 连上 | 引导屏自动 replace 掉 | 跳 `buildOpenProjectRoute()` | `welcome-screen.tsx:182-185` |
| 侧栏筛选后为空 | 列表体内插卡片 + 「清除」 | 清掉全部筛选 | `components/sidebar/empty-states.tsx:39-62` |
| 侧栏无项目 | 列表体内插卡片 + 「加项目」「导入会话」 | 打开对应流程 | `empty-states.tsx:64-88` |
| 新建 tab | 分组启动器，无「空」 | 启动对应面板 | `panels/new-tab-panel.tsx:132,136` |
| 新工作区空提交 | 静默建空 workspace | navigate 到新 workspace | `screens/new-workspace-empty.ts:21-30` |
| setup blocked | 警告 Alert + 可点「运行」 | `client.runWorkspaceSetup` | `panels/setup-panel.tsx:117-162` |
| setup 无命令 | 单行文案 | 无 | `panels/setup-panel.tsx:360-370` |

---

### 5.2 加载

paseo 的加载表达是**按「等待多久」和「等的是什么」分层的**，不是单一转圈。

**转圈基元极简**：`components/ui/loading-spinner.tsx:10` 就是一个 `ActivityIndicator` 包装，只有 `color` / `size` / `style` 三个 props，没有文案、没有延迟。**文案与延迟都在调用方**。

**骨架屏只有三处**，且都是「结构已知、内容未知」的列表：
- `components/sidebar-agent-list-skeleton.tsx:59` `SidebarAgentListSkeleton`——侧栏项目树，三个 section 递减透明度（`SECTION_OPACITIES = [1, 0.7, 0.4]`，`:8`），每 section 固定 3 行占位（`:10-12`），`SkeletonPulse` 用 `Animated` 脉冲（`:14-23`）。
- `git/pull-request-panel/pane-skeleton.tsx:9` `PullRequestPaneSkeleton`——PR 面板，连 toolbar 按钮、checks 区、activity 区都占位，但**分区标题是真实文案**（`:26` `t("workspace.git.pr.sections.checks")`），因为标题不依赖数据。

**没有「慢加载换策略」的通用机制**——全仓唯一的延迟加载常量是 `workspace-recovery/use-workspace-recovery.ts:11` `MIN_RECOVERY_LOADING_MS = 350`，但它的方向是反的：`waitForRecoveryLoadingPresentation`（`:17-22`）先等两帧让 React 有机会画一帧，再 `:24-26` 强制至少 350ms 才调 `restoreWorkspace`。**目的是防止 daemon 秒回时界面闪一下 loading**，不是超时降级。

**进度文案有明确范例**：`components/app-diagnostic-sheet.tsx:52` `AppDiagnosticSheet` 把加载做成**逐条任务清单**。`ProgressStatus = "pending" | "running" | "done" | "failed"`（`:31`），`ProgressRow = { id, label, status }`（`:33-37`）。运行逻辑 `runDiagnostics`（`:77-131`）对每个采集源（客户端头 → 桌面段 → 每个 host）推一条进度，条目用 `runIdRef` 做失效保护（`:79-81`），关闭面板时 `runIdRef.current += 1` 让在途回调失效（`:134-140`）。渲染时 running/pending 转圈、done/failed 画状态点（`:243-256`）。进度文案是逐条 label + `formatProgressStatus(status)` 拼出来的，不是笼统「加载中」。

**列表级的「静默等待」**：`schedules/aggregated-schedules.ts:69` `fetchAggregatedSchedules` 在「没有任何可问的 host，但有 host 还在 connecting/idle」时返回 `{ status: "connecting" }` 而不是抛错（`:80-82`、`:119-121`），让屏幕继续转圈而不是闪一个「加载失败」。`schedules-screen-state.ts:9-22` `resolveSchedulesScreenBodyState` 把 `connecting` 与 `loading` 归到同一个 `loading` 视图。

**面板级加载态被压成纯函数**：`panels/agent-panel-load-state.ts` 整个文件只有两个函数——`reconcileMissingAgentStateWithPresentAgent`（`:3`，agent 一旦存在就把 `resolving`/`not_found` 打回 `idle`）和 `clearHistorySyncErrorAfterSuccessfulSync`（`:12`，同步成功后清 `error`）。**不引入「加载更久」这个新状态**，只做状态回收。状态类型本身在 `hooks/use-agent-screen-state-machine.ts:37-41`：`idle | resolving | not_found | error`。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 任意异步等待 | 转圈，无文案 | 调用方自带 | `components/ui/loading-spinner.tsx:10` |
| 侧栏 agent 目录首载 | 骨架 + 脉冲，3 section | 占位行 | `components/sidebar-agent-list-skeleton.tsx:59-163` |
| PR 面板首载 | 骨架，标题是真文案 | 占位块 | `git/pull-request-panel/pane-skeleton.tsx:9-111` |
| 诊断采集 | 逐条进度清单 + 状态点 | 弹层内 `SurfaceCard` | `components/app-diagnostic-sheet.tsx:52-262` |
| 恢复工作区 | 强制 ≥350ms + 先让出一帧 | `client.restoreWorkspace` | `workspace-recovery/use-workspace-recovery.ts:11-26,57-59` |
| 计划任务页等待 | `connecting` 与 `loading` 合并为同一视图 | 转圈居中 | `screens/schedules-screen-state.ts:16-18`；`schedules/aggregated-schedules.ts:80-82` |
| agent 面板等待中对象出现 | 状态回收为 `idle` | 无 UI 变化 | `panels/agent-panel-load-state.ts:3-10` |

---

### 5.3 错误与失败

paseo 的错误分四个层，**判据是「谁出错了、用户能做什么」**。

**行内 Alert**（`components/ui/alert.tsx`）：variant 五档 `default | info | success | warning | error`（`:12`），每档一个固定图标（`VARIANT_ICON`，`:24-29`），`size` 复用按钮的 `ButtonControlSize`（`:13`）。`children` 用来塞行动按钮——这是它与纯提示的关键差别。用例：setup 阻塞警告 + 「运行」按钮（`panels/setup-panel.tsx:147-161`）、插件页加载失败 + 「重试」（`screens/settings/plugins-page.tsx:430-437`）、插件日志加载失败 + 「刷新」（`:232-241`）、用量加载失败 + 「重试」（`usage/usage-section.tsx:63-68`）。

**横幅（行内但可折叠/可忽略）**：`screens/schedules-screen.tsx:344` `ScheduleHostErrorsBanner`——多 host 场景下部分 host 加载失败不整屏报错，只在列表上方加一条边框容器，逐行列 `"{serverName}: Could not load schedules"`。生成逻辑在 `schedules/aggregated-schedules.ts:105-111`（每个失败 host 收一条 `ScheduleHostError`），只有**全部** host 都失败才 throw（`:115-117`）。

**整屏 gate**：`screens/workspace/workspace-route-state.ts:5-28` 定义 9 种 `WorkspaceRouteState`，`screens/workspace/workspace-route-state-views.tsx:26-82` `renderWorkspaceRouteGate` 做 kind → 组件的纯映射。每种都给行动：
- `unreachable` → `WorkspaceUnreachable`（`views.tsx:207-259`），标题按 `connectionStatus` 分三种（`connecting`/`idle` → 「连接中」、`offline` → 「{hostName} 已离线」、其余 → 「无法连接到 {hostName}」，`getWorkspaceHostStateTitle`，`:85-96`），`offline`/`error` 时才给「重试」和「管理 host」（`canRetry`，`:217`）。
- `recoveryInspectionFailed` → 「重试」+「返回」两个按钮（`WorkspaceRecoveryInspectionFailed`，`:179-206`）。
- `missing` / `needsHostUpgrade` / `recoveryUnavailable` → 只有「返回」（`WorkspaceEmptyState`，`:235+`）。

**toast**（瞬时、非阻断）：`contexts/session-context.tsx:177-183` `notifyVoiceAbortFailure` 直接 `notifyError(content)`；`agent-skills/use-agent-skills.ts:23-29` 的 `report` 里 `console.error` + `toast.error(message)`。

**错误边界的两条纪律**：
1. 根边界 `components/root-error-boundary.tsx:20` `RootErrorBoundary` 的 fallback 把堆栈**限高**——`:46-48` 注释写「stack trace 是参考材料不是屏幕内容」，`DETAILS_MAX_HEIGHT = 300`，主体只保留消息 + 「重载」按钮（`:55-64`）。
2. 插件边界 `plugins/surface-error-boundary.tsx:17` `SurfaceErrorBoundary` **自带自愈**：`componentDidUpdate`（`:31-40`）发现 `installation` / `resetKey` / `Surface` 任一变化就把 `error` 清空。调用方只需递增一个 `attempt` 计数器当重试键——`plugins/settings/index.tsx:81-94` 就是 `const [attempt, setAttempt] = useState(0)` + `retry` + `resetKey={attempt}`。

**是否保留上下文**：paseo 的答案分两种。
- 失败是查询的 → 保留旧数据不变。`usage/model.ts:47-49` `UsageRefresh = "idle" | "pending" | "failed"`，注释 `:39` 明写「用户主动刷新时旧报告全程留在屏上」。`usage/model.ts:66-92` 的 `replaceReport` / `upsertReport` / `settleReports` 三件套保证刷新后**行不重排**。
- 失败是提交/动作的 → 保留用户输入。`add-project-flow` 的 `setAddProjectPageInput` 每次输入都写进 `githubLocationDrafts` / `newDirectoryNameDrafts`（`add-project-flow/model.ts:208-238`），后退再前进会从草稿恢复（`:170-182`、`:191-206`）。计划任务表单的 `submitError` 与输入共存（`components/schedules/schedule-form-sheet.tsx:487,550`），且 `canSubmit` 只由字段与 cron 校验决定（`schedules/schedule-form-model.ts:545-565`）——**提交失败不禁用按钮，可直接改后重试**。

**错误文案统一出口**：`utils/error-messages.ts:1-6` `toErrorMessage(error)`（`Error` 取 `.message`，否则 `String(error)`），几乎所有 `catch` 都走它。`components/archived-agent-callout.tsx:31` 也是。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 单区域警告/错误 | Alert + 可选行动按钮 | 就地 | `components/ui/alert.tsx:31`；`panels/setup-panel.tsx:147,162` |
| 部分 host 加载失败 | 横幅，逐 host 一行 | 列表上方 | `screens/schedules-screen.tsx:344-357` |
| 全部 host 失败 | 整屏错误 + 「Try again」 | 屏中央 | `screens/schedules-screen.tsx:224-232` |
| 主机不可达 | 整屏 gate + 重试/管理 | 屏中央 | `screens/workspace/workspace-route-state-views.tsx:200-233` |
| 插件 Surface 崩溃 | 就地错误行，可自愈重试 | 面板内 | `plugins/surface-error-boundary.tsx:43-46`；`plugins/settings/index.tsx:84-94` |
| 应用崩溃 | 整屏 + 消息 + 重载，堆栈限高 | 根 | `components/root-error-boundary.tsx:48,55-64` |
| PR 面板查询失败 | 面板内居中 + 重试 | 面板内 | `git/pull-request-panel/pane-error.tsx:7-23` |
| diff 过大无法预览 | 图标 + 标题 + 说明，无按钮 | 面板内 | `git/diff-too-large-state.tsx:10-22` |
| 动作失败 | toast（瞬时） | 浮层 | `contexts/session-context.tsx:180`；`agent-skills/use-agent-skills.ts:26` |
| 刷新失败 | 旧数据留在屏上，行不重排 | 原地 | `usage/model.ts:39,47-92` |

---

### 5.4 归档与恢复

「对象被移走了」这件事，paseo 分两层：**归档的当下**在原地给 callout，**再回来时**给整屏恢复 gate。

**agent 被归档 → 原地 callout + 取消归档按钮**：`components/archived-agent-callout.tsx:17-61`。它渲染在**输入区位置**（`KeyboardTranslateView` 包着、复用 `FOOTER_HEIGHT`，`:37,71`），不是横幅也不是弹窗。含三态：文案 `agentPanel.archived.callout`、按钮 `unarchive`（`disabled={!isConnected || isUnarchiving}`，`:47`）、以及取消归档失败时**追加在 callout 下方的一行错误文本**（`:52-56`，`testID="agent-unarchive-error"`）。取消归档是 `client.refreshAgent(agentId)`（`:29`）。

**workspace 被归档 → 整屏恢复 gate**。状态推导分两段：

`workspace-recovery/model.ts:62-114` `resolveWorkspaceRecoveryModel` 把 daemon 的权威状态 + 连接/能力/查询状态折叠成 7 种 `WorkspaceRecoveryModel`（`:14-29`）：`idle | checking | needsHostUpgrade | recoverable{phase: ready|restoring|failed, error} | unsupportedAction | unavailable | inspectionFailed`。**注意 `supportedAction` 白名单**：`:8` `SupportedWorkspaceRecoveryAction = "unarchive" | "restore"`，`:50-60` 不在白名单里的 action 一律降级为 `unsupportedAction` 而不是假装能做。

`screens/workspace/workspace-route-state.ts:30-96` `resolveWorkspaceRouteState` 再把它折成路由级 9 态。关键顺序：workspace 在且在线 → 只有 `recovery.phase === "restoring"` 时才显示 `archived`（`:40-42`），其余 `ready`；workspace 不在且非在线 → `unreachable`（`:54-61`）；在线但没 hydration 完 → `loading`（`:63-65`）。`unsupportedAction` 被翻译成一句**面向用户的行动建议**而不是内部 action 名：`message: "Update Paseo to recover this workspace."`（`:83-88`，硬编码英文）。

渲染 `ArchivedWorkspaceRecovery`（`views.tsx:112-177`）：标题随 `phase` 在「restoringTitle」/「archivedTitle」间切（`:152-155`）；按钮标签三态——默认 `unarchiveAction`，`recovery.action === "restore"` 时 `restoreAction`，`phase === "failed"` 时**变成「重试」**（`:122-129`）；描述按「restore + 有分支名 / restore 无分支 / unarchive」三分（`:131-141`），都带上 `workspaceName`；错误文本作为第三行显示（`:158-163`）。

**恢复动作的假成本**：`use-workspace-recovery.ts:52-61` 的 mutation 在真正调 `restoreWorkspace` 前先 `waitForRecoveryLoadingPresentation()`（两帧）+ `waitForMinimumRecoveryLoadingTime()`（350ms）。`retryInspection` 是 `inspection.refetch()`（`:100-102`），且查询 `retry: false`（`:49`）——**不做自动重试，重试完全交给用户点**。查询 `staleTimeMs: 5_000`（`:41`）。

**归档是有风险确认的动作**：`workspace/project-workspace-archive.ts:18-41` `selectProjectWorkspacesToArchive` 批量归档时，对每个 `workspaceKind === "worktree"` 的对象逐个过 `confirmRiskyWorktreeArchive`（`:25-33`），风险信号来自 `archiveHasUncommittedChanges` / `archiveUnpushedCommitCount` / `diffStat`（`:5-14`）。`git/worktree-archive-warning.ts:79-90` `buildWorktreeArchiveRiskReasons` 逐条生成原因文案，`formatDiffStat`（`:60-77`）把新增/删除行拼成 `+12, -3`，且**只有 >0 的部分才进文案**。单复数分别有 key（`addedLine`/`addedLines`，`:38-45`）。

**「你少配了一步」型 callout**：`components/worktree-setup-callout-policy.ts` 是纯策略层。`shouldShowWorktreeSetupCallout`（`:50-52`）只在「读配置成功 **且** 没有 setup 命令」时为真——读失败不算，避免用网络错误当催办。`buildWorktreeSetupCalloutPolicy`（`:54-69`）产出 `id` / `dismissalKey`（同值）/ `priority: 100` / 三段文案 / `projectSettingsRoute` / `testID`；`dismissalKey` 里带 `serverId` + `projectId`（`:57`），所以 dismiss 状态天然按项目隔离。判断「有没有 setup 命令」的 `hasSetupCommands`（`:71-80`）同时接受字符串与字符串数组两种配置形态。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 打开已归档 agent | 输入区位置 callout + 「取消归档」 | 原地 | `components/archived-agent-callout.tsx:17-61` |
| 取消归档失败 | callout 下追加错误行 | 原地 | `archived-agent-callout.tsx:52-56` |
| 打开已归档 workspace | 整屏 gate + 恢复/取消归档按钮 | 屏中央 | `screens/workspace/workspace-route-state-views.tsx:110-169` |
| 恢复中 | 标题切 restoring、按钮禁用、显示转圈 | 同上 | `views.tsx:147,165-177` |
| 恢复失败 | 按钮文案变「重试」+ 错误行 | 同上 | `views.tsx:125,158-163` |
| daemon 报不支持的 action | 降级为「请更新 Paseo」 | 同上 | `screens/workspace/workspace-route-state.ts:83-88` |
| 批量归档含 worktree | 逐个风险确认弹层 | 模态 | `workspace/project-workspace-archive.ts:25-33`；`git/worktree-archive-warning.ts:79-90` |
| git 项目缺 setup 命令 | 侧栏 callout，可 dismiss，带优先级 | 侧栏 | `components/worktree-setup-callout-policy.ts:50-69` |

---

### 5.5 通知

paseo 有两条完全独立的通知通道，**触发条件与去重规则都在通道内部**。

**通道 A：本地 OS 通知**（Electron / Web）。`utils/os-notifications.ts:166` `sendOsNotification`：
- native 直接返回 `false`（`:168-170`，注释「移动端通知应只走远程推送」）。
- 有 desktop host 时委派给 `host.notification.sendNotification`（`:172-175`）。
- 否则用 Web `Notification` 构造器 + `ensureNotificationPermission()`（`:69-91`），**并发请求去重靠一个模块级 `permissionRequest` promise**（`:22,80-89`）。
- 只有 payload 里有可定位目标时才挂 click 监听（`hasNotificationClickTarget`，`:100-103,186-188`）。

**触发条件**在 `contexts/session-context.tsx`：
- **agent attention**（`:270-320`）。四道过滤：
  1. `reason === "error"` 直接不发（`:275-277`）——运行失败不通知。
  2. 必须「不在看这个 agent」：应用不可见 **或** 焦点 agent 不是它（`:279-284`）。
  3. **按 agentId 去重**：`attentionNotifiedRef` 存 `agentId → 已通知时间戳`，`lastNotified >= timestampMs` 就跳过（`:238,286-291`）。同一次 attention 只发一次，重连/重渲染不会重发。
  4. daemon 预先生成过 payload 就直接用，但**要求其中带 `workspaceId`**，否则丢弃（`resolveAgentAttentionNotification`，`:152-160`）。

  文案在 `packages/protocol/src/agent-attention-notification.ts`：标题三分（`:172-176`，permission → "Agent needs permission"、error → "Agent needs attention"、其余 → "Agent finished"），正文优先取内容预览（`resolveAgentAttentionPreview`，`:178-188`），没有预览时用固定兜底（`:190-194`）。data 里带 `serverId` / `workspaceId` / `agentId` / `reason`（`:196-215`）。

- **终端需要输入**（`session-context.tsx:685-703`）。daemon 端已算好 `shouldNotify`（`:688-690`），客户端只判断这一位就发，data 里带 `serverId` / `terminalId` / `cwd`，`workspaceId` 存在才带（`:697-702`）。

**点击后跳哪**：`utils/notification-routing.ts:30-41` `buildNotificationRoute` 是纯函数，按目标完整度降级：
- `serverId + workspaceId + agentId` → 打开该 workspace 的 `agent:{agentId}` tab
- `serverId + workspaceId + terminalId` → 打开 `terminal:{terminalId}` tab
- 只有 `serverId` → 打开该 host 根路由
- 都没有 → `/`

Web 端点击先派发 `CustomEvent("paseo:web-notification-click")`（`os-notifications.ts:20,120-136`），**若应用内没有监听者阻止默认行为**，才走 `location.assign` 兜底（`:138-163`）。即「应用活着就应用导航，应用没接管才让浏览器跳」。

**通道 B：远程推送**（仅 native）。`push-notifications/index.native.ts:4` 委派到 `internal/subscriptions.ts`：
- token 按 `serverId` 存 AsyncStorage，key 前缀 `@paseo:expo-push-token:`（`:9,12-14`），读取时过 zod 校验（`ExpoPushTokenSchema`，`:10`）。
- 权限被拒时**主动删除本地缓存**（`:34-36`）——避免下次拿到一个已失效的 token。
- Android 先建 channel（`:39-44`）；缺 EAS projectId 时 warn 并**沿用旧 token**而不是清空（`:46-50`）。
- `startSubscription`（`:59-85`）返回取消函数，`stopped` 标志防止在途 resolve 后又注册；连接状态变为 `connected` 时**重新注册**（`:77-79`）。
- `revokeSubscription`（`:87-102`）只在 daemon 声明支持 `pushTokenRevocation` 时才真去服务端注销（`:93`），否则只清本地。
- Web / 非 native 是空实现（`push-notifications/index.ts:3-9`、`index.web.ts:3-9`），注释统一写「Push notifications are native-only」。

**用户可见的通知设置**：`desktop/components/desktop-notifications-section.tsx:20` `DesktopNotificationsSection` 三个设置行——权限状态（`DesktopPermissionRow`，带「申请」）、是否播放声音（`Switch`，`:103-109`）、**「发送测试通知」**（`:111-125`）。测试结果三态 `sending | success | error`（`use-desktop-permissions.ts:126-152`），失败时区分「未投递」与「发送抛错」两种文案。`isDesktopApp` 为假时整个 section 返回 `null`（`desktop-notifications-section.tsx:82-84`）。

**注意力优先级**（决定侧栏高亮谁）：`utils/agent-attention.ts:18-22` `permission: 0 < error: 1 < finished: 2`，数值越小越优先。`pickAttentionAgent`（`:31-61`）**跳过所有 `parentAgentId` 非空的 subagent**（`:41-43`，不让子 agent 抢焦点），同级比时间戳取更早的。清除条件 `shouldClearAgentAttention`（`:63-81`）里 **`attentionReason === "permission"` 永不清除**（`:74-76`）——权限请求必须一直亮着。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| agent 跑完且用户不在看 | OS 通知 + body 取最后一条回复 | 桌面/Web 通知中心 | `contexts/session-context.tsx:270-320`；`protocol/src/agent-attention-notification.ts:196-215` |
| agent 运行失败 | **不通知** | — | `contexts/session-context.tsx:275-277` |
| 同一 agent 重复 attention | 按 `agentId` 去重，只发一次 | — | `contexts/session-context.tsx:238,286-291` |
| 终端等待输入且 daemon 置 `shouldNotify` | OS 通知 | 同上 | `contexts/session-context.tsx:685-703` |
| 点通知（应用在前台） | CustomEvent → 应用内导航 | 对应 agent/terminal tab | `utils/os-notifications.ts:120-163`；`utils/notification-routing.ts:30-41` |
| 点通知（无监听者） | `location.assign` 兜底 | 路由 | `utils/os-notifications.ts:138-152` |
| 权限被拒 | 删本地 token 缓存 | AsyncStorage | `push-notifications/internal/subscriptions.ts:34-36` |
| host 重连 | 重新注册推送 token | daemon | `subscriptions.ts:77-79` |
| 多个 agent 要注意力 | 按 permission > error > finished 选一个，忽略 subagent | 侧栏高亮 | `utils/agent-attention.ts:31-61` |

---

### 5.6 自动化与计划任务（本项目完全没有）

**列表组织：一行 = 身份 + 目标 + 状态 + 时间线**。`components/schedules/schedule-row.tsx:61-79` `ScheduleRowProps` 的字段直接说明这个模型：`targetLabel`（客户端推导的目标行）、`provider`（glyph）、`state`（客户端推导状态，**单一事实源**）、`serverName` / `singleHost`、`pending`（四个动作各自的 in-flight 标志，`:41-46`）。

`components/schedules/schedule-row.tsx:96-118` `buildMeta` 决定时间线怎么拼，注释写明阅读顺序是「身份 → 历史 → 未来」：`cadence` · `Created {x}` · `Last run {x}` 或 `Never run`（`:105-108`），**只有 `state === "active"` 才追加 `Next run {x}`**（`:109-113`）——已结束的任务不显示下次运行。多 host 时 host 名 `unshift` 到最前，单 host 时省略（`:114-116`）。状态只出现在 `StatusBadge` 上，不在 meta 行里重复（`:96-95` 注释）。

**状态是客户端推导的，且有优先级**：`schedules/schedule-derivation.ts:81-96` `deriveState` 的注释写「one badge, one truth，顺序有意义：过期和目标消失比原始的 completed/paused 更有信息量，所以它们先赢」。判定顺序：`expired`（`expiresAt <= now`）→ `targetGone` → `finished`（`status === "completed"`）→ `paused` → `active`。`scheduleBucket`（`:98-100`）把 `active|paused` 归入 `runnable`，其余归入 `ended`。

**「目标消失」有防误判**：`isAgentTargetGone`（`:56-62`）在 `agentDataLoaded` 为假时**一律返回 false**，注释（`:38-40`）写「目录还没首载完时，缺席只说明缓存冷」。这条防误判被上提到屏幕层：`screens/schedules-screen.tsx:76-91` 从 runtime snapshot 的 `hasEverLoadedAgentDirectory` 逐 host 收集就绪集合，`:92-94` 注释解释为什么不能用聚合的 `isInitialLoad`（任何一个 host 有数据就会翻 false，仍在加载的 host 会被误标「目标没了」）。

**过滤器只有两个维度**：`STATUS_FILTER_OPTIONS`（`schedules-screen.tsx:48-51`）是 Active / Ended 两档 `SegmentedControl`；host 过滤器 `showHostFilter = hosts.length > 1` 才渲染（`:165`）。筛选把行变空时分两种空态：有行但当前档为空 → `SchedulesEmptyState`（带「New schedule」，`:246-249`）；Ended 档为空 → `SchedulesEndedEmptyState`（只有图标 + 「No ended schedules」，`:333-342`）。

**时区**：`getDeviceTimeZone()` 作为表单默认值（`components/schedules/schedule-form-sheet.tsx:255`），`normalizeScheduleFormCadence`（`schedules/schedule-cadence-options.ts:38-51`）在用户没显式设时区时把设备时区补进 cron。cron 有 5 个预设（`schedule-cadence-options.ts:14-20`），`resolveCronPresetId`（`:22-28`）匹配不上就是 `"custom"`，`resolveCronPresetDisplay`（`:30-36`）显示为「Custom cron」。

**创建流程不是分步向导，是一张表单**：`ScheduleFormSheet`（`schedule-form-sheet.tsx:181`）挂在 `AdaptiveModalSheet` 上，一次呈现全部字段：Name / Prompt / host / project / provider+model / mode / thinking / isolation / Cadence / Max runs（`:491-548`）。两种目标类型走不同字段集——编辑已有 agent 的 "heartbeat" 只显示目标行 + cadence（`:476-489`），新建 agent 走全套。`header` 标题也随之分叉：`"Edit heartbeat"` vs `"Edit schedule"`（`:400-405`）。

**校验是纯函数**：`resolveCanSubmit`（`schedules/schedule-form-model.ts:545-565`）——agent 目标只要有 cadence 就能提交；new-agent 目标必须 prompt 非空、workingDir 非空、create 模式下还必须已匹配到项目、模型必须对 provider 合法。**cron 表达式校验在模型之外**：`schedule-form-sheet.tsx:277-280` 单独算 `cadenceError = validateCron(...)`，`canSubmit = state.canSubmit && cadenceError === null && !isSubmitting`（`:280`），错误直接传给 `CadenceEditor` 的 `error` prop（`:526-531`）。提交失败写进 `model.setSubmitError(toErrorMessage(error))`（`:389-396`），渲染在表单最底部（`:487,550`）。

**动作与并发**：`components/schedules/schedules-table.tsx:65` `SchedulesTableRow` 持**本地** pending 状态而非共享的，`:56-61` 注释说明原因：mutations hook 只暴露一个全局 pending 标志，多行同时操作时无法区分是哪一行。删除走 `confirmDialog` 且 `destructive: true`（`:114-128`）。`:79-96` `runAction` 的 catch 是空的，注释明写「mutations 自己回滚乐观写并在 settle 时重取；这里弹 toast 超出范围」——**失败对用户不可见是已知取舍，不是遗漏**。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 打开页面 | 只在 focus 时取数，否则渲染空 View | — | `screens/schedules-screen.tsx:55-61` |
| 首载 | 大号转圈居中 | 屏中央 | `schedules-screen.tsx:216-222` |
| 部分 host 失败 | 横幅列出失败 host | 列表上方 | `schedules-screen.tsx:344-357` |
| 全部 host 失败 | 整屏错误 + 「Try again」 | 屏中央 | `schedules-screen.tsx:224-232` |
| 筛选后为空 | Active 档给带按钮空态；Ended 档给纯文案 | 列表区 | `schedules-screen.tsx:246-250,333-342` |
| 渲染某行 | provider glyph + 标题 + 目标行 + 状态徽章 + meta + kebab 菜单 | 行 | `components/schedules/schedule-row.tsx:65-118` |
| 非 active 状态 | 不显示「Next run」 | meta 行 | `schedule-row.tsx:109-113` |
| agent 目录未首载完 | 不判定「目标没了」 | 徽章 | `schedules/schedule-derivation.ts:38-41,56-62`；`schedules-screen.tsx:76-91` |
| 点行 | 打开编辑表单 | 模态 | `schedules-screen.tsx:104-106` |
| 提交失败 | 表单底部错误行，字段与按钮保持可用 | 模态内 | `components/schedules/schedule-form-sheet.tsx:389-396,550` |
| 删除 | 破坏性确认弹层 | 模态 | `components/schedules/schedules-table.tsx:114-128` |

---

### 5.7 插件与技能（能力发现）

**插件管理页是一张设置行列表，每行 = id + 状态徽章 + 描述 + 来源 + 开关 + 菜单**。`screens/settings/plugins-page.tsx:115` `PluginRow` 把所有信息塞进一个 `SettingsRow`：`label={plugin.id}`、`labelAccessory={statusBadge}`、`hint`（描述 + `formatPluginInstallation(plugin.installation)` 的来源串，`:144-157`）、`error={clientError ?? plugin.error}`（`:158`）。开关直接绑 `plugin.enabled`，禁用条件是 `pending`（`:163-169`）。菜单里装：插件自己的设置项、日志、重载、删除（`PluginActionsMenu`，`:54-112`）。

**页面级状态是一个纯函数返回的六态字符串**：`screens/settings/plugins-page-state.ts:1` `PluginPageState = "offline" | "unsupported" | "loading" | "error" | "empty" | "ready"`，`resolvePluginPageState`（`:3-15`）**按优先级顺序短路**——offline → unsupported → loading → error → 空则 empty → ready。渲染侧 offline/unsupported 直接 return 一个整块 Alert（`plugins-page.tsx:413-426`），error 态是可带重试按钮的 Alert（`:430-437`），`loading` 态只给一句「加载中」的 `Alert size="sm"` 而**没有转圈**（`:427`）。

**一个安全提示常驻在列表上方**：`plugins-page.tsx:474-478` 无条件渲染 `settings.plugins.trustedTitle` 警告 Alert。这一条不随状态变化——插件页任何时候都先讲「这些是第三方代码」。

**客户端求值失败与 daemon 状态分离**：`plugins/registry.ts:14` `PluginRegistry` 为每个 `serverId/pluginId` 单独存 `evaluationErrors`（`:20,32-34`）。页面上 `clientError = pluginRegistry.getEvaluationError(serverId, plugin.id)`（`plugins-page.tsx:444`），且 `:130` `const status = clientError ? "failed" : plugin.status`——**客户端 bundle 跑不起来时，整行状态强制为 failed，即使 daemon 说它 running**。求值失败时仍会 abort + dispose 半成品 API（`registry.ts:117-121`），并且只有 bundle 与 requirements 都没变才复用旧实例（`:52-61,80-84`）。

**空列表有专门的 testID**：`plugins-page.tsx:456-460` 空时渲染 `styles.empty` + `settings.plugins.states.empty`。安装入口是自由文本框（`plugins-page.tsx:491-501`），`canSubmit` 就是「非空白」（`screens/settings/plugin-install-form-model.ts:29`），旁边挂一个指文档的 `ExternalLink`（`:33-42`）。装完 `installForm.reset()` 清空并 `resetKey + 1` 强制重挂输入框（`:50-52`）。

**插件提供四种不同的挂载点**，UI 层各有专门宿主：
- 设置菜单项：`plugins/settings/index.tsx:44` `PluginSettingsMenuItems`（宿主不支持 `pluginSettings` 时返回 `null`）。
- 独立设置屏：`plugins/settings/index.tsx:68` `SettingsContent`——`!connected` 显示离线文案、`!supported` 显示「请更新」、找不到 screen 显示 unavailable，注释 `:109` 标了 `COMPAT(pluginSettings): added in v0.8, remove after 2027-03-05`。
- 侧栏项 / 自定义 Screen：`plugins/surface-screen.tsx:124` `PluginSurfaceScreen`，路由参数解析在 `:125-141`，标题解析走 `resolvePluginScreenTitle`。
- 工作区面板：进新 tab 启动器的第二分组（见 §1）。

**技能管理只占一个设置 section，但状态机比插件更细**：`agent-skills/index.tsx:38` `AgentSkillsSection`。状态来自 daemon 的 `AgentSkillsStatus`，`index.tsx:55-58` 把 `drift` 且无维护操作的情况**改写成 `up-to-date`**——没有可做的事就不该显示「有更新」。行内文案随之切换（`:141-145`）。`hasSelected`（`:59-62`）判的是「选择集与可用集有交集」，全不交集时**连操作按钮都不渲染**（`:156-164`）。

`SkillsActions`（`:182-230`）三态三分支：`up-to-date` → 「已安装」+ 卸载；`drift` → 更新（`isWorking` 时文案变「working」）+ 卸载；其余 → 安装（`isWorking` 时变「installing」）。所有破坏性动作都过 `confirmDialog`，更新确认的 message 是**逐条操作列表**（`formatUpdateMessage`，`:31-36`，按 add/update/delete 再按名字排序）。

**技能选择 sheet 有一个防丢编辑的细节**：`agent-skills/selection-sheet.tsx:56-62` 只在 sheet **打开的那一帧**从 `selection` 播种草稿，注释明写「否则后台状态刷新带回的新 selection 对象会丢掉正在编辑的内容」。

**删除确认由 daemon 驱动，不是 UI 猜的**：`selection-sheet.tsx:90-108` 先 `onSave(draft)`，若返回 `confirmationRequired`（daemon 发现了本次没被告知的目录）才弹确认框，然后**带着同一份 removals 列表重试一次**；若重试又返回 `confirmationRequired`，说明确认框开着的时候目录又变了，此时**不删**，改显示保存失败（`:104-107`）。注释 `:87-89` 解释了为什么必须问 daemon：「只有问它，问题和删除才不会走偏」。

**Agent profiles 是「能力预设」而非「能力发现」**：`agent-profiles/settings/agent-profiles-section.tsx:29`。一行摘要由 `buildAgentProfileTags`（`agent-profiles/internal/profile-summary.ts:22-64`）生成：provider → model → mode → thinking → 「N features」，**每个标签都回退到存储的 id**（`:37-56`），注释 `:25-28` 说明理由：「一行必须在 provider 目录离线、或已不再提供该模型的 host 上仍然可读」。能力探测是 `supportsAgentProfiles`（`internal/capabilities.ts:6-8`），要求**两个 feature 同时为真**（`agentProfiles` + `agentConfigApply`）。写入是整列表覆盖，没有 per-profile RPC（`internal/use-agent-profiles.ts:12-13,22-27`），所以编辑时必须**整体替换而不是 merge**（`agent-profiles-section.tsx:54-56` 注释）。

**新建表单的偏好是「已提交 + 乐观未提交」两层**：`create-agent-preferences/optimistic-preferences.ts:6` `OptimisticFormPreferences` 持有 `committed` 与 `pending` map，`current()`（`:14-22`）按顺序叠加未提交更新。`reconcile`（`:36-40`）在**有未提交更新时丢弃**服务端返回——避免迟到回执盖掉用户刚改的。schema 用 zod 且 `strictObject`（`create-agent-preferences/preferences.ts:33-55`），带 `COMPAT(agentProfileFavoriteMigration)` 注释说明为何还要保留已废弃的 `favoriteModels` 字段。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 插件页 host 离线 | 整块警告 Alert，无列表 | 屏内 | `screens/settings/plugins-page.tsx:413-422` |
| 插件列表加载中 | 一句 Alert，无转圈 | 屏内 | `plugins-page.tsx:427` |
| 插件列表为空 | 一行文案 | 卡片内 | `plugins-page.tsx:456-460` |
| 插件客户端求值失败 | 该行状态强制 failed + 错误进 `error` prop | 行 | `plugins-page.tsx:130,158,444` |
| 插件页面任何时刻 | 常驻「这些是第三方代码」警告 | 列表上方 | `plugins-page.tsx:474-478` |
| 技能有 drift 但无可做操作 | 显示为「已是最新」 | 行内 | `agent-skills/index.tsx:55-58` |
| 技能选择集与可用集无交集 | 不渲染安装/更新/卸载按钮 | 行 | `agent-skills/index.tsx:59-62,156-164` |
| 技能保存将删目录 | daemon 驱动二次确认，重试一次，再冲突则放弃 | 模态 | `agent-skills/selection-sheet.tsx:90-108` |
| 插件设置屏宿主过旧 | 显示「请更新」+ COMPAT 注释 | 模态内 | `plugins/settings/index.tsx:109-110` |
| profile 行所在 host 目录离线 | 标签回退到 id | 行 | `agent-profiles/internal/profile-summary.ts:25-28,37-56` |
| 偏好保存迟到 | 丢弃该回执 | 内存 | `create-agent-preferences/optimistic-preferences.ts:36-40` |

---

### 5.8 用量与评审

**用量：一句话原则——「不可用」是宿主状态，「错误」是请求失败**。`usage/types.ts:13-16` `UsageView` 是四态判别联合，`unavailable` 带 `message`，注释明写「unavailable is a host state, not a failed request」。`usage/model.ts:111-120` `resolveUsageView` 的判定顺序：未连接 → unavailable；宿主不支持 → unavailable（不同文案）；之后才轮到 loading / error / ready。

`usage/usage-section.tsx:42` `UsageBody` 把四态映射到四个不同视觉：
- `unavailable` / `loading` / 空报告 → 同一种低调文案卡 `UsageMessage`（`:78-84`），**loading 与 empty 视觉不可区分**——这是刻意的，两者都不需要用户动作。
- `error` → `Alert variant="error"` + 「重试」按钮（`:63-68`）。

**一个报告 = 一个来源 = 一组窗口**。`usage/card.tsx:58` `UsageCard` 的头部：来源 icon + 来源名 + 套餐徽章 + 状态点 + 状态文字 + 刷新按钮。状态文字由 `statusText`（`:22-25`）从 `available` → `null`（不显示）、其余 → `"Error"` / `"Unavailable"` 得出。数据不可用时 `reportContent`（`:27-37`）把所有窗口清空、只留 `message`。

**百分比按用户偏好反着显示**：`usage/model.ts:6-11` `usedPercent` 与 `displayPercent`，`displayAs` 取 `used` 或 `remaining`，后者在只剩 `usedPct` 时用 `100 - used`。阈值配色 `usage/tone.ts:5-13` `windowTone`：**来源自带 tone 就用它**，否则按用量派生（>90 danger、≥70 warning、其余 default）——来源能表态时不覆盖来源。

**刷新期间不空屏**：`usage/card.tsx:77-78` `showsFreshnessInline = isNative || isCompact || !refreshable`——有 hover 的地方新鲜度放 tooltip，没有的地方印在卡面上，所以刷新不会让卡片「闪一下变空」。行不重排由 `usage/model.ts:66-92` 三个函数保证（见 §3）。

**同一批设置散在三处但共用一个 popover**：`usage/options.tsx:24` `UsageOptions` 里是「显示在侧栏」开关 + 「显示为 已用/剩余」分段控件，容器是 `DropdownMenu compactMode="sheet"`（`:103`）——**宽屏是 popover，窄屏自动变 sheet**，不需要两套代码。`usage/controls.tsx:166` `UsageControls` 是每个用量标题行右侧的控件组（host 过滤器 + 全部刷新 + 设置 cog），`:174` `busy = view.kind === "loading" || (ready && isRefreshing)` 统一禁用。

**代码评审：diff 上的行内批注 + 作为附件发回 agent**。数据模型 `review/state.ts:6-14` `ReviewDraftComment = { id, filePath, side: "old"|"new", lineNumber, body, createdAt, updatedAt }`——**side 必填**，批注挂在 old 还是 new 侧是模型的一部分，不是渲染细节。

**草稿持久化用 zustand persist + zod 校验**：`review/store.ts:126` `useReviewDraftStore`，`STORE_VERSION = 2`（`:26`），序列化只存 `drafts`（`review/state.ts:109-115`），`activeModesByScope` 被 v2 丢弃（`:39-40` 注释）。读回时 `normalizePersistedState`（`review/state.ts:117-122`）**解析失败就退化成空草稿而不是抛错**。

**草稿作用域键是显式拼装的**：`review/store.ts:105-109` `buildReviewDraftKey` 由 `server` / `workspace|cwd` / `mode` / `base` / `ignoreWhitespace` 拼成。`:96-99` 注释特别强调「workspaceId 是不透明的；不要把这个 key 解析回路径」。

**产物是 composer 附件**：`review/store.ts:204-258` `buildReviewAttachmentSnapshot` 为每条批注截取**上下文 3 行**（`CONTEXT_RADIUS = 3`，`:27`），带上 `hunkHeader` 与目标行，装成 `{ type: "review", mimeType: "application/paseo-review", cwd, mode, baseRef, comments }`。找不到目标的批注**静默跳过**（`:216-218`），全部跳过则返回 `null`（`:243-245`）——附件为空就不产生，避免发一个空 review 给 agent。

**发送是带状态机的工作流**：`review/feedback/index.ts:22-27` `FeedbackPhase = idle | choosing | sending{recipient, commentCount} | failed{message} | sent{recipient}`。`deriveState`（`:164-177`）给出 `disabledReason: "no-agents" | "disconnected" | "no-context" | null`，**按此顺序短路**，且 `canSend` 要求 commentCount > 0 且不在 sending。`press`（`:139-153`）在只有一个收件人时直接发，多个才进 choosing——不强迫用户做无意义的确认。发送成功后 `ports.clearSent(sentComments)`（`:115`）只清**本次实际发出的那些版本**（`review/store.ts:325-341` `clearSentReviewDraftComments` 按 `updatedAt` + `body` 比对，用户在发送途中又改过的批注保留）。`review/store.ts:343-362` `saveReviewDraftComment` 处理「确认已清但用户还开着编辑框」的情况。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 宿主不可用/不支持用量 | 文案卡（与 loading 同视觉） | 卡片 | `usage/usage-section.tsx:53-59,78-84` |
| 用量请求失败 | 错误 Alert + 「重试」 | 卡片 | `usage/usage-section.tsx:61-69` |
| 报告本身 error/unavailable | 窗口区清空，只留状态点 + 文案 | 卡内 | `usage/card.tsx:22-37,105-113` |
| 刷新中 | 旧数据保留、行不重排、按钮 busy | 卡内 | `usage/model.ts:39,47-49,66-92`；`usage/controls.tsx:174` |
| 窄屏打开设置 | popover 自动降级为 sheet | 浮层 | `usage/options.tsx:29` |
| 评审批注发送成功 | 只清本次发出的版本 | 内存 | `review/store.ts:325-341`；`review/feedback/index.ts:115` |
| 评审批注无可用目标 | 静默跳过；全跳过则不产附件 | — | `review/store.ts:216-218,243-245` |
| 持久化草稿损坏 | 退化为空草稿 | — | `review/state.ts:117-122` |
| 多个 agent 可收反馈 | 先选再发 | 浮层 | `review/feedback/index.ts:139-153` |

---

### 5.9 加项目流程

**这是一个手写的、可后退的多步向导，模型与视图彻底分离**。

**分步：7 种 page 构成一个栈**。`add-project-flow/model.ts:29-49` `AddProjectPage` 联合：`host`（选主机）→ `method`（选方式）→ 分三支：`directory-search`（找目录）/ `github-search`（搜仓库）→ `github-location`（选克隆目标）· `new-directory-parent`（选父目录）→ `new-directory-name`（起名）。`AddProjectFlowState`（`:51-55`）持有 `pages` 数组 + 两张跨步草稿表。

**能跳步**：`openAddProjectFlow`（`:69-84`）如果只有一台 host 或调用方给了 `preferredHostId`，**直接从 method 页开始**。`applyAvailableAddProjectHosts`（`:86-105`）在 host 列表后续刷新时，只在「栈里只有一页且那页是 host」时才重新跳（`:88-90`）——用户已经走过了就不再拽回去。

**中断与恢复**：
- `backAddProjectPage`（`:135-141`）在栈底返回 `null`，调用方据此决定是后退还是关闭。
- **每页的输入都存进按 (host, 上下文) 分桶的草稿表**，见 `newDirectoryNameDrafts` 与 `githubLocationDrafts`（`:52-56`）。`setAddProjectPageInput`（`:206-225`）在写入当前页的同时**同步写入对应草稿桶**；`setAddProjectActiveIndex`（`:258-272`）也把 query + activeIndex 一起存。重进该页时从桶里恢复（`openGithubLocationPage` `:170-181`、`openNewDirectoryNamePage` `:198-204`）。**后退再前进不丢已输入内容**。
- 输入时 `activeIndex` 归零、`error` 归零（`:212,220`）——重新输入即视为重新尝试。

**能力位驱动选项**：`add-project-flow/model.ts:1-8` `AddProjectHost` 携带 5 个能力位（`canAddProject` / `canBrowse` / `canCloneGithubRepositories` / `canSearchGithubRepositories` / `canCreateDirectory`）。`add-project-flow/options.ts:36-62` `buildAddProjectMethods` 据此生成选项，**不支持的选项仍然列出但 `disabled: true`，且描述改成「请更新该 host」**（`:56-59,64-75`）——不隐藏，让用户知道这个能力存在但需要升级。`canAddProject` 为假时**返回空数组**，此时空文案是「请更新该 host 以使用添加项目」而非「无匹配项」（`:64-70`）。

**GitHub 搜索与手输共存**：`components/add-project-flow.tsx:637-651`——若搜索结果里**没有**与输入完全匹配的项（`nameWithOwner` 或 `cloneUrl` 不区分大小写相等），就把 `buildManualGithubRepositoryChoices(query)` 的结果**前置**到列表顶部。`add-project-flow/options.ts:82-103` 会把完整 git remote / GitHub URL 直接转成一条「克隆此仓库 URL」选项。**先搜再猜，但永远不堵住手输**。

**克隆目标排序带记忆**：`add-project-flow.tsx:661-668`——`lastCloneParentByHost` 里的上次目标父目录被排到推荐目录列表最前。目标候选来自 `buildCloneLocationOptions`（`options.ts:104+`），已存在的路径会被 `disabled` 标记。

**状态呈现分层且互斥**（`add-project-flow.tsx:918-956`，渲染顺序即优先级）：`isSubmitting` → 进度文案；`page.error` → 错误行；`queryError` → 查询错误行；`loading` → 「Loading...」；结果列表；`rows.length === 0` → 空文案。**后三者都带 `!isSubmitting` 前置**（`:940,945,949`），所以提交中不会看到「无结果」。

进度文案按页分（`add-project-flow.tsx:177-181`）：克隆 → "Cloning project..."、建目录 → "Creating directory..."、其余 → "Adding project..."。空文案按页分（`:183-188`），`github-search` 页空时提示「输入 GitHub URL 或 owner/repo」——**指导下一步而不是陈述事实**。

**键盘驱动但有可见提示**：`add-project-flow.tsx:775-793` 处理 ArrowUp/Down/Enter/Escape；`Escape` 在栈深时后退、栈底时关闭（`:776-780`）。底部常驻三个提示 `Navigate` / `Select` / `Back|Close`（`:961-964`，第三个文案随栈深变化，`:140` `NAVIGATION_HINT_KEYS`）。移动端硬件键盘需要隐藏输入框接键（`:875-890` 那段被 a11y 全屏蔽的 `TextInput`，注释说明原因）。

**表单内容的实时预览**：新目录页在结果区顶部显示拼接后的完整路径（`:911-917`），并按 `pathBaseName` 展示（`options.ts:77-82`）。

**打开入口是一个带自增 id 的 store**：`stores/add-project-flow-store.ts:14-27` 只有 `{ request: { id, preferredHostId? } | null, open, close }`，`id` 自增（`:15,19`）。`components/add-project-flow-host.tsx:10` 用 `key={request.id}` 挂载——**重开即重置全部内部状态**，包括那些草稿。这是刻意的：一次 add-project 是一次性任务，不该跨次保留。

**行为表**

| 触发 | 行为 | 落点 | 位置 |
|---|---|---|---|
| 只有一台 host / 指定了 host | 跳过 host 页，从 method 开始 | 流程栈 | `add-project-flow/model.ts:73-86` |
| host 列表后续刷新 | 仅当还在第一页时才重新跳 | 流程栈 | `model.ts:88-107` |
| 某页输入 | 清 error、activeIndex 归零、写入草稿桶 | 草稿表 | `model.ts:208-229` |
| 后退后再前进 | 从草稿桶恢复输入 | 页面 | `model.ts:170-182,191-206` |
| 能力位不支持某方式 | 仍列出但禁用，描述改为「请更新」 | 列表 | `add-project-flow/options.ts:36-62,64-75` |
| 搜索无完全匹配 | 手输解析结果前置到列表顶部 | 列表 | `components/add-project-flow.tsx:637-651` |
| 提交中 | 只显示进度文案，隐藏错误/加载/空态/列表 | 结果区 | `add-project-flow.tsx:918-956` |
| 提交失败 | 错误行，页内其余内容恢复可交互 | 结果区 | `add-project-flow.tsx:924-927` |
| 新目录页 | 顶部实时预览拼接后的完整路径 | 结果区 | `add-project-flow.tsx:911-917` |
| 关闭后重开 | 全部状态重置（含草稿） | — | `components/add-project-flow-host.tsx:10`；`stores/add-project-flow-store.ts:19` |

---

### 5.10 与本项目对照

先说一处**与给定现状不符的地方**：给定事实说本项目「已实测不存在 toast 层」，这准确；但同时说「运行失败状态」是留白，而 `workbench/business-session.tsx:485-516` 实际已有三处失败表达——`role="alert"` 的业务错误 + 「刷新状态」按钮（`:485-491`）、`run.error` 文本（`:492-497`）、执行状态行里 `failed: '执行失败'` 的状态映射（`:499-516`）。**问题不是「没有」，而是「只有一行文字」**：没有原因分类、没有重试语义（只有 refresh）、没有失败时的上下文保留。下面按此校正。

| paseo 做法（路径:行） | 本项目现状（路径:行） | 影响 | 建议（方向） |
|---|---|---|---|
| 空态是纯函数 + 组件只选视图：`schedules-screen-state.ts:9-22`、`workspace-route-state.ts:30-96` | 状态分支内联在 JSX：`workbench/business-session.tsx:485-516` 一段里三个分支 | 状态矩阵无法脱离渲染测试；新增状态要改组件 | 把「连接态 × 业务态」的显示决策抽成纯函数，测试只测决策 |
| 空态自动跳过：`welcome-screen.tsx:182-185` 一连上就 replace | 无对应；会话/项目列表无空态分支（`SessionList.tsx`、`ProjectNavigation.tsx` 未见空态文案） | 首次启动要用户手动点一次 | 会话列表无项目时直接给「新建会话」单入口，不做多步引导 |
| 空态占列表体而非顶替列表：`sidebar/empty-states.tsx:31-35` | `SessionList.tsx` 无空态容器 | 后续加筛选器会踩同一个坑 | 空态渲染在列表容器内、保留已有 section header |
| 空态按钮清掉全部致空筛选：`empty-states.tsx:42-52` | 无筛选器 | 暂无影响 | 加筛选时按此约束 |
| 启动器按能力位隐藏/禁用：`workspace-tabs/launcher/index.tsx:141-186`、`add-project-flow/options.ts:36-62`（不支持仍列出但禁用并提示升级） | `TabGroups.tsx` 面板为静态配置 | 项目/能力不可用时会给出可点的死路 | tab 清单接入能力位，不可用项禁用并说明原因，而非隐藏 |
| 空提交静默建对象：`new-workspace-empty.ts:5,21-30` | 无 | 若做自动建会话会重复实现 | 复用此契约：空提交不报错、不发消息 |
| 转圈基元无文案，加载策略在调用方：`loading-spinner.tsx:10` | `.btn[aria-busy="true"]::after`（`styles.css:464-472`）——**只有按钮内转圈，没有页面级转圈** | 页面级等待无任何视觉反馈 | 需要一个页面级加载基元；文案由调用方给 |
| 骨架屏只给「结构已知」的地方：`sidebar-agent-list-skeleton.tsx:59-163`、`pane-skeleton.tsx:9-111` | 全仓无 skeleton（`grep -rni skeleton` 无命中） | 列表首载是空白 | 侧栏项目树与会话列表值得骨架；详情页不值得 |
| 加载超过一定时间换策略 | 无此机制；仅 `kernel-session.tsx:24-33` 有 phase 文案表 | 慢加载与快加载无区别 | 暂不引入超时降级；paseo 自己也只有 recovery 一处反向防闪（`use-workspace-recovery.ts:11-26`） |
| 进度文案逐条列出：`app-diagnostic-sheet.tsx:31-37,77-131` | `ActivityPane.tsx:255-278` 只有单行 `kernel-status__text` | 引导/摄取这类多步操作没有进度感 | 批量操作（题录导入、材料摄取）应给逐条进度而非单行文字 |
| 错误分四层，行内/横幅/整屏/toast 各司其职：`alert.tsx:31`、`schedules-screen.tsx:344-357`、`workspace-route-state-views.tsx:207-258`、`session-context.tsx:180` | 只有 `business-error` 一层（`business-session.tsx:485-491`，`styles.css:1616-1622`） | 所有错误长得一样，用户分不清能不能重试 | 至少分「可重试的行内错误」与「不可重试的状态行」两种形态 |
| 提交失败不禁用提交按钮：`schedule-form-model.ts:545-565` + `schedule-form-sheet.tsx:277-280` | 无提交失败态 | 失败后用户可能只能刷新页面 | 提交失败保留输入与按钮，错误显示在表单内 |
| 失败保留旧数据、行不重排：`usage/model.ts:47-49,66-92` | `business-session.tsx:487-490` 失败只给「刷新状态」 | 刷新失败即回到空 | 刷新失败保留上次快照 |
| 错误边界堆栈限高：`root-error-boundary.tsx:46-48` | 无错误边界 | 崩溃后白屏 | 加根错误边界；堆栈进 `<details>` 折叠，不占主视图 |
| 边界自带自愈（`resetKey` 变化即清错）：`surface-error-boundary.tsx:31-40`、`plugins/settings/index.tsx:81-94` | 无 | — | 若将来有可重挂的子区域，用同一模式 |
| 错误文案统一出口：`utils/error-messages.ts:1-6` | 各处 `error instanceof Error ? error.message : String(error)` 手写（`kernel-session.tsx:63-68`） | 文案格式可能不一致 | 抽一个 `toErrorMessage` |
| 归档在原地给 callout + 恢复按钮：`archived-agent-callout.tsx:17-61`（渲染在输入区位置，非横幅） | `business-session.tsx:431-447` 已有「会话已归档，历史和草稿保留」+「恢复当前会话」 | **已有且形态正确** | 保持；补的是失败时的错误行（paseo 有，本项目无） |
| 归档的取消失败追加错误行：`archived-agent-callout.tsx:52-56` | 无 | 用户点了没反应也不知道 | callout 内维护一个错误位 |
| 恢复流程的 9 态 gate + 失败即重试：`workspace-route-state-views.tsx:112-206` | 有「待核查指令」`<details>` + 「按原身份补交」：`business-session.tsx:450-484` | 已有恢复入口，且保留原文 `<pre>` | 补：恢复动作本身的失败态与重试按钮 |
| 风险动作先确认并逐条说明：`worktree-archive-warning.ts:79-90`、`:60-77` | `StopKernel`（`ActivityPane.tsx:277`）有确认；题录删除未核实 | 不可逆操作提示粒度不一致 | 所有不可逆操作统一走一个确认组件，message 支持动态条目 |
| 常驻 callout 带 dismiss key 与优先级：`worktree-setup-callout-policy.ts:50-69` | 无 callout 体系 | — | 若要加引导型 callout，dismiss key 必须按对象 id 分桶 |
| 通知去重按对象 + 时间戳：`session-context.tsx:238,286-291` | 无系统通知 | — | 接 Electron Notification 时先做去重表，否则重连会重发 |
| `error` 类 attention **不通知**：`session-context.tsx:275-277` | — | — | 同上：失败只在应用内呈现 |
| 通知点击按目标完整度降级路由：`notification-routing.ts:30-41` | — | — | 路由构造保持纯函数，便于测试 |
| 权限申请与状态行 + 测试通知三态：`desktop-notifications-section.tsx:82-125`、`use-desktop-permissions.ts:126-152` | 无通知设置 | — | 麦克风/通知权限若要做，给「发一条测试」入口 |
| 计划任务整页 | **无此能力**（`app/` 下无对应模块） | 定时类需求无法落地 | 若要做：先做「状态推导纯函数 + 单列表页」，创建表单不要分步 |
| 计划任务的客户端状态推导 + 防误判：`schedule-derivation.ts:38-41,56-62`、`schedules-screen.tsx:76-91` | — | — | 任何「目标是否还存在」的判断都需同样的「数据未就绪时不判定」守卫 |
| 徽章单一事实源 + 优先级排序：`schedule-derivation.ts:79-96`、`schedule-row.tsx:96-118`（状态不上 meta 行） | `business-session.tsx:610-613` 把 `state` 压成 3 档 | 状态信息被提前压平 | 映射前先保留 daemon 的原始状态 |
| 行级 pending 状态本地化：`schedules-table.tsx:56-61,77` | 无 | 多行并发操作会共用一个 loading | 若列表有行级动作，pending 必须按行 |
| 能力页状态折叠成六态字符串：`plugins-page-state.ts:1-15` | — | — | 同上，抽纯函数 |
| 客户端求值失败覆盖 daemon 状态：`plugins-page.tsx:130,444` | — | — | 本地「读缓存失败」时不要显示后端的成功态 |
| 能力行摘要每个标签都回退到 id：`profile-summary.ts:25-28,37-56` | `SessionList.tsx` 行摘要 | 依赖不可用时行会变空 | 摘要任何一段缺失都退到标识符，不留空 |
| 「已支持但无可做操作」改写为正常态：`agent-skills/index.tsx:55-58` | — | — | 提示只在有可做操作时出现 |
| 破坏性删除由后端驱动二次确认且可反悔：`selection-sheet.tsx:90-108` | 题录库删除未核实有二次确认 | 静默删除风险 | 二次确认的内容必须来自实际将被删的对象 |
| 能力开关与可用集无交集时不渲染操作：`agent-skills/index.tsx:59-62,156-164` | — | — | 同上 |
| 用量区分「宿主不可用」与「请求失败」：`usage/types.ts:13-16`、`usage/model.ts:111-120` | — | — | 任何远端数据都要区分「对方没这能力」与「这次没取到」 |
| loading 与 empty 同视觉（都不需动作）：`usage/usage-section.tsx:53-59,71-73` | — | — | 只有需要用户动作的空态才给按钮 |
| 刷新期间保留旧数据 + 忙碌禁用：`usage/model.ts:39,47-49`、`usage/controls.tsx:174` | `business-session.tsx:488-490` 失败给「刷新状态」 | — | 补「刷新中不禁用、不清空」 |
| 百分比读法做成用户偏好：`usage/model.ts:6-11`、`tone.ts:5-13`（来源有 tone 就不覆盖） | — | — | 数值展示的换算与着色分开，来源能表态时尊重来源 |
| 窄屏自动 popover→sheet：`usage/options.tsx:29` | 无浮层 | — | 同一控件两种形态需共用 |
| 评审草稿按作用域键持久化 + 损坏即退化：`review/store.ts:105-109`、`review/state.ts:117-122` | `drafts.ts` 有草稿机制（未核实键结构） | — | 若做 diff 审阅，键需含「会话 × 文件集 × 模式」 |
| 发送只清本次发出的版本：`review/store.ts:325-341` | — | — | 异步确认不得覆盖用户的后续编辑 |
| 附件为空则不生成：`review/store.ts:243-245` | — | — | 避免发空内容给模型 |
| 加项目是纯模型 + 7 页栈 + 跨页草稿：`add-project-flow/model.ts:27-56,208-229` | `ProjectNavigation.tsx` 有新建会话/新建目录（`:716,737,821` 有 aria-busy） | 目前是单步操作，没有多步需求 | 若将来要多步（远程项目、导入会话），照这个模型分 |
| 能力位不支持仍列出但禁用并提示升级：`add-project-flow/options.ts:56-75` | 无 | 会给出可点的死路 | 禁用 + 说明原因，而非隐藏 |
| 搜索无完全匹配时把手输结果前置：`components/add-project-flow.tsx:637-651` | 无 | — | 搜索框永远不能堵住手输 |
| 关闭后重开全部重置：`add-project-flow-host.tsx:10`（`key={request.id}`） | — | — | 一次性流程不该跨次保留状态 |

### 5.11 未核实项

- `review/geometry.ts`（90 行）与 `review/surface.tsx`（634 行）的行内批注定位逻辑未读；`docs/ui-design/README.md:214+` 提到的 diff 审阅面板仍是留白，本项目无可对照的实现。
- `usage/queries.ts`（253 行）与 `usage/preferences.ts`（105 行）的取数与偏好持久化细节未读，只确认了视图层的状态映射。
- `agent-profiles/internal/profile-form-model.ts`（609 行）与 `materialize-profile.ts`（59 行）的表单校验规则未读。
- `plugins/catalog-sync.tsx`（89 行）的目录同步触发时机未读。
- `create-agent-preferences/storage.ts`（33 行）与 `service.ts`（63 行）的持久化位置与写入节流未读。
- `schedules/use-schedule-form-model.ts`（20 行）与 `use-schedule-form-provider-snapshot.ts` 的 store 契约未读。
- 本项目 `workbench/drafts.ts` 的草稿键结构未逐行核实，只确认存在草稿机制。
- Electron 主进程是否已注册 `Notification` 与 `host.notification.sendNotification` 桥未查（本节只覆盖渲染层 `packages/app/src`）。

---

## 6. 跨切片的可迁移做法

前五章各写各的领域，但反复出现同一批设计手法。这一节把它们抽出来——**它们的价值在于跨领域复用，
而不是某一个具体功能**。每条给出多个独立来源的证据点，判断某条是否只是单点巧合。

### 6.1 状态是推导出来的，不是存出来的

`TurnLiveness` 只存两态（`timeline/turn-liveness.ts:6-13`），取消是叠加一个
`cancellationRequestId` 而不是新增状态（`timeline/turn-liveness.ts:74-100`）；对外可见的「运行中/已完成/失败」由
`deriveAgentStateBucket` 的五桶短路优先级算出来，再映射到状态点颜色。计划任务的状态同样是客户端推导，
且有优先级：**过期、目标消失压过 completed/paused**，并配一条守卫「agent 目录未首载完就不判定目标消失」
（`schedules/schedule-derivation.ts:38-41`、`screens/schedules-screen.tsx:76-91`），
防止首屏加载中误报「任务已失效」。第 5 章整体贯穿同一条原则：paseo 把非 happy 状态几乎全做成纯函数
`resolveXxx`，组件只负责选视图。

**本项目现状**：状态映射是渲染层里的字面量表——`workbench/business-session.tsx:498-506` 用一个对象
把 `queued/running/cancelling/cancelled/completed/failed/interrupted` 直接映射成中文串。
字面量表本身没错，但它没有「多信号归一」这一层。

### 6.2 用注册表代替硬编码分支

面板走 manifest + registry + pane context 三层（1.6）；命令面板走贡献式注册，每个贡献方带
`sourceId` 与 Symbol 世代标记做所有权与卸载（1.4）；侧栏导航项是「内置项与插件项共用一个有序序列」
（1.5）；快捷键 76 条绑定是一张声明式表（4.2）；斜杠命令有自动发现规则（4.6）。五处同一手法。

**本项目现状**：`shell/TabGroups.tsx:142` 直接在组件里 `kindIcons[tab.kind]` 取图标，
kind 到图标/组件的映射没有独立的注册点；新增一种 tab kind 要改组件而不是加一条注册。

### 6.3 弹层有唯一的焦点与关闭契约

`lib/overlay-root.ts` 提供焦点陷阱、焦点归还、Tab 循环与 IME 放行（3.7）；菜单面板失活即关（3.6）；
`AdaptiveModalSheet` 按视口宽窄二分，拖拽关闭只在紧凑分支（3.8）；tooltip 按当前输入模态决定是否响应
focus 事件（3.4）；输入框的键盘优先级是 IME → 弹层吞键 → 自身语义（4.5）。散落在多个控件里的
规则被收成一套。

**本项目现状**：只有 `shell/AgentOverlay.tsx` 一处 `role="dialog"` 与 `aria-live="polite"`；
没有 overlay 层、没有焦点归还约定、没有菜单层（`onContextMenu` 与 `role="menu"` 实测为零）。

### 6.4 失败保留现场，不清空用户输入

提交失败把 trim 后的消息与原附件写回（`composer/submit.ts:71-79`，见 ui-patterns 5.5）；
草稿不是删除而是打终态标记，让附件仍可被 GC 回收（2.4）；插件边界失败靠 `resetKey` 自愈而非清空 store；
用量面板失败时保留旧数据继续显示；加项目流程关闭后重开全部重置，不跨次保留（5.9）。

**本项目现状**：本项目的失败表达见 `workbench/business-session.tsx:485-516`——业务错误 `role="alert"` +
刷新按钮、`run.error` 的 `role="status"` 行、状态映射里的 `failed: '执行失败'`。
**校正一处常见判断**：这不是「没有失败态」，而是**只有一行文字**——无原因分类、无重试语义、
失败时不确定用户的输入与草稿是否完整保留。

### 6.5 同一个位置承载两种语义

发送键在运行中变取消键（2.4）；`SendBehavior "queue"` 在有待审批时被强制降级为 `interrupt`（2.4）；
草稿的终态用标记表达而不是删记录（2.4）。这三条都在**不动布局、不加新控件**的前提下表达状态切换。

**本项目现状**：`shell/AgentDock.tsx:92-97` 已有同类做法（折叠态只读最后一条做预览），
但 `shell/InstructionComposer.tsx` 目前只有发送一路，运行中可做什么没有系统答案（见 2.5）。

### 6.6 多步流程是「模型 + 栈 + 分桶草稿」

加项目流程是纯模型（`add-project-flow/model.ts:27-56`）+ 7 页栈 + 按 (host, 上下文) 分桶的跨页草稿（5.9）；
能力位不支持时**仍列出但禁用并提示升级**，不隐藏（`add-project-flow/options.ts:56-75`）；
搜索无完全匹配时把手输结果前置（`components/add-project-flow.tsx:637-651`）。

**本项目现状**：题录库导入与手动建项走的是现有表单样式，属于单步操作，没有多步需求。
paseo 这个模型是给「将来要加远程项目、批量导入」预留的，不是现在就抄。

### 6.7 恢复路径是设计对象，不是异常分支

agent 归档是输入区位置的 callout + 可取消归档（`components/archived-agent-callout.tsx:17-61`）；
workspace 归档是 9 态整屏 gate，失败时按钮文案就地改成「重试」（5.4）；
引导屏可以自动跳过，一连上就 `replace`（`components/welcome-screen.tsx:182-185`）；
列表空态是 body 而不是独立 screen，顶替列表会关掉筛选菜单（`components/sidebar/empty-states.tsx:31-35`）。

---

## 7. 与本项目的差距总表

前五章各有一节对照表，是细目。本表是**跨切片的排序视图**，只保留有决策价值的一行；
详细机制与行号见对应章节。`影响` 一列写清「不补会怎样」，`建议` 只给方向，不排期。

| # | 能力 | paseo | Scholoom | 影响 | 建议（方向，不排期） | 详见 |
|---|---|---|---|---|---|---|
| 1 | 集中快捷键注册表 | 76 条声明式绑定 + `ShortcutWhen` 门控（`keyboard/keyboard-shortcuts.ts:259-1173`） | 4 处局部监听：`Workbench.tsx:215`、`SessionList.tsx:49`、`TabGroups.tsx:153`、`InstructionComposer.tsx:78` | 改键要逐处改；`Ctrl/Cmd+B` 不看 target，在输入框内也会折叠侧栏 | 建注册表 + 门控字段；至少先给全局 handler 补 target 判断 | 4.2 |
| 2 | 命令面板 | 贡献式注册，四个贡献源，`sourceId` + Symbol 世代标记做所有权（`command-center/`） | 无 | 「加命令」必须改组件；后续功能越多越贵 | 最小版本：一张声明表 + 一个输入框 + 两层排序 | 1.4 |
| 3 | 弹层与焦点管理 | `lib/overlay-root.ts` 焦点陷阱/归还 + `AdaptiveModalSheet` 二分 | 仅 `AgentOverlay.tsx` 一处 dialog 语义 | 第二个弹层出现时焦点会跑丢，Esc 归属靠事件阶段偶然达成 | 抽一层 overlay：焦点陷阱 + 归还 + Esc 层级 | 3.7、3.8 |
| 4 | 菜单与右键 | 一套引擎两种呈现 + submenu + `data-menu-disabled` 键盘跳过（`components/ui/menu/`） | `onContextMenu` 与 `role="menu"` 实测为零 | 右键菜单、溢出菜单都无处落地 | 先补一套 `menu` primitive，不要在组件里各写 dropdown | 3.6 |
| 5 | 运行中控制面 | 打断/排队/steer/切模型/加上下文各有 RPC 入口与失败语义（`agent-controls/policy.ts`） | 只有发送一路（`InstructionComposer.tsx:78-91`） | 一次长运行开始后用户无事可做，只能等 | 先补「排队」与「打断」两态，二者都已有下游语义 | 2.5 |
| 6 | 草稿持久化 | 三态 lifecycle + TTL 5 分钟 + 帧发布/200ms 落盘节流 + 跨 key hydrate（`stores/draft-store/state.ts`、`workbench/drafts.ts` 对照） | 有草稿机制，键结构未逐行核实 | 切会话/刷新丢草稿的风险未知 | 先明确草稿键与生命周期，再谈 UI | 2.4 |
| 7 | 运行失败完整呈现 | 四层错误模型（行内/横幅/整屏 gate/toast）+ 重试 + 失败保留现场 | 只有 `business-session.tsx:485-516` 的一行文字 | 用户不知道能做什么、下一步是什么 | 先补原因分类与重试语义，再谈视觉 | 5.3、6.4 |
| 8 | 状态推导层 | `deriveAgentStateBucket` 五桶短路 + `schedule-derivation` 优先级与防误判守卫 | 渲染层字面量表（`business-session.tsx:498-506`） | 多信号（连接态、运行态、审批态）叠加时优先级靠记忆 | 把状态归一抽成纯函数，与渲染解耦 | 6.1 |
| 9 | 面板注册表 | manifest + registry + pane context 三层，加一个面板改 5 处且清单固定（1.6） | `TabGroups.tsx:142` 组件内 `kindIcons` 映射 | 新增 tab kind 要改组件 | 抽出 kind → 描述符的注册点 | 1.6、6.2 |
| 10 | 通知 | 两条独立通道，OS 通知按 agentId+时间戳去重，`reason === "error"` 刻意不通知 | 未查 Electron 主进程是否注册 Notification 桥 | 长任务完成后用户不知道 | 先定「哪些事件值得通知」，再定通道 | 5.5 |
| 11 | 多步流程模型 | 纯模型 + 7 页栈 + 按上下文分桶的跨页草稿（`add-project-flow/`） | 单步操作，无多步需求 | 现在不需要 | 不抄；若将来加远程项目或批量导入再回来取 | 5.9、6.6 |
| 12 | 计划任务 / 能力发现 / 用量评审 | 三块完整能力页 | 均无 | 对应 `docs/ui-design/README.md` 留白 | 不排期；先确认是否属于本项目能力边界 | 5.6–5.8 |
| 13 | Toast 与瞬时反馈 | 单条替换、hover 暂停、error 3200ms（`components/toast-host.tsx`） | 无 toast 层 | 轻量操作完成没有低成本反馈通道 | 若加，与 `role="alert"` 的用法一起定 | 3.9 |
| 14 | reduced motion | 全仓无 `prefers-reduced-motion`，仅两处 `useReducedMotion()` | `styles.css:401-404` 有媒体查询，但只覆盖 `.dot--run` | **本项目方向更对**，但覆盖范围太窄 | 把范围补到全部 keyframes | 3.11、6.7 |
| 15 | 语音输入 | `dictation/` + `voice/` + 音量反馈 | 无 | 长指令输入成本高 | 不排期；先确认模型侧是否支持流式语音 | 4.7 |

一条需要单独点出的**事实纠正**：`docs/ui-design/README.md` 的已知留白列有「运行失败状态的完整呈现」，
容易被读成本项目完全没有失败态。实测 `workbench/business-session.tsx:485-516` 已有三处表达
（`role="alert"` 业务错误 + 刷新按钮、`run.error` 的 `role="status"` 行、状态映射里的 `failed: '执行失败'`）。
准确说法是**只有一行文字，没有原因分类与重试语义**，见表第 7 行。

---

## 8. 路径索引

按主题列出本文引用密度最高的文件，便于复核。完整引用见各章正文。

| 主题 | 文件:行 |
|---|---|
| 屏幕与路由 | `packages/app/src/navigation/agent-route-resolution.ts`、`workspace-route-navigation.ts`、`settings-navigation.ts`、`themed-stack.tsx`、`agent-route-resolution-view.tsx` |
| 命令面板 | `packages/app/src/command-center/registry.ts`、`results.ts`、`contributions.ts`、`root-contributions.ts`、`workspace-contributions.ts`、`agent-control-contributions.ts` |
| 侧栏导航模型 | `packages/app/src/sidebar-nav/model.ts`、`use-sidebar-nav-items.ts`、`stores/sidebar-order-store.ts`、`sidebar-collapsed-sections-store.ts`、`sidebar-view-store.ts` |
| 面板注册表 | `packages/app/src/panels/panel-manifest.ts`、`panel-registry.ts`、`register-panels.ts`、`pane-context.tsx` |
| 工作区布局持久化 | `packages/app/src/stores/workspace-layout-store.ts`、`workspace-layout-actions.ts`、`workspace-layout-constants.ts`、`workspace-layout-ids.ts`、`workspace-layout-storage.ts` |
| 标签与多开模型 | `packages/app/src/workspace-tabs/model.ts`、`open-beside.ts`、`open-supporting-view.ts`、`screens/workspace/use-mounted-tab-set.ts`、`workspace-deck-retention.ts`、`workspace-bulk-close.ts` |
| 会话模型与状态机 | `packages/app/src/stores/session-store.ts`、`timeline/turn-liveness.ts`、`types/stream.ts`、`components/agent-status-dot.tsx`、`panels/agent-facts-line.tsx` |
| 发送与草稿 | `packages/app/src/composer/submit.ts`、`composer/input/state.ts`、`composer/draft/input-draft.ts`、`stores/draft-store/state.ts`、`stores/draft-keys.ts` |
| 运行中控制面 | `packages/app/src/agent-controls/policy.ts`、`composer/agent-controls/index.tsx`、`runtime/host-runtime.ts` |
| 工具调用展开 | `packages/app/src/tool-calls/presentation.ts`、`components/tool-call-details.tsx`、`tool-call-sheet.tsx`、`panels/changes/`、`panels/diff-panel.tsx` |
| 子 agent 与 timeline | `packages/app/src/subagents/select.ts`、`panels/provider-subagent-panel.tsx`、`packages/app/src/timeline/session-stream-reducers.ts` |
| 斜杠命令 | `packages/app/src/client-slash-commands/index.ts`、`utils/agent-command-autocomplete.ts` |
| 焦点与弹层 | `packages/app/src/lib/overlay-root.ts`、`components/ui/keyboard-dismiss.ts`、`components/ui/bottom-sheet-scope.tsx`、`components/ui/isolated-bottom-sheet-modal/`、`components/ui/anchor.ts` |
| 菜单 | `packages/app/src/components/ui/menu/`（`menu-surface.tsx`、`menu-overlay.tsx`、`menu-navigation.ts`、`menu-sub.tsx`）、`components/context-menu.tsx`、`dropdown-menu.tsx` |
| 控件按压反馈 | `packages/app/src/components/ui/press-highlight.tsx`、`press-highlight.shape.ts`、`button.tsx`、`icon-button-chrome.ts` |
| 提示层 | `packages/app/src/components/ui/tooltip.tsx`、`hover-card.tsx`、`components/workspace-hover-card.tsx` |
| 模态与抽屉 | `packages/app/src/components/adaptive-modal-sheet.tsx`、`adaptive-modal-sheet-layout.ts` |
| 瞬时反馈 | `packages/app/src/components/toast-host.tsx` |
| 快捷键 | `packages/app/src/keyboard/keyboard-shortcuts.ts:259-1173`、`keyboard/keyboard-action-dispatcher.ts`、`keyboard/focus-scope.ts`、`hooks/use-keyboard-shortcut-overrides.ts`、`keyboard/shortcut-override-store.ts` |
| 状态推导 | `packages/app/src/schedules/schedule-derivation.ts`、`screens/schedules-screen.tsx` |
| 错误四层 | `packages/app/src/components/ui/alert.tsx`、`app-diagnostic-sheet.tsx`、`diagnostics/` |
| 空态与归档 | `packages/app/src/components/welcome-screen.tsx`、`components/sidebar/empty-states.tsx`、`components/archived-agent-callout.tsx`、`workspace/project-workspace-archive.ts` |
| 通知 | `packages/app/src/push-notifications/` |
| 计划任务 | `packages/app/src/schedules/`、`screens/schedules-screen.tsx`、`screens/schedules-screen-state.ts` |
| 能力发现 | `packages/app/src/plugins/`、`agent-skills/`、`agent-profiles/` |
| 多步流程 | `packages/app/src/add-project-flow/`、`stores/add-project-flow-store.ts` |
| 本项目壳层 | `apps/desktop/src/renderer/src/workbench/Workbench.tsx:215`、`workbench/shell/TabGroups.tsx:141-153`、`shell/AgentOverlay.tsx:118`、`shell/InstructionComposer.tsx:78`、`workbench/business-session.tsx:485-506`、`workbench/SessionList.tsx:49` |
| 本项目无障碍现状 | `LibraryPanel.tsx`（23 处 `aria-label` + 7 处 `role="alert"`）、`ProjectNavigation.tsx:98,357`、`shell/TabGroups.tsx:141-150`（完整 WAI-ARIA tabs） |

---

## 附录：复核方法

```bash
git submodule update --init references/paseo && git -C references/paseo rev-parse --short HEAD   # 5c2a155
cd references/paseo/packages/app/src

# 规模先看一眼，再决定读哪些
wc -l keyboard/keyboard-shortcuts.ts command-center/registry.ts composer/index.tsx components/ui/menu/*.tsx
ls command-center/ screens/ panels/ workspace-tabs/ agent-controls/ subagents/ schedules/ plugins/

# 本项目对照事实
cd /home/joshua/Workspace/Code/JavaScript/Scholoom
grep -rn "keydown\|onKeyDown" apps/desktop/src/renderer/src --include=*.tsx
grep -rno 'role="[a-z]*"\|aria-[a-z]*=' apps/desktop/src/renderer/src --include=*.tsx | sed 's/:[0-9]*:/ /' | sort | uniq -c | sort -rn
grep -rn "onContextMenu\|showModal\|CommandPalette\|Toast" apps/desktop/src/renderer/src
```

复核时注意三点：

1. **本文所有引用逐条 `read` 过**，但仍有少量来自只读片段的长文件（`composer/index.tsx` 24 次引用、
   `runtime/host-runtime.ts` 15 次、`screens/workspace/workspace-screen.tsx`）。
   submodule 更新后优先按符号名重定位这几处。
2. **本文刻意不给几何与色值**，那些在 [`paseo-ui-patterns.md`](paseo-ui-patterns.md)；
   本文也不给 Codex 侧的 UX 推断，理由见开篇「为什么 UX 部分只分析 paseo」。
3. 各章末尾的「未核实项」是已知的阅读缺口，不是遗漏的结论，引用前应先自行确认。


