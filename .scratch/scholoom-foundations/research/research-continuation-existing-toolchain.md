# 已有研究的续做与复用：旧工具链事实

2026-10-08，只读核对 ResearchSpec `607c7a73` 与 zotero-agents `e48b2124`。沿用前序调查；源仓库通过 CodeGraph 定位，主 Agent 核对使用方法、恢复源码入口与研究包说明。未运行 CLI、科研任务、测试或模型。用户体验与 Scholoom 决定见[场景票](../issues/29-research-continuation-and-reuse.md)。

## 已有路径

- ResearchSpec 的普通工作恢复方法要求 Navigate 从相关任务笔记和当前材料找回目标、已完成内容与下一步，并核对材料和产出。普通工作不要求建立 graph；相关正式 run 则从当前状态与对应 instructions 恢复。[使用方法](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/docs/user/usage-model.md:316)。
- 正式 run 有恢复摘要机制，表达交付目标、frontier、待确认控制和阻塞材料，依据当前图与记录派生。它与普通工作的方法分开，不能据此将全部科研上下文缩减为执行状态。[恢复摘要源码](/home/joshua/Workspace/Code/JavaScript/ResearchSpec/src/core/runtime/graph-recovery.ts:23)。
- zotero-agents 的研究包 workflow 声明按论文意图从已有文献库与主题中挑选材料，产出只读研究包。它读取已有状态，不负责联网检索、入库或主题更新；分析产物的实际导出程序已在[首个场景底稿](research-scenarios-existing-toolchain.md)核对。[研究包方法](/home/joshua/Workspace/Code/JavaScript/zotero-agents/workflows_builtin/literature-workbench-package/export-research-bundle/README.md:5)。

## 证据边界

以上说明已有方法与源码，不证明所有跨 session／Agent 的承接效果。用户明确这种工作区设计使实际续做基本顺畅，并要求 Scholoom 吸纳；“几乎无损”是用户提供的体验与本项目的设计目标。本轮未调查工具链升级行为，也未继续追踪材料补充链路；材料补充问题沿首个场景处理。
