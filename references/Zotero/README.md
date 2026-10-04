# Zotero 项目参考资料

本目录是对 Zotero 桌面客户端源码仓库的调研笔记，服务于 Scholoom 的开发参考。

调研对象：`~/Workspace/Code/JavaScript/zotero`（本地克隆目录名全小写，官方仓库为 `zotero/zotero`）。

调研范围：仓库根文档、`chrome/`、`js-build/`、`resource/schema/`、`test/` 的结构与关键文件，15 个 Git 子模块，以及项目内 `.ua` 知识图谱与 wiki。

**本轮为增量更新**（主仓 commit `2cdc2cc`）。主仓代码相对上轮（`ae50d52`）只变了一个纯子模块指针升级的 commit，**没有源文件改动**。真正的增量在于：子模块已全部检出，五个关键子域各自完成独立分析并合并回主图谱。文档结构因此从 12 篇扩到 16 篇。

## 阅读顺序

### 主仓（11 篇）

| 文档 | 内容 | 什么时候读 |
| --- | --- | --- |
| [01-项目概览.md](01-项目概览.md) | 定位、版本、许可、仓库布局、贡献流程、规模统计 | 第一次接触，需要先建立全局认知 |
| [02-技术平台.md](02-技术平台.md) | Mozilla 平台、XUL/XPCOM、进程模型、资源协议、依赖 | 需要弄清「它到底跑在什么上面」 |
| [03-功能地图.md](03-功能地图.md) | 收集、整理、检索、引用、同步、插件等功能域拆解 | 设计 Scholoom 功能边界时 |
| [04-架构分层.md](04-架构分层.md) | 47 个分层（主仓 10 + 子域 37）、依赖方向、26 对双向依赖 | 定位模块归属、评估改动影响面 |
| [05-引导与构建.md](05-引导与构建.md) | `zotero.mjs` 引导、js-build 构建系统、CI、测试 | 参与 Zotero 代码开发或参考其构建思路 |
| [06-数据与持久化.md](06-数据与持久化.md) | DataObject / DataObjects、SQLite schema、事务、事件、撤销 | 涉及数据模型、存储、同步语义时 |
| [07-同步与存储.md](07-同步与存储.md) | 同步引擎、附件存储、文件变更监听、库设置同步 | 做多端/离线/文件同步设计时 |
| [08-界面与样式.md](08-界面与样式.md) | 主窗口、自定义元素、React 组件、虚拟列表、SCSS、Fluent | 做桌面 UI、大数据量列表、多主题多语言时 |
| [09-集成与扩展.md](09-集成与扩展.md) | 本地 HTTP 服务、浏览器连接器、Word/LibreOffice 引用、插件 API | 做外部集成、插件体系、本地 API 时 |
| [10-子模块与第三方.md](10-子模块与第三方.md) | 15 个子模块清单与检出状态、5 个已分析子域速查、内嵌第三方、npm 依赖 | 判断哪些能力不在主仓库内 |
| [11-开发约定与上手.md](11-开发约定与上手.md) | 代码风格、命名空间约定、常见任务入口、12 条常见坑 | 实际动手改 Zotero 代码前 |

### 子模块（4 篇，均为本轮新增）

| 文档 | 覆盖范围 | 规模 | 什么时候读 |
| --- | --- | --- | --- |
| [12-阅读器.md](12-阅读器.md) | `reader/`：PDF/EPUB/快照渲染、批注、高亮、朗读、SDT 位置映射 | 531 节点 / 10 层 | 做阅读器、批注、跨格式定位、TTS 相关设计时 |
| [13-笔记编辑器.md](13-笔记编辑器.md) | `note-editor/`：ProseMirror schema、命令层、插件层、Markdown 互转、多平台入口 | 221 节点 / 9 层 | 做富文本编辑、文档 schema 演进、Markdown 转换时 |
| [14-文档处理Worker.md](14-文档处理Worker.md) | `document-worker/`：PDF 标注读写、结构化抽取流水线、ONNX 推理、EPUB/快照抽取 | 395 节点 / 9 层 | 做文档解析、PDF 字节级读写、ML 布局分析时 |
| [15-翻译框架与共享工具库.md](15-翻译框架与共享工具库.md) | `xpcom/translate/` + `xpcom/utilities/`：消费方契约、RDF 栈、日期中枢、条目转换 | 74 + 74 节点 / 9 层 | 做抓取框架、宿主注入契约、日期/条目序列化时 |

## 资料来源说明

- Zotero 仓库根目录的 `README.md`、`CLAUDE.md`、`CONTRIBUTING.md`、`package.json`、`chrome.manifest`、`.gitmodules`、`.babelrc`、`eslint.config.mjs`。
- Zotero 仓库源码：`chrome/content/zotero/**`、`chrome/content/scaffold/**`、`chrome/content/zotero-platform/**`、`js-build/**`、`resource/schema/**`、`scss/**`、`defaults/preferences/zotero.js`、`test/**`。
- 15 个 Git 子模块的工作副本与各自 `README.md`、CI 配置、`package.json`。
- 项目内知识图谱：`~/Workspace/Code/JavaScript/zotero/.ua/`，共 6 份（主仓 + 5 子域）与一份合并图。
- 项目内知识 wiki：`~/Workspace/Code/JavaScript/zotero/.ua/wiki/`，共 1513 个 Markdown 页面（上轮 789），结构如下。
  - 入口页：`README.md`（元数据与三条阅读路径）、`tour.md`（**58 步**导览：1–14 主仓、15–58 五子域）、`architecture.md`（47 层与依赖）、`catalog.md`（符号目录）。
  - `layers/*.md`：**47 个**分层页，每页含目录分布与文件清单摘要。
  - `modules/**/*.md`：**153 个**目录聚合页，含每个文件的一句话摘要与符号数。
  - `files/**/*.md`：**1120 个**单文件页，含摘要、符号表、依赖与相关节点。
  - `symbols/**`：**189 个**被独立成页的复杂符号（reader 62、document-worker 58、chrome 41、note-editor 18、js-build 9、resource 1）。

### 引用图谱时的注意事项

合并图 `.ua/knowledge-graph.json` 的部分元数据**不可直接引用**：

- `project.name` 被合并过程覆盖为 `Zotero Utilities（@zotero/utilities）`（取自某个子域）；
- `project.description` 是六个子域描述用 `|` 直接拼接的结果；
- `catalog.md` 的「按语言」统计合并后只剩 `css 20` 一行；
- 子域分层存在**重名**（reader 与 note-editor 都有「样式与主题层」「构建配置与项目文档」），按名字统计会出错，必须带域前缀。

本目录中所有数字均从图谱原始数据重新计算，未引用上述字段。

本目录所有内容为观察与整理，不修改 Zotero 仓库；涉及数字与文件名的地方以调研时 commit `2cdc2cc` 为准。
