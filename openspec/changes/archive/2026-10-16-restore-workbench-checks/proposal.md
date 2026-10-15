# 变更提议

## Why

P3d 交付期间，全仓 lint 被四个既有工作台文件的格式、import 和元素语义问题阻断，已记录在 artifacts。继续 P4a 前恢复该检查，避免后续功能变更长期依赖局部静态验证。本次保留当前可访问 role、名字、交互与布局，只调整承载元素及按钮类型，复用现有双宿主回归验证。

## What Changes

修正 SessionList 和 ActivityPane 的 tree 容器、AuxiliaryPane 的 tablist 容器及三个 tab 按钮类型；整理四文件格式/import 和无效 Fragment。将已有 artifacts 记录标明已解决。

## 完成判据

全仓 lint、类型检查与构建通过，既有双宿主会话和工作台结构回归通过，无新增行为测试。

## Capabilities

无规格级变化，沿 `ui-workbench-shell` 的既有树、tab 和双宿主契约；声明 skip_specs，不生成 delta。

## 决策与授权依据

用户持续目标授权逐步实施、归档及提交，工程验证沿 #14/#15。修复已查明的验证基线问题是进入下一业务阶段前的有限维护，不安装依赖、不扩大功能范围。
