# 可信报告选择模块夹具

这是 `add-interactive-research-reports` 2.2c 的固定合成场景，供操作与独立验收使用。它不读取或执行报告 HTML，不是生产报告工作台，也不证明资源授权、浏览器隔离或报告 I5。

`entry.tsx` 挂载真实 `createReportContext`、`ContextContributionProvider`、`useBusinessSession` 和 `InstructionContextItems`。原正文通过 `session.draftKey` 读写真实 `drafts`；检查器、批注编辑和移除直接使用原贡献回调，没有第二份草稿。固定 `KernelClient` 端口仅供应 `workbench.watch` 合成快照，拒绝其他动作；没有模型或资源读取。所有文献、来源及版本身份均为合成数据。

界面由现有阅读工具栏、原生表单/表格/details 及共同检查器组成，样式导入原 `styles.css`，局部样式只引用既有语义 token。没有生产布局、公共路由或共享 fixture 登记。

## 构建与直接操作

从本树根目录运行，先指定自己的 cache：

```bash
export TMPDIR=/home/joshua/.cache/scholoom-round17-acceptance-fZn1SQ/next/research-graph-runtime
node tests/fixtures/report-context/build.ts "$TMPDIR/built"
node node_modules/typescript/bin/tsc --noEmit -p tests/fixtures/report-context/tsconfig.json
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.tools.json
```

在浏览器打开生成的 `built/index.html` 即可操作，无开发服务器。构建只使用已有 esbuild，并将未挂载的导航/资源视图替换为空组件；消费者、贡献、草稿及检查/编辑/移除模块保持真实。

1. 点击“会话一”，原正文、原摘录和原批注进入同一原草稿。
2. 筛选“随机”，切换年份排序，展开研究详情；选择林和赵，填写所选对象批注，点击“附加所选对象”。筛选变更会清除旧选择，排序保持对象身份。
3. 打开原“查看附加上下文”，检查报告版本、对象说明和来源；展开条目更正批注，或用原移除按钮删除该项。正文与原条目保持。
4. 清空筛选，全选17条后附加会整批拒绝，保留草稿。这个集合专门覆盖原16项上限，不改变生产限制。
5. 选择少量对象并“保留本次附加动作”，此时不写草稿。替换样本页面或切换会话，再“提交保留动作”会经已销毁的原消费者拒绝；新页面/接收者可重新选择附加。切回会话一，原草稿仍在。

`window.reportContextFixture.read()`仅提供有界状态观察：原存储序列化、正文、条目、订阅提交数、当前版本、回执及客户端调用名；测试不通过该入口改变草稿或选择。页面不自动发送，夹具也不提供发送按钮。

## 双宿主入口

`tests/ui/report-context.spec.ts` 沿已有 `uiPage`，先加载已构建产品并确认宿主连接，再由测试 route 加载本夹具固定 JS/CSS。Browser/Electron 执行相同两条场景，操作都从用户控件进入；只读状态用于独立核对保存结果。未提供构建目录时该专用夹具测试明确跳过，不能记作产品通过。

运行前使用已有静态 UI 配置，显式指定独立端口、数据目录和 `SCHOOLOOM_REPORT_CONTEXT_BUILD`；不要直接使用默认 UI 配置中的开发服务器。Electron 还须绑定已有 binary，图形动作前检查实际 DISPLAY。实际本轮命令、截图、首次失败及最终结果沿本轮 cache `RESULT.md` 交回。

```bash
export SCHOOLOOM_REPORT_CONTEXT_BUILD="$TMPDIR/built"
node node_modules/@playwright/test/cli.js test --config "$TMPDIR/ui.config.mts" tests/ui/report-context.spec.ts --workers=1 --output "$TMPDIR/ui-results"
```

此处控制器是固定合成模块：页面/接收者变更用 React key 卸载旧面板，其 cleanup 调用原 `dispose()`；保留动作只保存那次消息和原 `receive`，不转发到新接收者。它不承担可信浏览器的通道归属、授权撤回、限速、state/restore 或生产资源加载。完整2.2/I5保持开放，由所属线更新原 OpenSpec；本夹具不修改生产消费者或报告工件。
