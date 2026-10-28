# 执行任务

2026-10-29主线已实现核准字节冻结、原版本历史Adapter及严格单目标报告读取，完成1.2b.2b，当前7/13。真实根／子执行、队列／最终准入／重启、撤权竞争与目标只读联合59/59；独立审查所见授权及合法受理缺口已修复复核。活动页承载2.1b、共同动作／草稿和完整I5继续开放，不能以读取或独立[Linux隔离提供者](../add-linux-isolated-report-provider/tasks.md)替代浏览器呈现。实际命令与必要输入见delivery当前节，不依赖现有/tmp。

```mermaid
flowchart TD
  T11[1.1 同源清单与HTML保存] --> T12[1.2 真实快照及来源授权]
  T11 --> T21[2.1 隔离页面和网络样本]
  T12 --> T22[2.2 真实报告与共同附加]
  T21 --> T22
  T22 --> T31[3.1 保存更新及草稿]
  T31 --> T32[3.2 关闭重开和等待]
  T32 --> T41[4.1 双宿主I5]
  T41 --> T42[4.2 审查及交付记录]
```

## 1. 同源报告及真实项目保存

- [x] 1.1a 本轮：protocol/report-contracts同源manifest／snapshot／桥schema及容量／跨字段校验，editor/report-codec有界头部解析和转义编码；必要protocol叶导出／架构声明，不注册操作、不扩ResourceRef。以独立固定样本验证格式、UTF-16／字节边界及额外字段拒绝；先构建再模块测试。
- [x] 1.1b 生产接入：UI设计报告分节、公开根导出及resources.report注册、HTML条件保存、派生映射；真实ManualApplication验证保存重开、同内容替换拒绝、只读目标和库权限不扩大。
- [x] 1.2a 本轮：editor/report-resources的注入窄端口ReportResources深模块，复用共同describe/read及相对路径解析；核对入口／依赖／来源、path-ref一致、前后basis、read/send、容量、撤权和混合版本拒绝。测试adapter可替换，不新建存储／DTO，手工粘贴来源不作完整溯源承诺。
- [x] 1.2b.1 已验收：真实项目／库授权Adapter及editor公开入口，Manual及普通根执行的报告describe/read和模型准入复用声明来源授权，经真实broker及所属存储验证queue／final／restart；target和旧报告历史沿1.2b.2b交付，委派沿1.2b.2a交付。
- [x] 1.2b.2a 本轮：从Delegations.resources提取唯一checkReadable，普通describe/read/document及报告入口／展开Evidence复用；成功展开的来源沿现有Evidence仓储按子实例保存，子模型queue／最终同步准入核查范围与领域read/send，session记录继续保护父及重启。真实父子worker／库／报告验证全部允许、缺项／旧basis／撤权拒绝、取消及恢复，不把声明核查记为实际正文read。
- [x] 1.2b.2b 目标报告及旧报告历史版本Adapter完成：历史使用可信FileEdit原正文／Evidence／path，整组返回前同步复核全部声明来源；原版本摘录进入受理末次及持久模型复查。单目标入口／依赖／来源只允许原目标内既有身份，不登记或扩大授权，库／第三项目来源拒绝；当前坏清单不阻断合法原版本。真实host指令受理及执行读取、历史跨段撤权和现有目标／委派竞争联合59/59；独审发现已修复复核，完整I5仍开放。

## 2. 页面内浏览与共同动作

- [x] 2.1a 调查原型已交付：tests/fixtures/report-frame专用候选模块及真实Browser／Electron静态夹具，消费实际ReportResources快照与有版本的资源字节，复用Bridge schema；合法脚本及清单资源、HTTP／UDP探针、CSP／父frame-src／导航／资源通道、宿主访问及有界桥生命周期已有代表性证据。两宿主实际STUN外发、Browser忙循环阻塞反例见delivery；只关闭调查，不算生产已隔离，生产保持unavailable。
- [ ] 2.1b 正式承载仍未完成：独立[platform提供者](../add-linux-isolated-report-provider/delivery.md)9/9已由主线真实Linux固定静态native组接收，网络／syscall／迟到能力、unknown／容量／恢复已有其限定策略证据。该提供者仅内部六操作，未接产品宿主或完整浏览器；真实冻结字节消费者、浏览器完整进程图及呈现／分发仍需实施与实际验证，不能把native样本或临时launcher当活动报告。2.2／3.x及完整I5继续开放。
- [ ] 2.2 实际文献对比页面支持筛选／排序／展开，已加载对象通过原子appendContextItems进入同一composer，用户检查正文后沿原session.send；核对objectIds、报告basis、明确来源、comment与接收者不变。超限整批拒绝保留草稿。1.2与2.1可分离实现，本线主Agent整合共同贡献及共享资源符号，禁止并行写同一文件。
- [x] 2.2a 独立共同增量：appendContextItems同步返回成功／失败，一次完整合并校验后单次写回，16项／64KiB或非法项整批拒绝且原草稿不变；原单项委托同一实现，失效接收者及往返切换旧回调拒绝。复用真实useBusinessSession／草稿与贡献测试，补图片夹具消费者，运行必要类型／构建及双宿主单项／迟到回执保护；独立审查整改后只关闭本子项，不据此关闭完整2.2／报告I5。

## 3. 完整更新、草稿与接续

- [ ] 3.1 经真实harness保存新资源后条件发布HTML入口，范围订阅合并最新候选，完整验证后自动更新；有页面／composer草稿时保留原页提示，明确查看新版仍保留原显式项。扩展真实机械链路，覆盖发布前失败、保存关联unknown、迟到候选、来源撤权和旧资源不可得，保留旧成果而不重放写入。
- [ ] 3.2 按窗口／配置／报告版本保存有界浏览状态和草稿，关闭／重开核对身份权限及原版本不可得提示；工作台关闭不取消普通已受理执行，调试内核仍按原生命周期退出。复用固定registered图核对持久等待和新session.send接续，页面ready不消费等待、重启不自动推进；新会话可从实际报告／来源继续，不依赖原session。

## 4. 整合与交付

- [ ] 4.1 本线主Agent负责报告I5，使用真实报告文件、库来源、共同composer、broker／harness worker／保存／刷新，模型仅在外部边界受控；浏览器和真实Electron均检查2／3组行为及诊断阶段。运行design列最小kernel／UI／协议生成／类型／架构与必要构建，父CSP改动回归普通HTML／PDF预览。既有CI失败按原证据定位、未通过部分保持未完成，不加全仓无关测试或超时补丁。
- [ ] 4.2 安排独立审查核对页面隔离、来源授权、完整发布、并发与草稿；根据实际结果更新UI和开发入口，初设改为正式契约链接。实际执行后获取delivery instructions创建delivery.md，逐项说明真实接线、替身、科研质量／平台未验收范围，再决定任务完成；规划阶段不创建该文件。

## 续做入口

当前7/13，历史与目标Adapter及冻结字节接口已实现并验收，不重复等待来源授权／schema。独立Linux提供者在所属change实施、审查，正式浏览器及目标策略尚未交付；完整2.1b／2.2／3.x／I5保持开放。

下一步将已核准的冻结字节接入真实提供者，并完成浏览器全进程范围、呈现／输入／文本与可访问性、分发及资源预算的方案与实际校准，再实现共同UI／草稿。不能把固定native样本当浏览器通过；接续输入在Git／cache，macOS或目标证据不足保持unavailable。
