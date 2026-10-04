# 图谱计算与显示组件事实

核对日期：2026-10-04。为 [#12 技术栈](../issues/12-technology-stack.md)补充已有 [TS 计算源码调查](synthesis-typescript-main-compute.md)。本轮只读官方文档和许可，未安装、运行或比较性能。工具具体版本在集成时固定。

## 计算、显示和领域权威

- Graphology 提供 JS／TS 图结构，支持有向、无向、混合图及多重边，配有布局、遍历和指标等算法模块；图变化可发出事件。它适合用作计算或界面实例的内部表示，不能由此认定应将库对象作为 Scholoom 协议或持久化权威。[官方接口](https://graphology.github.io/)、[算法模块](https://graphology.github.io/standard-library/)
- 已有 main／历史 Synthesis 代码使用 d3-force 提供 force 布局，另有 radial／components 实现及独立抽取候选。沿此路径可复用现有计算；旧 Rust ForceAtlas2 与这些布局并非同一算法，坐标不承诺相等。[固定源码调查](synthesis-typescript-main-compute.md)
- d3-force 支持 `stop()` 配合 `tick()` 计算静态布局；其输入节点会被修改，官方建议大图静态计算进入 Worker。Scholoom 沿已确认 #09 的 Node Worker 执行计算，传回结果；不能将调用 async 包装视为卸载计算。[simulation API](https://d3js.org/d3-force/simulation)
- Sigma.js 使用 Graphology 作为图模型，以 WebGL 绘制网络；节点需要 x／y 等显示属性，提供节点／边事件和相机交互。可将布局结果交给它显示，图谱点击关联文献与证据的行为仍由 Scholoom 工作台定义。[简介](https://www.sigmajs.org/docs/)、[图数据](https://www.sigmajs.org/docs/advanced/data/)、[事件](https://www.sigmajs.org/docs/advanced/events/)
- Sigma 提供实例销毁、数据变更触发刷新和按帧合并刷新入口。React 可以管理容器及实例生命周期；库自动刷新不免除应用对图查询范围、数据批量更新和主线程响应的责任。[生命周期](https://www.sigmajs.org/docs/advanced/lifecycle/)
- 当前官方主文档提示 v4 为 alpha，建议候选沿 v3 稳定路线固定版本；不把新主分支的能力自动计入已选版本。[发布路线入口](https://www.sigmajs.org/docs/)
- Cytoscape.js 是另一成熟候选，包含布局、选择器、图操作和 compound nodes。若真实交互需要复杂分组编辑，可按实际样本再比较；本次未测其与 Sigma 的响应或规模差异。[官方文档](https://js.cytoscape.org/)

## 许可声明

Graphology 官方仓库为 MIT，Sigma 主分支许可正文为 MIT，d3-force v3.0.0 为 ISC。[Graphology LICENSE](https://raw.githubusercontent.com/graphology/graphology/master/LICENSE.txt)、[Sigma LICENSE](https://raw.githubusercontent.com/jacomyal/sigma.js/main/LICENSE.txt)、[d3-force LICENSE](https://raw.githubusercontent.com/d3/d3-force/v3.0.0/LICENSE)。Sigma 的最终固定 v3 包和实际扩展还需逐项核对；本轮主分支声明不代替具体分发包的声明。

## 接入建议与未验证项

建议 Graphology 用于图结构和需要的现成算法，d3-force 配合既有 TS 布局执行计算，Sigma.js v3 为引用／概念网络显示首选。领域 DTO 和事实继续由内核定义，界面仅建立当前研究范围的图投影。该组合是基于已有源码与接口的取舍，未证明性能优于其他方案。

实际验收覆盖代表性稀疏／密集图、长中文标签、方向和多重边、筛选与文献／证据导航、Worker 耗时和取消、结果传输、刷新响应、WebGL 可用性及三平台打包。节点规模和可交互性由实际样本测量，不能将官方描述的“数千节点”当作应用性能承诺。
