# 10 宿主能力与Bridge

这一篇讲这个项目**最值得抄的安全模型**：怎么让一个外部 Agent 安全地读写用户的文献库。

## 六层模型

`docs/components/zotero-host-capability-broker-ssot.md:9-14` 原文：

```
1. Zotero native APIs are the raw host runtime.
2. ZoteroHostCapabilityBroker is the canonical, process-local owner of
   portable host capability semantics.
3. WorkflowHostApi v12 is the closed workflow surface. It explicitly projects
   selected broker members and adds trusted local workflow services.
4. Host Bridge v2 is the remote locality, exposure, permission, and file-handle
   adapter over the canonical broker.
5. MCP is an exact public projection of the Host Bridge registry and reuses its handlers.
6. Broker-private native mutation primitives perform the admitted Zotero effects;
   Workflow supplies trusted local resources through its adapter.
```

两条关键规则（同文件 `:16`、`:61-64`）：

> The architecture has one fact source and deliberately separate public surfaces. **Adding a broker member does not implicitly expose it** to workflows, Host Bridge, or MCP.

> The projection uses explicit object literals and member-level types; **whole broker domains, spreads, proxies, and capability catalogs are forbidden**.

**"新增一个 broker 成员不会隐式暴露出去"**——这条规则是整个安全模型的地基。它的实现方式很简单但极易违反：见 06 篇的 member-level `Pick` + 显式对象字面量。

## 能力域与 JSON-safe 契约

Broker 公共入口 `src/modules/zoteroHostCapabilityBroker.ts`（**18619 行**，全项目最大的单文件）。

| 域 | 语义 | 代表 capability |
| --- | --- | --- |
| `context` | 当前视图 / 有序选区 | `context.get_current_view`、`context.get_selected_items` |
| `navigation` | 窗口 UI 导航（7 个，**仅 Host Bridge / MCP**） | `navigation.focus_zotero` … |
| `library` | 有界库/笔记/附件/标注读取 | `library.search_items`、`library.get_item_detail` |
| `metadata` | 标识符翻译（Zotero Translate 门面） | `metadata.translateIdentifier` |
| `mutations` | preview / execute / getOperation | `mutation.get_operation` + 29 个写入投影 |
| host services | file / preferences / editor / notifications / logging | 归 `WorkflowHostApi`，**非 agent 默认面** |

**JSON-safe 契约**：输入输出限定 `null / boolean / string / 有限数值 / array / plain object`。`undefined` 属性、NaN/Infinity、class 实例、Date、Map、Set、Function、BigInt、循环引用一律在契约外。

失败用 `ZoteroHostCapabilityError`，携带稳定 `code` + `retryable` + 严格 JSON `details`——**details 中不得含原生 ref、原生 error 或 cause**。

## 核心：写权限的强制次序

「写前无副作用预检 → 等待审批 → 重新准备 → 摘要变化需重新审批」不是靠调用方自觉，而是**四道机械闸门**。

### 闸门 1 — prepare 产生私有凭证

```ts
expiresAt: Date.now() + PRIVATE_PREPARED_MUTATION_TTL_MS,
// PRIVATE_PREPARED_MUTATION_TTL_MS = 15 * 60 * 1000   (15 分钟)
```

prepare 结果带 `unique symbol` 品牌 `preparedCanonicalMutationBrand`——**无法从外部 JSON 伪造**。

### 闸门 2 — 审批等待期间 digest 比对

`hostBridgeMutationAdapter.ts` 全文 176 行，就是一个循环：

```
prepare → 返回 domainPlanDigest → 等待审批 → 重新 prepare → digest 变化则要求重新审批
```

SSOT `:160` 原文：

> Approval wait triggers preparation again; changed digests require renewed approval.

`domainPlanDigest` 在 `capabilities.v2.json` 中出现 **58 次**——是跨层通用的计划指纹。

### 闸门 3 — TTL 硬过期

```ts
if (Date.now() - prepared.preparedAt > PRIVATE_PREPARED_MUTATION_TTL_MS) { ... }
```

### 闸门 4 — 进程级 FIFO 宿主 slice 单通道

```ts
const hostSliceQueue: Array<HostSliceWaiter<unknown>> = [];
let hostSliceActive = false;
function withZoteroHostSlice<T>(...)   // 所有原生切片串行入队
```

SSOT `:160` 的执行语义：

> Execute revalidates **inside the admitted native slice** before effects, **without silently refreshing a stale plan**.

**这一条最关键**：重校验与副作用在**同一次 slice 准入内**完成，审批与执行之间不存在「计划被静默刷新」的窗口。`assertPreparedMutationEntityObservations` 在 slice 内复查实体观察值。

⚠ 范围限定（SSOT `:158` 自陈）：该串行化只约束 Broker 调用者与原生事务持有者，**不排除** Zotero 自身写入、Sync 或用户在共享数据库连接上的并发写。

## 语义摘要与 durable insert winner

`src/modules/zoteroHostMutationAuthority.ts`（997 行）。

### 摘要构造

```ts
function canonicalDigest(value: JsonValue) { ... }
function canonicalSemanticValue(value: JsonValue): JsonValue { ... }   // 剥离表述差异
export function canonicalMutationDigest(value: JsonValue) { ... }
```

`canonicalSemanticValue` 负责**剥离与身份判定无关的表述差异**（键序、空白、非语义字段），使"语义相同的重放"得到同一摘要。

### 归属绑定

```ts
function recordKey(scope: string, operationId: string) { ... }
```

caller scope + operationId → 同时绑定**操作种类**与**归一化语义摘要**。`assertEntryBinding` 在重放时复核；`idempotencyConflict()` 处理"同 operationId 不同语义"。

### durable insert winner

摘要比对通过后，**只有 INSERT 成功者执行副作用**。落盘在 `pluginStateStore` SQLite（`mutationAuthorityTable.ts`）。

**进程内 `mutationRecords: Map` 只是热缓存，不是事实源。** 这正是"重启后仍能判定写入归属、幂等"的根据：重启后从 SQLite 读回同一条 identity 记录，重复请求走 replay 而非重新执行。

### Replay 顺序

SSOT `:162`：

> Replay checks stored identity **before resource acquisition or preflight**.

即**重放在拿资源、跑 preflight 之前就短路**，避免重复的昂贵扫描与副作用准备。

### 保留策略

```ts
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;   // 30 天
```

- 已终结记录保留 30 天
- `unknown` / `repair_required` **不清理**——**证据缺失比证据过期更危险**
- 过期删除证据，但**永久保留 identity tombstone**——否则旧 operationId 重来时会因"查无记录"被当作新写入，破坏幂等
- 成功只在**终局证据落盘之后**返回

### 观察语义

`MutationExecutionObservation` 返回 `running | settled | unavailable`，并**传播存储故障**而非吞掉。SSOT `:164`：

> Neither observation nor replay reconstructs a historical outcome from **current item state**.

**不拿"当前条目状态"反推历史结果**——这条避免了"用户改完条目后查历史，看到被改后的值"。

## 选区上下文

`src/modules/selectionContext.ts`（200 行）。

### 为什么不泄露原生 ID

`assertSelectionRef`（`:55-79`）三重约束：

```ts
typeof ref.key !== "string" ||
!ref.key.trim() ||
Object.keys(ref).some((key) => key !== "libraryId" && key !== "key")
```

1. 只接受 `{ libraryId, key }`
2. 键集合**封闭**（多余字段即拒）——防止顺手夹带 `itemID`、`id`、DOM 引用
3. `key` 必须是非空字符串

`itemRefIdentity` 把 ref 规范成稳定标量 `` `${libraryId}:${key}` ``。**Zotero 的内部自增 ID 与 DOM 对象从不进入契约面。**

`selectionTitle` 对无标题项**直接省略 `title` 字段**而非塞占位串。

### opaque cursor 与 `basis_mismatch`

游标是 base64url 包裹的 JSON，解码后必须满足：

```ts
decoded.version === SELECTED_ITEMS_CURSOR_VERSION &&
typeof decoded.basis === "string" &&
/^[a-f0-9]{64}$/u.test(decoded.basis) &&      // 必须是 sha256 hex
Number.isSafeInteger(decoded.afterIndex) && decoded.afterIndex >= 0
```

basis 摘要：

```ts
const digest = await sha256Hex(new TextEncoder().encode(
  JSON.stringify({ schema: "zotero.selection.v1", refs }),
));
```

客户端带回游标时重算 basis，不一致即 `conflict.details.reason = "basis_mismatch"`。

**语义**：用户在翻页期间改了选区 → 旧游标作废，**绝不返回新选区上的"第 N 条之后"**。这是干净的乐观并发控制。

游标**无 TTL、无持久化、无快照上限、无提升、无去重**——选区是瞬时视图，不是聚合状态。

### 公共 DTO 为何拒绝 `expectedRevision` / `token` / `path`

实测 `contracts/host-bridge/capabilities.v2.json`：

| 参数 | 出现次数 |
| --- | --- |
| `expectedRevision` | **0** |
| `token` | **0** |
| `path` | 6 |
| `domainPlanDigest` | 58 |
| `dryRun` | 29 |

**写入授权参数必须留在宿主侧。** 执行时宿主用 prepare 阶段捕获的**私有 revision/state** 重新核对；把它交给调用方等于让客户端自称"我已核对"。

`path` 三分语义：
- `library.get_item_attachments` 的 outputSchema 用 `"not": { "required": ["path"] }` **显式禁止**
- `topics.get_context` 与 `workflow_products.export` 的 `file` 描述符**允许** `path`——这是导出产物的相对定位

⚠ **待确认**：`applySynthesisOutputBoundary` 未见对 `path` 的剥离，`tests/host-bridge/` 也未搜到"响应不含本地路径"的守卫测试。`topics.get_context` 是 MCP 可见工具，其 `file.path` 语义需由代码所有者确认。

## 库读取的强制不变量

`src/modules/zoteroHost/`（9 文件 6938 行）：

| 文件 | 行 | 职责 |
| --- | --- | --- |
| `zoteroManagedNotes.ts` | 1974 | 受管笔记发现、按 kind 分派、健康度（`stale`/`anchor_stale`/`repair_required`） |
| `zoteroLibraryPageQuery.ts` | 1097 | **库选区 SSOT**：`listItems` / `syncSnapshot` / `readinessAudit` 共用 |
| `notePayloadCodec.ts` | 940 | 笔记内嵌 payload 块编解码；7 种 kind；base64url 变体 |
| `libraryArtifactReadiness.ts` | 848 | 库级文献产物就绪度审计 |
| `zoteroHostNativeMutations.ts` | 799 | Broker **私有**原生变更原语 |
| `zoteroNotePayloadResolver.ts` | 541 | payload 块 → 资源解析 |
| `zoteroHostBrokerPrimitives.ts` | 309 | 原生事务封装、字段/作者规范化 |
| `zoteroHostTrash.ts` | 245 | 回收站状态变更 |
| `zoteroHostPreparedFiles.ts` | 185 | 附件文件预置/暂存 |

**强制不变量**（SSOT `:182`）：

> These broker paths **must not use `Zotero.Items.getAll()` as a pagination fallback**.

**全量物化被明令禁止**，分页只能走 `zoteroLibraryPageQuery`。该模块的设计值得学：单条参数化 SQLite 谓词同时供 count 与 page 用，`limit+1` ID 后**仅 hydrate 返回页**。

**准入让步规则**（SSOT `:190`）：长原生循环**最多 100 条或 50 ms** 就释放准入；网络/文件、回调、detached JSON 处理、结束哈希都在准入之外。取消检查点：入队前、进入时、每批目标之间、await 宿主工作之后。

分页游标同样是不透明串，绑定域/来源/归一化条件/排序位置。畸形、不支持、条件不匹配、数字游标一律失败并映射到 `invalid_library_cursor`——**两个边界都不从第一页重启**（SSOT `:186`）。

## Host Bridge Server

`src/modules/hostBridge/server/hostBridgeServer.ts`（1989 行）。

### 监听

```ts
const LOOPBACK_HOST = "127.0.0.1";      // 默认
const LAN_HOST = "0.0.0.0";
const PORT_MIN = 26570;
const PORT_SPAN = 200;                   // → [26570, 26769]
const MAX_REQUEST_BODY_BYTES = 1024 * 1024;
const MAX_UPLOAD_BODY_BYTES = 16 * 1024 * 1024;
const MAX_ACCEPTED_CONNECTIONS = 16;
const WORKFLOW_PERMISSION_TIMEOUT_MS = 5 * 60 * 1000;
```

底层是 **Zotero `nsIServerSocket`**，非 Node http：

```ts
socket.init(port, bindMode === "loopback", MAX_ACCEPTED_CONNECTIONS);
```

三种端口模式：`random` | `pinned` | `fallback`。

**advertised host 默认是占位符 `<zotero-host-ip>`**（`normalizeAdvertisedHost`），未手动配置时 `advertisedHostSource = "placeholder"`——**避免把宿主真实 IP 写进状态而无意泄露**。

LAN 模式下**本地 profile 端点仍回投 `127.0.0.1`**，只有 `buildRemoteEndpoint` 走 advertised host。

### 请求准入的严格顺序

```
1.  request.parseError                       → 400 bad_request
2.  isMcpPath("/mcp")                        → 转交 MCP
3.  !isBridgePath                            → 404 not_found
4.  health 路径非 GET                         → 405 method_not_allowed
5.  isHostBridgeAuthorizationValid(headers)  → 401 unauthorized   ← 唯一免鉴权是 health
6.  body > 1 MiB（upload 除外）                → 413 request_body_too_large
7.  operation receipt 路径仅 GET              → 404
8.  路由族匹配（|| 链式短路，先到先得）
9.  routeMatch == null                       → 404 not_found
10. operationId 校验 + requestDigest 计算
11. reserveHostBridgeOperation → 409 / replay / reserved
12. 执行；异常或非终局响应 → markHostBridgeOperationOutcomeUnknown
```

MCP 侧额外前置于 JSON-RPC：不可信 `Origin` 头在解析前拒绝；超大 body 在 JSON 解析前拒绝；要求安全随机 token 生成，**失败即 fail closed**。

### Socket ownership：代际令牌

`serverGeneration` 单调递增作为"代际所有权"令牌：

- `listen()` 捕获 `generation`；`onSocketAccepted` 首个检查即 `generation !== serverGeneration → rejectStaleTransport()`
- 每个连接携带自己的 `generation`；`processAcceptedConnection` 在读 head 后、读 body 后、写响应前**各检查一次**
- `closeAllAcceptedConnections()` 在 shutdown 时统一 abort

**意义**：重启期间旧 socket 仍在 OS 层排队，只有代际令牌能保证它们不会污染新一代的请求处理。这是个容易忽略但很实用的细节。

### Shutdown

```ts
controlledShutdown = true;
clearRecoveryTimer();
serverGeneration += 1;          // ① 作废旧代
state.serverSocket?.close?.();
closeAllAcceptedConnections();  // ② 断开全部在途连接
state = createEmptyState("stopped");
```

`shouldRecover()` 要求 `supervisorEnabled && !controlledShutdown && status ∉ {running, starting}`——**避免与受控关闭打架**。

## 错误契约：给 Agent 的确定性恢复提示

`HostBridgeError` **六字段，每个错误都必须给全**：

```ts
type HostBridgeError = {
  code: HostBridgeErrorCode;          // 实测 89 个
  message: string;
  category: HostBridgeErrorCategory;  // 11 类
  details?: Record<string, unknown>;
  retryable: boolean;
  stateChange: HostBridgeStateChange;           // unchanged | changed | unknown
  handleConsumption: HostBridgeHandleConsumption; // unconsumed | consumed | unknown
  safeNextActions: string[];
  nextCommand?: string;
};
```

`category` 11 值：`auth | capability | config | connection | internal | not_found | permission | protocol | routing | validation | workflow`

**`stateChange` / `handleConsumption` 三态是这套设计最精彩的部分**：Agent 无需猜测"这个错误前副作用是否已生效""上传的文件句柄是否已被消费"，而是从错误本身读到确定答案。

89 个错误码按语义簇归类（代表性）：

| 簇 | 例 |
| --- | --- |
| 传输/路由 | `bad_request`、`not_found`、`method_not_allowed`、`unauthorized`、`request_body_too_large` |
| 审批/权限 | `approval_required`、`permission_denied`、`permission_timeout`、`permission_ui_unavailable` |
| 幂等/操作 | `operation_id_required`、`idempotency_conflict`、`operation_not_found` |
| 游标 | `invalid_library_cursor`、`invalid_host_bridge_cursor` |
| 文件 | `file_not_found`、`file_handle_expired`、`file_handle_leased`、`file_unavailable` |
| Workflow | `workflow_conflict_requires_policy`、`agent_run_already_consumed`、`skill_run_not_recoverable` 等 32 个左右 |

## 认证

两套令牌，**职责分离**：

| | 会话令牌 | 主令牌 |
| --- | --- | --- |
| pref | `hostBridgeToken` | `hostBridgeMasterTokenEncryptedJson` |
| 生命周期 | 短，进程/服务级 | 长，用户级 |
| 存储 | 明文 pref | **加密 JSON** |
| 用途 | 每次请求 Bearer | 派生/轮换会话令牌；CLI profile 引导 |

- 会话令牌被 `redactHostBridgeToken()` 掩码后才进 manifest——**明文令牌不出现在任何清单或诊断**
- `authRequired: true` 是**字面量类型 `true`**，在类型层就不允许出现"无需鉴权"的状态
- `/bridge/v2/health` 是唯一免鉴权端点

## Capability Registry：101 个

`src/modules/hostBridgeCapabilityRegistry.ts`（3052 行），三路构成加总严丝合缝：

| 构成 | 数量 |
| --- | --- |
| `capability("…")` 直接注册 | 29 |
| `debugCapability("…")` | 14 |
| `CANONICAL_MUTATION_PROJECTION_NAMES` 展开 | 29 |
| `synthesisCapability("…")` | 27 |
| `directResearchBundleCapability("…")` | 2 |
| **合计** | **101** |

与 `contracts/host-bridge/capabilities.v2.json` 的 101 条**逐名相等**——模块在加载时自校验，不一致直接 throw。**契约漂移在 import 阶段就炸。**

**运行时可见 87**（实测加载模块）= 101 - 14 个 `debug.*`。

契约元数据：`approval: none` = **66**，`zotero-ui-required` = **35**。

**命名规则**：`<domain>.<verb_noun>`，全小写下划线，29 个域。注意 `statusTags` 是 camelCase（唯一例外），`items`（导出）与 `item`（写入）是两个不同域。

⚠ **文档漂移**：`host-bridge-capability-registry.md` 写 `synthesisCapability(name, category, summary, invoke)`，代码实为 `synthesisCapability(name, methodName)`。

## 路由族

| 文件 | 行 | 前缀 |
| --- | --- | --- |
| `hostBridgeCapabilityRoutes.ts` | 715 | `/bridge/v2/call`、`/context/current`、`/context/selection` |
| `hostBridgeDiagnosticsRoutes.ts` | 303 | `/bridge/v2/manifest`、`/diagnostics/**` |
| `hostBridgeFileRoutes.ts` | 181 | `/bridge/v2/files/{fileId}`、`/files/upload` |
| `hostBridgeSynthesisRoutes.ts` | 226 | `/bridge/v2/synthesis/cache/**` |
| `hostBridgeWorkflowActivityRoutes.ts` | 1944 | `/workflows/**`（约 24 条）、`/tasks`、`/notifications`、`/permissions/**`、`/skill-runs/**` |

### Locality Projection

`hostBridgeFileRegistry.ts` 的下载清单把安全边界写成了可执行声明：

```ts
export function getHostBridgeFileDownloadManifest() {
  return {
    endpoint: "GET /bridge/v2/files/{fileId}",
    auth: "bearer",
    supportsRemoteClients: true,
    arbitraryPathAllowed: false,   // ← 显式声明禁止任意路径
    approvalRequired: false,
  };
}
```

`fileId` 必须匹配 `/^file-[A-Za-z0-9-]+$/`。**白名单式句柄**：客户端永远拿不到路径，只能拿 ID，且句柄有 `expiresAt` 与租约（`file_handle_expired` / `file_handle_leased`）。

SSOT `:216` 补一条原则：

> Never infer that an MCP client shares the Zotero process's filesystem, **even when the transport endpoint is loopback**.

**"即使是 loopback，也不要假定客户端与宿主共享文件系统"**——这条容易被想当然地违反。

## 三层 Agent Surface

`docs/components/host-bridge-agent-surfaces.md` 定义单向继承：

```
Mechanism (Minimum)  →  Task (Generic)  →  Residency (Hosted/Hermes)
```

`contracts/host-bridge/surfaces.json` 实测 3 个：

| Surface | kind | extends | skills |
| --- | --- | --- | --- |
| `zotero-bridge-cli` | `minimum-core` | — | 1 |
| `zotero-library-agent` | `generic-agent` | `zotero-bridge-cli` | 6 |
| `zotero-librarian` | `hosted-agent`（facet `hermes`） | `zotero-library-agent` | 1 |

规则：Generic **逐字节**挂载 Minimum；Hermes 逐字节挂载完整 Generic+Minimum 后只加 resident facet。渲染器一次解析图，**拒绝环、重复组件身份、冲突挂载路径**。

另有「agent-facing language boundary」——agent 不应需要知道内部 bridge 拓扑；`host-bridge.v2`、`/bridge/v2/**`、`ZOTERO_BRIDGE_HOST_PROFILE` 等形式化标识符不改写，由 `check-host-bridge-agent-language.ts` 守卫。

## MCP Server：85 个工具

`zoteroMcpServer.ts`（2656 行）+ `zoteroMcpProtocol.ts`（1502 行）。

内嵌 JSON-RPC 2.0 over **Streamable HTTP only**（`POST /mcp`）。无 `Mcp-Session-Id`、无 SSE fallback、不支持 `GET /mcp` 与 legacy `/mcp/message`。

**工具数量实测 85**（通过 `tools/list` 实际加载枚举）：

```
87  可见 capability（101 - 14 debug）
-2  workflow_products.export / workflow_products.remove（MCP 不可见）
=85 MCP 工具
```

automated / invalid scope 下**排除全部 7 个 `navigation.*`**，即 78。

> ⚠ **口径纠正**：文档常见的「MCP 40+」不准确。代码事实是 **85 个 MCP 工具**。

### 与 Host Bridge registry 的零复制复用

`zoteroMcpProtocol.ts:905-960` 从 registry 派生：tool name、inputSchema、outputSchema、effect、approval、exposure、响应尺寸策略、handler **全部来自同一份**。

SSOT `:196`：

> MCP must not maintain a second tool catalog or reconstruct a broker from a workflow API.

**agent-facing ID 与 Host Bridge ID 完全一致**（`context.get_current_view`、`library.list_items`、`item.updateMetadata`、`mutation.get_operation`）。

并发与超时：

```ts
const DEFAULT_TOOL_INFLIGHT_LIMIT = 9;          // 第 10 个 → -32001 zotero_mcp_inflight_limit
const DEFAULT_TOOL_RUNNING_TIMEOUT_MS = 45000;  // → -32003 zotero_mcp_tool_timeout
```

45s 看门狗触发可信取消，但**保留 inflight 名额直到 handler 真正 settle**——取消不释放在途宿主工作。

⚠ **严重文档漂移**：`zotero-mcp-service-design.md`（1778 行）通篇用**短名**（`get_current_view`、`get_mcp_status`、`list_library_items`），而代码用 canonical ID。`zotero.get_mcp_status` 在代码与契约中**零命中**（代码是 `diagnostic.get_status`）。

## Host Bridge CLI（Rust）：133 个子命令

`rust/zotero-bridge/` 11 个源文件 13011 行：

| 文件 | 行 | 职责 |
| --- | --- | --- |
| `commands.rs` | 4215 | 各命令族实现 |
| `args.rs` | 3926 | clap 枚举、参数结构、per-command 文案 |
| `contract.rs` | 1489 | **内嵌**契约、可执行 composition 解析 |
| `transport.rs` | 1174 | HTTP 传输、流式下载 |
| `surface.rs` | 914 | `surface describe/identity/search`——**离线**检视，不连 Zotero |
| `config.rs` | 486 | `BridgeConfig` |
| `error.rs` | 203 | `ErrorCategory` / `StateChange` / `HandleConsumption`——**与 TS 侧一一对应** |
| `client.rs` | 223 | `health` / `call` / `last_operation_id` |
| `main.rs` | 175 | clap 解析与分派 |
| `schema.rs` | 152 | JSON Schema 子树查询 |
| `output.rs` | 54 | stdout 契约 |

**错误契约跨语言同构**：clap 错误映射到 6 个稳定码（`cli_missing_argument`、`cli_unknown_argument`、`cli_argument_conflict`、`cli_invalid_value`、`cli_missing_subcommand`、`cli_usage_error`），填 `reason` / `property` / `conflictsWith` / `suggestions`。

### 子命令清单（实测 133 个，14 个顶层组）

| 顶层组 | 数量 | 样例 |
| --- | ---: | --- |
| `synthesis` | **30** | `topic list/get-context/get-report/find-by-paper-ref/export-research-bundle`；`graph overview/get-slice/get-layout/query-cluster/rank-*` |
| `workflow` | **20** | `list/describe/submit/queue/agent-run/agent-apply/profile/recent` |
| `library` | **17** | `item search/list/get/notes/attachments`；`readiness audit/missing-pdf` |
| `run` | **16** | `list/get/recent/cancel`；`permission get/pending`；`notification list/ack/wait` |
| `debug` | **12** | `status`、`synthesis snapshot/profiler/clean-install-reset` |
| `mutation` | **12** | `get-operation`；`item update/attach-file`；`note create/update/upsert-payload`；`tag add/remove` |
| `navigation` | **7** | `focus-zotero/select-collection/reveal-items/open-reader-location` |
| `bridge` | **6** | `status/manifest/backend list/profile diagnose` |
| `product` | **4** | `list/get/download/remove` |
| `surface` | **3** | `describe/identity/search` |
| `context` | **2** | `current`、`selection get` |
| `file` | **2** | `upload/download` |
| `call` | **1** | 裸 capability 调用（`long_about` 警告：**不得绕过语义校验**） |
| `operation` | **1** | `get` |
| **合计** | **133** | |

`cli-commands.v2.json` 每条含 `inputs`（每参数带 `required`/`requiredWhen`/`schemaSource`/`examples`）、`payloadSchema`、`resultSchema`、`composition`（transform 枚举：`identity` / `trim-string` / `path-string` / `context-ref` / `file-id`）。

## 跨语言契约治理

### `contracts/` 目录

```
contracts/
├── host-bridge/
│   ├── capabilities.v2.json      # 101 条
│   ├── cli-commands.v2.json      # 133 条
│   ├── surfaces.json             # 3 个 surface 组合图
│   └── schemas/                  # 15 个（agent-surface v2..v6 五个历史版本并存）
└── synthesis-sidecar/schemas/    # 6 个
```

`capabilities.v2.json` 大量使用 `additionalProperties: true` + **`x-openPropertiesReason` 显式说明理由**——例如「The selected domain service owns this capability input vocabulary; the capability boundary still requires a JSON object.」

**边界只强制"是 JSON 对象"，不强制领域词汇**；封闭性留给各 handler 校验。**这个取舍很好：跨域共享的 envelope 不该重复各域的词汇约束。**

### `check-synthesis-cross-language-contracts.ts` 实跑通过

```json
{ "ok": true, "schemaCount": 18, "definitionCount": 910,
  "positiveCaseCount": 52, "negativeCaseCount": 43,
  "protocolCapabilityCount": 130, "workerOperationCount": 15,
  "unauthorizedGenericEscapeCount": 0,
  "fingerprint": "sha256:07dd89d3…" }
```

**校验内容**：

1. **canonical JSON 摘要一致** — TS 侧 `canonicalizeSynthesisContractJson` 与 Rust 侧实现必须对同一输入产出**同一 hash**。这是跨语言一致的地基：摘要一致 ⇒ 键序、空格、数字表示、Unicode 处理一致
2. **18 个 schema 用 Ajv2020 编译并校验全部 910 条定义**
3. **协议能力 vs worker 运算闭合** — `protocolCapabilityCount`（130）须与 `workerOperationCount`（15）形成受控映射；**`unauthorizedGenericEscapeCount` 必须为 0**——协议层不得存在"通用逃逸口"绕过 worker 的显式运算清单
4. **正/负样例双向** — 52 positive（必须被接受）+ 43 negative（**必须被拒绝**）。**负样例的存在保证边界不是全放行**
5. `rebuildSynthesisSidecarObservationEvent` — TS 与 Rust 必须对同一事件重建出同一可观测记录
6. 外部 `$ref` 通过 `EXTERNAL_SCHEMA_FILES` 映射并**用 Ajv 真实加载**，不靠字符串比对

### 7 个 surface parity 脚本

`check-synthesis-*-surface-parity.ts` **实测 7 个**（非 8）：citation-graph、concept-topic-graph、artifact-library-debug、reference-canonical、tag、topic-workbench、webdav-maintenance。

统一机制以 **corpus** 驱动，校验三件事：

1. **语料完备** — corpus 的 `operations[].id` 与 `operations.json` 的 `access` 映射（`read` | `mutation`）**逐一对齐**
2. **case 分类完整** — 每个 operation 必须覆盖全部规定 case：边界（`invalid_args`/`oversized`/`expired`）、连贯读（`empty`/`deterministic_order`/`coherent_basis`）、窗口读（`filtered_window`/`cursor_basis`/`response_budget`/`endpoint_closure`/`stale_page`）、durable 变更（`valid`/`worker_canceled`/`publication_failed`）
3. **能力集合匹配** — 无缺漏、无越权

`coherent_basis` 与 `cursor_basis` 直接对应 Broker 的 `basis_mismatch` 语义。

`check-synthesis-native-runtime-contract-parity.ts` 更硬：**`spawnSync` 真跑 Rust**，对 corpus 的 5 类用例逐个注入 mutation，断言 TS 与 Rust 输出**逐节点相同**。

## 预编译二进制与 build fingerprint

`addon/bin/zotero-bridge-release.json`：

```json
{ "schema": "zotero-bridge-cli-release.v1", "version": "0.5.5",
  "buildFingerprint": "2ef15640…b4c1",
  "fingerprintInputs": [23 项], "binaryAggregateSha256": "68bc4ecc…" }
```

**23 项输入**：Rust 全部 11 个 `src/*.rs` + `Cargo.toml` + `Cargo.lock` + `cli-build-recipe.json` + 3 个契约文件 + 2 个 schema + 2 个构建脚本。

即：**改一行 Rust 源码、动一个 schema 字段、加一个 capability，fingerprint 都会变**。

`cli-build-recipe.json` 固定工具链（node 22.17.0 / rust 1.88.0 / zig 0.13.0 / cargo-zigbuild 0.20.1）与 7 个目标、3 个 runner。

⚠ **结构性摩擦**：`render-host-bridge-release-set.ts --check` 因 release-set 内嵌当前 HEAD commit，**HEAD 一旦前进就必然报 stale**（工作树干净时亦然）。这是设计导致，不是缺陷，但会制造噪声。

## 写自动批准的隔离

`hostBridgeWriteAutoApprovalRegistry.ts`：per-run 写自动审批，**仅当三项同时满足**时 mutation execute 可跳过 UI 审批：

1. workflow 声明支持（`allowWriteApprovalBypass`）
2. 用户显式启用
3. CLI profile scope 已为该 run 注册

**此旁路不覆盖 workflow submit**——后者仍只受全局 debug pref 控制。**这是防止权限从"mutation 旁路"意外扩大到"提交旁路"的关键隔离。**

审批分发器有四条通道：`acp-chat` | `acp-skill-run` | `skillrunner-run` | `global`；`NO_APPROVAL_CAPABILITIES` 白名单 35 项；默认超时 5 分钟。

## 安全模型小结

| 关卡 | 负责者 | 机制要点 |
| --- | --- | --- |
| **认证** | `hostBridgeAuth.ts` | 会话令牌 Bearer；主令牌加密存储用于派生；常量时间比较；清单只出掩码；`authRequired: true` 是**字面量类型**；health 唯一免鉴权 |
| **传输准入** | `hostBridgeServer.ts` | 401→413→405 严格顺序；最大 16 连接；MCP 侧前置 Origin 校验；**代际令牌防陈旧 socket 污染** |
| **请求级幂等** | `hostBridgeOperationStore.ts` | `requestDigest` 绑定四元组；409 冲突 / replay / outcome-unknown 三态 |
| **写授权** | `zoteroHostMutationAuthority.ts` | scope + operationId 绑定 kind + 语义摘要；**SQLite durable insert winner**；重启不丢幂等；**identity tombstone 永久保留**；replay 先于资源获取；不从当前状态反推历史 |
| **审批** | `hostBridgePermissionManager.ts` | `domainPlanDigest` 绑定审批；等待期间**重新 prepare**；15 min TTL；写自动审批三重条件且**不覆盖 submit** |
| **时序强制** | `zoteroHostCapabilityBroker.ts` | branded prepare token（不可伪造）+ 进程级 FIFO slice；**重校验与副作用同一次 slice 内** |
| **Locality** | `hostBridgeFileRegistry.ts` | 剥离 `path`；不透明 `file-…` 句柄 + 租约；`arbitraryPathAllowed: false`；**即使 loopback 也不假定共享文件系统** |
| **引用投影** | `selectionContext.ts` | 键集合封闭；opaque cursor 绑定 sha256 basis，变更即 `basis_mismatch` |
| **诊断脱敏** | `zoteroMcpProtocol.ts` | 令牌掩码；`details` 禁含 raw ref / 原生 error / cause |

⚠ **审计缺口**：**Host Bridge 没有独立的安全审计日志。** `src/modules/hostBridge/` 下的 `audit` 命中均为 `library.readiness_audit`（业务语义，非安全审计）。当前可追溯性由 `hostBridgeOperationStore`（请求级 receipt）+ `zoteroHostMutationAuthority`（30 天终局证据 + 永久 tombstone）+ notification/permission 通道**分布式代偿**。

**"谁在何时调了哪个能力"这一维度的集中审计流，在本次检索范围内未发现实现。** 写参考文档时不应声称存在统一审计日志。

## 对 Scholoom 的启示

按价值排序：

1. **写权限四道闸门**（branded token + digest 比对 + TTL + FIFO slice）。任何"让 LLM 改用户数据"的场景都该照抄。**尤其"重校验与副作用在同一次准入内完成"这条**——它消除了审批期间计划被静默刷新的 TOCTOU 窗口。
2. **语义摘要 + durable insert winner**。"同 operationId 不同语义"判为冲突，"同语义重放"直接短路。**identity tombstone 永久保留**这个细节尤其重要：删掉它就会把旧重放变成新写入。
3. **错误里带 `stateChange` / `handleConsumption` 三态**。让 LLM 无需猜测"副作用是否已生效""句柄是否已消费"，直接从错误读到确定答案。这比给它更多上下文更有效。
4. **"即使 loopback 也不假定共享文件系统"**。这条原则应该写进任何本地服务的边界文档。
5. **不透明游标 + basis 摘要**。乐观并发控制的干净实现。
6. **契约目录在 import 阶段自校验**。101 个 capability 名与契约文件逐名相等，不一致直接 throw。
7. **正/负样例双向语料**。有 negative case 才证明边界不是全放行。
8. **`authRequired: true` 用字面量类型**。让"关闭鉴权"在类型层就写不出来。

**反过来，不要照抄的**：这个项目在安全审计日志上有缺口（无集中审计流）；`render-host-bridge-release-set --check` 内嵌 HEAD 导致固有摩擦。这两点是应该避免的。

## 来源

- `src/modules/zoteroHostCapabilityBroker.ts`（18619 行）、`zoteroHostMutationAuthority.ts`（997 行）、`selectionContext.ts`（200 行）
- `src/modules/zoteroHost/`（9 文件 6938 行）
- `docs/components/zotero-host-capability-broker-ssot.md`（六层模型原文、`:16,31,58-64,101-103,152,158,160,162,164,182,186,190,196,198-204,210-218`）
- `docs/components/selection-context.md` + `selection-context.schema.json`
- `src/modules/hostBridge/server/hostBridgeServer.ts`（1989 行）、`hostBridgeAuth.ts`（338 行）、`hostBridgeProtocol.ts`（374 行）、`hostBridgeOperationStore.ts`（226 行）
- `src/modules/hostBridgeCapabilityRegistry.ts`（3052 行，101/87 实测）
- `src/modules/hostBridge/routes/*`（5 个路由族）、`hostBridgeFileRegistry.ts`
- `src/shared/hostBridgeAgentContract.ts`（协议常量）
- `docs/components/host-bridge-{capability-registry,agent-surfaces,lifecycle}.md`
- `src/modules/hostBridge/mcp/zoteroMcpServer.ts`（2656 行）、`zoteroMcpProtocol.ts`（1502 行）
- `docs/components/zotero-mcp-service-design.md`（1778 行）
- `rust/zotero-bridge/`（11 文件 13011 行）、`contracts/host-bridge/cli-commands.v2.json`（133 命令实测）
- `contracts/host-bridge/`（capabilities.v2.json 101 条、surfaces.json 3 个、schemas 15 个）
- `addon/bin/zotero-bridge-release.json`、`rust/zotero-bridge/cli-build-recipe.json`
- `scripts/synthesis/check-synthesis-cross-language-contracts.ts`（实跑输出）、7 个 surface parity 脚本、`check-synthesis-native-runtime-contract-parity.ts`
- `scripts/host-bridge/`（30 个脚本）
- `src/modules/hostBridge/permissions/hostBridgePermissionManager.ts`（649 行）、`hostBridgeWriteAutoApprovalRegistry.ts`
- `src/modules/hostBridge/cli/hostBridgePluginSkillBundle.ts`、`src/shared/hostBridgePluginSkillBundleContract.ts`
- `addon/content/host-bridge-skills/`（7 个 skill 清点）
- `src/modules/pluginStateStore/mutationAuthorityTable.ts`
