# 基本单 Agent harness

## Why

共同内核生命周期与工作台外壳已经交付，但默认工作台仍禁用发送，没有项目文件接口、真实模型、持久会话或执行恢复。下一步需要让用户在同一工作台授权项目、读取材料并留下真实成果，验证科研内核能脱离窗口继续执行。文件保护必须与写入能力一起交付，避免用固定回复或临时文件工具冒充可用的 Agent。

## What Changes

- 内置 MiniMax M Plan 中国区，用户只填写 API Key；自研加密 credential store，支持环境注入。
- 项目身份、共同文件读写、差异、草稿、安全撤销、备份及独立副本恢复。
- Deep Agents／LangGraph 持久会话、流式执行、可靠追加、取消、断线观察与显式接续。
- 共同协议、CLI 与双宿主工作台接线，模型替身仅位于外部 HTTP 边界。
- 本次不包含方法／能力调用、shell、插件 MCP 和多 Agent。

## 完成判据

用户经产品入口完成配置、项目授权、读取与修改材料，磁盘成果和执行记录可核查；追加指令、取消、关窗重接与重启接续有实际验证。文件冲突不覆盖外部编辑，旧备份恢复到独立副本。完成相关静态检查、内核测试、双宿主用户流程和受限真实 MiniMax 样本。

## Capabilities

### New Capabilities

- `model-access`: 内置模型、凭据、发送授权和共同资源控制。
- `project-files`: 项目身份、安全文件接口与备份恢复。
- `agent-harness`: 持久会话、指令、执行、状态订阅和接续。

### Modified Capabilities

- `ui-workbench-foundation`: 默认来源接入真实指令与材料。
- `ui-workbench-shell`: 会话列表、文件页与 Agent 控制接入真实状态。
- `kernel-lifecycle`: 停机协调持久执行。

## 决策与授权依据

沿路线图 P2 与 P3a–P3c、决议 #07、#12、#13、#22、#25、#43。用户在本会话选择完整单 Agent 闭环、项目一次授权、MiniMax M Plan 中国区、自研 credential store 和本机自动解锁，授权必需固定版本依赖及使用环境 key 测试；随后明确要求 Implement the plan。没有 Git 提交或发布授权。
