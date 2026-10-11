# Orca UI 交互开发路径：最小原型

验证日期：2026-10-11。用户要求先做简单原型，测试借助 Orca 内置浏览器共同操作和调试的路径。本次仅验证开发工具与前端交互，没有定义新的科研业务契约。

## 入口与实现

```sh
pnpm --filter @scholoom/desktop dev:browser --port 5173 --strictPort
```

在本项目 Orca 浏览器打开 `http://127.0.0.1:5173/?prototype=orca-ui`。原型与 Electron 复用 renderer，但只在开发态通过该参数显示；默认首页保持标题页。

- [OrcaUiPrototype.tsx](../../../apps/desktop/src/renderer/src/OrcaUiPrototype.tsx)：两个示例材料、指令输入、提交时材料快照、固定示例结果和重置。
- [orca-ui-prototype.css](../../../apps/desktop/src/renderer/src/orca-ui-prototype.css)：容器内样式、两栏布局、窄屏单栏及键盘焦点样式。
- [main.tsx](../../../apps/desktop/src/renderer/src/main.tsx)：开发态原型入口。
- [开发说明](../../../docs/development.md)：启动与范围说明。

材料名称仅为示例，未读取文件。结果不由模型生成；只保留最新提交，刷新清空状态。没有安装依赖或创建持久化数据。

## 实测结果

当前 Orca 1.4.222 的运行时可达，浏览器标签页归属当前 Scholoom 工作区。通过 `orca-cli` 技能加载当前版本指南，使用 `tab create/switch`、`snapshot`、`fill`、`check`、`click`、`eval`、`wait`、`console` 与 `network` 操作本项目页面。每次页面结构变化后重新获取快照。

| 行为 | 结果 |
| --- | --- |
| 打开页面、读取语义快照 | 通过；能定位材料复选框、指令输入与按钮 |
| 空指令、纯空白指令 | 发送按钮禁用 |
| 输入、勾选两份材料、发送 | 结果显示实际输入及所选示例材料，输入清空 |
| 发送后取消一份材料 | 已显示结果保留提交时材料快照 |
| 不附加材料发送 | 允许提交，结果显示未附加材料 |
| 重置 | 恢复默认材料，清空指令和结果 |
| 修改组件标题并热更新 | 同一页面立即显示新标题；`performance.timeOrigin` 不变，未发送指令与已有结果保留 |
| console 与网络观察 | 可读取 Vite 连接、热更新消息及资源请求；本轮捕获的 console 未出现 error |

交互验证包含页面内的断言检查，不仅依赖 CLI 操作返回成功。结束前恢复了默认示例状态，开发服务与标签页保留，供用户操作。

## 截图限制

`screenshot` 首次返回 1×1 PNG。显式切换到原型标签页后返回 1280×770 PNG，但人工检查该图片只见背景；`full-screenshot` 返回 1265×808 PNG。重新加载后 viewport 截图仍只捕获背景。页面语义快照、可见性、元素布局尺寸和交互状态正常，因此目前不能确定是截图通道问题还是用户端显示问题。

没有为绕过该现象修改 Orca 或另建浏览器控制系统。用户随后提交了实际界面截图，显示材料、指令 `1223` 的结果和红色手绘标注，与页面快照一致，确认用户端界面能够正常显示。用户发送的图片可以直接观察；Orca 自动截图仍未证明可用于可靠的视觉审查。

## Windows 客户端的局域网访问

用户说明日常在 Windows 主机 `192.168.13.22` 远程开发，希望在 Windows Orca 本地浏览器中打开开发主机 URL，以使用本地浏览器注释。

开发主机当前局域网地址为 `192.168.13.13`。仅关闭本轮创建的原型开发终端，再以以下命令重新启动，没有修改默认 Vite 配置：

```sh
pnpm --filter @scholoom/desktop dev:browser --host 0.0.0.0 --port 5173 --strictPort
```

`ss` 确认服务监听 `0.0.0.0:5173`。开发主机分别访问 `127.0.0.1` 和 `192.168.13.13` 的原型页面与 `/@vite/client`，均返回 HTTP 200。服务继续保留，Windows 可在 Orca 本地浏览器标签中打开 `http://192.168.13.13:5173/?prototype=orca-ui`。

本轮没有从 Windows 主机验证网络连通、HMR 或本地注释，也没有切换现有远程浏览器标签的执行位置。用远程 URL 导航现有标签，并不自动将它转为本地浏览器模式。

## 源码验证

以下命令在最终修改后均通过：

```sh
pnpm exec biome check apps/desktop/src/renderer/src/main.tsx apps/desktop/src/renderer/src/OrcaUiPrototype.tsx apps/desktop/src/renderer/src/orca-ui-prototype.css
pnpm --filter @scholoom/desktop typecheck
pnpm --filter @scholoom/desktop build
xvfb-run -a pnpm exec playwright test tests/smoke/entrypoints.spec.ts -g 'desktop loads React'
git diff --check
```

Electron 检查复用了已有 smoke，验证构建后的默认页面和 sandbox preload，1 项通过；它不验收原型的 Orca 显示。未验证真实 Agent、Node 内核连接、科研能力、三平台、窄屏实际操作或完整无障碍表现。未提交或切换 Git 分支，未覆盖原有未提交改动。
