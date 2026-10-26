# workbench-resources Spec Delta

## ADDED Requirements

### Requirement: 项目资源保存与修改历史关联分别可核查

项目资源的创建／执行保存结果 SHALL 在所属历史确已登记时提供可核查的editId；未提供时只能通过所属文件的实际版本与历史查询核查，不能把ResourceEvidence.basis、创建operationId或成果association当作editId。只在实际可证明的保存结果返回修改关联，不改变ResourceDescriptor的材料身份语义。来源与旧创建回执仍由projects掌握，不赋予库正文写入能力。

文件保存、FileEdit登记、执行成果association及任务入口links SHALL 分别表达其实际结果。后续关联失败不回滚已经保存的文件，不能重新生成成果或自动登记一份任务正文。

#### Scenario: 成果登记部分失败

- **WHEN** 项目正文及FileEdit已保存，而执行成果登记或任务入口关联失败
- **THEN** 保留可核查的文件／修改记录，分别报告未完成关联，不将其解释成文件未保存或所有关联已完成

#### Scenario: 无修改身份的旧结果

- **WHEN** 旧资源保存结果没有editId，或历史登记不能核实
- **THEN** 显示关联不可核查并沿所属查询处理，不用相同文字、basis字符串形状或时间邻近推断editId
