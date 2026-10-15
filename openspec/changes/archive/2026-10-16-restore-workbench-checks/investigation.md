# 调查依据

## 当前事实与复用选择

P3d 记录的11个 lint 错误来自四个原有文件。`nav role=tree/tablist` 把非交互导航语义改为交互 role；更换为中性 div 可保留 role。AuxiliaryPane 三个按钮缺少明确 type，其余按钮已使用 type=button。ProjectNavigation 有仅包含 permission 的无效 Fragment；余项是 Biome 可确定整理的格式/import。

已读取正式 ui-workbench-shell、设计文档及现有 workbench/conversation 测试。样式通过 `.project-tree`、`.auxiliary-tabs` 类定位，不依赖 nav 元素；不改 CSS、状态、回调或可访问名。现有测试已经覆盖会话查找/归档、tab、左右区和面板操作。

## 结论与承接

无阻塞未知项，不需要实验或新测试。用中性容器保留既有交互语义，运行全仓静态/构建和代表性双宿主现有用例。
