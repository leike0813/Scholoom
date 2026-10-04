# SQLite 与独立 Node 内核的接入选型依据

调查日期：2026-10-04。关联 [#12](../issues/12-technology-stack.md)，遵循 [#13 数据权威](../issues/13-storage-and-change-model.md)和 [#09 独立内核](../issues/09-electron-architecture.md)。本次查阅官方文档、包元数据及相关上游源码，未安装、构建或运行数据库集成。

## 事实

- SQLite 官方将桌面应用本地持久化和应用文件格式列为适合的用途。它是嵌入式引擎，不需要另起数据库服务器。此特点适合项目目录保存结构化事实；仍需定义 Schema、迁移、事务及备份。[SQLite 适用场景](https://sqlite.org/whentouse.html)
- `better-sqlite3` 为 MIT，提供同步语句、事务、扩展加载、备份及 Worker 使用方式。官方提供主要平台／架构的预编译二进制，但目标 Node ABI、架构和分发包仍需具体核对。[README](https://github.com/WiseLibs/better-sqlite3)、[API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- 其 transaction 回调应同步完成；将异步操作塞入该回调不能保持预期事务。`.backup()` 使用数据库备份接口，产物是可直接打开的 SQLite 库；写入与备份期间的连接行为见官方说明。备份不提供数据库与开放文件的共同事务。[transaction 与 backup](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- Node 自带 `node:sqlite`，包含 `DatabaseSync`、扩展加载与 backup。当前在线文档为 Node 26.10.0，模块标为 Stability 1.2／Release candidate；不能将该页面全部能力视为所有 LTS 或 Electron 内置 Node 已具备。`DatabaseSync` 的方法同步执行。[Node SQLite](https://nodejs.org/api/sqlite.html)
- Drizzle 官方 SQLite 文档列出 libsql、better-sqlite3、node:sqlite 驱动，当前示例安装 `drizzle-orm@rc`。本轮另读取 npm `latest` 元数据，得到稳定包 0.45.3、Apache-2.0，含 `./better-sqlite3` export，未含 `./node-sqlite` export。因此不能据当前 RC 文档宣称稳定包有 Node 内置驱动适配器。[SQLite 文档](https://orm.drizzle.team/docs/sqlite/get-started-sqlite)、[稳定包元数据](https://registry.npmjs.org/drizzle-orm/latest)
- Drizzle 支持 TypeScript Schema、类型化查询，以及由 Schema 生成 SQL 迁移；迁移可在应用运行时应用。框架支持多种 Schema 工作方式，项目仍需选择一个事实源。[迁移文档](https://orm.drizzle.team/docs/sqlite/migrations)
- LangGraph JS 官方提供 `@langchain/langgraph-checkpoint-sqlite`，文档定位为实验和本地 workflow；也提供用于服务器部署的其他保存器。官方使用建议不自动证明桌面重启／interrupt 恢复已验收。[保存器文档](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)
- 本轮读取上游 main 的 SQLite saver：包元数据为 1.0.4、MIT，依赖 `better-sqlite3 ^12.10.0`；源码 import 该驱动，`SqliteSaver` 接受连接，提供 `fromConnString`，创建自己的 checkpoint／writes 表。这是访问时上游状态，未锁定 Scholoom 依赖版本，也未运行这些方法。[package](https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-sqlite/package.json)、[saver 实现](https://github.com/langchain-ai/langgraphjs/blob/main/libs/checkpoint-sqlite/src/index.ts)

## Q6 选型依据

用户已采纳 Q6，正式范围集中记录在 [#12](../issues/12-technology-stack.md)。下文保留技术依据与边界。

文献库和项目结构化事实采用 SQLite；独立 Node 内核接入 `better-sqlite3`，通过 Drizzle 管理本项目表结构及常规查询。TypeScript Schema 为当前表结构定义，生成并审阅 SQL 迁移后随应用分发，迁移文件表达升级步骤。特定兼容视图、全文索引和必要复杂查询可使用 SQL，领域服务仍负责写入语义。

LangGraph 执行恢复优先采用官方 SQLite saver，其表及序列化规则由上游管理；本项目的研究事实由自身领域 Schema 管理，两者跟随相应库或项目保存，不互相替代。具体文件布局、连接与迁移接线在实现规格中核对。选择现成 saver 能减少自行实现 checkpoint 协议的工作。

驱动集中在独立内核；工作台和兼容宿主使用共同领域接口。同为同步数据库 API 不代表没有阻塞风险，查询需要限制范围并按实际负载安排 Worker。不会因选择独立 Node 而自动解决 native addon 打包：实际使用的 Node 运行时、二进制路径及三平台加载仍需验收。

另一条较少第三方驱动依赖的路径是 `node:sqlite`＋SQL，但要接受所选 Node 的 API 状态，并核对 Drizzle／LangGraph 适配；采用官方 SQLite saver 时它仍会带入 better-sqlite3，不能把此路径宣称为整个内核已去除 native addon。

SQLite 备份、WAL 与跨文件边界沿 [已有存储调查](local-storage-and-crash-recovery.md)，普通文件协同沿 #13 正式低摩擦结论。本选型不扩展为跨资源事务框架或普遍事件重放系统。全文／向量索引和图库仍按实际能力需要选择。

## 验证范围

后续实现验证实际数据库保存与迁移、恢复待处理介入请求、在线备份读回、插件更新同一题录，以及目标 Node 上三平台 native addon 加载。无需为了选型另做无限展开的数据库原型；已有宿主 SQLite 实验只覆盖当时临时 Schema 和路径，不能替代正式集成验证。
