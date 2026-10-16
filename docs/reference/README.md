# 参考资料指引

本目录放四份「供实现型 agent 直接消费」的参考文档，都只提供数值、事实与对照，不改任何产品代码。

## 本目录放什么

| 文档 | 定位 | 解决什么问题 |
|---|---|---|
| [`codex-atlas-specs.md`](codex-atlas-specs.md) | 图册实测规格（视觉） | `references/Codex-UI-Reference-Atlas.pdf` 每页只有散文观察，缺色值、尺寸、间距与状态矩阵。本文把 16 张官方素材逐张量成数值，并汇总语义色对照、尺寸阶梯、层级可读性与缺口清单 |
| [`paseo-ui-patterns.md`](paseo-ui-patterns.md) | 外部前端做法（视觉层） | `references/paseo` 的 token 体系与几何常量成熟但读码成本高。本文整理字面量、控件几何、交互契约常量、可迁移做法与不可直接迁移的 RN 专有做法 |
| [`paseo-ux-patterns.md`](paseo-ux-patterns.md) | 外部前端做法（UX 层） | 同上源码的另一半：**功能怎么组织、用户点了会发生什么**。信息架构、面板与命令的注册模型、会话与 turn 的状态机、控件按压与弹层行为、快捷键体系、错误与空态的多层表达，最后收敛成一份跨切片的差距总表 |

三份的关系：**图册给数值，paseo 给组织方式与交互行为。** 图册提供本项目色值与尺寸的实测参照，
paseo 提供单一来源、派生规则、注册表、状态推导这类结构性做法。
它们都不替代现有事实源——颜色仍以 `apps/desktop/src/renderer/src/styles.css` 为准，
结构决策仍以 [`docs/ui-design/README.md`](../ui-design/README.md) 为准。

同目录之外，本项目已有的设计依据不在此重复：视觉与布局的唯一事实源是
[`docs/ui-design/README.md`](../ui-design/README.md)，本文三份只被它引用。

## 为什么 UX 只做 paseo，不做 Codex

图册是 16 张**静态帧**，其中 6 张还是官方裁切图。按图册自己的声明（第 18 页）：
「公开静态图片无法验证悬停、键盘操作、动态刷新性能和真实尺寸」。

单帧证明不了点击后的状态迁移、悬停与按压差异、快捷键与焦点顺序、右键菜单、多步流程的中断与恢复。
[`codex-atlas-specs.md`](codex-atlas-specs.md) 已把这些逐条写进 16 节的「不可推断」栏，文末 D 表
登记为缺口——**Codex 侧的 UX 无可信来源，硬写就是编。** 图册仍能提供信息架构层面的线索
（哪块区域长期存在、状态与对象如何相邻），那部分已在 `codex-atlas-specs.md` 各节「画面结构」栏里。

## 来源

- **`references/Codex-UI-Reference-Atlas.pdf`** — Codex UI 设计参考图册，18 页，1440×900 pt，内嵌 16 张官方公开截图
  （原生分辨率 1919×1145 至 8192×4608 不等）。采集 2026-10-14。第 1 页封面与第 2 页引用同一图像对象。
- **`references/paseo`** — git submodule，commit `5c2a155`。渲染层 React Native + Expo，样式走
  `react-native-unistyles` v3；桌面主进程 `tsc` 直编译。

## 复核方法

各文档自带复核附录，命令可原样重跑：

- [`codex-atlas-specs.md` 附录](codex-atlas-specs.md#附录取样复核方法) — `pdfimages` 抽取原始截图、
  按 1px/2px 参照线校准缩放比、`magick` 取色与量边、1:1 裁切校验。文档内的每个 hex 与 px 都标了
  取样坐标或判据。
- [`paseo-ui-patterns.md` 附录](paseo-ui-patterns.md#附录复核方法) — `grep` 核对字面量与常量、
  逐条 `read` 核对 `路径:行号` 引用、行号漂移时按符号名改写。
- [`paseo-ux-patterns.md` 附录](paseo-ux-patterns.md#附录复核方法) — 先看文件规模再决定读哪些，
  并附本项目现状的核对命令（键盘监听分布、ARIA 分布、缺失能力检索）。

未核实处三份文档都写 `unverified — 需确认` 或「未核实项」，不复用记忆代替回查。仓库改动范围应只有
本目录的四个 `.md` 文件；`styles.css`、`tests/ui/`、`docs/ui-design/` 均未改动。
