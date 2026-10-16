# paseo 前端做法与差距清单

`references/paseo`（submodule，commit `5c2a155`）的前端有一批成熟的 token 与交互契约，但从代码里读出来成本很高。
本文把其中可迁移的做法整理成对照清单，让实现型 agent 不必先通读源码。

## 如何使用本文

三条边界先说清楚：

1. **只写源码里读到的事实。** 每条引用都带 `路径:行号`，可直接回查。读不到或未核实的写
   `unverified — 需确认`，不省略、不猜。
2. **本文不改本项目任何代码。** 第 7、9 节给出的是对照与方向，不是待办任务；采纳与否由设计裁决。
3. **paseo 与本项目技术栈不同**（第 1 节），照搬前先过第 8 节的「不可直接迁移」清单。

技术栈一句话：paseo 渲染层是 **React Native + Expo**，样式走 `react-native-unistyles` v3，
无 Tailwind、无 CSS-in-JS 库、无 `tailwind.config*`；桌面主进程用 `tsc` 直编译、无打包器；
渲染层 web / mobile / Electron 同源。本项目是 **Electron + React + Web**，样式是
`apps/desktop/src/renderer/src/styles.css` 的原生 CSS 变量。所以本文真正值钱的不是它的色值，
而是**组织方式**：单一来源、派生规则、几何常量、契约顺序。

章节导航：1 技术栈与分层 · 2 Token 体系 · 3 主题链路 · 4 控件几何与共享词汇 · 5 Composer 交互契约 ·
6 Agent 流渲染契约 · 7 可迁移做法 · 8 不可直接迁移 · 9 差距清单 · 10 路径索引。

---


素材：`references/paseo`（submodule，commit `5c2a155`）。以下每条都能按 `路径:行号` 复核。凡源码里读不到的，写 `unverified — 需确认`，不省略。

---

## 1. 技术栈与分层

### 1.1 渲染层样式栈（事实）

| 事实 | 取值 / 位置 |
|---|---|
| 样式库 | `react-native-unistyles` `^3.2.4`（`packages/app/package.json:126`） |
| Unistyles 初始化入口 | `packages/app/index.ts:6` `import "./src/styles/unistyles"` |
| `StyleSheet.configure` 调用 | `packages/app/src/styles/unistyles.ts:3-14` |
| 注册主题表 | `themes: REGISTERED_THEMES`（`packages/app/src/styles/unistyles.ts:5`），`REGISTERED_THEMES` 定义于 `packages/app/src/styles/theme.ts:874-880` |
| 断点 | `xs 0 / sm 576 / md 720 / lg 992 / xl 1200`（`packages/app/src/styles/unistyles.ts:6-12`） |
| 默认自适应主题 | `settings: { adaptiveThemes: true }`（`packages/app/src/styles/unistyles.ts:13`） |
| Tailwind / Nativewind / Tamagui | 未使用。`packages/app/package.json` 无 `tailwindcss` 依赖；全仓无 `tailwind.config*` 文件；`packages/app/src/constants/theme.ts:1-4` 的注释只是在列举「还有哪些别的方案」 |

### 1.2 桌面主进程（`packages/desktop`）

| 事实 | 取值 / 位置 |
|---|---|
| 编译方式 | `tsc -p tsconfig.json`（`packages/desktop/package.json:19` `build:main`），无打包器；`build` 串 `electron-builder`（同文件 `:18`） |
| 自定义 scheme 常量 | `const APP_SCHEME = "paseo"`（`packages/desktop/src/main.ts:115`） |
| scheme 提权注册 | `protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } }])`（`packages/desktop/src/main.ts:560-565`） |
| scheme 请求处理 | `protocol.handle(APP_SCHEME, …)`（`packages/desktop/src/main.ts:933`）；目录路径 307 回落到 `${APP_SCHEME}://app${path}`（`:941`） |
| preload 路径 | `path.join(__dirname, "preload.js")`（`packages/desktop/src/main.ts:571-573`） |
| 浏览器 webview 键盘 preload | `path.join(__dirname, "features", "browser-keyboard", "guest-preload.js")`（`packages/desktop/src/main.ts:575-577`） |
| 建窗函数 | `async function createWindow(…)`（`packages/desktop/src/main.ts:670-796`） |
| 新建窗口 | `new BrowserWindow({ title, …resolveWindowBounds(restoredWindowState), show: false, backgroundColor: … })`（`:695-702`） |
| 主窗口 `webPreferences` | `preload: getPreloadPath()`、`additionalArguments: [windowChromeModeArgument(DESKTOP_WINDOW_CHROME_MODE)]`、`contextIsolation: true`、`nodeIntegration: false`、`webviewTag: true`（`:704-710`）——此处未显式写 `sandbox`，走 Electron 默认值 |
| 路由加载 | 生产：`await mainWindow.loadURL(\`${APP_SCHEME}://app${options.initialRoute ?? "/"}\`)`（`:794`）；开发：`DEV_SERVER_URL`（`:114` `process.env.EXPO_DEV_URL ?? "http://localhost:8081"`），`:789-790` |
| webview 附加的二次加固 | `will-attach-webview` 里强制 `contextIsolation: true`、`sandbox: true`、`webSecurity: true`、`nodeIntegration: false`，删掉传入的 `preload` 后换成浏览器键盘 preload（`:743-763`） |
| 浏览器弹窗窗口 prefs | `partition: PASEO_BROWSER_PROFILE_PARTITION`、`nodeIntegration/InSubFrames/InWorker: false`、`contextIsolation: true`、`sandbox: true`、`webSecurity: true`、`webviewTag: false`、`allowRunningInsecureContent: false`（`:227-244`，函数头 `:227`） |
| 窗口几何恢复 | 仅会话内第一个窗口恢复并持久化（`:681-682` 注释 + `:686-689` `createWindowStateStore` / `.load()`） |
| 状态持久化 debounce | `const WINDOW_STATE_SAVE_DEBOUNCE_MS = 400`（`packages/desktop/src/window/window-manager.ts:16`），用于 `setupWindowStatePersistence` 的 `scheduleSave`（同文件 `:240-282`，定时器 `:279-282`） |
| 最大化时立即写盘、关闭时同步 flush | `saveNow()` 与注释描述的 flush 分支（`packages/desktop/src/window/window-manager.ts:284-293`） |

### 1.3 preload 桥与沙箱硬约束

| 事实 | 取值 / 位置 |
|---|---|
| 桥对象名 | `contextBridge.exposeInMainWorld("paseoDesktop", {…})`（`packages/desktop/src/preload.ts:32`） |
| preload 在沙箱里 tsc 直编译，**只能** require `electron` | 注释写在 `packages/desktop/src/preload.ts:5-9`；违反后果是 preload 在 `exposeInMainWorld` 之前中止、`window.paseoDesktop` 为 undefined（0.1.108 回归，#2103） |
| 类型导入允许 | `packages/desktop/src/preload.ts:2-3` 是 `import type`，emit 时被擦除（注释 `:9`） |
| 浏览器 profile partition 字面量 | `const PASEO_BROWSER_PROFILE_PARTITION = "persist:paseo-browser"`（`packages/desktop/src/preload.ts:11`），必须与 `features/browser-profile.ts` 的同名常量保持同步（注释 `:9-10`） |
| 窗口 chrome 模式从命令行参数读取 | `readWindowChromeMode()`（`packages/desktop/src/preload.ts:15-`），前缀 `"--paseo-window-chrome-mode="`，取值 `native-mac` / `custom-windows` / `custom-linux` |
| 通用调用通道 | `invoke: (command, args) => ipcRenderer.invoke("paseo:invoke", command, args)`（`packages/desktop/src/preload.ts:39-40`） |
| 事件订阅 | `events.on(event, handler)` → `ipcRenderer.on(\`paseo:event:${event}\`, …)`，返回退订函数（`:46-56`） |
| 守卫测试 | `packages/desktop/src/preload-sandbox.test.ts`（99 行）：`SANDBOX_ALLOWLIST = new Set(["electron"])`（`:13`）；用 TypeScript compiler API 解析源码、只收集会落到 emit 的运行时模块说明符（`:20-43`）；两条用例「only loads Electron's sandbox allowlist at runtime」「inlines the browser profile partition instead of importing it」（`:44-52`） |

### 1.4 渲染层与桌面 host 桥

| 事实 | 取值 / 位置 |
|---|---|
| 桥接口定义 | `packages/app/src/desktop/host.ts`（235 行），`DesktopDialogBridge` / `DesktopNotificationBridge` / `DesktopOpenerBridge` / `DesktopEditorBridge` 等全部是**可选成员**（如 `ask?`、`open?`，`:48-58`、`:62-71`） |
| 运行时取值 | `getElectronHost()` 读 `window.paseoDesktop`，非对象就返回 `null`（`packages/app/src/desktop/electron/host.ts:3-12`） |
| 窗口桥包装 | `packages/app/src/desktop/electron/window.ts`：`getDesktopWindow()` 先判 `typeof getter !== "function"` 再 try/catch 返回 `null`（`:8-18`）；`updateDesktopWindowChrome(update)` 在 `updateChrome` 非函数时静默 return（`:47-53`） |
| chrome 类型 | `DesktopWindowChromeUpdate = { backgroundColor?: string; trafficLightOffsetY?: number }`（`packages/desktop/src/window/window-manager.ts:29-32`） |

### 1.5 与本项目（Scholoom）的差异（逐条可证）

| 维度 | paseo | 本项目 | 证据 |
|---|---|---|---|
| 桌面构建 | `tsc` 直编译，无打包器 | `electron-vite build` / `electron-vite dev`，有打包器 | `references/paseo/packages/desktop/package.json:18-19` vs `apps/desktop/package.json:10,12` |
| preload 产物 | `preload.js`（tsc emit） | `../preload/index.cjs`（见下） | `references/paseo/packages/desktop/src/main.ts:571-573` vs `apps/desktop/src/main/index.ts:75` |
| preload 表面 | 140 行，含 window / agentNavigation / events / 多种桥 | 8 行，只有 `platform` / `bootstrap` / `openExternal` 三个成员 | `references/paseo/packages/desktop/src/preload.ts:32` vs `apps/desktop/src/preload/index.ts:5-8` |
| 沙箱与隔离 | 主窗口 `contextIsolation: true` + `nodeIntegration: false`（`:707-708`），webview 再加固一轮（`:743-763`）；preload 另有源码级守卫测试 | `sandbox: true`、`contextIsolation: true`（`apps/desktop/src/main/index.ts:76-77`）；仓库内未找到针对 preload 运行时依赖的等价守卫测试，`tests/` 下只有 Playwright 用例（`tests/ui/`、`tests/smoke/`） | — |
| 窗口 chrome | 主进程持有 `resolveSystemWindowTheme` / `getWindowBackgroundColor` / `setBackgroundColor` / mac 交通灯偏移 | 无对应通道（本项目 preload 只有 3 个方法，渲染层无从回写窗口底色） | `references/paseo/packages/desktop/src/window/window-manager.ts:42-48,196-214` vs `apps/desktop/src/preload/index.ts:5-8` |
| 自定义 scheme | `paseo` + `registerSchemesAsPrivileged` + `protocol.handle`（`main.ts:115,560-565,933-944`） | 未见同类 scheme 注册（`apps/desktop/src/main/index.ts` 内无 `registerSchemesAsPrivileged`） | — |
| 渲染层形态 | React Native + Expo，web/mobile/Electron 同源，`Platform.select` 分叉字体栈 | Electron + React + Web | `references/paseo/packages/app/src/styles/theme.ts:635-645` vs `apps/desktop/electron.vite.config.ts` |

---

## 2. Token 体系

唯一定义点：`references/paseo/packages/app/src/styles/theme.ts`（886 行）。

### 2.1 调色板 `baseColors`（`theme.ts:4-108`）

`baseColors` 是原始调色板，不参与语义；语义色由 builder 从 `surfaceN / foreground / accent` 派生（见 2.7）。

| 调色板 | 取值 | 位置 |
|---|---|---|
| `white` / `black` | `#ffffff` / `#000000` | `theme.ts:6-7` |
| `zinc`（主灰阶） | `50 #fafafa`、`100 #f4f4f5`、`200 #e4e4e7`、`300 #d4d4d8`、`400 #a1a1aa`、`500 #71717a`、`600 #52525b`、`700 #3f3f46`、`800 #27272a`、`850 #1a1a1d`、`900 #18181b`、`950 #121214` | `theme.ts:10-23` |
| `gray` | `50 #f9fafb`、`100 #f3f4f6`、`200 #e5e7eb`、`300 #d1d5db`、`400 #9ca3af`、`500 #6b7280`、`600 #4b5563`、`700 #374151`、`800 #1f2937`、`900 #111827` | `theme.ts:26-37` |
| `slate` | 仅 `200 #e2e8f0` | `theme.ts:40-42` |
| `blue` | `50 #eff6ff`、`100 #dbeafe`、`200 #bfdbfe`、`300 #93c5fd`、`400 #60a5fa`、`500 #3b82f6`、`600 #2563eb`、`700 #1d4ed8`、`800 #1e40af`、`900 #1e3a8a`、`950 #172554` | `theme.ts:45-57` |
| `green` | `100 #dcfce7`、`200 #bbf7d0`、`400 #4ade80`、`500 #22c55e`、`600 #16a34a`、`800 #166534`、`900 #14532d` | `theme.ts:60-68` |
| `red` | `100 #fee2e2`、`200 #fecaca`、`300 #fca5a5`、`500 #ef4444`、`600 #dc2626`、`800 #991b1b`、`900 #7f1d1d` | `theme.ts:71-79` |
| `teal` | 仅 `200 #99f6e4` | `theme.ts:82-84` |
| `amber` | `500 #f59e0b`、`700 #b45309` | `theme.ts:87-90` |
| `yellow` | 仅 `400 #fbbf24` | `theme.ts:93-95` |
| `purple` | `500 #a855f7`、`600 #9333ea` | `theme.ts:98-101` |
| `orange` | `500 #f97316`、`600 #ea580c` | `theme.ts:104-107` |

### 2.2 diff 色（`theme.ts:116-124`）

| 角色 | 浅色 | 位置 | 深色 | 位置 |
|---|---|---|---|---|
| `diffAddition` | `#15803d` | `theme.ts:117` | `#4ade80` | `theme.ts:122` |
| `diffDeletion` | `#b91c1c` | `theme.ts:118` | `#ef4444` | `theme.ts:123` |

注释明确划界：diff **正文**用这一组，因为颜色本身是信号、要能逐行扫读；diff **stat**（标题旁的 `+12 −3`）不算这一档，走 `statusSuccess` / `statusDanger`（`theme.ts:109-115`）。

### 2.3 状态色（`theme.ts:146-160`）

| 角色 | 浅色 | 位置 | 深色 | 位置 |
|---|---|---|---|---|
| `statusSuccess` | `#3e704a` | `theme.ts:148` | `#6cb17b` | `theme.ts:156` |
| `statusDanger` | `#9d433b` | `theme.ts:149` | `#d8847b` | `theme.ts:157` |
| `statusWarning` | `#7b5d39` | `theme.ts:150` | `#c09664` | `theme.ts:158` |
| `statusMerged` | `#7347af` | `theme.ts:151` | `#a890d5` | `theme.ts:159` |

生成规则写在注释里：四个色共享同一亮度与同一彩度，只有色相变；彩度取该亮度该色相 sRGB 允许值的固定比例，因为色域不均（琥珀在红色跑满前就先用尽）。色相按族固定，跨深浅不变——success 150、danger 27、warning 70.5、merged 300（`theme.ts:141-145`）。浅色带 `L=0.50 / chroma 60%`，深色带 `L=0.70 / chroma 55%`（`theme.ts:147,155`）。

### 2.4 状态点色（`theme.ts:204-218`）

| 角色 | 浅色 | 位置 | 深色 | 位置 |
|---|---|---|---|---|
| `statusDotSuccess` | `#299f51` | `theme.ts:206` | `#35c264` | `theme.ts:214` |
| `statusDotDanger` | `#f12e2f` | `theme.ts:207` | `#f7796d` | `theme.ts:215` |
| `statusDotWarning` | `#b37824` | `theme.ts:208` | `#db932e` | `theme.ts:216` |
| `statusDotRunning` | `#268ae0` | `theme.ts:209` | `#5caaf6` | `theme.ts:217` |

与 2.3 的差别写在注释里（`theme.ts:176-203`）：点是 6pt 纯色、无形状无标签，所以亮度按色相分离度定而不是按与底色的距离；浅色带 `L=0.62 / chroma 90%`、深色带 `L=0.72 / chroma 90%`（`theme.ts:205,213`），running 用 hue 250 避开 identity 蓝的 256.6。

### 2.5 浅色语义色 `lightSemanticColors`（`theme.ts:323-345`）

| 角色 | 取值 | 位置 |
|---|---|---|
| `surface0`（背景 / 正文底） | `#ffffff` | `:324` |
| `surface1` | `#fafafa` | `:325` |
| `surface2` | `#f4f4f5` | `:326` |
| `surface3` | `#e4e4e7` | `:327` |
| `surface4` | `#d4d4d8` | `:328` |
| `surfaceDiffEmpty` | `#f6f6f6` | `:329` |
| `surfaceSidebar` | `#f4f4f5` | `:330` |
| `foreground` | `#1a1a1e` | `:331` |
| `foregroundMuted` | `#71717a` | `:332` |
| `foregroundExtraMuted` | `#a1a1aa` | `:333` |
| `border` | `#e4e4e7` | `:334` |
| `borderAccent` | `#ececf1` | `:335` |
| `accent` | `#20744A` | `:336` |
| `accentBright` | `#239956` | `:337` |
| `accentForeground` | `#ffffff` | `:338` |
| `primary` / `primaryForeground` | `#18181b` / `#fafafa` | `:339-340` |
| `destructive` | `#b04138` | `:341` |
| `terminalBlack` / `terminalBrightBlack` | `#1a1a1e` / `#3f3f46` | `:342-343` |
| `ring` | `#18181b` | `:344` |

浅色 builder 的固定派生值：

| 派生项 | 取值 | 位置 |
|---|---|---|
| `surfaceSidebarHover` | `= surface3` | `theme.ts:270` |
| `surfaceSidebarSelected` | `= surface4` | `theme.ts:271` |
| `interactionHighlight` | `rgba(0, 0, 0, 0.06)` | `theme.ts:273` |
| `terminal.selectionBackground` | `rgba(0, 0, 0, 0.15)` | `theme.ts:314` |

### 2.6 默认深色 `paseoDarkColors`（`theme.ts:459-477`）

| 角色 | 取值 | 位置 |
|---|---|---|
| `surface0` | `#181B1A` | `:461` |
| `surface1` | `#1E2120` | `:462` |
| `surface2` | `#272A29` | `:463` |
| `surface3` | `#434645` | `:464` |
| `surface4` | `#595B5B` | `:465` |
| `surfaceDiffEmpty` | `#252827` | `:466` |
| `surfaceSidebar` | `#141716` | `:467` |
| `foregroundMuted` | `#A1A5A4` | `:468` |
| `foregroundExtraMuted` | `#717574` | `:469` |
| `border` | `#252B2A` | `:470` |
| `borderAccent` | `#2F3534` | `:471` |
| `accent` | `#20744A` | `:472` |
| `accentBright` | `#7ccba0` | `:473` |
| `destructive` | `#c64f43`（暖红，色相约 7） | `:474` |
| `terminalBlack` / `terminalBrightBlack` | `#141716` / `#434645` | `:475-476` |

深色 builder 的固定派生值：

| 派生项 | 取值 | 位置 |
|---|---|---|
| `foreground` 缺省 | `#fafafa` | `theme.ts:391` |
| `ring` 缺省 | `#d4d4d8` | `theme.ts:392` |
| `surfaceSidebarHover` | `= surface1` | `theme.ts:401` |
| `surfaceSidebarSelected` | `= surface2` | `theme.ts:402` |
| `interactionHighlight` | `rgba(255, 255, 255, 0.08)` | `theme.ts:404` |
| `destructiveForeground` / `successForeground` | `#ffffff` | `theme.ts:418,420` |
| `terminal.selectionBackground` | `rgba(255, 255, 255, 0.2)` | `theme.ts:446` |

其余深色变体（同一 builder，只换 tint 字面量）：`zincDarkColors` `:480-498`、`midnightDarkColors` `:501-518`、`claudeDarkColors` `:521-538`、`ghosttyDarkColors` `:541-558`、`pureBlackDarkColors` `:721-738`。对应的成品主题 `darkTheme` `:714`、`darkZincTheme` `:715`、`darkMidnightTheme` `:716`、`darkClaudeTheme` `:717`、`darkGhosttyTheme` `:718`、`darkPureBlackTheme` `:740`、`lightTheme` `:776`。

### 2.7 ANSI 终端色（`theme.ts:244-259` / `theme.ts:373-388`）

| 角色 | 浅色 | 位置 | 深色 | 位置 |
|---|---|---|---|---|
| `red` | `#dc2626` | `:245` | `#e07070` | `:374` |
| `green` | `#16a34a` | `:246` | `#5dba80` | `:375` |
| `yellow` | `#ca8a04` | `:247` | `#d4a44a` | `:376` |
| `blue` | `#2563eb` | `:248` | `#6a9de0` | `:377` |
| `magenta` | `#9333ea` | `:249` | `#b07ad0` | `:378` |
| `cyan` | `#0891b2` | `:250` | `#4aabb8` | `:379` |
| `white` | `#ffffff` | `:251` | `#d4d4d8` | `:380` |
| `brightRed` | `#ef4444` | `:252` | `#e89090` | `:381` |
| `brightGreen` | `#22c55e` | `:253` | `#7ecf9a` | `:382` |
| `brightYellow` | `#f59e0b` | `:254` | `#e0be6e` | `:383` |
| `brightBlue` | `#3b82f6` | `:255` | `#8ab4e8` | `:384` |
| `brightMagenta` | `#a855f7` | `:256` | `#c49ae0` | `:385` |
| `brightCyan` | `#06b6d4` | `:257` | `#6ec2cc` | `:386` |
| `brightWhite` | `#fafafa` | `:258` | `#f0f0f2` | `:387` |

`terminal.black` / `terminal.brightBlack` 不在 ANSI 表里，由各 tint 单独给（浅 `theme.ts:342-343`，深 `theme.ts:475-476`）。终端对象的其余键：`background / foreground / cursor / cursorAccent / selectionBackground / selectionForeground` 在 `theme.ts:309-319`（浅）与 `theme.ts:441-451`（深）。

### 2.8 尺寸与排版常量

| 常量 | 取值 | 位置 |
|---|---|---|
| `SPACING` | `0:0`、`0.5:2`、`1:4`、`1.5:6`、`2:8`、`3:12`、`4:16`、`6:24`、`8:32`、`12:48`、`16:64`、`20:80`、`24:96`、`32:128` | `theme.ts:560-575` |
| `FONT_SIZE` | `code:12`、`content:15`、`sm:12`、`base:14`、`lg:16`、`xl:18`、`2xl:20`、`3xl:22`、`4xl:26` | `theme.ts:577-587` |
| `LINE_HEIGHT` | `diff:22` | `theme.ts:589-591` |
| `ICON_SIZE` | `xs:12`、`sm:14`、`md:16`、`lg:20` | `theme.ts:593-598` |
| `ICON_STROKE_WIDTH` | `1.5` | `theme.ts:600` |
| `FONT_WEIGHT` | `normal:"normal"`、`medium:"500"`、`semibold:"600"`、`bold:"bold"` | `theme.ts:602-607` |
| `BORDER_RADIUS` | `none:0`、`sm:2`、`base:4`、`md:6`、`lg:8`、`xl:12`、`2xl:16`、`full:9999` | `theme.ts:609-618` |
| `BORDER_WIDTH` | `0:0`、`1:1`、`2:2` | `theme.ts:620-624` |
| `OPACITY` | `0:0`、`50:0.5`、`100:1` | `theme.ts:626-630` |
| `DEFAULT_UI_FONT_STACK` | iOS `"system-ui"`；默认 `"normal"`；web `"system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"` | `theme.ts:635-639` |
| `DEFAULT_MONO_FONT_STACK` | iOS `"ui-monospace"`；默认 `"monospace"`；web `"SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"` | `theme.ts:641-645` |
| `DEFAULT_CONTENT_MAX_WIDTH` | `820` | `theme.ts:648` |

阴影（两套，不共用 token 名）：

| 档 | 深色 `shadowColor / offset / radius / elevation` | 位置 | 浅色 | 位置 |
|---|---|---|---|---|
| `sm` | `rgba(0,0,0,0.25)` / `{0,2}` / `4` / `2` | `theme.ts:682-686` | `rgba(0,0,0,0.02)` / `{0,2}` / `8` / `2` | `theme.ts:744-748` |
| `md` | `rgba(0,0,0,0.20)` / `{0,4}` / `8` / `8` | `theme.ts:687-691` | `rgba(0,0,0,0.04)` / `{0,4}` / `16` / `4` | `theme.ts:749-753` |
| `lg` | `rgba(0,0,0,0.40)` / `{0,12}` / `24` / `8` | `theme.ts:692-696` | `rgba(0,0,0,0.08)` / `{0,8}` / `24` / `8` | `theme.ts:754-758` |

### 2.9 派生规则（三条）

| 规则 | 实现 | 位置 |
|---|---|---|
| 状态 tint = 状态色拼 alpha 后缀 | `function statusTints(colors, alphaHex)` 把 `statusSuccess` / `statusDanger` / `statusWarning` 拼上 hex alpha；浅色传 `"1f"`（12%），深色传 `"29"`（16%），没有 `statusMergedTint` | `theme.ts:165-171`；浅 `theme.ts:173`，深 `theme.ts:174` |
| 语义色由 builder 生成 | `buildLightSemanticColors(tint)`（`theme.ts:261-321`）与 `buildDarkSemanticColors(tint)`（`theme.ts:390-457`）各自返回完整语义表；末尾 spread `…lightDiffColors, …lightStatusColors, …lightStatusTints, …lightStatusDotColors`（`theme.ts:304-307`）与深色对应（`theme.ts:436-439`），所以 tint 只提供 20 来个原色 | 见左 |
| 主题对象 = `colorScheme + colors + shadow + commonTheme` | `buildDarkTheme`（`theme.ts:701-712`）/ `buildLightTheme`（`theme.ts:763-774`），`colors` 形如 `{ …semanticColors, palette: baseColors, syntax: darkHighlightColors }`；`commonTheme` 一次性挂上 spacing / fontSize / fontFamily / lineHeight / contentMaxWidth / iconSize / fontWeight / borderRadius / borderWidth / opacity | `theme.ts:654-666`（类型）、`:667-678`（实例） |

`commonTheme` 里 `fontSize`、`fontFamily`、`lineHeight`、`contentMaxWidth` 被刻意放宽成 `number` / `string` 而不加 `as const`，注释说明就是为了让 appearance updater 能在运行时用 `UnistylesRuntime.updateTheme` 打补丁（`theme.ts:650-653`）。

主题名与 Unistyles 名的映射表：`THEME_OPTIONS`（`theme.ts:781-832`，含 `swatch` 字面量 `#ffffff` / `#2D8B62` / `#808080` / `#4A6BA8` / `#D97757` / `#8caaee` / `#000000`）、`THEME_TO_UNISTYLES`（`:866-868`）、`THEME_SWATCHES`（`:870-872`）、`REGISTERED_THEMES`（`:874-880`）、插件主题名 `pluginLight` / `pluginDark`（`:834-838`）、`theme = darkTheme` 兼容别名（`:779`）。

### 2.10 已知遗留与缺口

| 项 | 结论 | 证据 |
|---|---|---|
| `packages/app/src/constants/theme.ts` | **重复定义，且无任何代码引用**，是死文件。内容：`tintColorLight "#0a7ea4"`、`tintColorDark "#fff"`、`Colors.light.{text #11181C, background #fff, icon #687076, tabIconDefault #687076, tabIconSelected tintColorLight}`、`Colors.dark.{text #ECEDEE, background #151718, icon #9BA1A6, tabIconDefault #9BA1A6, tabIconSelected tintColorDark}` | 文件共 26 行；`tintColorLight` `:6`、`tintColorDark` `:7`、`Colors` `:9-26`；全仓 grep `constants/theme` 只命中 `packages/app/src/styles/theme.ts:632` 的一句注释「copied verbatim from constants/theme.ts `Fonts`」——而该文件里其实没有 `Fonts` |
| `motion` 集中模块 | **不存在**。没有 `styles/motion.ts`，也没有任何名为 `motion*` 的文件或目录。时长字面量全部散落在组件里，共 15 处 / 5 个文件 | 逐条见下表 |
| 缓动函数 | 无集中 token。出现的都是内联的 `Easing.inOut(Easing.ease)` | `packages/app/src/components/volume-meter.tsx:69,79,89`、`packages/app/src/components/ui/switch.tsx:28` |
| Web 滚动条 | 有独立常量，但与主题系统解耦（原生文件是空实现，web 变体注入 `<style>`） | `packages/app/src/styles/web-scrollbar.ts:1-3`（`WEB_SCROLLBAR_WIDTH "thin"`、`WEB_SCROLLBAR_SIZE_PX 8`、`WEB_SCROLLBAR_RESTING_OPACITY 0.4`）；`packages/app/src/styles/install-web-scrollbar-styles.ts:1-3` 为 no-op；`install-web-scrollbar-styles.web.ts:16-19,26-33,38-42` 用 `var(--colors-foreground-extra-muted)` 上色 |

散落的动画时长（已排除测试文件与生成产物）：

| 文件:行号 | 字面量 |
|---|---|
| `packages/app/src/components/sidebar-agent-list-skeleton.tsx:67` | `duration: 1000` |
| `packages/app/src/components/sidebar-agent-list-skeleton.tsx:72` | `duration: 1000` |
| `packages/app/src/components/volume-meter.tsx:68` | `duration: 0` |
| `packages/app/src/components/volume-meter.tsx:69` | `duration: 800` |
| `packages/app/src/components/volume-meter.tsx:70` | `duration: 800` |
| `packages/app/src/components/volume-meter.tsx:78` | `duration: 200` |
| `packages/app/src/components/volume-meter.tsx:79` | `duration: 1000` |
| `packages/app/src/components/volume-meter.tsx:80` | `duration: 1000` |
| `packages/app/src/components/volume-meter.tsx:88` | `duration: 400` |
| `packages/app/src/components/volume-meter.tsx:89` | `duration: 1200` |
| `packages/app/src/components/volume-meter.tsx:90` | `duration: 1200` |
| `packages/app/src/components/file-drop/file-drop-backdrop.tsx:26` | `duration: 150` |
| `packages/app/src/components/ui/switch.tsx:28` | `TIMING = { duration: 180, easing: Easing.inOut(Easing.ease) }` |
| `packages/app/src/git/pull-request-panel/activity-skeleton.tsx:12` | `duration: 1000` |
| `packages/app/src/git/pull-request-panel/activity-skeleton.tsx:13` | `duration: 1000` |

Tooltip 打开延迟也是就地字面量，默认 `0`：`packages/app/src/components/ui/tooltip.tsx:231`、`packages/app/src/components/headers/header-toggle-button.tsx:33`。

---

## 3. 主题链路

### 3.1 持久化（zod + AsyncStorage）

| 环节 | 事实 | 位置 |
|---|---|---|
| AsyncStorage 键 | `APP_SETTINGS_KEY = "@paseo:app-settings"`；`LEGACY_SETTINGS_KEY = "@paseo:settings"`；`SETTINGS_MIGRATIONS_KEY = "@paseo:settings-migrations"` | `packages/app/src/hooks/use-settings/keys.ts:3,4,13` |
| 迁移标记独立于设置体 | 注释说明：设置体保留新构建认识的字段，迁移标记单独放，把 id 存成列表以便下次迁移只是新增一项 | `packages/app/src/hooks/use-settings/keys.ts:6-12` |
| 存储实现 | `productionDeps.storage = AsyncStorage`（`@react-native-async-storage/async-storage`，导入于 `packages/app/src/hooks/use-settings/index.ts:2`） | `packages/app/src/hooks/use-settings/index.ts:118-119` |
| 主题枚举 schema | `ThemePreferenceSchema = z.enum([...THEME_OPTIONS.map(o => o.name), PLUGIN_THEME_PREFERENCE])`，即枚举直接从 `THEME_OPTIONS` 生成，不手写列表 | `packages/app/src/hooks/use-settings/storage.ts:45-48` |
| 主题默认 | `DEFAULT_THEME_PREFERENCE = "auto"` | `packages/app/src/hooks/use-settings/storage.ts:50` |
| 持久化 schema | `StoredAppSettingsSchema`（`z.looseObject`），主题项 `theme: ThemePreferenceSchema.catch(DEFAULT_THEME_PREFERENCE)`，语法高亮 `syntaxTheme: z.string().refine(isSyntaxThemeId).catch("one")` | `packages/app/src/hooks/use-settings/storage.ts:212-243`（主题 `:214`，语法 `:243`） |
| 读写入口 | `saveAppSettings`（`:353`）、`loadAppSettingsFromStorage`（`:373`）、`loadSettingsFromStorage`（`:420`）、`normalizeAppSettings`（`:446`）；读时 `raw = await storage.getItem(key)` 后 `StoredAppSettingsSchema.parse(decoded)`（`:584-597`），写时 `storage.setItem(APP_SETTINGS_KEY, JSON.stringify({...}))`（`:607-610`） | 同左 |
| 默认值表 | `DEFAULT_CLIENT_SETTINGS`（`:137-165`）：`theme: "auto"`（`:138`）、`uiFontFamily: ""`、`monoFontFamily: ""`（`:145-146`）、`contentMaxWidth: null`（`:150`）、`syntaxTheme: "one"`（`:151`）、`sendBehavior: "steer"`（`:141`） | `packages/app/src/hooks/use-settings/storage.ts:137-165` |
| 字号边界 | UI base 10–21（`:59-60`）、content 10–21（`:66-67`）、code 9–22（`:69-70`）、正文宽度 600–4000（`:73-74`）；native 与 web 的 base 缺省不同：native 15 / web `FONT_SIZE.base`（`:54-56`），content native 16 / web `FONT_SIZE.content`（`:61-63`） | `packages/app/src/hooks/use-settings/storage.ts:54-77` |
| 设置拆两半 | App 自持的一半落 AsyncStorage，桌面相关的一半走 Electron 设置桥；app 那半的键集就是 `DEFAULT_CLIENT_SETTINGS` 的键集，新增设置项不用改手写列表 | `packages/app/src/hooks/use-settings/index.ts:102-106`，实现 `storage: AsyncStorage` / `desktop: { isElectron, loadDesktopSettings, … }`（`:118-122`） |

### 3.2 `applyTheme` → `UnistylesRuntime`（`packages/app/src/appearance/provider.tsx`）

| 分支 | 事实 | 位置 |
|---|---|---|
| 函数入口 | `function applyTheme({ preference, contributedTheme })` | `provider.tsx:39` |
| 插件主题 | `UnistylesRuntime.updateTheme(themeName, () => contributedTheme.theme)` → `setAdaptiveThemes(false)` → `setTheme(themeName)`，然后 return | `provider.tsx:40-46` |
| `auto` | `UnistylesRuntime.setAdaptiveThemes(true)` 后 return，不显式 setTheme | `provider.tsx:50-53` |
| 具体主题 | `setAdaptiveThemes(false)` + `setTheme(THEME_TO_UNISTYLES[builtInPreference])` | `provider.tsx:55-56` |
| 偏好为 `plugin` 但无选中项 | 落到 `DEFAULT_THEME_PREFERENCE` | `provider.tsx:48-49` |
| 应用时机 | `useEffect` 里 `if (isLoading) return;` 之后依次 `applyTheme(...)`、`applyAppearance({...})`、`setHasAppliedAppearance(true)` | `provider.tsx:68-93` |
| 首帧门控 | `if (!hasAppliedAppearance) return null;`——注释理由：首次设置加载会改外观键，挂载屏幕放在应用之后，避免启动时销毁重建已可见的工作区 | `provider.tsx:107-108` |
| 系统栏 | provider 树里挂 `<AppearanceSystemBars />` | `provider.tsx:112` |

### 3.3 运行时打补丁（`packages/app/src/appearance/apply.ts`）

| 项 | 事实 | 位置 |
|---|---|---|
| 字体阶梯重建 | `scaleFontSize(uiBaseSize, contentSize, codeSize)`，比例 `const r = uiBaseSize / FONT_SIZE.base`，`sm/base/lg/xl/2xl/3xl/4xl` 逐项 `Math.round(FONT_SIZE.<key> * r)`，`content` 与 `code` 是绝对值不缩放 | `apply.ts:33-50`（比例 `:38`，逐项 `:40-46`，绝对值 `:47-48`） |
| 幂等的原因 | 从「写死的 `FONT_SIZE`」而非当前（可能已缩放过）的主题推导，重复 apply 不会累乘；改 code 字号不动 UI 阶梯 | 注释 `apply.ts:24-33` |
| diff 行高跟字号耦合 | `const diffLineHeight = Math.round(input.codeFontSize * 1.5)`，覆盖 `lineHeight.diff` | `apply.ts:66`、`:83` |
| 补丁范围 | 对**全部** `REGISTERED_THEMES` 的键逐个 `updateTheme`，只改 `fontFamily` / `fontSize` / `lineHeight` / `contentMaxWidth` / `colors.syntax`，其余 `...t` 原样保留 | `apply.ts:63-105`（键集合 `:12`，循环 `:75-105`） |
| 顺序 | 当前激活主题先更新，其余在后——注释解释：Unistyles web 在每次 registry 补丁后 emit，先更新已挂载主题可让订阅者在本次渲染就拿到新数值，最后更新会让 Pure black 落后一次提交 | `apply.ts:67-73`，注释 `:68-70` |
| 字体栈兜底 | `input.uiFontFamily.trim() \|\| DEFAULT_UI_FONT_STACK`、`monoFontFamily` 同理 | `apply.ts:64-65` |
| web 额外一步 | 结尾调 `applyRootUiFont(ui)`，因为 RN-web 会给每个文本元素盖默认字体，只靠 theme 改不动；原生上是 no-op | `apply.ts:105-107`，注释 `:104-106` |

### 3.4 桌面 chrome：独立于 Unistyles 的第二条通道

| 环节 | 事实 | 位置 |
|---|---|---|
| 主进程只认系统主题 | `resolveSystemWindowTheme() { return nativeTheme.shouldUseDarkColors ? "dark" : "light" }` | `packages/desktop/src/window/window-manager.ts:42-44` |
| 窗口底色字面量 | `getWindowBackgroundColor(theme)` → 深 `#181B1A` / 浅 `#ffffff` | `packages/desktop/src/window/window-manager.ts:46-48` |
| 建窗时消费 | `const systemTheme = resolveSystemWindowTheme()`（`main.ts:679`）→ `backgroundColor: getWindowBackgroundColor(systemTheme)`（`main.ts:699`） | `packages/desktop/src/main.ts:679,699` |
| renderer 回写通道 | IPC `paseo:window:updateChrome`（`window-manager.ts:196`）→ `readWindowChromeUpdate` 校验（`:202`）→ `win.setBackgroundColor(nextUpdate.backgroundColor)`（`:207-209`） | `packages/desktop/src/window/window-manager.ts:196-214` |
| 交通灯偏移 | 仅 `mode === "native-mac"` 时走 `applyMacWindowControlsUpdate`（`:211-212`）；实际计算 `y = MAC_TRAFFIC_LIGHT_POSITION.y + update.trafficLightOffsetY`，`x` 固定 | `window-manager.ts:134-146`，常量 `MAC_TRAFFIC_LIGHT_POSITION = { x: 16, y: 14 }` 在 `:17` |
| 偏移量的合法性上限 | `Math.abs(input) <= MAX_TRAFFIC_LIGHT_OFFSET_Y ? input : null`，`MAX_TRAFFIC_LIGHT_OFFSET_Y = 10` | `window-manager.ts:112`、常量 `:18` |
| 渲染层发起 | `DesktopWindowControlsSync` 从 `useUnistyles()` 取 `theme.colors.surface0`，effect 依赖 `[isLoading, surface0]`，发 `{ backgroundColor: surface0, trafficLightOffsetY: -4 }`，`isLoading || isNative` 时跳过 | `packages/app/src/app/_layout.tsx:689-706`（import `:83`，挂载 `:683`） |
| 渲染层封装 | `updateDesktopWindowChrome` 在 `getDesktopWindow()` 为空或没有 `updateChrome` 时静默 return | `packages/app/src/desktop/electron/window.ts:47-53` |

结论：窗口底色启动时来自系统主题（`shouldUseDarkColors`），运行期由渲染层的 `surface0` 覆盖回写；两条路径的深色值一致（`#181B1A`）。

### 3.5 `nativeTheme.themeSource` —— 核实结论

**全仓未对 `nativeTheme.themeSource` 做过任何赋值。** 以 `themeSource|nativeTheme\.` 全仓 grep，命中的唯一一处是 `packages/desktop/src/window/window-manager.ts:43` 的 `nativeTheme.shouldUseDarkColors`；没有任何 `setThemeSource` / `themeSource =` 的写入，也没有 `nativeTheme.on("updated", …)` 监听。

由此可确认的后果（不是推测，是这条缺失直接导致的）：

- 系统级外观不跟随应用主题。Electron 原生滚动条、native 控件等由 `nativeTheme.themeSource` 决定走哪套系统外观，paseo 从不设置它，因此用户把系统切到浅色时窗口内的原生滚动条仍是浅色。
- 系统主题运行期变化没有回流。`shouldUseDarkColors` 只在建窗那一刻读一次（`main.ts:679`），没有 `nativeTheme.on("updated")` 订阅，所以系统切换深浅色时已开着的窗口不会重算 `backgroundColor`。
- 这一缺口 paseo 自己绕开了 Web 侧：注入的 `<style>` 直接给滚动条上色，用主题 CSS 变量而不是系统外观——`* { scrollbar-color: …; scrollbar-width: thin }`、thumb 取 `var(--colors-foreground-extra-muted)` 按 40% 混透明、hover 提到 100%、`[data-composer-input] { scrollbar-gutter: stable }`、`[data-overlay-scrollbar="true"]::-webkit-scrollbar { display: none }`（`packages/app/src/styles/install-web-scrollbar-styles.web.ts:16-19,26-33,35-38,40-42`，常量在 `packages/app/src/styles/web-scrollbar.ts:1-3`）。原生侧 `install-web-scrollbar-styles.ts:1-3` 是空函数。

---

## 4. 控件几何与共享词汇

### 4.1 唯一几何来源：`components/ui/control-geometry.ts`（331 行）

三个高度常量是全部按钮、输入、分段控件的基础（`control-geometry.ts:25-28`）：

| 常量 | 值 | 行号 | 说明 |
|---|---|---|---|
| `TIGHT_CONTROL_HEIGHT` | 28 | `:25` | 最紧控件（xs 按钮、xs 分段） |
| `COMPACT_CONTROL_HEIGHT` | 32 | `:26` | sm 按钮、sm 分段、sm 输入 |
| `FIELD_CONTROL_HEIGHT` | 44 | `:27` | md 按钮、md 输入（移动端触控目标） |
| `HEADER_CONTROL_HEIGHT` | 26 | `:28` | 头部内控件，唯一直接导出 |

聚合出口 `CONTROL_HEIGHTS = { tight, compact, field }`（`:45-49`），按钮高度由它映射（`buttonControlHeight`，`:51-56`：`xs→tight`、`sm→compact`、`md/lg→field`）。这是这份文件最值得抄的地方：行高不自己写，从控件高度反推。

其余几何：

- 图标尺寸不做本地常量，直接引用 `ICON_SIZE`（`buttonIconSize`，`:58-63`；`segmentedIconSize`，`:65-69`）。
- 开关：`switchGeometry`（`:71-76`）`trackWidth 34`、`trackHeight 20`、`thumbSize 16`，`thumbTravel` 用公式算出（`34 - 16 - (20 - 16) = 14`），不手填。
- focus ring：`CONTROL_FOCUS_RING_WIDTH = 2`（`:35`）、`CONTROL_FOCUS_RING_OFFSET = 1`（`:36`），用在 `controlActive` 的 `outlineWidth/outlineOffset`（`:283-285`），focus ring 颜色单独走 `controlFocusRingColor`（`:289-291`）。
- hover 只改边框色（`controlHover` → `theme.colors.borderAccent`，`:277-279`），active 才是 ring。也就是说 paseo 的视觉焦点是「边框变强调色」，不是背景色。
- 输入框内边距由函数算，不是常量：`fieldVerticalPadding(controlHeight, lineHeight, borderWidth)`（`:82-88`），行高 = `round(fontSize * 1.4)`（`:78-80`，`FIELD_TEXT_LINE_HEIGHT_RATIO` 在 `:37`）。`createControlGeometry(theme)`（`:189-`）据此产出 `fieldControlSm`（minHeight 32、横向 padding `spacing[3]`、圆角 `borderRadius.md`，`:193-202`）与 `fieldControlMd`（minHeight 44、横向 `spacing[4]`、圆角 `borderRadius.lg`，`:203-212`）。
- 交互相位收敛成一个枚举：`ControlInteractionPhase = "rest" | "hover" | "active"`（`:7`），由 `getControlInteractionPhase`（`:139`）与 `resolveControlInteractionStyles`（`:147`）分发，组件不自己写三套样式。
- 禁用态统一 `opacity: theme.opacity[50]`（`controlDisabled`，`:293-295`）。

### 4.2 密度阶梯：`styles/density.ts`（不是 `components/ui/density.ts`，后者只有图标 `density-icon.tsx`）

关键设计：普通 theme token 永远桌面尺寸，只有显式「摸到 density 的表面」才随断点变（`density.ts:4-9` 注释）。数值都是 Unistyles 断点值 `{ xs, md }`，`md` 起即桌面（`:17-19` `byLayout`）。

| 名称 | compact(xs/sm) | desktop(md+) | 行号 |
|---|---|---|---|
| `density.rowHeight`（列表行，如侧栏条目） | 44 | 36 | `density.ts:24` |
| `density.tightRowHeight`（紧凑组内行） | 36 | 28 | `density.ts:26` |
| `density.iconButton`（行内/工具栏方形图标钮） | 44 | 28 | `density.ts:28` |
| `COMPACT_ICON_SIZE` | xs 14 / sm 18 / md 20 / lg 24 | 取 `ICON_SIZE` | `density.ts:15` |

配套：`densityIconBox(size)`（`:32-34`）、`densityIconSize(rt, size)`（`:36-38`）、`densityIconProps(size, mapping)`（`:41-`）把断点判断从组件里挪走。紧凑判定函数在 `constants/layout.ts:37-` `isCompactBreakpoint`（`xs` 或 `sm`）。

对本项目的意义：`.icon-btn` 30px（`styles.css:343-351`）这个裸值就属于该进 `density` 表的东西——它现在既不是 28 也不是 44，跟两侧都对不上。

### 4.3 布局常量：`constants/layout.ts`

| 常量 | 值 | 行号 |
|---|---|---|
| `FOOTER_HEIGHT` | 75 | `layout.ts:4` |
| `HEADER_INNER_HEIGHT` / `_MOBILE` | 36 / 56 | `:9-10` |
| `WORKSPACE_SECONDARY_HEADER_HEIGHT` | 36 | `:11` |
| `COMPACT_FORM_FACTOR_WIDTH` | 500 | `:14` |
| `SETTINGS_DESKTOP_SIDEBAR_WIDTH` | 320 | `:18` |
| `SETTINGS_DESKTOP_DETAIL_MIN_WIDTH` | 400 | `:19` |
| `SETTINGS_DESKTOP_SPLIT_MIN_WIDTH` | = 320 + 400（表达式，非字面量） | `:20-21` |
| `DESKTOP_TRAFFIC_LIGHT_WIDTH` / `_HEIGHT` | 78 / 45 | `:25-26` |
| `DESKTOP_WINDOW_CONTROLS_HEIGHT` | = `HEADER_INNER_HEIGHT` | `:29` |

默认窗口尺寸不在这里，在 `packages/desktop/src/window/window-manager.ts:79-80`：`DEFAULT_WINDOW_WIDTH = 1200`、`DEFAULT_WINDOW_HEIGHT = 800`。

设置页的两条注释说明了为什么锁死数字：侧栏 + 详情要能一起放下，才能和主导航分宽度（`layout.ts:16-17`）。`supportsDesktopPaneSplits()` 依赖 dnd-kit 与 DOM 无障碍助手，所以窄屏触控平板走桌面外壳但不走分栏路径（`layout.ts:53-`）。

### 4.4 设置页词汇：`styles/settings.ts`（64 行，单个 `settingsStyles` 对象）

全部条目在 `settings.ts:3-63`：`section`（下边距 `spacing[6]`，`:4-6`）、`sectionHeader`（flex row + space-between + 下边距 `spacing[3]`，`:7-13`）、`sectionHeaderTitle`（`foregroundMuted` + `fontSize.sm`，`:14-18`）、`sectionHeaderLink` / `sectionHeaderLinkText`（`:19-27`）、`card`（`surface1` 底 + `borderRadius.lg` + `borderWidth: 1` + `border` 边 + `overflow: hidden`，`:28-34`）、`row`（flex row + space-between + 纵向 `spacing[4]` 横向 `spacing[4]`，`:35-41`）、`rowBorder`（只加 `borderTopWidth: 1`，靠 `overflow:hidden` + 卡片圆角裁切，`:42-45`）、`rowContent`（`:46-49`）、`rowTitle`（`fontSize.base`，`:50-53`）、`rowHint`（`fontSize.sm` + `foregroundMuted`，`:54-58`）、`rowError`（`fontSize.sm` + `statusDanger`，`:59-62`）。

要点：行分隔线不是每行画 border，而是 `rowBorder` 只加 `borderTopWidth`，首行不加；这与本项目 `.tab` 每项自带 `border-bottom: 2px solid transparent`（`styles.css:847`）的做法不同——本项目用透明边占位防抖动，paseo 用首行豁免，两种都能避免 1px 抖动。

### 4.5 共享 primitive 清单（`packages/app/src/components/ui/`，已逐个确认存在）

全部存在：`button.tsx`、`form-field.tsx`、`floating.tsx`、`tooltip.tsx`、`switch.tsx`、`segmented-control.tsx`、`search-field.tsx`、`select-field.tsx`、`status-badge.tsx`、`loading-spinner.tsx`、`press-highlight.tsx`（+ `press-highlight.types.ts` / `.shape.ts` / `.native.tsx`）、`shortcut.tsx`、`hover-card.tsx`。

combobox 一族：`combobox.tsx`、`combobox-trigger.tsx`、`combobox-frame-style.ts`、`combobox-keyboard.ts`、`combobox-options.ts`（另有 `autocomplete.tsx` / `autocomplete-popover.tsx` / `autocomplete-utils.ts`）。

menu 一族（`components/ui/menu/`）：`menu-root.tsx`、`menu-sub.tsx`、`menu-item.tsx`、`menu-surface.tsx`、`menu-overlay.tsx`、`menu-context.ts`、`menu-geometry.ts`、`menu-navigation.ts`、`menu-sheet-layout.tsx`、`index.ts`。

同层还有 `alert.tsx`、`context-menu.tsx`、`dropdown-menu.tsx`、`dropdown-trigger.tsx`、`scroll-view.tsx` / `scroll-view.web.tsx`、`floating-action-button.tsx`、`floating-action-layout.ts`、`pane-content-toolbar.tsx`、`icon-button-chrome.ts`、`external-link.tsx`。

两个跨模块宿主：`components/adaptive-modal-sheet.tsx`（配套 `adaptive-modal-sheet-layout.ts`）与 `components/toast-host.tsx`——后者 `DEFAULT_DURATION_MS = 2200`（`toast-host.tsx:54`，默认路径 `:83`）。

注意：`floating.tsx` 是 Floating UI 的 RN 封装，本项目在浏览器里直接用 DOM + CSS，忽略此项。

---

## 5. Composer 交互契约

### 5.1 Enter 判定顺序（`composer/input/input.tsx:407-438`，`handleDesktopKeyPressImpl`）

严格按代码顺序，一条不落：

1. **IME 合成优先**：`isImeComposingKeyboardEvent(event.nativeEvent)` 为真直接 return，不吞键也不发送（`:411`）。中文输入法选词时的 Enter 不会被当发送。
2. **弹层/调用方吞键**：`ctx.onKeyPressCallback` 存在时先给它，`handled` 为真就 return（`:413-421`）。菜单、补全等弹层可以先于 composer 拿走 Enter。
3. **非 Enter、非 submitOnEnter、Shift 换行** 三连提前 return（`:423`、`:424`、`:426`）。
4. **运行时 `Cmd/Ctrl+Enter` 走 alternate**：仅当 `(metaKey || ctrlKey) && isAgentRunning && onQueue` 时命中，且要求 `!isSubmitDisabled && !isSubmitLoading && !disabled`，命中后 `preventDefault()` 并调 `handleAlternateSendAction()`（`:428-433`）。也就是运行中才有 alternate 这条路。
5. **发送中忽略**：`isSubmitDisabled || isSubmitLoading || disabled` 时 return（`:435`）。
6. **默认发送**：`preventDefault()` + `handleDefaultSendAction()`（`:436-437`）。

上下文契约类型 `DesktopKeyPressContext` 在 `:396-405`。

### 5.2 队列与审批强制打断

`composer/input/state.ts:7` 定义 `SendBehavior = ActiveTurnBehavior | "queue"`。`resolveActiveSendBehavior(sendBehavior, hasPendingPermission)`（`state.ts:9-16`）：当用户选择 `"queue"` 而当前有 `hasPendingPermission` 时，一律改回 `"interrupt"`。

含义：待审批期间不允许排队，否则批准后用户要等一条被自己遗忘的排队消息。覆盖点在数据流入口，不依赖 UI 禁用。

本项目 `InstructionComposer.tsx:78-91` 只有「运行中 + Cmd/Ctrl+Enter + 非 Shift + 非 IME + canSend → `aui.composer.send()`」，无队列概念；`InstructionComposer.tsx:99` 注释明确「指令由内核持久受理，执行中也直接发送，不另设浏览器队列」。这是刻意的产品决定，不是缺口——若将来要队列，5.2 的规则值得先抄。

### 5.3 运行中发送键变取消键

`composer/index.tsx:2377`：`const submitLoadingPressHandler = isAgentRunning ? handleCancelAgent : undefined;` —— 同一个按钮位置，运行中按下即取消，不切图标语义。

### 5.4 Escape 中断

`keyboard/keyboard-shortcuts.ts:1139-1151`：`{ id: "agent-interrupt", action: "agent.interrupt", combo: "Escape", when: { commandCenter: false, focusScope: ["message-input", "other"] }, preventDefault: false, stopPropagation: false }`，带 `help` 段 `agent-input` / `label: "Interrupt agent"`（`:1146-1150`）。

三个要点：`when` 门控排除命令面板打开时；`focusScope` 允许在输入框与其他区域触发；`preventDefault/stopPropagation` 都为 false，即不吞键，只是额外监听。帮助文案 id 在 `:249`。

### 5.5 提交失败回填输入与附件

`composer/submit.ts:26-81` `submitAgentInput`。顺序：

1. `message.trim()`，附件原样取出（`:32-33`）。
2. 空消息 + 无附件 + 无外部内容 + 不许空提交 → `"noop"`（`:36-42`）；`canSubmit` 为假同样 `"noop"`（`:44-46`）。
3. 运行中且未 `forceSend` → `queueMessage(...)`，按 `submitBehavior` 决定是否清草稿，返回 `"queued"`（`:48-56`）。
4. 立即清空输入与附件 + 清 sendError + 置 processing（`:59-63`，注释说明为了让时间线行与 composer 状态同步）。
5. 成功：`clearDraft("sent")`、processing 归零、返回 `"submitted"`（`:65-70`）。
6. 失败：`onSubmitError?.(error)`，**把 `trimmedMessage` 与原附件写回**，设置 sendError（错误优先用自己的 `message`，否则 i18n key `composer.errors.failedToSend`），返回 `"failed"`（`:71-79`）。

结果类型 `AgentInputSubmitResult = "noop" | "queued" | "submitted" | "failed"`（`submit.ts:3`）。附件在失败时原样回填这一点，本项目 `InstructionComposer` 走 SDK 内部实现，未核实是否等价——`unverified — 需确认`。

---

## 6. Agent 流渲染契约

### 6.1 虚拟化阈值与常驻窗口

- `DEFAULT_WEB_PARTIAL_VIRTUALIZATION_THRESHOLD = 100`（`agent-stream/web-virtualization.ts:10`）。条目少于阈值时不做部分虚拟化。
- `DEFAULT_MOUNTED_RECENT_STREAM_ITEMS = 20`（`agent-stream/history-window.ts:3`），web 侧别名导出在 `web-virtualization.ts:11`。
- 两个阈值都可被 E2E 全局变量覆写：`__PASEO_E2E_WEB_PARTIAL_VIRTUALIZATION_THRESHOLD`（`web-virtualization.ts:26-31`）、`__PASEO_E2E_WEB_MOUNTED_RECENT_STREAM_ITEMS`（`history-window.ts:16-22`），读出值必须为正整数否则忽略（守卫 `web-virtualization.ts:18-24` / `history-window.ts:9-14`）。测试注入点做得干净。
- 窗口起点 `findMountedWindowStart`（`history-window.ts:25-40`）：先取 `length - minMountedCount`，再**向前回退到最近的 `user_message`**，保证常驻窗口从一条完整用户消息开始，不会把一条助手消息劈成两半。这是这段最该抄的一行逻辑。
- 切分 `splitWebVirtualizedHistory`（`web-virtualization.ts:86-97`）返回 `{ virtualizedEntries, mountedEntries }`。

### 6.2 行高估算表（`web-virtualization.ts:58-82`）

| item.kind | 估算 px | 行号 |
|---|---|---|
| `user_message` 带图 | 220 | `:59-60` |
| `user_message` 无图 | 96 | `:59-60` |
| `assistant_message` | 走 `estimateAssistantMessageHeightFromCache({ markdown, contentMaxWidth, imageContext })`，未命中回落 220 | `:61-68` |
| `tool_call` | 40（`COLLAPSED_TOOL_SEQUENCE_ROW_HEIGHT_ESTIMATE`，`:12`） | `:69-70` |
| `thought` | 40 | `:71-72` |
| `todo_list` | 144 | `:73-74` |
| `notification` | 88 | `:75-76` |
| `compaction` | 72 | `:77-78` |
| 兜底 | 120 | `:79-80` |

助手消息用「按 markdown 文本 + 内容宽度缓存估算」，不是固定值——这是虚拟化在可变高度内容上能落地的前提。

### 6.3 底部锚点

模式枚举 `BottomAnchorMode = "sticky-bottom" | "detached"`（`agent-stream/bottom-anchor-controller.ts:4`）。请求来源也分类（`:6-15`）：路由级 `initial-entry` / `resume`，本地级 `jump-to-bottom` / `message-sent` / `rewind`。阻塞原因枚举四条（`:17-22`）：等待历史就绪、等待可测视口、等待可测内容、等待布局后复验——说明它承认「DOM 尚未可量」是常态。

`USER_SCROLL_AWAY_DELTA_PX = 24`（`:113`），用在 `shouldDetachFromScrollAway`（`:705-721`）：`|scrollDelta| >= 24` 判为「用户主动滚开」。脱离条件还要同时满足仍在 `sticky-bottom`、已不近底部、无待处理请求、无待复验，以及「没有未复验的 sticky 测量变化，或者这次确实是用户滚的」（`:713-720`）。

配套常量：`MAX_VERIFICATION_RETRIES = 3`（`:111`）、`WEB_PARTIAL_VIRTUALIZED_CONFIRMATION_DELAY_FRAMES = 1`（`:112`）。sticky 模式只在内容变高时才吸底（`:699-703` `contentHeight > previousContentHeight`）。控制器共 826 行，是这批文件里最重的单文件。

### 6.4 逐字显示节流

`agent-stream/text-reveal.ts`：`TEXT_REVEAL_HORIZON_MS = 150`（`:21`），积压在 150ms 内摊完；`TEXT_REVEAL_FRAME_INTERVAL_MS = 1000 / 60`（`:24`）——即便 120Hz 屏也每帧最多揭示一次；`MAX_ELAPSED_MS = 250`（`:29`）钳制长卡顿，避免后台标签页回来时一步跳完。

`computeRevealStep({ backlog, elapsedMs, horizonMs })`（`:36-62`）：步长 = `ceil(backlog * elapsed / horizon)`，带 1 字符下限，保证尾巴一定收完；`elapsed >= horizon` 时一次放完。

分字用 `Intl.Segmenter`，`granularity: "grapheme"`，`typeof Intl.Segmenter === "function"` 才实例化，否则降级为 null（`:65-68`），并有 `segmentAt`-style helper（`:95` `graphemeSegmenter?.segment(text).containing(index)`）。emoji 与组合字符不会从中间切开。

文件头注释（`:1-16`）点明分工：store 存全文，只节流**渲染切片**，复制、选区、outline、滚动几何都不受影响。这条边界要抄。

### 6.5 工具调用展示投影

`tool-calls/presentation.ts`：`ToolCallPresentation` 接口（`:28-40`）把原始 tool call 投影成纯展示数据——`displayName`、`summary?`、`errorText?`、`icon`、`isLoadingDetails`、`hasDetails`、`canOpenDetails`、`openFilePath`、`isPlan`、`planOutcome?`。

`buildToolCallPresentation(input)`（`:55-`）做归一：`displayStatus` 把 `executing` 映射为 `running`（`:46-48`），`displayDetail` 用 `{ type: "unknown", input: null, output: null }` 填缺失 detail（`:50-52`），再交给 `buildToolCallDisplayModel`，并用 `isPendingToolCallDetail` 判定加载态。图标通过 `ToolCallIconResolver`（`:42-45`，`resolveIcon: (toolName, detail) => ComponentType`）注入，所以 presentation 层不含 React 组件选择逻辑之外的东西，可单测（有 `presentation.test.ts`）。

### 6.6 审批卡

`agent-stream/view.tsx:1410` `PermissionRequestCard({ permission, client })`。用 `useIsCompactFormFactor()` 分移动/桌面（`:1418`）。响应走 mutation，`client.respondToPermissionAndWait(agentId, requestId, response, 15000)`（`:1490`）——**15 秒超时**，等待主进程应答而非本地乐观更新。失败只 `console.error`（`:1513`），不打断对话。`useEffect` 在 `permission.request.id` 变化时重置 mutation 与 `respondingActionId`（`:1503-1507`），避免上一张卡片的 pending 态串到下一张。

---

## 7. 可迁移做法

| paseo 做法（路径:行） | 本项目现状（路径:行） | 迁移建议 |
|---|---|---|
| token 单一来源 + 派生规则：几何、阴影、字号全部从 `theme.ts` 派生，控件高度由 `CONTROL_HEIGHTS` 映射而非各组件自填（`components/ui/control-geometry.ts:45-56`、`styles/density.ts:24-28`） | `styles.css` 是唯一颜色事实源（`:root` 7-53），但尺寸全是裸值：`.icon-btn` 30×30（`styles.css:343-351`）、`.icon-btn--sm` 24×24（`:360-363`）、`.send-btn` 28×28（`:479-488`）、`.tab` padding 6px 10px / font 13px（`:838-851`）。文档表 `docs/ui-design/README.md:181-198` 只列了 16 项 token，代码里有 22 个色/阴影 token，6 个（`--pill-neutral-bg`、`--diff-add-bg`、`--diff-remove-bg`、`--shadow-card`、`--handle-hover`、`--handle-active`）未进文档 | 尺寸抽一层 `--control-height-*` / `--row-height` 常量（或一个 `control-geometry.ts` 等价模块），由行高反推而非各处自填；同时把 6 个漏记 token 补进 `docs/ui-design/README.md` 的表。字号目前全是裸 px，可与几何一并集中 |
| 控件几何集中常量：28/32/44 三档 + focus ring 2px/offset 1 + 开关 34×20/16 + hover 只改边框色（`control-geometry.ts:25-36`、`:71-76`、`:277-291`） | 无几何层，尺寸散在选择器里（同上）；focus 态未见集中定义；`.send-btn` 28px 与 `.icon-btn` 30px 并存，两级之间没有中间档 | 先补一个 `--control-height-{tight,compact,field}` 三档，把 `.icon-btn` / `.icon-btn--sm` / `.send-btn` 映射进去；focus ring 用 `outline` + `outline-offset` 统一一条规则，而不是每处写 box-shadow |
| 设置行/卡词汇：`sectionHeader / card / row / rowBorder / rowTitle / rowHint / rowError` 七个共享样式（`styles/settings.ts:7-62`） | 无共享层。`docs/ui-design/README.md:150-177` 只有组件规格散文；`docs/ui-design/README.md:214-248` 的留白清单里「权限审批弹窗」「diff 审阅面板」尚无表达方式 | 抽一组 `.row / .card / .row__title / .row__hint` 类名。paseo 的 `rowBorder` 只加 `borderTopWidth`、首行豁免，配合 `overflow: hidden` + 圆角裁切，比本项目逐条画边更省一条规则 |
| composer 队列与审批强制打断：`SendBehavior "queue"` 在 `hasPendingPermission` 时强制降级为 `"interrupt"`（`composer/input/state.ts:9-16`）；Enter 判定 6 步有序（`composer/input/input.tsx:407-438`）；运行中发送键即取消键（`composer/index.tsx:2377`）；失败回填文本与附件（`composer/submit.ts:71-79`） | `InstructionComposer.tsx:78-91` 只有单一 Enter 分支（Cmd/Ctrl+Enter + 运行中 + canSend）；`InstructionComposer.tsx:99` 注释明确不设浏览器队列，指令由内核持久受理；无失败回填路径（走 SDK） | 本项目队列是显式产品决定，不必推翻。但 6 步判定顺序值得照抄成有序表：IME 优先、弹层吞键、Shift 换行、alternate、发送中忽略、默认发送——尤其 IME 优先（`:411`）与弹层吞键（`:413-421`）两条，本项目当前靠 SDK 实现，等价性 `unverified — 需确认`。失败回填附件这点值得单独核 |
| agent 流虚拟化与底部锚点：阈值 100、常驻 20 条且窗口起点回退到 `user_message`（`agent-stream/web-virtualization.ts:10`、`agent-stream/history-window.ts:3,27-39`）；底部锚点 `sticky-bottom`/`detached` 两态、`USER_SCROLL_AWAY_DELTA_PX 24` 区分主动滚开（`agent-stream/bottom-anchor-controller.ts:4,113,705-721`） | 未虚拟化：`AgentOverlay.tsx:126` 直接 `<ThreadPrimitive.Messages />`，`:118` 一个 `Viewport` 承担滚动；`AgentDock.tsx:13-22` 只读最后一条做预览 | 优先抄 `findMountedWindowStart` 的「窗口起点对齐到用户消息」这一条逻辑，成本低、收益直接。完整虚拟化等消息量真的成为问题再做；底部锚点两态模型在有审批卡打断滚动之前不必引入 |
| 每面板至多 3 个常驻 tab：`useMountedTabSet({ activeTabId, allTabIds, retainedTabIds, cap: 3 })`（`screens/workspace/workspace-panel-host.tsx:110-115`，渲染 `mountedIds` 于 `:116-134`） | `workbench/shell/TabGroups.tsx` 无常驻集合：只按 `group.activeId` 找当前 tab（`:138`），正文区只渲染 `active`（`:182-213`），其余 tab 完全卸载 | 本项目是「只渲染 1 个」，比 paseo 的「≤3」更省内存，但也丢掉了 tab 间的滚动/输入状态保留。若日后要保留状态，直接采用 `cap: 3` 的常量上限而不是无限增长 |
| preload 沙箱边界测试：`preload-sandbox.test.ts:11` 定义 `SANDBOX_ALLOWLIST = new Set(["electron"])`，用 TypeScript AST 遍历 `preload.ts` 收集**运行时**模块说明符（`:17-`），type-only 导入被擦除故忽略（`:35-48`）；`preload.ts:5-10` 注释记录了 0.1.108 因沙箱内 `require` 本地模块导致 `window.paseoDesktop` 为 undefined 的事故 | `apps/desktop/src/preload/index.ts` 全文 8 行，只有 `contextBridge.exposeInMainWorld`（`:4`）暴露 `platform` / `bootstrap` / `openExternal`；**无对应边界测试**（`apps/desktop/src/preload/` 下仅 `index.ts`） | 抄这个测试：它不测运行时行为，静态断言 preload 不产生 electron 之外的运行时 import，回归成本极低。本项目 preload 一旦加入本地工具模块就会踩同一个坑 |
| 窗口状态 400ms debounce：`WINDOW_STATE_SAVE_DEBOUNCE_MS = 400`（`packages/desktop/src/window/window-manager.ts:16`），`scheduleSave` 先 capture 再 clear + `setTimeout`（`:276-282`），最小化/全屏时不 capture（`:256-258`），最大化立即写、关闭与 `before-quit` 同步 flush（`:236` 函数注释、`:292-` `flushFinal`） | 未核实窗口状态持久化实现——`unverified — 需确认` | 若本项目也持久化窗口几何，直接照抄三个细节：debounce 常量化、最小化/全屏跳过 capture、关闭与 `before-quit` 双路径同步 flush。最后一条最容易漏 |

补充可迁移点（未列入上表但同源）：

- 交互相位枚举 + `resolveControlInteractionStyles`（`control-geometry.ts:7,139,147`）把 rest/hover/active 三态集中，组件不再各写一遍。
- 阈值可被 E2E 全局变量覆写（`web-virtualization.ts:26-31`、`history-window.ts:16-22`），读出值必须为正整数。这是把「调参」与「生产代码」分开的干净手法。
- 展示投影层（`tool-calls/presentation.ts:55-`）纯数据、无组件，天然可单测。

---

## 8. 不可直接迁移

| paseo 做法 | Electron + Web 下的等价做法 / 结论 |
|---|---|
| `StyleSheet.create((theme) => ({...}))`（`styles/settings.ts:3`、`control-geometry.ts:189`） | 本项目用 HTML/CSS 原生，忽略此项。等价约束只有一个：几何与配色仍需单一来源，本项目对应 `styles.css` 的 CSS 变量，不必引入运行时样式对象 |
| FlatList / 部分虚拟化列表（`web-virtualization.ts:10`、`history-window.ts:25-40`） | 用 `IntersectionObserver` + 固定高度估算，或直接 CSS `content-visibility: auto`。行高估算表（`web-virtualization.ts:58-82`）可原样抄成 TS 常量，它与框架无关 |
| `react-native-draggable-flatlist`（`packages/app/package.json:115`） | 拖拽排序用 HTML5 drag event 或 `@dnd-kit` 一类库；本项目当前无拖拽列表需求，忽略 |
| `@gorhom/bottom-sheet`（`package.json:56`） | 用 CSS `transform: translateY` + `transition`，配合 `overscroll-behavior: contain`；抽屉手势在 Web 上另需 pointer events 实现 |
| Reanimated（`package.json:121`） | Web 用 CSS transition / WAAPI。唯一与它有关的可迁移结论见第 9 节 reduced motion |
| `accessibilityRole` / `accessibilityLabel`（如 `composer/index.tsx:2381` 的 `accessibilityRole="alert"`） | 本项目用 `role` / `aria-label` / `aria-live`。注意 `AgentOverlay.tsx:118` 已用 `aria-live="polite"`，方向一致 |
| i18n key（`composer/submit.ts:77` `i18n.t("composer.errors.failedToSend")`、help 文案 `keyboard-shortcuts.ts:249`） | 本项目当前是中文单语，`unverified — 需确认` 是否有 i18n 层。若要引入，文案收口的位置应与 token 收口同批做，不要在组件里散写 |

---

## 9. 差距清单

| 能力 | paseo | Scholoom | 影响 | 建议（方向，不排期） |
|---|---|---|---|---|
| 列表部分虚拟化 | 阈值 100 + 常驻 20，窗口起点回退到 `user_message`（`web-virtualization.ts:10`、`history-window.ts:25-40`） | 未虚拟化，`ThreadPrimitive.Messages` 全量渲染（`workbench/shell/AgentOverlay.tsx:126`） | 长会话首屏与滚动成本随消息数线性增长 | 引入 `IntersectionObserver` 方案；先只搬「窗口起点对齐用户消息」的逻辑 |
| 底部锚点 | `sticky-bottom`/`detached` 两态 + 24px 主动滚开阈值 + 4 类阻塞原因（`bottom-anchor-controller.ts:4,17-22,113,705-721`） | 无；滚动交给 `ThreadPrimitive.Viewport`（`AgentOverlay.tsx:118`） | 审批卡插入、流式输出时滚动位置不可控 | 审批/失败态进入本项目（见 `docs/ui-design/README.md:214-248` 留白）时一并引入，否则暂不需要 |
| 设置页共享词汇 | `section/card/row/rowTitle/rowHint/rowError` 七件套（`styles/settings.ts:7-62`） | 无共享层，仅散文规格（`docs/ui-design/README.md:150-177`） | 「权限审批弹窗」「Skills 插件管理页」等留白项落地时会各写各的 | 抽 `.card` / `.row` 系列类名，作为留白项落地的前置 |
| 快捷键注册表 | 声明式表 + `ShortcutWhen` 门控（`keyboard/keyboard-shortcuts.ts:69-82`，`mac` / `desktop` / `editable` / `terminal` / `commandCenter` / `focusScope`）+ 每条带 `help`（`:109`、`:113-115`） | 未核实存在集中快捷键表，`unverified — 需确认` | 快捷键行为、帮助文案分散时无法统一门控与重绑定展示 | 若要引入，照抄 `ShortcutWhen` 的字段设计——尤其 `editable: false` 与 `focusScope` 两条门控 |
| reduced motion | `useReducedMotion()` 仅两处：`agent-stream/chat-outline/rail.web.tsx:33`（用于 `:100` 抑制放大动画）、`components/synced-loader.tsx:97`。**全仓无 `prefers-reduced-motion`** | `styles.css:401-405` 有 `@media (prefers-reduced-motion: reduce)`，但只关掉 `.dot--run` 一条动画 | 两侧都不完整：paseo 缺 CSS 媒体查询，本项目 CSS 覆盖更窄 | 本项目方向更对（CSS 媒体查询覆盖所有声明式动画），只需把范围补全到全部 keyframes；`unverified — 需确认` 是否存在 JS 驱动的动画需另加开关 |
| 常驻 tab 上限 | `cap: 3`（`screens/workspace/workspace-panel-host.tsx:114`） | 只渲染当前 tab（`workbench/shell/TabGroups.tsx:138,182-213`） | 本项目更省内存，但 tab 切换不保留内部状态 | 若要保留状态，照抄 `cap` 常量上限，不做无限常驻 |
| 控件几何单一来源 | `CONTROL_HEIGHTS` 三档 + `density` 表（`control-geometry.ts:45-56`、`styles/density.ts:24-28`） | 裸 px 散落（`styles.css:343-351,360-363,479-488,838-851`） | 改密度要逐处改，易出 30/28 并存 | 加 CSS 变量三档，行高由其反推 |

---

## 10. 路径索引

| 主题 | 文件:行 |
|---|---|
| 控件高度三档 | `packages/app/src/components/ui/control-geometry.ts:25-28`、`:45-49` |
| 按钮高度/图标映射 | `control-geometry.ts:51-56`、`:58-63`、`:65-69` |
| 开关几何 | `control-geometry.ts:32-34`、`:71-76` |
| focus ring | `control-geometry.ts:35-36`、`:277-291` |
| 输入框内边距计算 | `control-geometry.ts:37`、`:78-87`、`:189-213` |
| 交互相位 | `control-geometry.ts:7`、`:139`、`:147` |
| 密度阶梯 | `packages/app/src/styles/density.ts:15`、`:24`、`:26`、`:28`、`:32-41` |
| 紧凑断点判定 | `packages/app/src/constants/layout.ts:37-` |
| 头部/设置/交通灯常量 | `constants/layout.ts:4`、`:9-11`、`:14`、`:18-21`、`:25-26`、`:29`、`:56-58` |
| 默认窗口尺寸 | `packages/desktop/src/window/window-manager.ts:79-80` |
| 窗口状态 debounce | `window/window-manager.ts:16`、`:236-241`、`:256-258`、`:276-282`、`:292-` |
| preload 沙箱约束 | `packages/desktop/src/preload.ts:5-10` |
| preload 沙箱测试 | `packages/desktop/src/preload-sandbox.test.ts:11`、`:17-`、`:35-48` |
| 设置页词汇 | `packages/app/src/styles/settings.ts:3-63` |
| Toast 默认时长 | `packages/app/src/components/toast-host.tsx:54`、`:83` |
| Enter 判定 | `packages/app/src/composer/input/input.tsx:396-405`、`:407-438` |
| 队列/审批降级 | `composer/input/state.ts:7`、`:9-16` |
| 发送键变取消键 | `composer/index.tsx:2377` |
| Escape 中断 | `packages/app/src/keyboard/keyboard-shortcuts.ts:1139-1151`、`:249` |
| 快捷键门控类型 | `keyboard/keyboard-shortcuts.ts:69-82`、`:109`、`:113-115` |
| 提交结果与失败回填 | `packages/app/src/composer/submit.ts:3`、`:26-42`、`:48-56`、`:59-79` |
| 虚拟化阈值 | `packages/app/src/agent-stream/web-virtualization.ts:10-11`、`:26-31` |
| 常驻窗口起点 | `agent-stream/history-window.ts:3`、`:16-22`、`:25-40` |
| 窗口切分 | `web-virtualization.ts:86-97` |
| 行高估算表 | `web-virtualization.ts:12`、`:58-82` |
| 底部锚点模式 | `agent-stream/bottom-anchor-controller.ts:4`、`:17-22` |
| 主动滚开阈值 | `bottom-anchor-controller.ts:111-113`、`:699-703`、`:705-721` |
| 逐字显示节流 | `agent-stream/text-reveal.ts:21`、`:24`、`:29`、`:36-62`、`:65-68`、`:95` |
| 工具调用展示投影 | `packages/app/src/tool-calls/presentation.ts:28-45`、`:47-53`、`:55-` |
| 审批卡 | `agent-stream/view.tsx:1410`、`:1418`、`:1490`、`:1503-1513` |
| 常驻 tab 上限 | `packages/app/src/screens/workspace/workspace-panel-host.tsx:104-115`、`:116-134` |
| reduced motion（仅两处） | `agent-stream/chat-outline/rail.web.tsx:33`、`:100`；`components/synced-loader.tsx:97` |
| RN 专有依赖 | `packages/app/package.json:56`、`:115`、`:121`、`:126` |
| 本项目 preload | `apps/desktop/src/preload/index.ts:1-8` |
| 本项目 tab 组 | `apps/desktop/src/renderer/src/workbench/shell/TabGroups.tsx:138`、`:142-151`、`:182-213` |
| 本项目消息区 | `apps/desktop/src/renderer/src/workbench/shell/AgentOverlay.tsx:118`、`:126` |
| 本项目 composer | `apps/desktop/src/renderer/src/workbench/shell/InstructionComposer.tsx:78-91`、`:99` |
| 本项目 token 与尺寸 | `apps/desktop/src/renderer/src/styles.css:7-53`、`:136-195`、`:343-351`、`:360-363`、`:401-405`、`:479-488`、`:838-851` |
| 本项目 token 文档表（16 项 vs 代码 22 项） | `docs/ui-design/README.md:181-198` |
| 本项目组件规格 / 留白清单 | `docs/ui-design/README.md:150-177`、`:214-248` |

---

## 附录：复核方法

```bash
# 切到 submodule
git submodule update --init references/paseo && git -C references/paseo rev-parse --short HEAD   # 5c2a155

# 技术栈
grep -n "unistyles" references/paseo/packages/app/package.json
find references/paseo -maxdepth 2 -name 'tailwind.config*'          # 无输出
grep -n '"build' references/paseo/packages/desktop/package.json    # build:main = tsc -p tsconfig.json

# token
grep -n "^export const\|^export function\|^const \|^function " references/paseo/packages/app/src/styles/theme.ts
grep -rn "from \"@/constants/theme\"" references/paseo/packages/app/src   # 无输出

# motion 散落
grep -rn "duration: [0-9]\+" references/paseo/packages/app/src --include=*.tsx | grep -v test

# themeSource
grep -rn "themeSource" references/paseo                              # 无输出
grep -rn "nativeTheme\." references/paseo/packages                  # 仅 window-manager.ts:43

# 本项目对照
sed -n '1,10p' apps/desktop/src/preload/index.ts
sed -n '70,80p' apps/desktop/src/main/index.ts
grep -n '"build"\|"dev"' apps/desktop/package.json
```

---


