# Scholoom 项目入口

使用中文沟通。沿用用户的操作授权及已有决定；用户当前指示优先。

- 产品、领域和架构讨论先读 [.scratch/scholoom-foundations/map.md](.scratch/scholoom-foundations/map.md)，再按当前问题读取相关决策票；地图是索引，具体决定以对应票为准。
- 领域术语见 [CONTEXT.md](CONTEXT.md)。实现时核对当前代码、规格和真实运行结果，发现漂移更新相应事实源。
- 开发、调试和验证先读 [开发说明](docs/development.md)，实际命令以根 `package.json` 为准；源码位于 `apps/` 与 `packages/`，`.scratch/` 是决策和原型材料。
- 新功能、接口／状态变化、数据迁移和核心跨模块约定使用项目默认 OpenSpec schema；已有契约内的小清理、文字调整和简单修复沿轻量流程。
- OpenSpec 实施与续做先读 [scholoom-dev 的阶段约定](openspec/schemas/scholoom-dev/README.md)，再获取当前变更的 instructions；使用 continue 时，按该约定的阶段判断处理 delivery，优先于通用 Skill 的“生成首个 ready 工件”步骤。
- 宏观产品、领域和架构判断由主 Agent 与用户讨论。范围明确的事实调查、执行和必要审查可委派，模型沿用户当前指定，委派前说明任务与模型。
