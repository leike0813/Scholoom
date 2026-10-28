# 执行任务

本次HEAD为cb5f7ed，用户授权完成现有可信来源的真实消费；D1粗粒度来源、D2原整次编辑撤销、D3有界查询／editId不变。真实执行／委派事实、MaterialChangeView与Agent历史工具已在共同源码，不再等待同步；精确工具token仍后续，阅读I5由材料change记录实际只读库／选择／保存组合。

```mermaid
flowchart TD
  D[1.1 确认D1至D3] --> C[1.2 单源声明与来源绑定]
  C --> S[2.1 所属保存及undo]
  S --> Q[2.2 有界查询与结果传播]
  Q --> I[3.1 独立审查及消费者核对]
  I --> V[3.2 实际交付记录]
```

## 1. 明确公共范围与可信输入

- [x] 1.1 用户及恢复指令已确认D1–D3，采用粗粒度可信来源、原整次编辑undo及有界changes／edit和editId；git确认公共0519904祖先，精确工具作用域明确另列后续，不用自报字段替代。
- [x] 1.2 在project-file-contracts定义唯一Origin／查询／结果schema和派生类型；宿主绑定真实人工／系统／活动执行事实及核对四元组的可信提供者seam。多指令保留可证明集合或unknown；普通参数拒绝自报，tool只接受unknown。真实worker及绑定夹具验证通过，夹具委派事实不计实际Agent提供者已接入；精确token分支留后续。

## 2. 文件权威内独立交付

- [x] 2.1 在原store.save、创建prepare／inspect和undo临界区记录来源及实际before／after依据，和FileEdit同事务。验证冲突无成功edit、历史登记失败保留实际文件且unknown、旧创建查询不改来源、旧历史不补作者；安全undo产生新edit及revertsEditId，后续内容变化拒绝覆盖，正常内部改名仍可撤销。创建撤销登记失败同样outcomeUnknown；未新增通用持久事务框架。
- [x] 2.2 实现files.changes／files.edit及窄消费端口，固定分页上界、所属fileId、首屏上下界／锚点状态；缺锚仍可读固定范围，下界裁剪使旧游标失效，列表无全文。项目资源结果可选editId沿实际FileEdit传播，保留association。裁剪续页、并发新保存、同路径新实体、旧结果及真实Agent下一指令读取人工更改通过；子实例历史入口保守拒绝，不自动唤醒。

## 3. 整合与交接

- [x] 3.1 构建后运行定向kernel、schema／架构／类型检查及独立审查；重命名undo、无锚窗口裁剪及缺锚续页三项P2已静态复核并由53/53覆盖，资源保存association失败及editId／来源另10/10通过。工具结果、领域历史及故障分别核对，不以模型说明证明修改原因。
- [x] 3.2 实际执行后已取delivery instructions，记录成果、同步事实、首次失败、审查与未验证边界；交独立公共补丁并验证适用性，未入dev的本轮M2增量不称消费者已同步，不归档。
- [x] 3.3 【真实提供者／消费者】沿正式执行／委派事实及MaterialChangeView，真实核对子worker创建、父读改、来源／Evidence、草稿与覆盖缺口、人工重叠拒绝和整次undo；原会话新指令经get_file_changes/read_file_edit/read_file核查撤销及当前正文。仅外部模型受控，不将绑定夹具当实际委派；I5另在材料change记录，精确工具token后续。

## 续做入口

从当前已同步正式源码继续apply，不复制旧/tmp组合或等待公共同步。3.3只关闭有实际证据的粗粒度提供者／消费者验收；精确工具作用域、科研质量与完整平台交付不随本任务关闭。当前输入、profile、项目与结果均在本树Git及本轮cache。
