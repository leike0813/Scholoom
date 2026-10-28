# 变更提议

## Why

科研域需要按原启动指令和真实执行身份核查历史尝试，而当前 harness.snapshot 只返回会话最新运行。取消后建立的新运行也没有可供领域消费的稳定来源关联。缺少该接口会迫使科研模块猜测同配置运行或复制执行状态。本公共增量提供有界只读查询及启动来源，继续由harness掌握执行事实。

## What Changes

- 增加内部harness.executions，按所属会话及runId、instructionId或originInstructionId精确查询，分页返回原Run。
- 源码图绑定增加宿主生成的originInstructionId，普通接续沿用，显式新启动建立新来源。
- 查询、原记录及恢复不触发执行，不复制科研业务语义，不引入新依赖或数据表。

## 完成判据

原启动回执可核查；新尝试与原图调用关联；显式同配置新调用不混同；跨会话查询不泄露；查询有页数及字节上限；真实worker接续和旧图回归通过。

## Capabilities

### Modified Capabilities

- `domain-execution-handoffs`：增加历史执行查询与源码图启动来源约定。

## 决策与授权依据

2026-10-25用户在本会话明确选择“方案A：由本线规划并实现独立的公共查询增量”，并授权按锁文件安装既有依赖。此增量服务connect-research-graph-runtime的G1，不包含Git提交、推送、PR或其他工作树操作。沿项目统一broker、所属记录权威及公共增量分工实施。
