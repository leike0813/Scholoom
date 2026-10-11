# omp advisor：写作过程内监督的参考机制

日期：2026-10-09。官方仓库 [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)，核查基线 `a3fe79348f5bbd104be4bc9354f89cad430412d6`。子 Agent 核对文档与源码，主 Agent 抽查官方文档、建议工具和会话调度。全部为静态调查，未运行 omp、模型或实际写作任务。

## 官方入口

- [advisor 文档](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/docs/advisor-watchdog.md)
- [运行时](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/runtime.ts)
- [建议工具与分发策略](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/advise-tool.ts)
- [主会话调度](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/session/session-advisors.ts)

## 已核事实

| 方面 | omp 的实际约定 | 依据 |
| --- | --- | --- |
| 开关与角色 | 子系统默认关闭；可显式启停，名单中每个 advisor 可指定模型、工具、方法指令和评审节奏。会话开关与持久配置有区别。 | 官方文档 Enabling the advisor、WATCHDOG.yml；[配置](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/config.ts#L61)。 |
| 执行主体 | advisor 是独立 Agent，有自己的消息积累和 ToolSession，而非把提示词附到主模型便称为独立监督。 | 官方文档 Tools and isolation。 |
| 当前上下文 | 按游标接收主 Agent 的新增消息，包含运行时可见推理、文本、工具意图／结果、编辑差异及展开的约束；另取得项目指令。工具输入输出发送前经过会话凭据遮蔽处理。 | 官方文档 What the advisor sees；[增量渲染](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/delta-split.ts#L35)。 |
| 上下文更新 | advisor 已注入的建议从后续增量中滤去，避免评审自己的建议；主上下文压缩或重写时重置并重放当前有界内容。中途开启时游标从当前末尾起，不重放此前整段会话。 | 官方文档 What the advisor sees。 |
| 触发 | 主 Agent 的 turn 边界捕获增量，包含工具调用轮；`turn` 与 `agent-end`、间隔配置决定何时启动评审，未评审更新可积累。不是逐 token 触发，也没有专门的科研写作文本完成事件。 | [会话调度](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/session/session-advisors.ts#L659)；官方文档 WATCHDOG.yml。 |
| 输出 | 通过 `advise` 提交建议；消息保留 advisor、严重程度和所涉轮次，提示主 Agent 权衡建议。 | [建议格式](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/advise-tool.ts#L46)。 |
| 注入 | aside 在后续边界进入上下文；steer 可影响运行中的 Agent 或触发继续；preserve 保存为可见建议，后续恢复时进入上下文。选择受严重程度、当前执行、是否已经结束和用户中断影响。 | [分发策略](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/advisor/advise-tool.ts#L115)。 |
| 结束边界 | 边界内的多条建议合并投递；blocker 或终局评审的 concern 可触发一次继续，其余可能留为可见卡片。不能概括为所有建议都会在结束前被处理。 | [边界汇总](https://github.com/can1357/oh-my-pi/blob/a3fe79348f5bbd104be4bc9354f89cad430412d6/packages/coding-agent/src/session/session-advisors.ts#L1755)。 |
| 等待 | `syncBacklog` 配置是否等待 advisor 排空，默认 off，也有有限等待与 strict；strict 无壁钟上限，但取消、失败等仍可结束等待。 | 官方文档 Catch-up with advisor.syncBacklog；会话调度 691–700。 |
| 主动中断 | 用户中断后，advisor 建议不能自动恢复被停止的 Agent，已产生建议保留到用户恢复；advisor 关闭会停止运行时。 | 官方文档 Tools and isolation、Enabling the advisor。 |
| 防循环 | advisor 引发的继续不再触发新的 advisor 评审，仍捕获内容供下次正常评审；另有建议预算、去重和干预冷却。 | 会话调度 649–681；官方文档 WATCHDOG.yml、Emission guard。 |
| 工具 | 默认调查工具只读，始终有 advise；显式配置可授予写入等其他工具，独立 ToolSession 并不等于只读隔离。 | 建议工具 169；官方文档 Tools and isolation。 |

## 对 Scholoom 的参考范围

用户已明确：文风监督是可显式开关的写作 advisor，取得当前写作 Agent 上下文，在生成文本后注入修改建议；目标仍是 Agent 生成文本。学术分工审稿另有独立初审安排。

可借鉴独立角色、上下文增量、建议消息、边界注入及防止建议自触发的机制。Scholoom 需按写作任务识别所涉生成文本，advisor 的读取范围与建议对象分别表达；当前执行共享上下文与跨会话使用持久化科研材料各有用途。

omp 中途开启不回放此前内容，不能直接推为 advisor 当时已拥有完整写作背景。Scholoom 已确认开启时取得当前有效写作上下文、后续更新增量，过程中后台运行、结束本轮有限等待，并规定建议触发继续及关闭后的处理；具体决定以[多模型协作票 Answer](../issues/37-multi-model-research-collaboration.md)为准，运行接口由 harness 协作票落实。

omp 内置 advisor 方法偏向代码正确性、设计和验证，文风监督需要自己的方法约束。其备用模型链、strict 等待、严重程度枚举、文字去重及 WATCHDOG 文件布局是上游实现选择，不自动成为 Scholoom 决定；模型切换和授权沿本项目既有政策。

## 未实测

当前源码与本地已安装版本未逐行比较；未验证模型上下文填充、建议到达时机、上下文压缩后的实际表现、停止效果、写作质量、费用或延迟。源码中的具体额度及去重实现没有作为本项目可靠性保证。
