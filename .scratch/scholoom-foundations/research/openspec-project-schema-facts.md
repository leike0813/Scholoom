# OpenSpec 项目 schema 事实

核对日期：2026-10-04。本机 CLI 为 1.14.0；官方来源固定到 v1.14.0。子 Agent 调查官方文档与源码，主 Agent 复核官方 schema／config 文档及本机安装实现。仅运行版本、schema 查询和帮助命令，未安装依赖或运行应用；本文件是调查工件。

## 项目 schema 与选择

项目 schema 位于 `openspec/schemas/<name>/schema.yaml`，模板位于同目录的 `templates/`。按项目、用户、CLI 内置顺序查找，目录名是查找键。[schema 参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/schemas/schema-yaml.md)

变更采用的 schema 按显式 `--schema`、变更 `.openspec.yaml`、项目 `openspec/config.yaml`、内置 `spec-driven` 顺序选择。项目默认值不会覆盖已有变更的明确记录。[选择实现](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/src/utils/change-metadata.ts)

项目副本不会随 `openspec update` 更新，需要自行核对上游改进。[定制 schema](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/customize/schemas.md)

## 能力与限制

- schema 定义 artifact 的 id、输出路径、模板、指引及 requires，形成固定依赖图；apply 定义 requires、tracks 和 instruction。未知字段不会自动获得执行含义。[类型定义](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/src/core/artifact-graph/types.ts)
- artifact 完成状态按输出文件存在判断；glob 匹配到文件即可，内容是否正确或实际验收通过不由此判定。[schema 参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/schemas/schema-yaml.md)
- apply.tracks 可以是相对路径或 glob，靠任务 checkbox 统计完成。建议与某个 artifact 的 generates 完全一致，以保持 status／list 进度一致。[schema 参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/schemas/schema-yaml.md)
- 没有通用条件 artifact 字段。内置 design 的适用条件由自然语言指引表达；无行为变化时 `skip_specs: true` 可专门跳过 specs/ 输出，其处理并非通用条件执行器。[默认 schema](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/schemas/spec-driven/schema.yaml)、[skip_specs 处理](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/src/core/artifact-graph/instruction-loader.ts)
- schema 没有专门的“实现后验收”类型、审批或执行 hook 字段；配置指引交给 Agent 遵循，不能宣称 CLI 会核验实际测试或授权。[类型定义](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/src/core/artifact-graph/types.ts)、[项目配置](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/configuration/config-yaml.md)

## 配置指引和验证

config.context 用于共同约束；rules 对对应 artifact 提供补充指引；operations 仅提供 apply／archive 的操作建议。这些字段的能力是上下文注入。[配置参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/configuration/config-yaml.md)

verify Skill 核对实现与实际工件，rules 不直接传给它；验收要求应实际写入 specs／design／tasks，而不是只藏在生成提示里。[项目定制说明](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/customize/project-config.md)、[Skill 参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/skills.md)

`openspec schema validate` 检查结构、依赖与模板；`openspec validate` 检查规格与变更结构；这些结果不能证明产品行为通过。verify 由 Skill 提供，不是该版本的 CLI 子命令。[CLI 参考](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/docs-lab/reference/cli.md)、[验证实现](https://github.com/Fission-AI/OpenSpec/blob/v1.14.0/src/core/validation/validator.ts)

## 对项目方案的启示

用户已批准制作 [scholoom-dev](../../../openspec/schemas/scholoom-dev/README.md)。该 schema 将 investigation 和 delivery 纳入工件图，apply 仅依赖实现前工件；delivery 的实际生成时机由指引表达，CLI 的 ready 状态不证明实现已完成。执行后的成果、验证与交接写入 delivery.md，任务进度以 tasks.md 为准。具体阶段约定以 schema 为事实源。
