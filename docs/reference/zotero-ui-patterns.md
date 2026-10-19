# Zotero UI/UX 设计模式：源码事实与本机实测

Zotero 7 之后的主界面是一套完整的界面工程：XUL 骨架 + React 虚拟列表 + SCSS 令牌三层。
本文把它在本机测得的**视觉数值**（调色板字面值、几何、密度）与源码里的**交互契约**
（命令三层、菜单三层、图标解析、section 懒渲染、a11y/RTL 规则）写成可逐条回查的条目。
只写 Zotero 自己的事实，不写对本项目的对照与落地建议。

## 如何使用本文

1. **只写源码与实测里读到的客观事实**，每条带 `路径:行号`（或归档成员路径）。读不到写
   `unverified — 需确认`，不猜不省略。
2. **本文不改本项目任何代码**，也不写落地建议。是否采纳由设计裁决。
3. **组件结构与样式分层**见 [`references/Zotero/08-界面与样式.md`](../../references/Zotero/08-界面与样式.md)——
   它写了文件清单、元素职责、React 虚拟化的组件划分、`scss/` 目录分层与平台入口。
   本文只补它没写的两类内容：**交互契约**（命令/菜单/焦点/拖放/懒渲染怎么串）和**视觉数值**
   （令牌字面值、几何 px、密度公式、实测截图尺寸）。两文重叠的部分（文件清单、目录树）本文不复述。

## 来源与版本

| 素材 | 口径 | 用途 |
| --- | --- | --- |
| 本机安装版 Zotero **9.0.4**（`/usr/lib/zotero/app/omni.ja`，BuildID `20260522150903`） | 归档成员路径 `chrome/…` | 与截图同版；DOM id / 命令 id / 编译后 CSS 的复核 |
| 源码检出 `/home/joshua/Workspace/Code/JavaScript/zotero`，`main` @ `2cdc2cc`（`version` 文件为 `11.0.SOURCE`） | `zotero/…` 路径 + 行号 | 行号级引用的唯一口径 |
| 截图采集环境 | Xvfb `:99` 1280×1024，无窗口管理器，Zotero 窗口 1280×1000 | §11 的量测与交互事实 |

三处素材**不是同一版本**，已知漂移点与标注规则见 §1.2 与 §1.3。

章节导航：1 取证基线与版本漂移 · 2 主窗口布局骨架 · 3 条目列表 · 4 条目面板 · 5 视觉令牌与主题链路 ·
6 排版、密度与几何数值 · 7 图标体系 · 8 交互契约 · 9 无障碍与本地化 · 10 XUL 专有 vs 可移植 ·
11 实测观察 · 12 路径索引 · 附录 复核方法。

---

## 1. 取证基线与版本漂移

### 1.1 版本事实（实测，写作时不再重复验证）

| 事实 | 取值 | 核验命令 |
| --- | --- | --- |
| 安装版本 | `Version=9.0.4`、`BuildID=20260522150903`、`MinVersion=140.0` | `grep -E '^(Version\|MinVersion\|BuildID)' /usr/lib/zotero/app/application.ini` |
| 界面源码成员 | `chrome/content/zotero/**` 共 **501** 个成员 | `unzip -l /usr/lib/zotero/app/omni.ja \| grep -c 'chrome/content/zotero/'` |
| 编译后 CSS | `chrome/skin/default/**/*.css` 共 **24** 个，另 21 个 `.css.map` | 同上，`grep -oE 'chrome/skin/default/[^ ]*\.css'` |
| 主界面样式 | `chrome/content/zotero-platform/{mac,win,unix}/zotero.css`（unix 581 269 B，已 minify） | `unzip -l … \| grep zotero-platform` |
| 编译产物是否可读 | **不可读**：`.css.map` 只有 `version`/`sources`/`mappings`，**无 `sourcesContent`**（`sources` 指向 CI 构建机路径 `file:///home/runner/work/zotero/zotero/scss/…`） | `unzip -p … chrome/skin/default/zotero/scaffold.css.map \| grep -c sourcesContent` |
| minify 程度 | `chrome/skin/default/zotero/scaffold.css` 只有 **2 行** | `unzip -p … scaffold.css \| wc -l` |
| 可读源码树 | `/home/joshua/Workspace/Code/JavaScript/zotero` @ `2cdc2cc`，`scss/**` 是编译进上述 CSS 的唯一来源 | `git -C … rev-parse HEAD` |

### 1.2 引用规则

- 本文所有行号级引用写作 `zotero/…`，一律指
  `/home/joshua/Workspace/Code/JavaScript/zotero`（commit `2cdc2cc`）。例：
  `zotero/scss/base/_base.scss:2`、`zotero/chrome/content/zotero/zoteroPane.js:1283`。
- 涉及 DOM id、命令 id、偏好名、编译后取值这类**必须与安装版一致**的断言，再给一条归档成员路径
  复核，形如 `chrome/content/zotero/zoteroPane.xhtml`；或给归档内的字面量命中计数（见 §1.3）。
- 凡涉及漂移风险的断言就地标注 **版本漂移 — 以截图或归档为准**。
- 读不到或无法核实的写 `unverified — 需确认`，不省略、不猜。

### 1.3 版本漂移表（源码树 `11.0.SOURCE` vs 安装 `9.0.4`）

| 断言 | 源码树 | 安装版 9.0.4 归档 | 核验命令 |
| --- | --- | --- | --- |
| 令牌与几何字面值（`--color-sidepane`、`--color-stripe`、`--default-focusring-width`、`2.33333333em`、`min-height:41px`、`width:37px`、`[zoteroUIDensity=…]`、`outline-offset:calc(-1*var(--default-focusring-width))`、`image-set(`、`scrollbar-color`、`@keyframes rotating`、`grid-template-columns:max-content 1fr`、`padding:6px 4px 0`、`gap:6px`、`border-radius:5px`、`-moz-context-properties:fill`） | 见 §5、§6 | **一致**（逐条命中计数见附录） | `unzip -p … chrome/content/zotero-platform/unix/zotero.css \| grep -o <字面量> \| wc -l` |
| 条目面板 `deck` 结构与元素 id | `zotero/chrome/content/zotero/elements/itemPane.js:34-48`（`zotero-item-pane-content` / `item-details` / `annotation-items-pane` / `zotero-note-editor` / `duplicates-merge-pane`） | **一致** | `unzip -p … elements/itemPane.js \| grep -n 'item-details'` |
| 批量编辑提示 `batch-edit-prompt`（groupbox + 「编辑多个条目…」按钮） | `elements/itemPane.js:44-47` | **9.0.4 无**（`batch-edit` 命中 0）；截图 `shot-03-multiselect.png` 的条目面板只有文案、没有按钮，与之一致 | `unzip -p … elements/itemPane.js \| grep -c batch-edit` |
| 图标总数 `skin/16/universal/*.svg` | **109** | **107** | `ls zotero/chrome/skin/default/zotero/16/universal \| wc -l`；`unzip -l … \| grep -c 'skin/16/universal/'` |
| `skin/16/white/` 目录 | 不存在（只有 `universal`/`light`/`dark`） | 同样不存在；启动日志实测 `Missing chrome or resource URL: chrome://zotero/skin/16/white/loading.svg` | `unzip -l … \| grep -c 'skin/16/white/'` |
| `view-menuitem-tag-selector` | `zoteroPane.xhtml:597-601` | **一致**（9.0.4 同位置同写法） | `unzip -p … zoteroPane.xhtml \| grep -n tag-selector` |

其余行号（函数定义位置、变量名、DOM id）只在源码树口径下核对；9.0.4 归档里若同名成员存在，
其行号可能不同，需按归档成员路径重查（命令见附录）。

### 1.4 实测与临时工作区

- 采集用隔离 profile 与**拷贝的数据库**：`/tmp/zotero-ui/{profile,data,shots,zotero.log,launch.sh,ui.sh,cap.sh,measurements.md}`。
  用户的 `~/Zotero/zotero.sqlite` 全程只读——采集前后 `ls -l` 的大小与 mtime 未变（47505408 B / Jul 30 11:23）。
- 采集期结束后 `pgrep -a zotero` 无输出（收尾已 `pkill`），仓库工作树只新增本文件与 `docs/reference/README.md`。
- 截图只落在 `/tmp/zotero-ui/shots/`，不进仓库；本文引用截图只写文件名与尺寸。
- Zotero 启动参数：`zotero -profile /tmp/zotero-ui/profile -no-remote`（`/usr/lib/zotero/zotero:20` 把 `"$@"`
  透传给 `zotero-bin`，`-profile`/`-no-remote` 因此有效）。

---

## 2. 主窗口布局骨架

### 2.1 布局树

全部取自 `zotero/chrome/content/zotero/zoteroPane.xhtml`：

| 层级 | 元素 | 行号 |
| --- | --- | --- |
| 1 | `window#main-window` | `:42` |
| 2 | `vbox#titlebar`（菜单栏；`</vbox>` 在 `:888`） | `:217` |
| 2 | `hbox#zotero-title-bar`（与 `titlebar` **平级**，不是子节点） | `:889` |
| 3 | `div#tab-bar-container`（React 挂载点，XUL 里是空 `<div/>`） | `:890` |
| 3 | `hbox#zotero-tabs-toolbar` | `:891` |
| 2 | `hbox#browser` | `:1079` |
| 3 | `vbox#appcontent` | `:1080` |
| 4 | `stack#zotero-pane-stack` | `:1081` |
| 5 | `deck#tabs-deck` | `:1089` |
| 6 | `tab-content#zotero-pane` | `:1090` |
| 7 | 6 个 `vbox.banner-container` + `hbox#zotero-trees` | `:1095 / :1125 / :1139 / :1156 / :1166 / :1178`，`zotero-trees` 在 `:1189` |

6 个 banner 依次是 post-upgrade、sync-reminder、mac-word-plugin-install、retracted-items、
architecture-warning、file-renaming（`:1095-1187`，整体）。命名规律是 `*-container`，
只有最后一个是 `file-renaming-banner-container`（`:1178`）。

### 2.2 三栏容器与分隔

| 容器 | 行号 | 说明 |
| --- | --- | --- |
| `vbox#zotero-collections-pane` | `:1190` | 左栏：自己的工具栏 + 集合树 + 标签选择器 |
| `vbox#zotero-items-pane-container` | `:1242` | 中栏：`#zotero-items-toolbar` + 条目列表 |
| `item-pane#zotero-item-pane` | `:1372` | 右栏：条目面板本体（**不是** `box#zotero-context-pane`） |
| `box#zotero-context-pane` | `:1393` | 阅读器侧栏上下文面板，`collapsed="true"` 默认收起 |

分隔靠 3 个 `<splitter>`：

| splitter | 行号 | 属性 | 作用 |
| --- | --- | --- | --- |
| `zotero-tags-splitter` | `:1214-1222` | `orient="vertical" collapse="after" zotero-persist="state"`，`<grippy oncommand="ZoteroPane.toggleTagSelector()"/>` | **在左栏内部**，切标签选择器高度 |
| `zotero-collections-splitter` | `:1234-1239` | 无 `orient`（取 XUL 默认）、`resizebefore/after="closest"`、`collapse="before"`、`zotero-persist="state"` | 左栏宽度 |
| `zotero-items-splitter` | `:1365` | `orient="horizontal" collapse="after" zotero-persist="state orient"` | 切「中栏 / 右栏」的分隔，**不分隔中栏高度**；堆叠布局下 `orient` 被 JS 改写 |

splitter 的视觉规则在 `zotero/scss/components/_splitter.scss`：`appearance: none`（`:16`），
可拖区尺寸用 `--draggable-size`（compact 5 px / comfortable 8 px，折叠态 8/10 px，`:21-35`），
可折叠侧用 `border` + `margin: calc(1px - var(--draggable-size))` 抵消，只留 1 px 可见线
（`splitter-invisible-size` mixin `:1-12`，在 `[state="collapsed"]` 时互换上下边，`:7-11`）。
实测：左栏分隔线 1 px（y 方向取样 `217,217,217`），标签选择器分隔线同值（见 §11）。

### 2.3 尺寸持久化归属

`zoteroPane.xhtml` 里 `zotero-persist` 共 **12** 处，全部属性：

| 行号 | 元素 | 持久化属性 |
| --- | --- | --- |
| `:1083` | `zotero-reader-sidebar-pane` | `collapsed width` |
| `:1190` | `zotero-collections-pane` | `width` |
| `:1218` | `zotero-tags-splitter` | `state` |
| `:1229` | `zotero-tag-selector-container` | `height,collapsed` |
| `:1235` | `zotero-collections-splitter` | `state` |
| `:1241` | `zotero-layout-switcher` | `orient` |
| `:1365` | `zotero-items-splitter` | `state orient` |
| `:1372` | `zotero-item-pane` | `width height` |
| `:1385` | `zotero-context-splitter` | `state` |
| `:1393` | `zotero-context-pane` | `width` |
| `:1401` | `zotero-context-splitter-stacked` | `state` |
| `:1409` | `zotero-context-pane-inner` | `height` |

规律：`width`/`height` 记在容器上，`state`（折叠）记在 splitter 上，`orient` 记在布局盒子上。
非 `zotero-persist` 的持久化另有：条目面板 sidenav 顺序存偏好 `sidenav.order`
（`elements/itemPaneSidenav.js:344,459,465`）、固定分区存 `pinnedPane`
（`elements/itemDetails.js:190,668,679`）、布局模式存偏好 `layout`（`zoteroPane.js:7556,7564`）。
序列化/反序列化走 `zoteroPane.js:7465`（`serializePersist`）与 `:7424`（`unserializePersist`）。

### 2.4 三栏不是硬编码

`box#zotero-layout-switcher` 的 `orient` 可在 horizontal / vertical 间切换并持久化
（`zoteroPane.xhtml:1241`），JS 侧改写点 `zoteroPane.js:7385,7387,7391,7393`
（堆叠布局同时把 `zotero-items-splitter` 的 `orient` 改为 `vertical`，见 `:7386`）；
偏好 `layout` 变化由 `xpcom/prefs.js:377` 监听并调 `updateLayout()`。

### 2.5 空壳挂载点模式

XUL 只管骨架，三块内容区域在运行时挂载：

| 挂载点 | 声明 | 由谁填 |
| --- | --- | --- |
| `div#tab-bar-container` | `zoteroPane.xhtml:890`（空 `<div/>`） | `tabs.js:536` `ReactDOM.createRoot(document.getElementById('tab-bar-container')).render(` |
| `html:div#zotero-collections-tree` | `zoteroPane.xhtml:1212` | `collectionTree.jsx` |
| `html:div#zotero-tag-selector` | `zoteroPane.xhtml:1230`（带 `label`） | `containers/tagSelectorContainer.js`（`zoteroPane.xhtml:89` 载入） |
| `item-pane#zotero-item-pane` | `zoteroPane.xhtml:1372` | `customElements.js` 注册的 `<item-pane>` |
| `html:div#tree`（进度队列） | `progressQueueDialog.xhtml:29` | `progressQueueDialog.jsx:37-43`（`createRoot` + `render`） |

即：XHTML 里 `<html:div>` 只有 id 和少量属性，内容由 JS/React 决定；条目面板的 `<deck>` 甚至不在
XHTML 里，而在自定义元素的模板字符串里（`elements/itemPane.js:33-48`，`MozXULElement.parseXULToFragment`）。

---

## 3. 条目列表：虚拟化、列、排序分组、选择、拖放

### 3.1 两层虚拟化

| 层 | 文件 | 关键行 |
| --- | --- | --- |
| 表格外壳 | `zotero/chrome/content/zotero/components/virtualized-table.jsx` | `WindowedList` 实例化 `:1172`；`render()` 只出表头与粘性分区头 `:1351`、`:1352-1367`、`:1429-1439` |
| 行容器 | `zotero/chrome/content/zotero/components/windowed-list.js` | 行元素复用 `:101-109`（`renderItem(index, oldElem)`）；`_rowOffsets` 前缀和 `:67,168-177`，消费 `:162,194,236,243,249`；可见区二分 `:235-246`、`:317-334`；overscan 与滚动方向 `:254-281`（`overscanCount = 2` 在 `:65`，方向在 `:311`，150 ms debounce 复位 `:336`） |
| 真实 DOM 复用 | `virtualized-table.jsx` | `if (oldDiv) { div = oldDiv; div.innerHTML = ""; }` `:2262-2266` |

行元素被复用而不是重建：行元素拿到 `oldElem` 后清空内容再渲染，
所以 React 的行组件必须是「纯渲染」，不能假设实例唯一。

### 3.2 列即数据

- 全部可用列的唯一事实源：`zotero/chrome/content/zotero/itemTreeColumns.jsx:61-403`（`const COLUMNS = [` … `];`）。
- 数组内**实际使用**的字段：`dataKey:63`、`primary:64`、`defaultIn:65`、`label:66`、
  `showInColumnPicker:67`、`flex:68`、`zoteroPersist:69`、`width:83`、`sortReverse:89`、
  `disabledIn:97`、`staticWidth:102`、`columnPickerSubMenu:123`、`dependsOnChildren:196`、
  `defaultSort:193`（仅 `lastRead`）、`fixedWidth:361`、`iconLabel:360`、`minWidth:373`、
  `enabledIn:379,388`。
- 只存在于 JSDoc typedef、未在 `COLUMNS` 里使用：`renderCell`（`:53`）、`dataProvider`（`:52`）
  ——真实用例在 `integration/citationDialog.js:672`、`integration/citationExplorer.js:55`、
  `xpcom/pluginAPI/itemTreeManager.js:136`。
- `Columns` 类 `virtualized-table.jsx:1908`；`_computeFlexWidth` `:2143`、`toggleHidden` `:2127`、
  `toggleSort` `:2160`。
- 持久化不是 `Columns` 的方法，而是 `VirtualizedTable` 的 props（默认 `:427-428`、propTypes `:495-496`），
  由 `_getPrefs()` `:2017` / `_storePrefs()` `:2021` 转发，实现在
  `zotero/chrome/content/zotero/itemTree.jsx:2460`（`_getColumnPrefs`）与 `:2465`（`_storeColumnPrefs`），
  绑定于 `itemTree.jsx:1454-1455`。

### 3.3 排序与分组在 JS 侧重排数组

| 机制 | 位置 |
| --- | --- |
| 排序 | `zotero/chrome/content/zotero/collectionViewItemTree.jsx:184` `_sort(itemIDs)`（重排行数组，不是 DOM） |
| 库分组头 | `collectionViewItemTree.jsx:200` `_insertLibraryHeaders()`；`:236` `_computeSectionHeaders(collectionTreeRows)` |
| 分组/占位行类 | `zotero/chrome/content/zotero/itemTreeRow.js:652` `LibraryHeaderItemTreeRow`、`:729` `SpacerItemTreeRow`，导入于 `collectionViewItemTree.jsx:46` |
| 分组行不可选 | `collectionViewItemTree.jsx:1266` `isSelectable(index, selectAll=false)` → `!row.isObjectRow`；`isObjectRow` 在 `itemTreeRow.js:666`（header）与 `:729`（spacer）为 false |
| 默认排序列 | 库视图回落到列的 `dataKey`（`itemTree.jsx:1863-1870`）；只有 feed 视图返回 `'id'`（`collectionViewItemTree.jsx:1930-1931`） |

### 3.4 选择模型

`virtualized-table.jsx:55-348` 的 `TreeSelection`：

| 成员 | 行号 |
| --- | --- |
| `selected: new Set([])` | `:65` |
| `pivot: 0` | `:63` |
| `rangedSelect` | `:189` |
| `selectAll`（内部转 `rangedSelect(0, rowCount-1)`） | `:205` |
| `shiftSelect` | `:215` |
| `adjustForRowRemoval(index, remapToPrevious = false)` | `:273` |
| `adjustForRowInsertion(index, count)` | `:304` |
| `selectEventsSuppressed` getter/setter（内部 `_selectEventsSuppressed`） | `:334` / `:338`，字段 `:66` |

增删行时重映射选择是必需的：虚拟化列表的展开/折叠会插入 `SpacerItemTreeRow`，不做重映射就会选中错行。

修饰键判定**不在** `collectionViewItemTree.jsx` 集中一处：键盘分支在 `virtualized-table.jsx:636-638`，
鼠标分支在 `:859-861`（`shiftKey` / `ctrlKey||metaKey`），选择事件分派在 `:917-925`；
`collectionViewItemTree.jsx:1890-1895` 的 `modifierIsPressed` 是重复条目视图专用的。

### 3.5 拖放

| 点 | 位置 |
| --- | --- |
| 基类行不可拖 | `itemTreeRow.js:46-48`（`get isDraggable() { return false; }`） |
| 普通条目可拖 | `itemTreeRow.js:155-157`（`return true;`） |
| 分组行拒拖 | `collectionViewItemTree.jsx:1336`（`onDragStart`）内 `:1339` `event.preventDefault()` |
| 拖拽源/落点注册 | `Zotero.DragDrop.currentDragSource` `collectionViewItemTree.jsx:1342`；`currentDropEffect` / `currentOrientation` `:1354-1356` |
| 数据负载 | `zotero/chrome/content/zotero/xpcom/utilities_internal.js:3431` `event.dataTransfer.setData("zotero/item", itemIDs)`，由 `itemTree.jsx:1956` 调用 |
| 粘性表头拒收 drop | `virtualized-table.jsx:1468-1479`（`// Make a drop on the pinned header a no-op.`），挂载 `:1187-1189` |

---

## 4. 条目面板：不是 tab，是单列滚动 + 竖排 sidenav

### 4.1 deck 与 mode

条目面板用 `<deck>` 在 6 个 pane 之间切换，deck 在自定义元素模板里：
`zotero/chrome/content/zotero/elements/itemPane.js:34-48`。

| 下标 | 元素 / id | 行号 |
| --- | --- | --- |
| 0 | `<item-message-pane id="zotero-item-message">` | `:35` |
| 1 | `<item-details id="zotero-item-details" tabType="library">` | `:37` |
| 2 | `<note-editor id="zotero-note-editor" previousfocus="zotero-items-tree">` | `:39-40` |
| 3 | `<duplicates-merge-pane id="zotero-duplicates-merge-pane">` | `:42` |
| 4 | `<annotation-items-pane id="zotero-annotations-pane">` | `:44` |
| 5 | `<groupbox id="batch-edit-prompt" data-l10n-id="item-pane-batch-editing-prompt">` | `:44-47` |

`get mode()` 把 `selectedIndex` 映射成字符串，`elements/itemPane.js:115-117`：
`["message", "item", "note", "duplicates", "annotations", "batch-edit-prompt"][this._deck.selectedIndex]`；
setter 的分支在 `:710-738`。当前 pane 的缓存映射表在 `:646-652`（**不含** `batch-edit-prompt`，
因为该 pane 无子组件需要缓存）。

`batch-edit-prompt` 里有文案 `<description>` 与按钮
`<button id="batch-edit-prompt-enable" data-l10n-id="item-pane-batch-editing-enable">`（`:44-47`），
点击后 `_isBatchEditEnabled = true` 并只保留 info 分区（`:67-70`、`:608-609`）。
文案取自 Fluent `item-pane-message-items-selected`（`elements/itemPane.js:334-340`）。
**版本漂移 — 以截图或归档为准**：该 pane 在 9.0.4 里不存在（§1.3），所以本机截图
`shot-03-multiselect.png` 只显示「已选择 3 个条目」文案、没有按钮。

### 4.2 sidenav

`zotero/chrome/content/zotero/elements/itemPaneSidenav.js`：

| 机制 | 行号 |
| --- | --- |
| `role="tablist"` | `:342` |
| 顺序存偏好 `sidenav.order`（观察 / 写 / 读） | `:344` / `:459` / `:465` |
| `pinnedPane` 委托读写 | `:151-158` |
| 右键菜单 pin / unpin | `:330-331` |
| `pinned` class 切换 | `:398` |
| 修饰键点击切换固定 | `:820-826` |

宽度：变量 `zotero/scss/abstracts/_variables.scss:119` `$width-sidenav: 37px`，
消费点 `zotero/scss/elements/_itemPaneSidenav.scss:14`（堆叠布局改行高 `:19`）；
9.0.4 归档 `zoteroPane.js:6939` 另有一处 `const sideNavMinWidth = isStackedMode ? 0 : 37;`，
`:6938` 注释提醒「Keep in sycn with abstracts/variables.scss > $width-sidenav」——同一数值的两处事实源。

### 4.3 section 懒渲染三段式

面板由若干带 `data-pane` 的分区组成，`zotero/chrome/content/zotero/elements/itemDetails.js:39,41,43,45,47,49,51,53,55,57`：
`info` / `abstract` / `attachments` / `notes` / `note-info` / `attachment-info` /
`attachment-annotations` / `libraries-collections` / `tags` / `related`。

三段式契约定义在基类 `zotero/chrome/content/zotero/elements/itemPaneSectionElementBase.mjs:97-99`
（既无 `render` 也无 `asyncRender` 时 `Zotero.warn("Pane section must have method render or asyncRender.")`），
`itemDetails.js` 只负责调用：

| 阶段 | 调用点 | 实现举例 |
| --- | --- | --- |
| 同步 `render()` | `:260-266` | `elements/abstractBox.js:159`、`elements/attachmentsBox.js:199` |
| 异步 `asyncRender()`（限 500 ms） | `:292-305` | `elements/abstractBox.js:168`、`elements/attachmentBox.js:344`、`elements/attachmentsBox.js:208` |
| `discard()` | `:260-266` | `elements/attachmentBox.js:370`、`elements/attachmentsBox.js:239` |

可见性驱动用 `IntersectionObserver`：初始化 `itemDetails.js:528-534`，
回调 `_handleIntersection` `:611`，进入视口才渲染 `:617-620`（执行 `:636-639`），
离开视口即丢弃 `:621-622`（执行 `:645-646`）；滚到目标前 `unobserve`、滚到后恢复
`:492-497` / `:499-515`（开关函数 `:536-544`）。

header 带高度：`zotero/scss/elements/_itemPaneHeader.scss:10-11` `min-height: 41px; max-height: 25%;`
（实测见 §11：面板自 y=107 起，header 带 41 px）。

### 4.4 字段绑定抽象

| 机制 | 位置 |
| --- | --- |
| 值元素统一 `editable-text` | `elements/itemBox.js:1918-1919` `document.createXULElement("editable-text")` |
| `fieldname` 作为绑定键 | `itemBox.js:1974-1975`（声明）→ `:1938-1939`（落到 DOM） |
| 写回字段 | `itemBox.js:2602` `_modifyField(field, value, item = null)`；调用 `:2559`、`:2640` |
| 日期 blur 时 `parseDescriptiveString` 双向转换 | `itemBox.js:2504-2505`（解析「昨天/今天/明天」等描述式输入）、`:2553-2554`（反向写回，多值合并） |
| creator | 用**两个** `editable-text`（`creator-N-lastName` / `creator-N-firstName`，`:1413-1427`），只加 `nowrap` 不加 `multiline`（`:1971-1972`）；多行字段白名单在 `xpcom/data/itemFields.js:401-409`，不含 creator |
| 批量编辑多值 | `itemBox.js:2052-2054` `multipleValues = true` + `placeholder`；用户字段同类处理 `:862-865`；creator 行整体跳过 `:877-878` |

### 4.5 插件扩展点

| 扩展点 | 定义 | 消费 |
| --- | --- | --- |
| `Zotero.ItemPaneManager.customSectionData` | `zotero/chrome/content/zotero/xpcom/pluginAPI/itemPaneManager.js:561-563` | `elements/itemDetails.js:321` |
| `Zotero.ItemPaneManager.customInfoRowData` | 同上 `:650-652` | `elements/itemBox.js:1014` |
| section 六个 hook | 注册 `itemDetails.js:346-351`；schema `itemPaneManager.js:210,214,218,222,223,227`；类型注解 `elements/itemPaneCustomSection.js:180`；分发 `:222-228,231-235,237-241,243-247,254-261,263-267` | — |
| info row 的 hook | **只有 `onItemChange` 一个**（`itemPaneManager.js:426-429`，文档注释 `:594`），消费 `itemBox.js:1153-1154` | — |

section 的 hook 名逐字为 `init` / `destroy` / `itemChange` / `render` / `asyncRender` / `toggle`；
info row 不是六个，别照抄。

---

## 5. 视觉令牌与主题链路

### 5.1 调色板唯一事实源

`zotero/scss/themes/_light.scss:1-53` 与 `zotero/scss/themes/_dark.scss:1-53` 是两个同名 `$-colors` map，
共 **51** 个 key（`accent-*` **15** 个、`fill-*` 6 级、`color-*` 19 个、`tag-*` 11 色）。
**map 里的 key 不带 `--` 前缀**（逐字开头三行：`$-colors: ($` / `    accent-azure: #66adff,` / `    accent-blue: #4072e5,`），
`derive-colors`（§5.2）在输出时才补上前缀，所以下表按**最终 CSS 变量名**写。
文件末尾各自包一层 media 查询：

```
zotero/scss/themes/_light.scss:55  @media (prefers-color-scheme: light) {
zotero/scss/themes/_light.scss:56      :root {
zotero/scss/themes/_light.scss:57          @include derive-colors($-colors);
```

`_dark.scss:55-59` 同位，`prefers-color-scheme: dark`。

| key | light | dark | 行号（两文件同位） |
| --- | --- | --- | --- |
| `--accent-azure` | `#66adff` | `#66adffd9` | `:2` |
| `--accent-blue` | `#4072e5` | `#4072e5` | `:3` |
| `--accent-blue10` | `#4072e51a` | `#4072e54d` | `:4` |
| `--accent-blue30` | `#4072e54d` | `#4072e573` | `:5` |
| `--accent-blue50` | `#4072e580` | `#4072e599` | `:6` |
| `--accent-gold` | `#cc9200` | `#cc9200d9` | `:7` |
| `--accent-green` | `#39bf68` | `#39bf68d9` | `:8` |
| `--accent-orange` | `#ff794c` | `#ff794cd9` | `:9` |
| `--accent-red` | `#db2c3a` | `#db2c3ae5` | `:10` |
| `--accent-teal` | `#59adc4` | `#59adc4e5` | `:11` |
| `--accent-white` | `#fff` | `#fff` | `:12` |
| `--accent-wood-dark` | `#996b6f` | `#996b6f` | `:13` |
| `--accent-wood` | `#cc7a52` | `#cc7a52e5` | `:14` |
| `--accent-yellow` | `#faa700` | `#faa700cc` | `:15` |
| `--accent-highlight` | `#ffea0080` | `#ffd40026` | `:16` |
| `--fill-primary` | `#000000d9` | `#ffffffe5` | `:17` |
| `--fill-secondary` | `#0000008c` | `#ffffff8c` | `:18` |
| `--fill-tertiary` | `#00000040` | `#ffffff4d` | `:19` |
| `--fill-quarternary` | `#0000001a` | `#ffffff1f` | `:20` |
| `--fill-quinary` | `#0000000d` | `#ffffff0f` | `:21` |
| `--fill-senary` | `#00000005` | `#ffffff08` | `:22` |
| `--color-background` | `#fff` | `#1e1e1e` | `:23` |
| `--color-background30` | `#ffffff4d` | `#1e1e1e4d` | `:24` |
| `--color-background50` | `#ffffff80` | `#1e1e1e80` | `:25` |
| `--color-background70` | `#ffffffb2` | `#1e1e1eb2` | `:26` |
| `--color-border` | `#00000026` | `#ffffff2e` | `:27` |
| `--color-border50` | `#00000014` | `#ffffff17` | `:28` |
| `--color-button` | `#fff` | `#404040` | `:29` |
| `--color-control` | `#fff` | `#ccc` | `:30` |
| `--color-invalid` | `#b81d29` | `#ff7078` | `:31` |
| `--color-invalid-background` | `#fce8ea` | `#40191c` | `:32` |
| `--color-menu` | `#f6f6f6b8` | `#28282894` | `:33` |
| `--color-panedivider` | `#dadada` | `#404040` | `:34` |
| `--color-sidepane` | `#f2f2f2` | `#303030` | `:35` |
| `--color-tabbar` | `#f2f2f2` | `#1e1e1e` | `:36` |
| `--color-toolbar` | `#f9f9f9` | `#272727` | `:37` |
| `--color-scrollbar` | `rgb(194,194,194)` | `rgb(117,117,117)` | `:38` |
| `--color-scrollbar-hover` | `rgb(125,125,125)` | `rgb(158,158,158)` | `:39` |
| `--color-scrollbar-background` | `transparent` | `transparent` | `:40` |
| `--color-stripe` | `#0000000a` | `#ffffff0d` | `:41` |
| `--tag-blue` | `#2ea8e5` | `#2ea8e5d9` | `:42` |
| `--tag-gray` | `#aaa` | `#aaac` | `:43` |
| `--tag-green` | `#5fb236` | `#5fb236d9` | `:44` |
| `--tag-indigo` | `#576dd9` | `#576dd9` | `:45` |
| `--tag-magenta` | `#e56eee` | `#e56eeed9` | `:46` |
| `--tag-orange` | `#f19837` | `#f19837cc` | `:47` |
| `--tag-plum` | `#a6507b` | `#a6507b` | `:48` |
| `--tag-purple` | `#a28ae5` | `#a28ae5e5` | `:49` |
| `--tag-red` | `#ff6666` | `#ff6666e5` | `:50` |
| `--tag-teal` | `#009980` | `#009980` | `:51` |
| `--tag-yellow` | `#ffd400` | `#ffd400bf` | `:52` |

上表同时是本机 9.0.4 的实测色值：编译产物里
`--color-sidepane: #f2f2f2` / `#303030`、`--color-stripe: rgba(0,0,0,0.0392156863)` / `rgba(255,255,255,0.0509803922)`
（即 `#0000000a` / `#ffffff0d`）、`--color-toolbar: #f9f9f9` / `#272727`、`--accent-blue: #4072e5`、
`--tag-purple: #a28ae5` / `rgba(162,138,229,0.898…)`（即 `#a28ae5e5`）均逐字命中（命令见附录），
截图实测像素值与之精确对应（§11）。

### 5.2 派生规则：半透明叠色在编译期就混成不透明色

`zotero/scss/abstracts/_mixins.scss:325` `@mixin derive-colors($colors)`：

1. `:326-327` 先把 map 的每个 key 原样输出为 `--<key>`。
2. `:330` 注释 `// composite (opaque) colors`，然后生成**不透明**派生值：
   `--color-quinary-on-background:331`、`--color-quarternary-on-background:334`、
   `--color-quinary-on-sidepane:337`、`--color-quarternary-on-sidepane:340`、
   `--color-stripe-on-background:343`、`--color-menu-opaque:346`。
   逐字（`:331-333`）：
   ```
   --color-quinary-on-background: #{color.mix(
       map.get($colors, "color-background"),
       color.change(map.get($colors, "fill-quinary"), $alpha: 1),
       100% * (1 - color.alpha(map.get($colors, "fill-quinary")))
   )};
   ```
   `--color-menu-opaque` 走另一条路：按 alpha 分量相乘再拼 `rgb()`（`:346-350`）。
3. `:352` 注释 `// opaque tag colors for tag swatches`，`:353-354` 用 `@each` 生成
   `--tag-blue-opaque` … `--tag-yellow-opaque` 共 11 个。

含义：设计令牌层只放半透明叠色，组件层要的是**能直接当实心色用**的值（例如斑马纹在白底与在侧栏底上
各一个），所以混色在编译期完成，不在运行期叠。

### 5.3 `--material-*` 别名层

`zotero/scss/abstracts/_mixins.scss:357-377` 是全仓唯一定义处，分两组（注释 `// background materials` `:357`、
`// border materials` `:370`）：

| 组 | 变量（行号 → 取值） |
| --- | --- |
| 背景 12 个 | `--material-background:358` / `--material-background50:359` / `--material-background70:360` / `--material-button:361` / `--material-control:362` / `--material-menu:363` / `--material-sidepane:364` / `--material-tabbar:365` / `--material-toolbar:366` / `--material-mix-quinary:367` / `--material-mix-quarternary:368` / `--material-stripe:369`（值分别是同名 `--color-*` 或 §5.2 的派生值） |
| 边框 6 个 | `--material-border-transparent:372` = `1px solid transparent` / `--material-border:373` = `1px solid var(--color-border)` / `--material-border50:374` / `--material-panedivider:375` / `--material-border-quinary:376` = `1px solid var(--fill-quinary)` / `--material-border-quarternary:377` = `1px solid var(--fill-quarternary)` |

它们的取值全部是 `var(--…)` 引用，不是新颜色——即「别名层」。源码里没有任何注释声称组件「只准」消费这一层；
组件层同时直接写 `--color-*` 是普遍现象，别把它读成强制分层。

### 5.4 平台自适应：选中色与焦点环

`zotero/scss/base/_base.scss` 用三个平台 media 查询分别给 `--color-accent` / `--color-accent-text` 取值：

| 平台 | 行号 | 取值 |
| --- | --- | --- |
| Windows | `:7-9` | `--color-accent: var(--accent-blue)`；`--color-accent-text: #fff` |
| macOS | `:15-17` | `--color-accent: SelectedItem`；`--color-accent-text: SelectedItemText` |
| Linux | `:21-23` | 同上，取系统 `SelectedItem` / `SelectedItemText` |

下游所有选中态只消费这一个变量（斑马之外的强调色、焦点环、进度条等）。

焦点环 mixin `zotero/scss/abstracts/_mixins.scss:295`：

- Windows 分支 `:296-297` → `windows-focus-ring` `:304-309`：`outline: var(--color-focus-outer-border) solid var(--width-focus-outer-border)`
  + `outline-offset` + `box-shadow` 双层。
- 非 Windows 分支 `:299-300` → `non-windows-focus-ring` `:312-323`：`:315` `outline: none`
  （注释 `:314` `// fx115: Necessary to hide default focus ring`）+ `:316` 单层 `box-shadow`；
  `$thin` 时 `:318-321` 把 `--width-focus-border` 设为 1px、颜色取 `--color-accent`。

只有 1 px 焦点环的场合统一用 `--default-focusring-width`（`zotero/scss/base/_base.scss:6`，值 `1px`），
引用者：`scss/components/_richlistbox.scss:57`、`scss/components/_virtualized-table.scss:420,424,506`、
`scss/elements/_richlistCheckbox.scss:29`、`scss/preferences/_cite.scss:81`。

### 5.5 平台差异两层

| 层 | 事实 |
| --- | --- |
| 编译期 | 三个平级入口：`zotero/scss/zotero-mac.scss`（18 行）、`zotero-win.scss`（26 行）、`zotero-unix.scss`（17 行）；`zotero/js-build/sass.js:39-43` 把 `*-<platform>.scss` 编译进 `build/chrome/content/zotero-platform/<platform>/`（默认 `build/chrome/skin/default/zotero/`，`:37`），再由 `zotero/chrome.manifest:2-7` 的 `os=` 分支选中（Darwin / WINNT / Linux / SunOS / FreeBSD / OpenBSD） |
| 运行期 | `@media (-moz-platform: …)` 在 `scss/` 下命中 **30 个文件**（`scss/base/_base.scss`、`scss/abstracts/_mixins.scss`、`scss/components/` 14 个、`scss/elements/` 5 个、`scss/preferences*`、`scss/mac/_menuBar.scss`、`scss/win/elements/_infoBox.scss`、`scss/xulElementPatches/` 等） |

本机安装版的主界面 CSS 正是 `chrome/content/zotero-platform/unix/zotero.css`（581 269 B，minify），
与这条链路一致。

---

## 6. 排版、密度与几何数值

### 6.1 字体与基准

| 事实 | 值 | 位置 |
| --- | --- | --- |
| 全局字体 | `font-family: system-ui, -apple-system, sans-serif` | `zotero/scss/base/_base.scss:2` |
| 基准字号 | `font-size: 13px` | `_base.scss:3` |
| 基准行高 | `line-height: 1.3333333333` | `_base.scss:5` |
| 焦点环粗细 | `--default-focusring-width: 1px` | `_base.scss:6` |
| 小字号 | `$font-size-small: 0.923076923em`（13 px 基准下 = 12 px），注释写明「Font size used in tag selector and annotation rows of itemTree」 | `zotero/scss/abstracts/_variables.scss:33`（注释 `:32`）；引用 `_item-tree.scss:287`、`_tagSelector.scss:106` |

### 6.2 定义了但几乎没被用的令牌（本节最值得记的部分）

`zotero/scss/abstracts/_variables.scss` 里有一批**零引用**的变量，组件实际是硬编码 4/8 网格：

| 变量 | 定义 | 引用情况 |
| --- | --- | --- |
| `$space-min` / `$space-xs` / `$space-sm` / `$space-md` / `$space-lg` / `$space-xl` / `$space-xxl` / `$space-max` = `4px / 8px / 12px / 16px / 24px / 32px / 48px / 64px` | `:9-16` | **零引用**（全仓只在定义处出现） |
| `$border-radius-small` / `-base` / `-large` = `3px / 4px / 6px` | `:57-59` | **零引用**（组件直接写 `border-radius: 5px`，编译后 `unix.css` 里出现 46 次） |
| `$font-size-h1` / `$font-size-h2` | `:29-30` | 零引用 |
| `$line-height-base` / `-computed` / `-large` | `:35-40` | 仅 `$font-size-base` 被 `:36` 自身用于 `$line-height-computed` |
| `$headings-*` | `:44-46` | 零引用 |
| `$border-width` / `$separator-width` | `:61,63` | 零引用 |
| `$padding-base-horizontal` | `:54` | 引用了 `$space-xs`，自身零引用 |
| `$font-family-sans-serif` / `$font-family-base` | `:24-25` | `$font-family-base` 被 `_citationDialog.scss:593`、`_tag-manager.scss:6,80` 引用，但**全局 `:root` 不用它**（用 `:2` 的 `system-ui`）——所以这两个变量与实际生效的字体不是同一套 |

反过来，真正被引用的少数几个：`$link-hover-decoration`（`:42`）、`$btn-disabled-opacity`（`:70`）、
`$width-sidenav`（`:119`）、`$height-toolbar`（`:121`）。

### 6.3 真实几何数值表

| 对象 | 值 | 位置 |
| --- | --- | --- |
| 工具栏高度 | `$height-toolbar: 41px`（`_variables.scss:121`），`height: $height-toolbar !important` + 注释「Hard-code this to fix toolbar icon compression on Linux」 | `zotero/scss/components/_toolbar.scss:4`（padding `:7`，`$toolbar-padding-inline: 8px` 在 `:1`） |
| 工具栏按钮 | 28×28，`padding: 0 4px` | `_toolbar.scss:39-41` |
| `type="menu"` 工具栏按钮 | `min-width: 0; width: 40px` | `_toolbar.scss:44-45`（`:43` 为选择器） |
| 工具栏分隔线 | `.zotero-tb-separator { height: 36px }` | `zotero/scss/components/_toolbarbutton.scss:64`（**不在 `_toolbar.scss`**） |
| 集合搜索框 | `max-width: 0` → 展开 `max-width: 180px`，`transition: max-width 0.2s ease` | `_toolbar.scss:66,76,67` |
| 虚拟表单元格 | `padding: 0 8px; min-width: 30px` | `zotero/scss/components/_virtualized-table.scss:51-52` |
| 虚拟表容器 | `padding: 4px 8px 8px` | `_virtualized-table.scss:397`；条目树同值 `_item-tree.scss:17` |
| 行圆角 | `border-radius: 5px` | `_virtualized-table.scss:116` |
| 表头高度 | `1.83333333em`（注释「22px @ 12px font size」）；comfortable `2.33333333em`（「28px @ 12px font size」） | `_virtualized-table.scss:244`、`:252` |
| 行高下限 | `MINIMUM_ROW_HEIGHT = 20; // px` | `zotero/chrome/content/zotero/components/virtualized-table.jsx:37` |
| 条目面板 sidenav | 宽 37px、`gap: 6px`、`padding: 6px 4px 0` | `zotero/scss/elements/_itemPaneSidenav.scss:14`、`:11`、`:9` |
| 条目面板 header | `min-height: 41px; max-height: 25%` | `zotero/scss/elements/_itemPaneHeader.scss:10-11` |
| 折叠分区 | `gap: 2px; padding-block: 4px` | `zotero/scss/elements/_collapsibleSection.scss:4-5` |
| 元数据表 | `grid-template-columns: max-content 1fr`、`column-gap: 8px`、`row-gap: 2px`；子行 `grid-template-columns: subgrid` + `grid-column: span 2` | `zotero/scss/abstracts/_mixins.scss:155-156,157`、`:161-163`（mixin `:153-223`） |
| 设置页搜索容器 | `min-height: 40px`（**不是**导航项高度；导航项是 `padding: 1em`） | `zotero/scss/preferences.scss:99`（导航项 `:117`） |
| 设置页区块间距 | `padding-top: 16px; margin-top: 32px` | `zotero/scss/preferences.scss:183-184` |

行高公式（`zotero/chrome/content/zotero/components/virtualized-table.jsx:1630-1655` `_getRowHeight()`）：

```
rowHeight = this.props.linesPerRow * this._renderedTextHeight;      // :1633（linesPerRow 默认 1，:420）
if (!disableFontSizeScaling) rowHeight *= Zotero.Prefs.get('fontSize');  // :1635-1637
rowHeight += Zotero.Prefs.get('uiDensity') === 'comfortable' ? 11 : 5;  // :1638
rowHeight = Math.round(Math.max(MINIMUM_ROW_HEIGHT, rowHeight));      // :1653
```

`_renderedTextHeight` 不是常数：`_getRenderedTextHeight()`（`:1657-1666`）插入一个隐藏 `div`，
设 `line-height: 1.3333333333333333`、文本 `"Zotero"`，量 `getComputedStyle(div).height` 再删掉。
13 px 基准下约为 17 px，所以 comfortable = 17 + 11 = **28 px**、compact = 17 + 5 = **22 px**
——与本机实测完全一致（§11）。

### 6.4 四条表格渲染决策

1. **表头与表体的 cell padding 必须完全一致**，否则 flex 列宽永久错位。
   `_virtualized-table.scss:48-50` 注释逐字：`// NOTE: To avoid the complexities of dealing with padding in the`
   `// flexbox model, .cell padding must be identical in the header and body. See #5198, #5162.`
2. **粘性分区表头**用「零高度 + 高 z-index + 关闭事件」的方式叠在滚动容器上：
   `_virtualized-table.scss:368-390` 的 `position: sticky; top: 0; height: 0; z-index: 10001; pointer-events: none;`，
   内容层 `:385` 重新 `pointer-events: auto;`（注释 `:362-366`）。
3. **粘性表头出现时把 body 的 `padding-top` 换成 `margin-top`**：
   `zotero/scss/components/_item-tree.scss:25-27`
   `.virtualized-table-body.has-sticky-section-headers { padding-top: 0; margin-top: 4px; }`（注释 `:20-24`）。
4. **焦点环内缩**，否则滚动容器会裁掉首行的环：
   `_virtualized-table.scss:424` `outline-offset: calc(-1 * var(--default-focusring-width));`
   配 `:420` `outline: var(--default-focusring-width) dotted var(--color-accent);`。

### 6.5 滚动条不用 WebKit 伪元素

- 全仓 `scss/` **无** `::-webkit-scrollbar`（grep 无命中）。
- 逐容器声明 `scrollbar-color: var(--color-scrollbar) var(--color-scrollbar-background)`，
  共 **10 处 10 个文件**：`_citationDialog.scss:414`、`_collection-tree.scss:129`、`_item-tree.scss:31`、
  `_notesList.scss:9`、`_tagSelector.scss:50`、`_bubbleInput.scss:21`、`_duplicatesMergePane.scss:7`、
  `_editableText.scss:31`、`_itemDetails.scss:40`、`_itemPaneHeader.scss:13`、`_noteEditor.scss:26`
  （11 个文件里各 1 处；编译后 `unix.css` 命中 11 次）。
- 宽度由 JS 量出后注入 CSS 变量：`virtualized-table.jsx:1673-1679` `_updateWidth()` 用
  `Math.max(0, jsWindow.parentElement.offsetWidth - jsWindow.parentElement.clientWidth)`，
  然后 `header.style.setProperty('--scrollbar-width', \`${scrollbarWidth}px\`)`——
  注释写明用整数测量，避免分数 flex 宽度让表头 padding 在滚动条宽度的边界上抖动。
- 需要让位的内边距统一写 `calc(8px + var(--scrollbar-width, 0px))`：
  `_virtualized-table.scss:249`（`padding-inline-end`），另 `_item-tree.scss:36,77,81`。

### 6.6 字号与密度的运行时入口

`zotero/chrome/content/zotero/xpcom/uiProperties.js`（全文 80 行）把偏好落到已注册的 UI root：

| 行为 | 位置 |
| --- | --- |
| `fontSize`（默认 `"1.00"`）写 `root.style.fontSize` 与 `--zotero-font-size`，按阈值打 `zoteroFontSize` 属性 | `uiProperties.js`（阈值 `<=1 small` / `<=1.15 medium` / `<=1.3 large` / 其余 x-large 的分档实现见同文件；分档名与阈值 `unverified — 需确认`，本机未触发过非默认值） |
| `uiDensity` 写 `--zotero-ui-density` 与 `zoteroUIDensity` 属性 | `uiProperties.js:85` `root.setAttribute('zoteroUIDensity', density);` |
| CSS 侧按属性分档 | `zotero/scss/abstracts/_mixins.scss:7-20`（`@mixin compact` → `:9` `@at-root [zoteroUIDensity="compact"]`）、`:22-35`（`comfortable` → `:24`） |
| `@include compact` / `comfortable` 调用点 | 全仓 **29 处、20 个文件**（`_splitter.scss:23,30`、`_virtualized-table.scss:251,280,319`、`_tagSelector.scss:115`、`_infoBox.scss:39`、`_itemPaneHeader.scss:21,25` 等） |
| 设置后派发非冒泡事件 | `xpcom/uiProperties.js` 中的 `UIPropertiesChanged`（派发点行号 `unverified — 需确认`，本机未直接读该段） |

---

## 7. 图标体系

### 7.1 目录即规范

路径形如 `{size}/{tone}/{name}[@2x].svg`，但**顶层没有 12 与 28**：

| 目录 | 实测内容（源码树） | 9.0.4 归档 |
| --- | --- | --- |
| `chrome/skin/default/zotero/8/` | chevron 等（`scss/components/_toolbarbutton.scss:41` 用 `@include svgicon("chevron-6", "universal", "8")`） | 同源 |
| `.../16/universal/` | **109** 个 `.svg` | **107** 个 |
| `.../16/light/`、`.../16/dark/` | 各 **3** 个：`annotations.svg`、`loading.svg`、`note-annotation.svg` | 同 |
| `.../16/white/` | **不存在** | **不存在**（启动日志实测 `Missing chrome or resource URL: chrome://zotero/skin/16/white/loading.svg`，`integration.css:242` 指的是 `16/light/loading.svg`） |
| `.../20/` | 20 px 图标 | — |
| `.../item-type/{12,16,28}/` | 条目类型图标（`_item-tree.scss:473` 用 `"12", "item-type"`，`_attachmentPreview.scss:63` 用 `"28", "item-type"`） | — |
| `.../itempane/16/`、`.../itempane/20/` | 11 个 / 14 个（20 比 16 多 `multi-notes`、`notes-1`、`notes-3`） | 同 |
| `.../collection-tree/16/{light,universal,white,dark}/` | 三色变体齐备，含 `white/` | — |
| `.../mac/` | 8 个 twisty 变体 + `menu/`（30 个 SF-Symbol 命名 svg） | — |

`white` 不是与 `light`/`dark` 平级的通用 tone，只在带 prefix 的子树上存在。

### 7.2 解析：一份 SVG 三处复用

`zotero/scss/abstracts/_svgicon.scss`（68 行）：

| 机制 | 位置与逐字 |
| --- | --- |
| 2x 由 `image-set` 给出 | `:51-54` `@return image-set(url('chrome://zotero/skin/#{$size}/#{$color}/#{$icon}.svg') 1x, url('…/#{$icon}@2x.svg') 2x);`（带 prefix 的分支 `:44-47`） |
| universal 用 `currentColor` | `:10` `fill: currentColor;`、`:12` `-moz-context-properties: fill, fill-opacity;`，配合 `:6` 的 `light-dark(fill, …)` |
| 非 universal 预载三个变体 | `:18-21` 注释 `// Invisible backgrounds to preload all variants:`，分别 preflight `'white' 'light' 'dark'` 的 `center/0` 背景 |
| 菜单专用降级 | `:26-29` 注释 `// Disable 2x because list-style-image doesn't support image-set`（下两行注释说明 `list-style-image` 给 macOS 原生菜单、`--menuitem-icon` 给应用内菜单），随后同时输出两者 |

编译后 `chrome/content/zotero-platform/unix/zotero.css` 里 `image-set(` 出现 1248 次、
`-moz-context-properties:fill` 出现 211 次——一个 SVG 被反复内联到各条规则里，
所以「换色」靠 CSS 变量而不是换文件。

### 7.3 三态着色

`zotero/scss/abstracts/_mixins.scss:71-93` 的 `focus-states` mixin 把同一段 svgicon 内容
在编译期**发 4 次** `@content`：`light`（`:76`）、`light` 分支内的 `white`（`:80`）、
`dark`（`:86`）、`dark` 分支内的 `white`（`:91`）；选中态与聚焦态的选择器是 mixin 参数
（默认 `'.row.selected'` 与 `'.focus-states-target:focus-within'`，`:72-73`）。

集合树走另一套：`zotero/scss/components/_collection-tree.scss:3-6` 的 `$themed-icons` 共 **15** 个
（`collection, duplicates, feed, feed-error, feed-library, feed-updating, groups, library, library-group,
publications, trash-full, trash, unfiled, retracted, search`），走三色 SVG；
`:9-11` 的 `$universal-icons` 只有一项 `recent: --tag-purple`。

### 7.4 按钮与行内按钮

`zotero/scss/components/_toolbarbutton.scss`：

| 状态 | 逐字 | 行号 |
| --- | --- | --- |
| 基础 | `appearance: none;` / `border-radius: 5px;`（`&:not(.titlebar-button)` 内） | `:2` / `:5` |
| hover | `background-color: var(--fill-quinary);` | `:14` |
| active / `[selected]` | `background-color: var(--fill-quarternary);` | `:18` |
| `[open="true"]` | `background-color: var(--fill-quarternary);` | `:34` |
| `[disabled]` | `color: var(--fill-tertiary);` | `:26` |
| 旋转动画 | `@keyframes rotating` + `toolbarbutton[status=animate] { animation: rotating 2s linear infinite; }` | `:47`、`:56-59` |

行内按钮在选中行上必须反色，但语义 fill 会失效（底色是 `--color-accent`），于是硬编码：
`_virtualized-table.scss:513-522` 的 `:516` `background-color: #ffffff1a;`、`:519` `#ffffff33`。

React 侧的图标组件：`zotero/chrome/content/zotero/components/icons.jsx:6` `Icon`、`:21` `CSSIcon`；
批注图标特殊——用 `<img>` + `img.style.fill` 直接改色（`:60-66`，`img.src = 'chrome://zotero/skin/16/universal/annotate-' + type + '.svg'`）。

---

## 8. 交互契约

### 8.1 命令三层并存

| 层 | 实现 | 关键事实 |
| --- | --- | --- |
| ① 声明式 | `zoteroPane.xhtml:92-130` `<commandset id="mainCommandSet">`；`:153-183` `<keyset id="mainKeyset">` | `key=` 写 DTD 实体（`:154` `<key id="key_close" key="&closeCmd.key;" command="cmd_close" modifiers="accel"/>`）；`modifiers` 有两种分隔写法并存（`:167` `accel shift`、`:174` `accel,shift`）；另有 `keycode="VK_DELETE"` 这种绑定（`:192,197,198`）。占位 keyset `<keyset id="sortSubmenuKeys">` `:202-215`，其中 `key_sortCol0..9` `:205-214`，注释 `:203-204` 明写「Attributes are set in initItemsTree(), but these don't work on Windows if they're…」。**XHTML 里那份 keyset 是死骨架**：真正的赋值在 `zotero/chrome/content/zotero/elements/itemTreeMenuBar.js:111-117`（`key.setAttribute('key', (i + 1) % 10);` `:116`），而该文件自己另建了一份 `sortSubmenuKeys`（`:37-49`，经 `parseXULToFragment`） |
| ② 偏好反向索引 | `zotero/chrome/content/zotero/xpcom/zotero.js:2163-2229` `Zotero.Keys` | `_keys[this.getKeyForCommand(cmd)] = cmd;` `:2185`；`getKeyForCommand` `:2223-2228`（读 pref 后大写化，无则 `false`）；`windowInit` 只在 `<key>` 仍是默认值时才用 pref 覆盖 `:2203-2213`；运行时改写 `<key>` 在 `zotero/chrome/content/zotero/standalone/standalone.js:98-103`，随后 `:104-107` 强制菜单刷新（注释「as of fx128, this is necessary」） |
| ③ JS 分发 | `zoteroPane.js:1283-1423` `handleKeyPress(event)` | 无映射 `return` `:1311-1314`；非 Ctrl/Cmd+Shift 直接忽略 `:1316-1319`（注释 `// Ignore modifiers other than Ctrl-Shift/Cmd-Shift`）；`default` 分支 `throw new Error('Command "' + command + '" not found in ZoteroPane_Local.handleKeyPress()')` `:1413-1414`；两个 copy 命令故意 `return` 但仍被捕获 `:1405-1411`，注释逐字：`// "Copy Citation"/"Copy Bibliography"/"Copy as"/"Copy Note" menu options. When disabled, the shortcuts are` / `// still caught in handleKeyPress so that we can show an alert about not having references selected.` |

### 8.2 焦点链是手工维护的环

`zoteroPane.js:174-505` `setUpKeyboardNavigation()`：

| 挂载点 | 行号 |
| --- | --- |
| `titleBar`（取 `zotero-title-bar`） | `:177` 取元素，`:260` `addEventListener("keydown", …)` |
| `collectionTreeToolbar` | `:351` |
| `itemTreeToolbar` | `:369` |
| `collectionsTree` | `:430` |
| `itemTree` | `:451` |
| `tagSelector` | `:478` |

每一处都有一张手工维护的 `actionsMap`（`:263` 注释
`// Mapping of target ids and possible key presses to desired focus outcomes`），
titleBar 段 `:264-319`，其余五处在 `:352/:370/:431/:452/:479`；查表先按 id 再按 classList `:215-221`。
条目树那一处不能用固定 id——`zoteroPane.js:453-454` 用动态键
`[ZoteroPane.itemsView?.id]`（注释 `// The item tree's DOM id has a view-specific suffix, so key on the current view's id`）。
另外 Tab 进出 `<iframe>`/`<browser>` 时不动焦点，注释在 `:1154-1157`。

### 8.3 菜单三层

| 层 | 事实 |
| --- | --- |
| 可见性按 tab 类型切 | `.menu-type-library` / `.menu-type-reader` / `.menu-type-note` 只是 class 约定（`scss/` 零命中），由 `Notifier` 的 `tab` 事件驱动：`zotero/chrome/content/zotero/standalone/standalone.js:57-86`（注册 `:59-85`、监听 `['tab']`、`onLoad` 首行 `switchMenuType('library')` `:58`）；实际切换在 `switchMenuType` `:159-162`，用 `document.querySelectorAll('.menu-type-library, .menu-type-reader, .menu-type-note').forEach(el => el.hidden = true)` |
| 阅读器再分 subtype | 调用点 `standalone.js:77`，实现 `:164-169`，三类 `pdf` / `epub` / `snapshot`；阅读器窗口内另有一份等价实现，注释明写「Do the same as in standalone.js」（`zotero/chrome/content/zotero/xpcom/reader.js:2246-2252`） |
| 菜单项运行时改写 | 四个 handler：`onFileMenuOpen` `standalone.js:171`、`onManageAttachmentsMenuOpen` `:333`、`onGoMenuOpen` `:434`、`onViewMenuOpen` `:472`；XHTML 侧 `onpopupshowing` 挂点 `menu_FilePopup` `zoteroPane.xhtml:239`、`menu_viewPopup` `:448`、`menu_goPopup` `:719`、`manage-attachments-menu` `:770` |
| 改 label | Fluent 与 `setAttribute` 两种写法并存：`standalone.js:203-204`（`document.l10n.setAttributes(showFileMenuitem, showFileLabel);` + `showFileMenuitem.disabled = !numFiles;`） |
| 改 hidden + 单复数 label | `:215-226`，`Zotero.getString('pane.items.menu.exportPDF' + (numFiles == 1 ? '' : '.multiple'))` |
| 按平台改写 `<key>` | `:438-449`：mac `keyBack.setAttribute('key', '[')` + `modifiers = 'meta'`；其他平台 `keyBack.setAttribute('keycode', 'VK_LEFT')` + `modifiers = 'alt'`；`:452-456` 注释说明 menuitem 的 `key` 必须动态设才生效 |
| 启用/勾选 | `updateMenuItemEnabled` `standalone.js:721-728`（直接 `setAttribute('disabled', true)` / `removeAttribute('disabled')`）；`updateMenuItemCheckmark` `:709-717` |
| 插件菜单 | 各 handler 末尾统一交给 `Zotero.MenuManager.updateMenuPopup(popup, 'main/menubar/${type}', …)`（`standalone.js:579-607`，调用点 `:233/:468/:568`） |

### 8.4 条目右键菜单：骨架在 XHTML，内容在 JS

- 骨架：`zoteroPane.xhtml:977-1010` `<menupopup id="zotero-itemmenu">`，`:978` 注释逐字
  `<!-- Keep order in sync with buildItemContextMenu -->`；集合树同类注释在 `:934`（并注明
  `which adds additional attributes`）。
- 真实内容由 `zoteroPane.js:4209-4759` `buildItemContextMenu()` 生成：先声明字符串数组
  `:4210-4244`（`'showInLibrary', 'sep1', …`）并建 name→index 映射 `:4242-4244`（`var m = {};` … `m[options[i]] = i;`），
  再用两个 `Set` 维护显隐 `:4252`（`var disable = new Set(), show = new Set(), multiple = '';`），
  默认全隐藏全启用 `:4722-4732`（注释 `// Hide and enable all actions by default (so if they're shown they're enabled)`），
  尾部接 Locate 与插件菜单 `:4734-4758`。
- 实测（`shot-05-contextmenu.png`）：菜单尺寸 221×357，左上角对齐指针，点击后保持打开（`xdotool click 3` 即可）。

### 8.5 拖放目标与反馈

| 行为 | 位置 |
| --- | --- |
| 集合树 drop：同库加集合 + `dropEffect == 'move'` 时**在同一事务内**从源集合移除（单次 undo） | `zotero/chrome/content/zotero/collectionTree.jsx:2454-2472`（注释 `// If moving, remove from source in the` / `// transaction so it's a single undo step`，`await sourceTreeRow.ref.removeItems(toMove);`） |
| 落在条目行上建子附件 | `collectionViewItemTree.jsx:1646-1663`，`item.parentID = rowItem.id;` `:1658`；文件拖入 `:1709-1838`（`Zotero.Attachments.importFromFile` `:1825`）。**条目面板本身没有 drop 监听** |
| 落点指示 | `zotero/scss/components/_virtualized-table.scss:127-141` `span.drop-before, span.drop-after { position: absolute; width: 20%; height: 1px; }`；由 JS 创建，方向取 `Zotero.DragDrop.currentOrientation`（`itemTree.jsx:2264-2274`）；落在行本体（orient 0）时改用 `.drop` class（`itemTree.jsx:2271-2272`、`collectionTree.jsx:336`） |
| 粘性表头拒收 | `virtualized-table.jsx:1468-1479`（注释 `// Make a drop on the pinned header a no-op.`） |
| mac 修饰键映射 | `collectionViewItemTree.jsx:1717-1731`（cmd=move、cmd+alt=link、裸拖=copy） |

### 8.6 反馈层级与空态

| 层级 | 实现 |
| --- | --- |
| 长任务进度窗 | `zotero/chrome/content/zotero/xpcom/progressWindow.js:103` `Zotero.ProgressWindow`，`:130-131` 用 `openDialog("chrome://zotero/content/progressWindow.xhtml", …)` 开独立 chrome 窗口 |
| 批量队列 | XUL 骨架 `progressQueueDialog.xhtml:7-31`（挂载点 `#progress-queue-root` `:20`、`html:div#tree` `:29`）＋ React 挂载 `progressQueueDialog.jsx:37-43`（`createRoot(...).render(` `:39`）。**注意路径**：`progressQueueDialog.jsx` 在 `chrome/content/zotero/`，不在 `xpcom/` |
| 6 个横幅 | `zoteroPane.xhtml:1095-1187`，都是 `role="status"` + `class="banner-container"` + `collapsed="true"`（逐字例：`<vbox id="post-upgrade-container" class="banner-container" collapsed="true" role="status">` `:1095`） |
| 同步错误 | `toolbarbutton#zotero-tb-sync-error` `zoteroPane.xhtml:900`（`hidden="true" style="-moz-user-focus: normal;"`） |
| 空态/提示 | `stack#zotero-pane-overlay` `zoteroPane.xhtml:1420` + `deck#zotero-pane-overlay-deck` `:1423`；文案经 `ZoteroPane_Local.setItemsPaneMessage(content, lock)` `zoteroPane.js:5094-5107` 转发到 `zotero/chrome/content/zotero/itemTree.jsx:1203-1220`；key 为 `pane.items.loading`，且源码里有针对该 key 的特判（`itemTree.jsx:1206-1207` 注释 `// Hack to keep "Loading items…" small`） |

### 8.7 添加、复制与校验

| 能力 | 位置与门控 |
| --- | --- |
| Add by Identifier | `zotero/chrome/content/zotero/lookup.js:165` `showPanel`（`Zotero_Lookup = new function ()` `:30`）；命令 `zoteroPane.xhtml:119` `<command id="cmd_zotero_addByIdentifier" oncommand="Zotero_Lookup.showPanel()"/>`；键盘 `Enter: () => Zotero_Lookup.showPanel(event.target)` `zoteroPane.js:390-391` |
| 创建副本 | `zoteroPane.js:2428` `duplicateSelectedItem` |
| 副本并转换 | `zoteroPane.js:2481` `duplicateAndConvertSelectedItem`（单选且必须是 book/bookSection，否则 `throw`） |
| 合并重复项 | `zoteroPane.js:2699` `mergeSelectedItems`（自身只有 `canEdit()` 与进入 duplicates 模式）；「必须全是 regular item 且不在重复视图」的门控在 `buildItemContextMenu` `zoteroPane.js:4305-4307`：`if (canMerge && (!item.isRegularItem() || item.isFeedItem || collectionTreeRows[0].isDuplicates())) {` |
| 快速复制菜单可用性 | `zoteroPane.js:2380` `updateQuickCopyCommands`；门控 `:2382-2387` 逐字 `// If all items are notes/attachments and at least one note is not empty`，随后 `selectedItems.every(item => item.isNote() || item.isAttachment())` 且 `selectedItems.some(item => item.note)` |
| 重建全文索引 | `zoteroPane.js:2408` `reindexItem` → `:2422-2423` `Zotero.FullText.indexItems(itemIDs, { complete: true })` 并刷新附件索引态 |

### 8.8 Reader 与笔记入口

`zotero/chrome/content/zotero/tabs.js` 的 `Zotero_Tabs` 统一管理三类标签：

| 方法 | 行号 |
| --- | --- |
| `getState` | `:583` |
| `setTabData`（**不是** `setData`） | `:529` |
| `add` | `:636` |
| `close` | `:728` |
| `move` | `:830` |
| `select` | `:858` |
| `unloadUnusedTabs` | `:1021` |

- `unloadUnusedTabs` 由 60 秒定时器驱动（`:352-354`，注释 `// Trigger every minute`），
  门槛与「不卸当前选中标签」在 `:986-989`（`tab.id !== this._selectedID`）。
- 三类标签的 hook 分派表在 `:200-306`（`reader:` / `note:` / `library:` 三个分支，如 `reader: async (tab, tabIndex) => {` `:210`）。
- 阅读器走独立 chrome 窗口 + `<browser>` 内嵌 PDF：`reader.xhtml:343-349`（`<browser id="reader" type="content">`）。
- 条目面板内的 `note-editor` 声明了 `previousfocus="zotero-items-tree"`（`elements/itemPane.js:39-40`），
  独立笔记窗口同款在 `note.xhtml:145`；自定义元素注册 `customElements.js:52`，note tab 动态创建于
  `zotero/chrome/content/zotero/xpcom/data/notes.js:162`。

---

## 9. 无障碍与本地化

### 9.1 焦点

- 统一 `:focus-visible`；焦点环粗细只有 `--default-focusring-width: 1px` 一个令牌
  （`zotero/scss/base/_base.scss:6`，引用者见 §5.4）。
- `:-moz-focusring` 在 `scss/` 里**只剩** `zotero/scss/abstracts/_split-button.scss` 一处文件，
  且四段对应代码都被注释停用（注释块 `:142-149`、`:226-243`、`:267-272`、`:315-320`，
  生效的 `&:-moz-focusring {` 在 `:151`、`:245`、`:274`、`:322`）——属历史残留。

### 9.2 标签

| 规则 | 位置 |
| --- | --- |
| `aria-labelledby` 配 `<label id>`（本文件**零** `aria-label`） | `elements/itemBox.js:678`（配 `:674-677`）、`:1075`、`:1246`（配 `:1216`）、`:1657` |
| `editable-text` 把两者列为可观测属性并透传 | `elements/editableText.js:46-54` `observedAttributes`、getter `:141-147`、透传 `:387-392` |
| 自绘按钮补 `role` + `aria-label` | `elements/librariesCollectionsBox.js:115-117`（`tabindex` / `aria-label` / `role="button"` 逐字） |
| `data-l10n-attrs` 一次填多个属性 | `elements/attachmentRow.js:38`（`data-l10n-attrs="tooltiptext,aria-label"`）；全仓该属性共 9 处，另见 `newCollectionDialog.xhtml:39,59`、`zoteroPane.xhtml:1200`、`elements/abstractBox.js:41`、`elements/collapsibleSection.js:191`、`elements/notesContext.js:34` 等 |
| 过滤框的 combobox 语义 | `elements/tabsMenuPanel.js:38` `role="combobox"`、`:45` `role="listbox"`、`:160` `role="option"`；`aria-activedescendant` `:148` 与 `:354`。**不是** `role="grid"`——全仓 `role="grid"` 字面量零命中，唯一相关命中是注释 `components/tagSelector/tagSelectorList.jsx:284` `// <Collection> sets role="grid" which is not semantically correct`。真正的 activedescendant 型 grid 在 `components/virtualized-table.jsx:1736` |
| 批注行的 label / description | `elements/annotationRow.js:159-162`：`aria-label` = 批注文本或批注类型；`aria-description` = 批注 + 标签（注释与标签分别拼接） |
| 折叠分区 | `elements/collapsibleSection.js:492` `this._head.setAttribute('aria-expanded', this.open);`、`:493` `aria-label` |
| macOS 自绘标题栏按钮对读屏隐藏 | `zoteroPane.xhtml:867-868`、`:873`、`:878`、`:883`（该文件 `aria-hidden` 仅这 4 处） |
| sidenav 聚焦时动态互斥 `aria-hidden` | `elements/itemPaneSidenav.js:773-784`，注释 `:767-771` 逐字要点：`It confuses some screen readers and leads them to announce the index of tabs incorrectly. As a workaround, aria-hide all non-tabs when a tab is focused and hide tabs when a non-tab is focused.` |
| 主动删 `aria-autocomplete` | `elements/searchTextbox.js:2` 注释 `// Modified to not set aria-autocomplete, which confuses screen readers`；`:135` `this.inputField.removeAttribute("aria-autocomplete");`（`:87` 另有 `input.autocomplete = "off"; // not applicable in XUL docs and confuses aria.`） |

### 9.3 高对比度：明确的空白项

全仓 `scss/` 里 `prefers-contrast` 只命中 `zotero/scss/win/_titleBar.scss` 一处（5 处）：
`:83-86` 把标题栏背景换成 `background-color: -moz-menuhover; color: -moz-menuhovertext;`，
`:175-201` 换四组窗口按钮图标码点（如 `:175` `content: "\e921"; /* ChromeMinimize */` → `:177`
`content: "\ef2d"; /* ChromeMinimizeContrast */`）。**其余所有组件没有任何高对比度处理**——
这是一处显式空白，不是遗漏记录错误。

### 9.4 RTL 三条路径

| 路径 | 事实 |
| --- | --- |
| ① 属性开关 | `zotero/chrome/content/zotero/xpcom/uiProperties.js:74-79`：`if (Zotero.rtl) root.setAttribute('dir', 'rtl'); else root.removeAttribute('dir');` |
| ② `:-moz-locale-dir(rtl)` | `scss/` 下命中 **9 个文件 14 处**：`_item-tree.scss:122`（工具栏/条目图标 `scaleX(-1)`）、`_search.scss:172-173`（`::part(search-sign)` / `::part(search-icon)` 翻转）、`_splitter.scss:57,58,64,65`（splitter 折叠侧）、`_toolbar.scss:11`、`_attachmentPreview.scss:105`、`_collapsibleSection.scss:83`（twisty `rotate(180deg)`，注释说明动画方向要反）、`_itemPaneSidenav.scss:119`（注释「Locate is flipped in RTL」）、`mac/_tabbox.scss:48,63`、`win/_titleBar.scss:164` |
| ③ `[dir=rtl]` 属性选择器 | 仅 1 处：`zotero/scss/components/_virtualized-table.scss:429-445`——排序指示器 `left: 3px; right: initial;`（`:431-433`）、resizer `right: -5px; left: initial;`（`:435-436`）、twisty `transform: rotate(90deg);`（`:443-444`） |

方向性写法基本全用逻辑属性（`padding-inline-end`、`border-inline-start` 等）。
唯一的方向性硬编码：tag 月牙 `margin-left: -0.38461538em`，`zotero/scss/components/_item-tree.scss:173-174`，
上一行注释写明 `// RTL: Parent is flipped, so margin can always be on logical left`。

### 9.5 本地化

- 旧 `.properties` / `.dtd` 实体与新 Fluent **并存**：`zoteroPane.xhtml:237`
  `<menu id="fileMenu" label="&fileMenu.label;" accesskey="&fileMenu.accesskey;">` 对
  `zotero/chrome/locale/en-US/zotero/standalone.dtd:15`；同文件 `:325`
  `<menuitem id="menu_print" data-l10n-id="menu-print" …>`、`:429-430` `data-l10n-id="menuitem-advanced-search"`。
- Fluent 侧仍保留少量 `accesskey`（`zotero/chrome/locale/en-US/zotero/zotero.ftl:596` `.accesskey = Y`）。
- 硬约束在 `zotero/CLAUDE.md:73`：所有新字符串必须加到 `.ftl`，**不得**再往 `.properties` 或 `.dtd` 加。
- `accesskey` 只给顶层菜单与少数命令，条目级 menuitem 不用（`:237` 与 `:325` 的写法对比）。
- locale 声明在 `zotero/chrome.manifest`：**43 条启用**、5 条被注释
  （`af-ZA`、`he-IL`、`hr-HR`、`mn-MN`、`nn-NO`），含 `km`（`:39`）；`:13` 注释要求
  「Keep in sync with locale.js and app/assets/multilocale.txt」。注意部分行用空格对齐，
  按单空格匹配的计数命令会漏行。

---

## 10. XUL 专有 vs 可移植

### 10.1 XUL 侧专有（连同为什么难以替换）

| 机制 | 一句理由 |
| --- | --- |
| `<window>/<vbox>/<hbox>/<box>/<stack>/<deck>/<splitter>/<toolbar>/<menupopup>/<menulist>/<search-textbox>/<panel>` | XUL 盒模型只有 `orient` 一个轴向，flex 只能「按主轴分配」，无法表达 CSS 那种两轴 flex |
| `MozXULElement.parseXULToFragment` | 自定义元素的 `content` getter 靠它把 `<template>` 内容变成可渲染的 XUL 片段（`elements/itemPane.js:33-48`） |
| `document.createXULElement` | 值元素统一走它（`elements/itemBox.js:1918-1919`） |
| `XULElementBase` / `XULElementMixin` | `init()`/`destroy()` 生命周期与属性反射（见 `references/Zotero/08-界面与样式.md` 第二节） |
| `XPCOMUtils` / `Services.*`（prompt、`focus.moveFocus`、scriptloader） | 跨进程与原生能力只能走 XPCOM |
| `<splitter>` 自带 `state` 折叠语义 | 拖拽与折叠都由 toolkit 状态机管（`zotero/scss/components/_splitter.scss` 只改外观，不实现拖拽） |
| `oncommand` / `onpopupshowing` 的冒泡语义 | 菜单项开关与菜单打开钩子都靠冒泡到父节点统一处理（`zoteroPane.xhtml:239` 等） |
| `@media (-moz-resolution)` | 屏比判断（另有 `matchMedia("(min-resolution: 1.5dppx)")` 在 `containers/tagSelectorContainer.jsx:59`） |
| `<browser>` 内嵌 | PDF 阅读器与隐藏 browser 都靠它（`reader.xhtml:343-349`） |

### 10.2 可移植（不依赖 XUL 的部分）

| 机制 | 一句理由 |
| --- | --- |
| 空壳挂载点分层 | XHTML 只留 id，内容由运行时挂载（`zoteroPane.xhtml:890,1212,1230`） |
| 行高前缀和 + 二分可见区 + overscan + 行元素复用 | `components/windowed-list.js:67,168-177,235-246,254-281`、`virtualized-table.jsx:2262-2266`，与框架无关 |
| `Set<index>` + `pivot` + `selectEventsSuppressed` 选择模型，含增删重映射 | `virtualized-table.jsx:55-348` |
| 列定义即数据 + flex 宽度分配 + 持久化键白名单 | `itemTreeColumns.jsx:61-403`、`virtualized-table.jsx:2017-2160` |
| section 懒渲染三段式（`render`/`asyncRender`/`discard`）+ pinned + 顺序持久化 | `elements/itemDetails.js:260-305,617-646`、`:127-143` |
| `fieldname` 属性即绑定键 | `elements/itemBox.js:1974-1975` |
| 搜索栏分模式 + 高级搜索 DSL | `elements/quickSearchTextbox.js`（模式 `titleCreatorYear` / `fields` / `everything`）、`elements/advancedSearchPane.js` |
| `Zotero.Notifier` 事件驱动 | 菜单可见性、标签切换、选择变化都挂在 Notifier 上（`standalone.js:59-85`） |

---

## 11. 实测观察

采集环境：Xvfb `:99` 1280×1024，无窗口管理器；Zotero 9.0.4 用隔离 profile 启动，
窗口强制为 **1280×1000 @ (0,0)**。截图原生 1:1 落在 `/tmp/zotero-ui/shots/`。

### 11.1 截图清单

| 文件 | 尺寸 | 状态 | 驱动方式 |
| --- | --- | --- | --- |
| `shot-01-default.png` | 1280×1000 | 默认三栏，选中第 3 行（`xdotool click 420 246`） | 基础骨架与所有纵向/横向量测的来源 |
| `shot-02-expanded.png` | 1280×1000 | 第 1 行展开出 5 个子行（3 笔记 + 2 附件） | 单击行首 chevron `xdotool click 216 196` |
| `shot-03-multiselect.png` | 1280×1000 | 3 行多选，条目面板切到批量编辑提示 | `click 420 396` + `ctrl` 三连点 `:421 :446` |
| `shot-04-tagselector.png` | 1280×1000 | 标签选择器筛选 `task` 并选中 `ai_task:classification`，条目列表被过滤 | 点筛选框 `85 978` → 键入 `task` → 点标签 `60 842` |
| `shot-05-contextmenu.png` | 1280×1000 | 条目右键菜单打开 | `xdotool click 3` @ `420 271` |
| `shot-06-search.png` | 1280×1000 | 快速搜索输入 `tunnel`，命中 12 行 | 点搜索框 `762 128` → 键入 |
| `shot-07-dark.png` | 1280×1000 | 深色（`browser.theme.toolbar-theme=0` 后重启） | 见 §11.3 |
| `shot-09-compact.png` | 1280×1000 | 紧凑密度（`extensions.zotero.uiDensity="compact"`） | 重启 |

### 11.2 量得数值

| 量 | 实测 | 取样 | 源码对照 |
| --- | --- | --- | --- |
| 窗口 | 1280×1000 | `xdotool getwindowgeometry` | — |
| 菜单栏带 | y 0–34，`(221,218,214)` | `shot-01` 竖扫 x=400 / x=1235 | GTK 原生 menubar，不走 Zotero token |
| 标签栏带 | y 36–71，`(242,242,242)`；选中标签页 255 | 同上 | `--color-tabbar`（`_light.scss:36`） |
| 升级横幅 | y 73–106，`(197,212,247)` | 同上 | `banner-container`（`zoteroPane.xhtml:1095`） |
| 工具栏带 | y 107–146 底色 249，y 147 为 1 px 分隔线 | 同上 | `--color-toolbar` `#f9f9f9`（`_light.scss:37`）、`$height-toolbar:41px`（`_variables.scss:121`） |
| 条目面板 header 带 | y 107–147，41 px | `shot-04` 竖扫 x=1235 | `_itemPaneHeader.scss:10-11` `min-height:41px` |
| 列表列头带 | comfortable y 148–177（30 px）；compact y 148–171（24 px） | `shot-01` / `shot-09` 竖扫 x=880 | `2.33333333em` / `1.83333333em`（`_virtualized-table.scss:252,244`），13 px 基准下 30.33 / 23.83 |
| **条目行高** | comfortable **28 px**（变化点 210/238/266/294/322/350/378/406…）；compact **22 px**（198/220/242/264/286/308…） | `shot-01` / `shot-09` 竖扫 x=880 | 公式 `virtualized-table.jsx:1633-1653`：17 px 文本高 + 11 / + 5，`Math.round` 后正是 28 / 22 |
| 斑马纹 | 偶数行 `(245,245,245)` = `#f5f5f5` | 同上 | `--color-stripe: #0000000a` 叠 `--color-background: #fff`（`_light.scss:41,23`）；深色下为 41 = `#1e1e1e` + `#ffffff0d` |
| 分类栏宽 | x 0–198（199 px），分隔线 1 px `217` | `shot-01` 横扫 y=953 | `zotero-collections-splitter`（`zoteroPane.xhtml:1234`） |
| 条目列表宽 | x 200–921（722 px）；行背景自 x=208 起（容器 `padding: 4px 8px 8px` 的 8 px） | 同上 | `_virtualized-table.scss:397` |
| 条目面板宽 | x 923–1242（320 px） | 同上 | `zotero-item-pane`（`zoteroPane.xhtml:1372`） |
| sidenav 宽 | x 1244–1279（36 px，含 1 px 边框共 37） | 同上 | `$width-sidenav: 37px`（`_variables.scss:119`） |
| 列表滚动条 | x 895–904，拇指 `(249,249,249)`、两端 1 px `(227,227,227)` | `shot-01` 横扫 y=953 | `--scrollbar-width` 注入 + `padding-inline-end: calc(8px + var(--scrollbar-width, 0px))`（`_virtualized-table.scss:249`、`virtualized-table.jsx:1673-1679`） |
| 标签选择器 | 分隔线 y=800（1 px `217`）；标签行首行 y≈817，行距 21 px；筛选框白底 255，y 963–993 | `shot-03` / `shot-04` 竖扫 x=45 | `zotero-tags-splitter`（`zoteroPane.xhtml:1214-1222`）；筛选框用 `$font-size-small`（`_variables.scss:33`） |
| 标签行字体 | 21 px 行的行距来自 `$font-size-small: 0.923076923em`（12 px） | 同上 | `_tagSelector.scss:106` |

### 11.3 深色

深色**不是**靠 `ui.systemUsesDarkTheme` 或 `GTK_THEME=Adwaita:dark`（两者本机均无效，
像素仍为浅色取值）。生效的开关是偏好 `browser.theme.toolbar-theme = 0`
（对应设置里「配色 → 深色」，`zotero/chrome/content/zotero/preferences/preferences_general.xhtml:41-44`
的 radiogroup，`:41` `preference="browser.theme.toolbar-theme"`、`:44` `value="0"`）。

`shot-07-dark.png` 的像素实测与 `_dark.scss` 精确对应：

| 位置 | 浅色 | 深色实测 | 令牌 |
| --- | --- | --- | --- |
| 条目列表底 | `(255,255,255)` | `(30,30,30)` | `--color-background: #1e1e1e` |
| 斑马行 | `(245,245,245)` | `(41,41,41)` | `--color-stripe: #ffffff0d` 叠 `#1e1e1e` |
| 分类栏 / 面板 / sidenav | `(242,242,242)` | `(48,48,48)` | `--color-sidepane: #303030` |
| 标签栏 | `(242,242,242)` | `(30,30,30)` | `--color-tabbar: #1e1e1e` |
| 分隔线（标题栏下） | `(218,218,218)` | `(64,64,64)` | `--color-panedivider: #404040` |
| 行高 | 28 px | 28 px | 密度未变 |

（深色截图在部分图片预览器里会被自动提亮成浅色外观，判定请以像素取样为准。）

### 11.4 交互实测

| 交互 | 结果 |
| --- | --- |
| 条目行首 chevron | **单击**展开/折叠；双击等于两次切换（净效果 0） |
| 条目右键菜单 | `click 3` 打开后保持，尺寸 221×357，左上角对齐指针 |
| 菜单栏下拉 | 需按住鼠标键；松键即关 |
| splitter grippy | `zotero-tags-splitter` 的 `<grippy oncommand="ZoteroPane.toggleTagSelector()">` 单击与拖拽**均无效果**；`scss/` 里对 splitter 的 grippy 无任何样式规则（只有 `.zotero-clicky-grippy` 在 `_clicky.scss:40`，属于条目面板的点击区）。故标签选择器折叠/展开交互本机**未实测** |
| 快速搜索 | 命中 12 行；行内**不**额外高亮匹配串；输入后搜索框右侧出现清除按钮 |
| 标签筛选 | 输入 `task` 后标签列表收敛，出现清除按钮；点标签后条目列表被过滤，条目面板切到该条目 |
| 升级横幅 | 首次启动后常驻，带「稍后提醒我」与「完成」两个按钮 |

### 11.5 不可推断（单帧证明不了的）

- 悬停与按压的可见差异：只在按下 twisty 后捕获了展开态，没有稳定的 hover 帧。
- 键盘焦点顺序：`setUpKeyboardNavigation` 的环是代码事实，但本机用合成事件无法可靠驱动 Tab，
  实际走位顺序**未实测**。
- 动态刷新性能与滚动帧率：虚拟化的 overscan 与行高前缀和是代码事实，滚动过程中的实际重排次数
  与耗时本机未测。
- 真实 DPI：Xvfb 为 1×，`@2x` 图标分支与 `image-set` 的 2x 选择未在物理缩放下验证。
- 深色下的对比度实测：本节只比对了令牌字面值，没有做对比度比值计算。
- 子窗口（阅读器、进度窗、标签选择器设置弹窗）未采集。

---

## 12. 路径索引

| 归档成员（`/usr/lib/zotero/app/omni.ja`） | 源码树路径（`zotero/…`） | 职责 |
| --- | --- | --- |
| `chrome/content/zotero/zoteroPane.xhtml` | 同名 | 主窗口骨架：命令集、快捷键、菜单、三栏、6 个 banner、3 个 splitter |
| `chrome/content/zotero/zoteroPane.js` | 同名 | 主窗口控制器：选择/排序状态、右键菜单构建、键盘分发、焦点环、布局切换 |
| `chrome/content/zotero/standalone/standalone.js` | 同名 | Notifier 驱动的菜单类型切换、`onpopupshowing` 菜单改写、`Zotero.Keys` 落键 |
| `chrome/content/zotero/tabs.js` | 同名 | 三类标签生命周期与回收；`tab-bar-container` 的 React root |
| `chrome/content/zotero/elements/itemPane.js` | 同名 | 条目面板 deck 与 `mode`、批量编辑提示、sidenav 挂载 |
| `chrome/content/zotero/elements/itemDetails.js` | 同名 | 分区懒渲染调度、IntersectionObserver、pinned 持久化 |
| `chrome/content/zotero/elements/itemBox.js` | 同名 | 全部元数据行的渲染、编辑与写回 |
| `chrome/content/zotero/elements/itemPaneSidenav.js` | 同名 | sidenav 的 tablist 语义、顺序与固定、a11y 互斥 |
| `chrome/content/zotero/components/virtualized-table.jsx` | 同名 | 表格外壳、列管理、行高公式、选择模型、滚动条注入 |
| `chrome/content/zotero/components/windowed-list.js` | 同名 | 行虚拟化：行高前缀和、二分可见区、overscan |
| `chrome/content/zotero/itemTreeColumns.jsx` | 同名 | 全部可用列的唯一事实源 |
| `chrome/content/zotero/collectionViewItemTree.jsx` | 同名 | 条目树：排序、分组头、拖放、右键菜单装配 |
| `chrome/content/zotero/xpcom/uiProperties.js` | 同名 | 字号/密度/RTL 落到 UI root |
| `chrome/content/zotero/xpcom/zotero.js` | 同名 | `Zotero.Keys` 偏好反向索引 |
| `chrome/content/zotero/xpcom/dataDirectory.js` | 同名 | 数据目录选择（含 `isLegacy` 的路径判定） |
| `chrome/skin/default/zotero/{8,16,20,item-type,itempane,collection-tree,mac}/**/*.svg` | 同名 | 图标资产 |
| `chrome/content/zotero-platform/{mac,win,unix}/zotero.css` | `scss/zotero-{mac,win,unix}.scss` → `scss/_zotero.scss` | 三平台编译出的主界面样式 |
| `chrome/skin/default/zotero/scaffold.css`（+ 21 个 `.css.map`） | `scss/scaffold.scss` | 令牌层（`:root` 上的 `--color-*`/`--accent-*`/`--tag-*`/`--material-*`） |

---

## 附录：复核方法

所有中间产物写 `/tmp/zotero-ui`，不进仓库。

### 版本与源码树

```bash
grep -E '^(Version|MinVersion|BuildID)' /usr/lib/zotero/app/application.ini
git -C /home/joshua/Workspace/Code/JavaScript/zotero rev-parse HEAD
git -C /home/joshua/Workspace/Code/JavaScript/zotero status --porcelain   # 期望只有 .ua/ 未跟踪
```

### 归档检索（安装版）

```bash
J=/usr/lib/zotero/app/omni.ja
unzip -l $J | grep -c 'chrome/content/zotero/'                       # 501
unzip -l $J | grep -oE 'chrome/skin/default/[^ ]*\.css' | sort -u    # 24
unzip -p $J chrome/skin/default/zotero/scaffold.css | wc -l          # 2（已 minify）
unzip -p $J chrome/skin/default/zotero/scaffold.css.map | grep -c sourcesContent   # 0
unzip -l $J | grep -oE 'zotero/16/[a-z]+/' | sort | uniq -c          # dark 3 / light 3 / universal 107
unzip -l $J | grep -c 'skin/16/white/'                               # 0
unzip -p $J chrome/content/zotero/zoteroPane.xhtml | grep -n '<字面量>'
unzip -p $J chrome/content/zotero/elements/itemPane.js | grep -c batch-edit          # 0
unzip -p $J chrome/content/zotero-platform/unix/zotero.css > /tmp/zotero-ui/unix.css  # 581269 B
grep -oE '2\.33333333em|--color-sidepane:[^;]*|min-height:41px' /tmp/zotero-ui/unix.css | sort | uniq -c
```

### 源码树检索（行号口径）

```bash
cd /home/joshua/Workspace/Code/JavaScript/zotero
git grep -n 'MINIMUM_ROW_HEIGHT' -- chrome scss
git grep -c '@media (-moz-platform:' -- scss          # 30 个文件
git grep -n 'scrollbar-color' -- scss                 # 10 处
git grep -n 'webkit-scrollbar' -- scss                # 无命中
```

### 重采与量测

```bash
# 1) 隔离环境（绝不打开 ~/Zotero）
mkdir -p /tmp/zotero-ui/{profile,data,shots}
cp ~/Zotero/zotero.sqlite /tmp/zotero-ui/data/
# profile/prefs.js 关键项（dataDir 是**路径**不是 file:// URL，见 §1.4）
#   extensions.zotero.useDataDir=true
#   extensions.zotero.dataDir=/tmp/zotero-ui/data
#   extensions.zotero.firstRun2=true
#   extensions.zotero.sync.autoSync=false / sync.enabled=false
#   browser.theme.toolbar-theme=1（深色截图用 0）
#   extensions.zotero.uiDensity=comfortable|compact
# 2) 启动（窗口 id 会变，先按 class 找）
/tmp/zotero-ui/launch.sh                                   # DISPLAY=:99 zotero -profile … -no-remote
xwininfo -root -children | grep -i navigator
# 3) 截图必须抓 root 再裁：import -window <窗口 id> 在本机抓到空白
import -window root png:- | convert - -crop 1280x1000+0+0 +repage out.png
# 4) 竖扫某列的取样命令
convert out.png -crop 1x820+880+180 +repage txt:- | tail -n +2 \
  | sed -E 's/^0,([0-9]+): \(([0-9]+),([0-9]+),([0-9]+)\).*/\1 \2 \3 \4/' \
  | awk '$2!=p2||$3!=p3||$4!=p4 {print; p2=$2;p3=$3;p4=$4}'
# 5) 横扫某行：把 crop 换成 1280x1+0+953，解析式换成 ^([0-9]+),0: …
```

行号漂移时按符号名改写引用，不要按旧行号；本文中所有行号只对 commit `2cdc2cc` 有效。
