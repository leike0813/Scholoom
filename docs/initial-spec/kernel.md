# 内核与状态观察 Specification

初设参考；适用方式见 [总入口](README.md)。

## Purpose

定义工作台、CLI 和内核之间的可观察生命周期与状态传递行为，使科研工作能独立于界面持续开展，并在断线、多客户端介入和通知积压时仍能查明实际成果、待处理事项及当前可用性。

依据：[架构与客户端协议 #09](../../.scratch/scholoom-foundations/issues/09-electron-architecture.md#answer)、[生命周期 #23](../../.scratch/scholoom-foundations/issues/23-kernel-entry-and-lifecycle.md#answer)。

跨模块 broker、内部通道、双向调用、版本与接口发现、操作等待策略沿[内部接口决议](../../.scratch/runtime-architecture/issues/06-internal-interfaces-and-ipc.md#answer)；以下共同领域及结果语义继续适用，具体声明和接线另以 OpenSpec 实施，不将初设视为已交付。

对外 MCP 服务为已确认目标、尚未实施：stdio 与 Streamable HTTP（HTTP 默认回环，远程接入须明确配置 HTTPS）、默认关闭、按外部调用方逐方授权，含 Tasks 扩展并保留普通工具路径；范围沿[对外接口决议](../../.scratch/runtime-architecture/issues/07-external-interfaces-and-extensions.md#answer)，正式契约与接线由后续 OpenSpec 承接。

## Requirements

### Requirement: K-01 独立内核与单实例

已转入[内核生命周期正式规格](../../openspec/specs/kernel-lifecycle/spec.md)的“共同配置与单实例”“明确停机与结果确认”及“调试内核归属与回收”；以正式规格区分普通关窗驻留与最后调试所有者退出回收。

### Requirement: K-02 连接与明确停机

已转入[内核生命周期正式规格](../../openspec/specs/kernel-lifecycle/spec.md)的“本机认证与共同协议”“有界恢复与界面保护”及“明确停机与结果确认”。版本、认证、草稿、重连和结果未知以该处要求及场景为准。

### Requirement: K-03 共同入口与操作结果

GUI、CLI、Agent 与兼容适配 SHALL 经共同领域契约访问同一事实并执行相应授权校验。本机客户端端点 SHALL 限于本机监听并验证客户端身份。请求编号 SHALL 不替代任务、会话或执行身份。长操作 SHALL 返回稳定引用并提供查询或订阅；效果未知的写入 SHALL 先核查而非盲目重放。

#### Scenario: 未通过身份验证的客户端连接
- **WHEN** 客户端尚未通过内核身份验证
- **THEN** 不能读取领域数据、订阅状态或执行操作，本机连接本身不等同授权

#### Scenario: 长操作受理后断线
- **WHEN** 批量摄取或科研执行已受理，客户端随后断线
- **THEN** 操作不因连接断开而取消，客户端可按稳定引用查询实际结果

#### Scenario: 写入未收到回执
- **WHEN** 客户端无法确认某项写操作是否成功
- **THEN** 暴露结果未知和核查途径，不通过新请求编号直接重复副作用

### Requirement: K-04 有界订阅与局部重同步

状态订阅 SHALL 覆盖快照读取与订阅接入之间的变化，按授权范围缓冲有界通知。溢出或连续性失效 SHALL 只使相关订阅重新同步；工作台保留旧视图并标明刷新，草稿和未保存编辑独立保留。已保存结果及待处理事项 SHALL 可从持久事实重新读取。

#### Scenario: 一个会话的通知积压
- **WHEN** 该会话订阅队列溢出而其他订阅仍有效
- **THEN** 仅重读该范围快照，不清空其他视图或覆盖输入草稿，已保存决定和结果仍可查到

#### Scenario: 合并进度更新
- **WHEN** 同一执行产生多个可替代的绝对进度更新
- **THEN** 可以只展示最新进度；追加消息内容不以只保留最后一个片段的方式截断

### Requirement: K-05 故障范围如实呈现

系统 SHALL 按实际受影响执行呈现失败；共享宿主故障标明所有受影响调用。内核自身故障可中断依赖它的会话，工作台 SHALL 保留草稿与已显示内容，重启后沿 [执行恢复](research.md)核查并续做，不宣称持续运行或自动重试已安全完成。

#### Scenario: 兼容宿主崩溃
- **WHEN** 共享 Zotero 兼容宿主退出
- **THEN** 受影响调用可诊断，重启环境与重试写操作分别判断，其他可独立工作不被误报失败
