# Orca UI 路径：Windows 本机验证

验证日期：2026-10-11。续接 [UI 开发协作讨论](ui-centered-development-continuation.md)，在本机恢复现有 [交互原型](orca-ui-path-prototype.md)。用户手动打开页面后，本机交互、HMR、自动截图与随消息发送的结构化标注均已验证；输入框大小的用户体验确认待用户反馈。

## 本机环境与恢复

- 项目路径：`D:/Workspace/Code/JavaScript/Scholoom`。
- Orca：1.4.219，CLI 位于 `C:/Users/leike/AppData/Local/Programs/orca/resources/bin/orca.exe`。
- `orca worktree current --json` 返回本项目，执行主机为 `local`；`orca status --json` 返回本地目标、运行中的桌面窗口和 ready 运行时。
- Node：v24.11.0；pnpm：11.10.0。
- 初始工作区干净，尚无 `node_modules`，5173 端口没有服务。
- 用户明确批准安装后，`pnpm install --frozen-lockfile` 成功，没有升级依赖或改变锁文件。
- 启动 `pnpm --filter @scholoom/desktop dev:browser --port 5173 --strictPort` 成功；服务监听 `127.0.0.1:5173`，原型入口 HTTP 200。

原型入口：`http://127.0.0.1:5173/?prototype=orca-ui`。服务保留供继续测试；是否仍存活需在后续会话重新核对。

## 浏览器阻塞与已尝试步骤

按当前版本 orca-cli 指南，执行：

```text
orca tab create --worktree path:D:/Workspace/Code/JavaScript/Scholoom --url http://127.0.0.1:5173/?prototype=orca-ui --json
```

返回 `ok: false`、`code: runtime_error`，消息为“当远程运行时处于活动状态时，浏览器选项卡不可用”。本项目 `tab list` 返回空列表。没有将服务可达视为浏览器交互通过。

通过 computer-use 查看 Orca 应用界面，确认本地 Scholoom 工作区存在，界面同时显示已连接的远程主机。新标签菜单提供“新浏览器选项卡”。这与 CLI 拒绝创建本地标签的表现存在矛盾，尚未确认是全局远程模式限制、CLI 路由问题或其他原因。

窗口操作期间前台切到其他项目，已暂停窗口控制，并请用户切回 Local Windows 下的 Scholoom，手动尝试浏览器入口。没有断开远程主机、重启 Orca或改动其配置，也没有向其他项目发送消息或执行命令。

## 本机源码检查

| 检查 | 结果 |
| --- | --- |
| `pnpm build:shared` | 通过 |
| `pnpm --filter @scholoom/desktop typecheck` | 通过 |
| 三份原型文件的默认 `biome check` | 失败：checkout 为 CRLF，formatter 默认要求 LF |
| 同样文件的 `biome check --formatter-enabled=false` | 通过 |
| 同样文件的 `biome check --line-ending=crlf` | 通过；没有写回文件 |

三份文件为 `main.tsx`、`OrcaUiPrototype.tsx` 和 `orca-ui-prototype.css`，均位于 `apps/desktop/src/renderer/src/`。`git config --get core.autocrlf` 返回 `true`；指定换行格式后的检查用于定位原因，没有修改项目的格式契约。

## 手动打开后的实测结果

用户通过链接打开原型，并发送包含元素选择、React 组件、DOM 路径、尺寸、样式与“框大一点”的 Design Feedback。Agent 已收到这份结构化标注，能够直接定位 `textarea#orca-instruction`。实际 `tab show` 的 URL 包含 `?prototype=orca-ui`，反馈头部的根 URL 没有该参数；页面入口以实际标签地址为准。

CLI 可列出并识别这个属于本地 Scholoom 的标签。首次读取页面出现 `runtime_unavailable`；随后确认运行时仍 ready，显式指定本项目 `--worktree` 与实际 `--page` 后重试成功。没有重启或断开远程主机，不能据此认定初始错误的根因已经解决。后续操作均明确指定工作区和标签。

| 行为 | 结果 |
| --- | --- |
| 页面快照与元素定位 | 通过 |
| 空指令与纯空白输入 | 发送禁用；纯空白通过实际填入及页面断言验证 |
| 勾选两份材料并发送 | 输入首尾空白被去除，结果包含两份材料，输入清空 |
| 发送后取消材料 | 结果保持提交时的材料快照 |
| 无材料发送 | 允许提交，最新结果替换前次结果 |
| 重置 | 恢复默认材料，清空草稿和结果 |
| 刷新 | 清空已有结果，恢复默认状态；输入框仍为 6 行 |
| HMR | 临时从 6 行改为 7 行再恢复 6 行；`performance.timeOrigin` 不变，草稿、已有结果和材料选择保留 |
| 自动截图 | 通过；已查看截图，能完整看到标题、材料、输入框与按钮 |
| console／network | 能取得 HMR 消息与资源请求；所检查的 console 条目没有 error，HMR 资源请求为 200 |
| 用户标注随消息传递 | 通过；本轮修改直接依据用户发来的结构化反馈 |

`OrcaUiPrototype.tsx` 的输入框由 `rows={4}` 改为 `rows={6}`，宽度保持面板内自适应；用户原标注高度约 128px，修改后实际测得 179.5625px。最终源码只保留这一行 UI 调整。修改后的定向 Biome 检查、桌面端类型检查及 `git diff --check` 均通过。

页面操作使用 CLI 的 `fill/check/uncheck/click/reload`，状态判断使用页面内断言；不是仅依据操作返回成功。PowerShell 中元素引用以 `'@e7'` 等字符串传递。测试结束恢复默认示例状态，停止 console／network 捕获，保留服务与标签供用户体验。

## 后续讨论边界

日常反馈可以先采用“运行中的 React 原型 → 用户标注随消息发送 → Agent 修改 → 同页验证 → 用户确认体验”。本轮证明了主动发送标注的路径，没有证明 Agent 可以独立轮询未发送的注释，也没有完成用户对输入框大小的最终确认。

没有运行 Electron smoke、全项目检查、三平台验收或 Figma 接入。现有原型仍为固定示例响应，不代表真实科研功能已实现。
