# 实际交付与交接

## 当前状态与成果

2026-10-25，用户选择G1方案A后，本树完成独立公共查询增量及验证，3项任务已完成。该增量不依赖科研私有实现；未提交、操作dev／其他树、同步正式规格或归档。

已核对 [design](design.md) 的公共接入图。新增内部 `harness.executions`，按明确项目／会话及runId、instructionId、originInstructionId之一查询原Run；默认25、最多100项，响应最多512KiB。按指令命中返回所属原Message，消息缺失明确unavailable；其他选择器不返回消息。host／system之外或已绑定范围不匹配时拒绝，公共客户端不暴露该操作。

GraphBinding新增宿主来源originInstructionId，首次显式启动建立，普通接续和取消后新run沿用，同配置显式新启动另起来源。registered初始化将宿主来源传给worker，用户config不能替代该身份。旧无来源记录按真实run／指令读取，不猜测补链。并发重放所有受理路径统一核对原消息和图绑定，不改通用driver或checkpoint格式。

本增量文件／符号：protocol的graph-contracts、harness-module-contracts、execution-graph及派生harness-module-types；Harness.executions、acceptedInstruction和send来源／worker初始化；application内部提供者；architecture实际消费声明及公共测试。与科研接入共享文件按design拆分归属；科研记录、目录及业务交付不属于此增量。

## 实际验证

Linux，Node v24.12.0，pnpm11.10.0，Playwright1.63.0。隔离项目／profile，真实broker、harness仓储及受管worker；公共测试使用既有domain-execution-worker注册夹具，无真实模型或用户数据。

- `tests/kernel/execution-history.spec.ts` **6/6通过**：并发同图及不同图／配置重放、选择器与分页、旧指令／来源查询、同配置独立启动、取消后新尝试、重启、跨会话隔离、字节上限及无来源历史。
- 最终补验实际broker的host／system准入、绑定范围、非host拒绝及公共入口隐藏，**1/1通过**（所在最终组合3/3）。
- 包含registered-graph、registered-context、research及resource-creation的7文件组合 **62/62通过**，原图等待、恢复、取消与上下文回归通过；`/tmp/scholoom-research-regression.log`。
- 根 `pnpm --config.optimisticRepeatInstall=false typecheck` 和 `build` 均通过，分别见 `/tmp/scholoom-research-typecheck-final.log`、`/tmp/scholoom-research-build-final.log`。
- architecture守卫0 findings、生成器self-test、格式归一化映射一致性、改动源码Biome、OpenSpec严格校验及diff空白检查均通过；`/tmp/scholoom-research-static-final.log`。

原62项组合包含本公共查询、registered-graph、registered-context、research-capabilities、research-module、research-graphs、resource-creation；其科研私有用例不作为公共补丁的独立前置。公共用例可独立执行：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/execution-history.spec.ts --output test-results/execution-history
```

最终补验命令使用同一文件及 `--grep 'direct entry'`（与科研两个补验同次运行），结果见 `/tmp/scholoom-research-final.log`。

## 审查与问题处理

独立只读审查发现并发等待后的重放分支未一致检查图选择，现由acceptedInstruction统一处理五条路径；三个确定性并发用例通过，复审确认闭合。未知科研回执需要核对原始文本，因此指令查询补充原Message，仍由所属harness记录提供，含消息的整体响应受同一上限约束。调用者不能用相同配置猜测关联。

提供者只读，无跨模块表读取、执行状态副本、安装新依赖或原记录来源回填。科研端当前读回授权等问题属于其delivery，未引入本公共查询实现。

## 未完成事项与下一步

公共实现的独立范围已完成。本轮追加公共补丁准备，dev接入与Agent组合验收门保持开放，详见tasks 3／4；没有操作dev、其他树或Git交付。当前同树科研消费的真实broker／worker整合已验证，不代表跨树或项目任务整合完成。未运行Windows／macOS、UI／Electron交互、真实模型或分发包验收，不能从Linux结果推导这些结论。

## 本轮公共补丁交接

本次正式输入为 `/tmp/scholoom-phase2-handoff-VZS5mS/{manifest.json,acceptance.md,coordination-plan.md}` 及该包agent-delegation源码快照；manifest基线仍为e3d58fc。主线接收本线独立成果，报告科研组合17/17通过，未发现本线确证缺陷。本轮没有新业务缺陷修复或运行时改写；完成的是可脱离科研私有业务的切片准备与独立复验。

补丁及证据统一放在 `/tmp/scholoom-research-phase2-mtJQci/`：

| 文件 | 用途及边界 |
| --- | --- |
| `0001-harness-execution-history.patch` | 相对e3d58fc的9文件公共源码／类型／最小注册／调用者／文档／测试；不含科研Graph业务、TaskRef、委派或迁移私有源码 |
| `0002-harness-execution-history-openspec.patch` | 本公共change的7份OpenSpec工件；后接第一份补丁，不同步正式规格 |
| `provenance.json` | 基线、来源、隔离目录及9文件清单；外部依赖复用本树已安装store，所有workspace包（含Quarto别名）指向隔离副本 |
| `public-baseline/` | 从HEAD git archive生成的普通临时目录，不是Git worktree；仅加公共切片。科研包仍只有原材料分析，未复制ResearchGraphRuntime、graphs.ts、Graph业务contract或私有测试 |
| `agent-symbol-composition.json`、`*.threeway.txt` | 共同基线／Agent正式快照／公共切片三方文本试合并；契约表与导入列表各1个冲突，application／architecture无文本冲突。组合方式见design，未将Agent私有源码装入或执行为公共基线 |
| `public-build-direct.log`、`public-tests.log` | 独立构建及31/31回归结果；运行中没有重建共享产物 |

代码补丁在9个原始基线文件／新测试所在的 `patch-check/` 执行 `git apply --check` 通过，在隔离公共切片执行 `git apply --reverse --check` 通过。第二份工件补丁在同一临时基线独立检查；不运行提交、切分支或应用到dev。本公共delivery已给出自身命令和边界，补丁不需要私有科研change文件才能构建或阅读操作步骤。

独立构建先按根build:shared的既有依赖顺序执行protocol、broker、platform、models、research、client、projects、library、editor、harness、kernel各自package.json的build脚本；使用已有tsc／native编译工具，无安装。随后运行：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/execution-history.spec.ts tests/kernel/registered-graph.spec.ts \
  tests/kernel/research-capabilities.spec.ts --output test-results/public-history
```

结果 **31/31通过，2.6分钟**（6项历史查询、14项原注册图、11项旧材料分析）。隔离副本architecture为13模块／194文件、0 findings／exceptions，生成器self-test通过。此结果证明公共切片不需要科研私有业务；没有运行Agent组合、真实任务或I1／I3。

首次准备失败均保留：`/tmp/scholoom-research-phase2-mwkSBe/` 在workspace别名解析处停止；本轮目录setup.log记录原因。首次pnpm build:shared触发依赖元数据检查，试图自动安装，在删除modules确认前以ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY中止，原日志为public-build.log；未完成安装、未设置自动清理确认。随后直接运行项目既有build脚本并显式核对workspace解析范围成功，未放宽权限、安装新依赖或改测试时限。

接入顺序：公共代码与本change工件→主线在dev按design合并Agent相关符号、从最终schema重生映射并验证→用户同步消费者→任务／科研I1和Agent I3分别实际验收。Agent A1授权修复及计算线迁移组合仍由所属线提供，不包含在本补丁；tasks 4.1保持未完成。

原审查Agent（gpt-6.1-sol／high）本轮独立只读复核：补丁9文件与provenance及隔离副本一致，其余1997个基线受管文件保持e3d58fc；32个workspace链接均指向隔离基线；最小broker调用者／提供者齐备，未发现科研私有依赖或遗漏的关键组合符号。未重跑测试或将文本合并判为生命周期验收。另以正式本线快照逐文件比较41项，只有本轮两change的tasks／design／delivery共6份文件变化，业务源码未改；记录为source-preservation.json。
