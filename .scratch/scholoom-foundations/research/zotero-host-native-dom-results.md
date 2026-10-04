# 茉莉花原包：真实 DOM、作者处理与同一文献权威

关联 [#16](../issues/16-zotero-host-prototype.md)。2026-10-04 用户同意执行[上一轮](zotero-host-mutation-results.md)提出的 DOM 验证。

**这轮通过：未修改的茉莉花 1.1.39 在我们提供的 Chromium DOM 环境中完成原主包求值及原 onStartup，收到新增题录通知后实际拆分中文作者并保存；原 BBT 9.0.68 从同一 SQLite 权威导出处理后的作者。** 没有运行完整 Zotero，也没有用自写姓名处理或预设保存结果代替原插件。

这回答了一个窄问题：上一轮的 Prompt DOM 缺口可以由原生 Chromium DOM 承接，这条作者处理路径不需要完整 Zotero。它没有验收在线元数据识别、附件匹配、Reader 或插件全部功能。

## 实际执行和数据边界

```text
Node／SQLite literature（唯一权威）
  → 按通知 ID 投影题录到内部 Chromium 页面
  → 原茉莉花 bootstrap → 原主包 → 原 onStartup
  → 原新增 item 监听器 → 原 splitName → Item.saveTx
  → 页面提交字段变更 → Node 保存同一 literature 表
  → 原 BBT 变更监听器更新缓存
  → 原 BBT Worker／translator → 实际 BibTeX
```

BBT 主包仍在 Node VM 中执行，其原 Worker 使用 Chromium 原生 IndexedDB。茉莉花主包在另一个本地页面执行，使用浏览器真实 document、节点、样式、输入框和事件。两者共用已有 Chromium 进程，没有开发服务器。

兼容脚本加载器把完整原主包字符串放入 bootstrap 提供的作用域求值，保持 `_globalThis`、addon 及动态全局 getter 的关系；未改写源码、抽取业务函数、删除启动任务或设置假 ready。原 bootstrap 未等待 onStartup 的 Promise，宿主通过透明调用观察器取得原 Promise 并等待完成。

页面保存有限 Item 投影，保存请求只携带 ID、变更字段和选项，Node 执行实际保存并返回权威记录。页面没有 SQLite 写连接或另一份可自由提交的当前文献库。本轮只投影对照和处理样本两个 ID（3、4），不读取或刷新全库；Node 的最终全表读取仅用于核对四条临时样本的落盘结果。

## 观察结果

| 检查 | 实际结果 |
| --- | --- |
| 原 bootstrap／主包／onStartup | 全部求值，bootstrap 返回，原 onStartup Promise 已结束 |
| 上一轮阻断的 Prompt 初始化 | 原工具包实际创建 style、Prompt 容器和原生 HTMLInputElement，节点连接到真实 document |
| 关闭 autoSplitName 的对照 | 收到新增通知后，“欧阳明、李华”仍为单字段作者，没有茉莉花保存请求 |
| 开启 autoSplitName | 原监听器调用原 splitName，保存“欧阳／明、李／华”，fieldMode 从 1 变为 0 |
| 原包保存与读回 | 页面 saveTx 请求、Node item-save、SQLite 当前字段和保存返回的页面记录一致 |
| 其他元数据和原有题录 | 标题／日期／引用键及之前两条题录不变 |
| BBT 消费 | 实际导出含 `author = {欧阳, 明 and 李, 华}`，对照仍是两个完整姓名 |
| 持久保存 | 关闭后以新只读连接核对四条记录全部字段和身份，integrity_check 为 ok |
| 后台错误 | 本轮未记录页面错误、未处理 Promise 拒绝或意外网络请求 |
| 原包不变 | 两份 XPI 和实际执行成员的字节核对通过 |

处理样本为 `source-jasminum`／4／`JASM0001`，引用键为 `JasminumNames2026`；对照为 `source-jasminum-control`／3／`JASMC001`。BBT 导出同时保留原有两条题录。

[完整结果](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom/result.json)、[实际 BibTeX](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom/jasminum-dom-names.bib)、[SQLite 文件](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom/literature.sqlite)及[原工具包生成的 DOM 快照](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom/jasminum-dom-rendered.html)已保存。DOM 快照是内部环境证据，不是交互工作台或完整插件界面。

原通知链没有等待作者处理的 async 函数，observer 返回不能算保存完成。宿主记录页面 Item.saveTx 的待完成请求，等待实际 RPC 保存及后续通知结束，再从 SQLite 读回；页面错误和 unhandledrejection 另作失败记录。本轮没有修改原插件来补 Promise 链。

## 真实服务与占位边界

| 契约 | 本轮边界 |
| --- | --- |
| HTML DOM／作者处理／保存 | Chromium 原生节点；原监听器及 splitName 实际运行，保存提交 Node SQLite，原 BBT 接收变更 |
| 主窗口／菜单 | getMainWindow 提供内部页面，getMainWindows 返回空列表；没有 Zotero 菜单 popup，原工具包查询后返回 false，未验收 onMainWindowLoad、菜单呈现或 XUL |
| 偏好／本地化 | 内存设置，关闭首次运行、在线元数据更新和 translator 自动更新；本地化提供 ID 回退 |
| actor／Reader／偏好窗／列／窗口生命周期 | 接受并记录注册描述，没有真实 Gecko actor、Reader 或对应用户界面 |
| HiddenBrowser／BlockingObserver／E10SUtils／AddonManager | 仅声明模块命名空间，实际调用报未实现；ActorManager 没有执行 Gecko 模块副作用 |
| 文件／HTTP／translation | 附件、联网、RIS/Web translator 等未执行 |

启动成功指上述窄宿主条件下原主包与 onStartup 已完成，不能扩大为全部生命周期或 Gecko 服务兼容。作用域适配未提供生产插件隔离；Item 投影与顺序通知未验证并发冲突、事务队列、批量处理、崩溃恢复或规模性能。

## 工件与验证

新增 `jasminum-dom-probe.mjs`：复用 Chromium 创建真实 DOM 页面、运行原包并桥接保存。`chromium-worker.mjs` 增加创建页面入口，`run.mjs` 增加场景及 DOM 快照保存。保留已有 Node 茉莉花失败探针作为无 DOM 对照。

```sh
node .scratch/scholoom-foundations/prototypes/bbt-minimal-host-prototype/run.mjs --worker-engine=chromium --scenario=jasminum-dom --evidence=/new/evidence/directory
```

最终退出 0，11 项本轮行为核对及原 BBT 基线／持久保存通过。BBT 缓存变更场景也实际回归，退出 0，保留无通知陈旧导出对照，见[回归证据](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-dom-mutation-regression/result.json)。8 个 MJS 文件的 node --check、SQLite／BibTeX／DOM 工件及文档链接检查见[核对摘要](../prototypes/bbt-minimal-host-prototype/evidence/2026-10-04-native-dom-validation.json)。复用已有资产，无依赖安装、开发服务器或 Git 提交。

首次失败保存在 `evidence/dom-attempt-1`：脚本加载器复制作用域后，`_globalThis` 仍指向原对象，原包不能按全局名读取 addon。修正宿主别名后，`dom-attempt-2` 通过。这是适配接线错误，不是茉莉花 DOM 不兼容。

## 当前判断与下一项

独立 Node／Chromium 宿主现在有两条不同原插件的业务证据：BBT 引用键／导出／变更缓存，以及茉莉花的通知驱动中文作者处理。两者共用一个文献权威，原包不变。这支持继续评估该路线，尚不足以承诺整个插件兼容或确定正式宿主。

下一项应进入茉莉花的原元数据识别或附件匹配任务，验证实际要求的 HTTP、translator、文件和关系保存契约。姓名处理不能代替这些功能，不再重复 Prompt DOM 或 BBT 初次导出验证。#16 保持 claimed；整体宿主、Electron 嵌入及跨平台分发仍待决定或取证。

后续已执行[元数据任务实验](zotero-host-metadata-results.md)：固定合成 HTTP 输入下原插件回退建项并关联 PDF，BBT 实际消费；真实在线服务仍待验证。
