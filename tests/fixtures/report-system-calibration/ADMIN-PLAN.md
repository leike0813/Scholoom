# T1.0 待审管理员操作与收尾计划

**这不是可执行安装脚本或当前授权。** 本轮仅普通UID构建、自检及离线verify。临时单位、探针、合成数据均能由Git中的prepare入口重建；未提供C/M服务、LSM或生产私有Interface。原安装研究下方M-writer内容及第21轮模板不是本方案的现行依据。

## 申请前必须补齐的身份／状态

- 主线先指定且批准受保护非root C的真实UID/GID和bootstrap方式；当前包只记录登录UID的模拟创建，不能把UID1000默认为C，不能创建或借用账户来补缺。若需要新账户／组，是另一项明确权限决定，本清单不包含创建指令。
- C必须在其实际保护根创建原configId、持writer锁并恢复完整原库存；K固定该configId并恢复原unknown，之后才有域核准／唯一准入。当前无C/M实现，以下只能校准OS对象，不能使T1或报告启动被当成授权成功。
- 明确C预核／封存、scopeIntent持久ACK、M采scope→C持久ACK、K末次授权／launchIntent ACK→许可、停止→C stopped ACK→释放的真实接线。不得将本包expected.bin解释成上述ACK、原records或configId。
- 在真实C根重新创建合成对象并取dev/ino/owner，生成新的预核表。**禁止将离线shadow根的expected.bin复制过去继续使用**，复制对象会改变inode；不能由M重建C表来迎合PID1打开结果。
- 审定FIFO写端的固定建立、单G+EOF及失败关闭方案。当前没有C/M许可生产者；不能靠手工改成socket、O_RDWR自读或轮询／sleep隐藏PID1读端打开／阻塞问题。没有预执行外部采证时，本探针的事后身份不能证明首指令前LSM／tracer状态。

以上任一项缺失时，主线可只接收本离线材料，停止系统阶段；不得把权限请求写成完整T1已准备可用。

## 精确影响清单（每次以bundle.json的唯一名字为准）

| 对象／主体 | 待批操作及权限 | 限制和预期证据 |
| --- | --- | --- |
| `/run/<本次calibration-name>/`，root:root0755 | 管理员新建且确认不存在同名对象；部署唯一固定静态probe到bin，root:root0555，所有父目录受保护 | 不替换已有路径／symlink，不SUID／filecap，不装依赖；核源码、ELF、内容及完整路径链 |
| `/run/<name>/c-owned/`，实际C UID/GID0700 | 管理员只建立受保护归属；**C**创建输入／预核表0400、FIFO及两个日志0600并sync、核对象 | root M不创建或管理原records／字节／日志；P仅持既定只写日志FD，不按P UID更改C对象owner |
| `/run/systemd/system/<精确probe单位名>`与`<精确observer单位名>`，root:root0644 | 管理员部署仅这两份经审文本；核同名mask/drop-in/别名不存在 | 无enable、无启动依赖C/M的伪单元、不安装到/usr；没有通配管理授权或任意exec／env／路径 |
| PID1 manager | 在另获许可后，一次daemon-reload、仅启动精确probe单位；固定root observer仅在所指probe范围实际存在且已登记后启动 | 当前没有执行；不使用systemd-run/StartTransientUnit，不变全局策略。5秒是失败预算候选，不是停止证明 |
| DynamicUser P | 由PID1实际分配；外部核主PID、birth、UID/GID／组与C/K/root不同、完整LSM状态及limits | 同名静态账户／动态UID碰撞及回收是实测项，不能从文本声明通过；不额外给组／capability |
| 固定root observer | 空capability集合、ProtectControlGroups=true；只观察本次已核兄弟scope | 核eff/prm/bnd为空、实际cgroup可见和只读挂载、无额外管理操作；UID0仍有属主权限，两选项不是全程序只读证明 |
| C/K原records及库存 | 只沿原权威保存实际scope／停止观察与持久ACK；K使用同一admission | 未实现不得伪造receipt或复制台账；新系统route／格式不能重解释旧version1 user-scope记录 |

包内单位采用实际runtime绝对路径，probe以命名OpenFile而非`/proc/<C>/fd/N`交付数据。当前候选假设FD从3起且LISTEN_*为直接启动接线；原文没有足够的本机实跑证据，必须记录manager实际传入内容及对象。不能为使通过而在真实单位追加`--offline`绕开这一门。

## 获批后的观测次序与停止判据

1. 独立记录bootId、本次包摘要、原configId／instance与calibrationId的不同职责、精确对象与C预核结果；先证明只有这两个新单位／runtime目录归本轮。
2. 启动请求只表示受理。外部采集精确unit的InvocationID、ControlGroup、主PID/birth；与probe实际自cgroup、身份、FD元数据和输入匹配。C预核表与PID1实际打开的FD必须完全一致；同内容新inode仍失败。
3. 固定observer只读其构建目标scope，核dev/ino、cgroup.events、所在mount是否只读及capability字段。scope不存在／EACCES／文件缺失／实际ControlGroup不等于固定候选路径时保留错误，不扩大到任意路径、添加能力或挂载。
4. FIFO open时序、日志创建/不截断、OpenFile名称映射、DynamicUser与C对象DAC、RootDirectory/namespace/LSM与首指令顺序均需实际证据；本T1.0没有LSM策略，不能在缺policy时放行不可信报告或浏览器。所有材料是固定可信合成探针。
5. 正常探针退出不等于范围停止。对原InvocationID／boot／cgroup对象核全范围空、实际后代及不可迁移前提，再由C持久保存stopped ACK，K才结清。5秒或inactive、主PID消失、日志objectsMatch都不能替代原停止事实。

停止管理的最小待验候选沿主线补充研究：提交保存的**非零16字节**原InvocationID给`Manager.GetUnitByInvocationID(ay)`，保留返回的opaque Unit路径，在该路径调用`Unit.Stop`或`Unit.Kill`；不能换成按名`StopUnit`、名称路径或`Ref`，也不自行拼装opaque路径。官方v259.5源码证明该路径在方法受理前按原ID解析，失效时不回退同名新代；本机发行版及真实竞态尚未验。它不接收原cgroup dev/ino，不是inode CAS，异步stop job后续与Kill仍须独立核查，最终空范围／C持久ACK条件不变。原ID失效时只报告未知并核查，不回退按名停止接替者。

依据保存在`/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/stop-identity-research/RESULT.md`及其固定systemd v259.5来源；本包只引用待验差异，不新增或执行管理命令。

## 仅本轮对象的收尾及保全

- 收尾前先封住本次许可生产者和新增调用；保留查询与停止能力，不先删除FIFO／记录／程序。只有明确归属的原unit才能请求停止；身份失配或同名接替者不动，不能通配停止scholoom或其他报告实例。
- 另获许可的管理员最多停止这两个**原身份**单位；回读原范围与C持久ACK。请求返回成功、超时、cgroup目录消失或机器重启均不自动结清unknown。无法确认时停止新增阶段，按原实例保留占用和证据，不换新ID重试。
- 完整确认后才移除这两份精确临时unit文本、经核对仍为本轮对象的runtime暂存物，再reload清掉旧定义；不要enable/disable其他服务或撤系统策略。删除动作需逐对象身份核对及独立授权，不给`rm -rf`、通配或自动uninstall脚本。
- 有unknown、丢ACK或C/M不可用时，保留C原records／index／config／writer锁归属、原包／unit／程序／policy版本依据、冻结字节、预核表与日志、boot/InvocationID/cgroup物理身份和权限失败原始输出；不删账户或改变owner来伪造停止。
- 项目／文献库／报告成果不归此校准包清理。合成暂存仍按其真实保留归属处理；动态UID回收不是安全删除或对象恢复的证明。本轮未创建任何真实系统对象，当前无需管理员回收。

系统阶段的每一个“未证”都有明确停止点；本材料只帮助主线审查将来的有界权限与风险，不构成安装、T1/T2或生产报告完成。
