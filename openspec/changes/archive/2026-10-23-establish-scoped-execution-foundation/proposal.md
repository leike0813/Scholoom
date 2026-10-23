# 建立固定工作域与受限资源访问基础

## Why

当前 application 已有固定身份和隔离会话临时区，但它只允许发送消息；项目文件守卫会拒绝包括只读在内的跨项目访问。七域并行前需要让全局会话按目标授权取材，同时保持自身临时区、目标项目与库成果的责任分开。简单放开 projectId 检查会扩大写权限，必须补齐可信调用范围和独立只读入口。

## What Changes

- 复用 application、现有会话 scratch、broker 及项目文件保护，增加宿主建立的工作域描述与只读目标访问端口。
- 保持普通项目的原读写边界；跨项目访问限已登记且可信的目标，经所属模块再次检查真实路径、身份、内容依据及外发条件。
- 全局会话的临时文件仅进入自己的 scratch；不把整个 application 配置目录变成项目文件区，不向其开放通用 Shell。
- 提供可替换窄端口及无模型模块验证；工作域契约先交付，其他两线可并行实现，实际授权能力作为资源交接和工作台真实接线的前置。

## 完成判据

全局会话可读取获授权目标材料；任意目标写入、私有路径、越界和撤权后的新读取均被拒绝。两个会话 scratch 隔离，清理临时区不影响领域成果。既有项目保存、人工组合及会话接续回归通过。

## Capabilities

### New Capabilities

- `execution-work-domains`: 固定工作域、会话临时资料及可信跨项目只读访问。

## 决策与授权依据

依据[全局工作域决定](../../../../.scratch/domain-development/issues/04-research-methods-scope.md#全局会话与工作域)、[公共基础范围](../../../../.scratch/domain-development/issues/10-parallel-design-and-delivery.md#q3公共基础优先补齐四组共同部分)和[共同工程分工](../../../../.scratch/domain-development/issues/09-shared-engineering-responsibility.md#answer)。用户于 2026-10-22 要求“形成OpenSpec实施规划”，本轮授权为调查及规划，不包含业务实施、依赖安装、服务、真实模型或 Git 操作。

随后用户要求开始实施，并明确选择“本轮只做共同契约 1.1”。当前实施授权限工作域、可信上下文及目标只读契约的声明、生成和验证；运行时读取、授权接线、其他 change、Git 提交和工作树操作仍不在本轮范围。

2026-10-22 用户在本工作树要求“实现 openspec/changes/establish-scoped-execution-foundation”，续做本变更的运行时能力、测试和文档。当前工作树实施沿现有设计；Git 提交、分支切换及接入 dev 仍需单独授权，其他两线的功能不在本变更实施范围。

随后用户要求“向 dev 分支发 pr”，授权提交当前变更、推送当前分支并创建目标为 dev 的 PR；实际合并及 dev 接入验收留待 PR 流程完成。
