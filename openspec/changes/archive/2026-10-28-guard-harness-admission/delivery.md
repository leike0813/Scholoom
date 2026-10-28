# 实际交付与交接

## 第十六轮阶段收尾

用户授权主线进行阶段收尾；独立审查对照实际同步检查、原身份重放、真实科研adapter及原交付，接收全部3/3任务。最终共同产物运行`harness-admission.spec.ts`1项及`research-graphs.spec.ts`12项，其中两项final-admission真实边界通过；所在提供者组合44/44。完整构建、全包／tools类型、架构及八份生成映射通过，证据根`/home/joshua/.cache/scholoom-round16-integration/`。冻结Standards／Spec各0确证发现。

正式规格新增《宿主最终受理检查》，未改既有checkpoint或执行状态权威。归档只关闭本公共同步seam及其消费范围，不关闭活动Agent、项目、Windows稳定性或科研质量验收；macOS受管执行不可用保持。原历史日志可保留为出处，后续接续不依赖旧`/tmp`。

## 当前状态与成果

2026-10-26，在实际已同步树281277777f88aa068c948512f084f0d05150776e完成独立公共补充；0519904（含b838402）为祖先。两行公共源码变化：Harness.send第四个可选同步admit参数，及原SQLite事务重放检查后、新指令／run写入前的调用。没有新RPC字段、表、迁移、来源或执行状态权威。图和旧host语义保持；未提供检查时仍沿原路径。图示及接口见design。

公共调用者／测试为tests/kernel/harness-admission.spec.ts，复用原domain-execution-worker实际图和资源。科研消费通过宿主私有signal／WeakMap把权限与空闲条件传到该seam；其app装配及产品契约归科研补丁，不进入本公共源码切片。

## 实际验证

Linux、Node24、已有pnpm11.10.0与锁定依赖，未安装。先执行 `pnpm --config.optimisticRepeatInstall=false build:shared`，再固定产物运行：

```sh
node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts \
  tests/kernel/harness-admission.spec.ts tests/kernel/research-graphs.spec.ts \
  tests/kernel/research-module.spec.ts tests/kernel/execution-history.spec.ts \
  tests/kernel/research-capabilities.spec.ts tests/kernel/registered-graph.spec.ts \
  --output test-results/research-request-final
```

**47/47通过，4.1分钟**：公共admission1、历史6、注册图14、旧能力11、科研图12、科研模块3。公共独立用例确认拒绝后无消息／run／文件，并可释放后重试；原身份已受理重放不再执行检查或新开工。科研两项实际反例确认异步等待后的库撤权及普通消息形成waiting都被拒绝，原等待和文件保持。

全包无emit类型检查及tsconfig.tools检查通过；architecture为13模块／200文件、0 findings／exceptions；生成器self-test及格式归一化映射核对通过，改动源码Biome与OpenSpec strict／diff检查通过。运行过程中未重建产物。

日志保留于 `/tmp/scholoom-research-request-handoff-DNDj0C/`：build.log、types.log、kernel.log；原始日志为 `/tmp/scholoom-research-request-build-final.log`、`/tmp/scholoom-research-request-types-final.log`、`/tmp/scholoom-research-request-final.log`。测试profile／项目／库均为独立合成样本，所属app／worker已由fixture关闭；没有真实用户库、真实模型或开发服务器。

## 审查与问题处理

独立只读审查（gpt-6.1-sol／high）先发现两项P2受理窗口，再复核闭合：事务内没有await，先重放后admit；signal由宿主新建、在broker中保持对象身份，私有映射finally清理；客户端schema不能伪造该标记。

修复前真实反例的两次请求都错误返回成功run，日志为/tmp/scholoom-research-admission-red.log，副本为red-final-admission.log；只暂停真实project.check的返回，不替换授权提供者或模拟保存成功。没有增加时限。恢复副本及未注册产品入口的早期失败另归科研delivery，不混作公共harness缺陷。

## 未完成事项与下一步

本轮独立补充与本树消费验证完成，交 `/tmp/scholoom-research-request-handoff-DNDj0C/0001-guard-harness-admission.patch`，其后应用科研私有补丁。补丁仅含上述公共源码、独立公共测试及本change工件；公共runtime在0519904与本树初始HEAD一致，没有重做历史查询。未提交、推送、PR、应用到其他树或归档。公共dev后续接入、其他消费者与Agent实际组合仍由主线处理；本轮结果不表示I1／I3、Windows／macOS或真实科研质量通过。
