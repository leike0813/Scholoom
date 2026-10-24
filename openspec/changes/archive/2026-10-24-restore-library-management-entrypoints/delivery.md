# 实际交付与交接

## 当前状态与成果

2026-10-24，按用户批准方案在 dev 由主 Agent 实施，未再分派工作树或代理。当前 LibraryTab 接回原 LibraryPanel 的授权、建项、JSON／本地材料摄取、批次结果与接续、集合、独立备份恢复，以及修订核对和持久草稿；保留现有虚拟列表与两栏详情布局。主体沿 [design](design.md#变更总览) 接线，未新增后端、协议、依赖或第二份库权威。

工具栏“新建题录”聚焦同一手动表单，列表刷新不抢走输入焦点；集合和分页按实际 API 读取，不展示未接线的版本筛选。读取失败在原 tab 明示，撤权时隐藏受保护题录。原未接线的元数据／标签／关联及筛选占位已删除，相关编辑以单一修订明确保存。UI 设计与开发说明已同步。

## 实际验证

Linux、Node 24.12.0、pnpm 11.10.0，复用现有运行时与依赖。真实客户端、SQLite、文件、受管执行和双宿主接线；模型边界使用原 loopback 合成响应，没有真实外部科研模型调用。

| 命令／路径 | 实际结果 |
| --- | --- |
| 既有 `tests/ui/library.spec.ts --project ui-browser`，修改前 | 在已移除的授权入口失败；`/tmp/scholoom-r6-library-red.log`、`test-results/r6-library-red` |
| library／attachments，初次接回后双宿主 | 6/6，1.5分钟，`/tmp/scholoom-r6-library-green.log`；建项、部分失败、多附件、下载、外链重定位、冲突、异步草稿和独立恢复 |
| 最终 `playwright.ui.config.ts` 的 library、attachments、context-bridge、resource-opening、resource-lifecycle，端口5617 | **16/16，5.7分钟**，`/tmp/scholoom-r6-ui-final.log`，`test-results/r6-ui-final`；增加工具栏聚焦核对，含真实上下文、保存、关闭与独立草稿 |
| smoke development 的两个非 live 场景 | 双实例隔离1/1，34.5秒；真实 dev命令共享／最后宿主回收／重启读回1/1，3.9分钟；`/tmp/scholoom-r6-development.log`、`/tmp/scholoom-r6-development-final.log` |
| root `pnpm --config.optimisticRepeatInstall=false typecheck`／`build` | 均通过，`/tmp/scholoom-r6-final-{typecheck,build}.log`；最后焦点与读取错误显示调整另通过 desktop tsc，构建已包含该调整 |
| Biome／architecture／OpenSpec | 无错误，71既有warnings／35infos，13模块194文件零findings；`/tmp/scholoom-r6-final-lint.log`、`/tmp/scholoom-r6-spec-validation.json` |

表内6项与最终16项有重叠，不累加。恢复使用测试创建的独立临时目录，未读写用户文献库。截图沿同一输出目录保留，检查并修正工具栏窄宽度下竖排按钮，浅色截图已核对，未据此宣称所有视觉状态已验。

## 审查与问题处理

主线逐项对照旧接线、共同 schema 与现有测试，核对原修订号保存、异步回执、权限分别设置、独立恢复及有界列表；未修改所属库的数据保护实现。按用户不再分派的要求，没有新增独立代理审查。

开发模式场景首次和定向复跑均在180秒总预算失败。HTML报告表明启动两条真实命令与连接消耗约139秒，库建项、跨端读回、刷新、两次关闭／内核回收检查均通过；第三条命令仍在重新构建共享包时总预算耗尽。将场景总预算改为300秒，保留每条命令60秒启动、60秒连接和原停止／身份断言后，全场景实际3.9分钟通过。没有把最终断线页面当作库失败，也未修改产品生命周期时限。

## 未完成事项与下一步

本变更的 Linux 双宿主用户路径完成。完整UI110项、真实外部模型与科研质量、三平台实际分发安装恢复未在本轮验收。macOS受管执行及未知归属的公共基础验收由[领域执行 change](../2026-10-24-establish-domain-execution-handoffs/tasks.md)继续承接，不据本变更通过关闭其剩余任务。Windows执行与Electron验证见同轮跨平台修复交付。
