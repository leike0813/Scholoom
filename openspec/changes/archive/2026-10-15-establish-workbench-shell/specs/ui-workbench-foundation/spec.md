# Spec Delta

## MODIFIED Requirements

### Requirement: 共享正式工作台

浏览器与 Electron SHALL 默认呈现同一工作台，布局沿用 `ui-workbench-shell` 的三区骨架：材料与文件操作位于右区辅助面板，Agent 交流位于中间区 Agent 面板，指令输入位于 Agent 面板的 composer；材料、交流与指令操作使用共享实现。默认来源 SHALL 在左区底部显示实际内核连接状态并提供生命周期操作。连接可用性 SHALL 不被当作科研 Agent 已可发送的证明。

#### Scenario: 从不同宿主进入
- **WHEN** 用户打开浏览器或 Electron 默认入口
- **THEN** 看到三区工作台：右区材料区域、中间区 Agent 面板与交流、composer 指令输入和左区底部的实际连接状态；尚未接入研究指令能力时草稿可编辑、发送不可用
