# 实际交付与交接

## 当前状态与成果

2026-10-26，用户已明确恢复实施。当前工作点为已同步`70be8bfcda5ab1453c20428f9eb3b367d90ed0b7`，0519904祖先；只操作本树，没有自行同步其他树、安装依赖、提交／推送／PR或归档。完成本轮首片1.2a、2.1a、2.2a，连同既定政策1.1共**4/10**；完整change与I6未完成。

- `packages/protocol/src/library-records.ts`提供5个同源操作：createSourceInstance、record、recordHistory、commitRecords、commitResult；library.ts统一导出和注册schema，business-types从最终schema生成。原开放CSL schema移到既有library-metadata叶模块并保留原导出及全部约束，避免循环依赖和重复事实源。
- `LiteratureCatalog`分配来源实例：同requestId同内容返回原结果，新requestId分配新实例；不凭路径、DOI或副本猜同一来源，也不开放无确认的重绑定。来源三元组唯一关联已有题录，原字段／类型／姓名对象与完整顺序／日期／Extra／关系JSON独立保存。只改CSL保留原值。
- 正式键及固定状态独立存储，NFC及默认Unicode小写比较唯一，显示保留原拼写。candidate只补缺键且不固定；已有键返回preserved。显式改键／固定状态仍需原revision及write，冲突不自动改名或覆盖。
- 同库最多100条已有题录、请求256KiB、单原值64KiB；CSL沿原16KiB。题录、原值、键、来源关联、相应历史和成功回执同一SQLite事务；CAS／身份／键冲突及中途SQL失败整体回滚，仅另存可查询拒绝回执。相同requestId不同内容拒绝，重放不重复修改或通知，成功通知在commit后一次。
- library独立v3→v4迁移沿既有Drizzle journal，保留`before-migration-v3.sqlite`；不从旧metadata.citation-key或origin猜补权威。原项目公共v5→v6迁移、来源／历史能力与资源叶schema未修改。
- ManualApplication/broker注册真实提供者。百条事务经真实宿主、领域和SQLite执行，无HostCatalog替身；生态原包适配尚未消费此接口。

设计图中的broker→文献权威→记录／键／历史／回执→提交后通知已在本树实现；生态适配箭头尚未真实接线。原子范围是**多个已有题录及上述附属记录**，完整BBT事务目标保留，不把首片缩成逐条成功，也不把首片当作任意SQL或完整saveTx。

## 实际验证

Linux、既有锁定依赖、隔离合成库；没有真实用户库。先完成共享／library／harness／kernel及桌面构建，再测试，UI期间不重建共享产物。共同X1相关结果另在原workbench change记录。

| 入口 | 结果及证据 |
| --- | --- |
| `pnpm --config.optimisticRepeatInstall=false build:shared`及定向protocol／library／harness／kernel build | 最终通过。首次生成映射遗漏5个新增操作，生成后消除；新增模块映射泛型曾触发TS实例化过深，改为逐操作FromSchema及窄broker消费，未放宽DTO或转any。日志`/tmp/scholoom-library-round3-{shared-first,shared,protocol,build-library,build-harness,build-kernel}.log`保留失败与最终结果。 |
| protocol／kernel／desktop及tools类型检查、architecture、生成器self-test／映射比对 | 最终通过；architecture为13模块205文件、0 findings／exceptions。dry-run按既有Biome格式化后6份映射与当前文件一致。类型及架构日志`/tmp/scholoom-library-round3-{kernel-types,desktop-types,tools-types-final,architecture}.log`；映射`/tmp/scholoom-library-round3-contracts-final.patch`只作核查，未应用格式性噪声。 |
| `tests/kernel/library-records.spec.ts` | 正式键／大小写冲突、候选不固定、稳定重放／通知、完整原值与历史重启；真实SQL唯一约束在第二条写入失败，核对第一条已写入的题录／键／原值／历史全部回滚。宿主百条提交、拒绝查询、101条／256KiB拒绝。 |
| 最终定向内核组合 | **53/53，348.3秒，0 skipped／flaky**：catalog契约、真实选择和模型复查、records／migration及既有catalog／context-query／resources／registered-context。完整命令文件集合与结果在`/tmp/scholoom-library-round3-kernel-final.json`和stderr；工件`test-results/library-round3-final`。不称全仓CI通过。 |
| 百条实际样本 | JSON编码**140,495字节**，本机SQLite提交约**154.75ms**，原字段含中文Extra、日期、姓名和关系；annotation保存在上述JSON。仅支持本次100条／256KiB初始限额，不构成发布性能门槛或所有Zotero记录大小结论。 |
| 收尾限额／新来源重复回归 | **2/2，7.0秒**：同批两个对象争用尚未绑定来源时整体拒绝；单原值约66KiB且总请求未超256KiB仍明确resourceLimit，原修订不变。`/tmp/scholoom-library-round3-record-limits.log`；工件`test-results/library-round3-record-limits`。 |
| `tests/kernel/library-record-migration.spec.ts` | 真实独立v3数据库、旧身份／CSL／未知字段及旧citation-key保留、不猜升级；备份仍v3且可检查，重启v4；未来v5停止并保留原表／数据。包含在53项最终通过内；测试夹具用既有前三份SQL及静态LibrarySource构造，不以新实现输出作唯一oracle。 |
| lint／OpenSpec／diff | 相关24文件检查通过；收尾单条测试格式调整后专项通过。两个change strict及git diff --check通过，新增文件另检查。 |

首次records红灯为旧产物尚无createSourceInstance；首次实现测试因“此前不存在”的历史值被SQL NOT NULL拒绝，事务返回rejected，后改为允许SQL null表示缺失并复验通过。未通过放宽超时或吞掉SQL失败掩盖问题。早期测试可选参数／原值可能undefined导致tools检查失败，补明确夹具断言后通过。

## 审查与公共交接

同一原生辅助Agent，gpt-6.1-sol/high，限定文件实现纯DTO及迁移夹具；父Agent负责领域／授权／事务设计、整合与验收。独立只读审查发现候选可写固定状态，已修复为候选只补缺键、不固定且不覆盖既有正式键；回归通过，最终窄复核无新确证风险。审查是源码证据，不替代实际测试。

公共补丁目录`/tmp/scholoom-literature-round3-patches-EBWcGa/`，0001为X1，**0002-public-record-authority.patch**为本change；因共享文件上下文按0001→0002顺序应用，二者都不依赖文献私有UI。已对0519904受影响文件做`git apply --check`并实际应用，未创建另一套源码运行点；实际测试始终在当前已同步树。0003是私有工作台消费，依赖原70be8bf库UI。事实进度仅本tasks／delivery维护。

## 未完成事项与停止边界

生态需消费当前5个真实操作并核对字段、调用身份、SQL／saveTx及原包通知；尚无真实BBT／茉莉花共同库写入，不关闭2.3或I6。首片之外的新建／删除／附件／组织原子操作、来源副本的实际检测与显式重绑定UI继续开放，不擅自定案或迁入。没有全库反向引用表、没有扫描全部项目。

主线尚需接入新公共补丁并同步真实消费者。本轮已达到有界交回点，停止实施；未验证Windows／macOS分发、全仓CI、真实模型科研效果或真实用户数据，完整change不归档。
