# 实际交付与交接

## 第十六轮主线接收

主线接收1.2的本机固定native校准及三阶段完整证据，独立Spec审查未发现超出本轮授权的交付声明。默认拒绝策略、原生三代／setsid归属、controller／宿主失联两种收尾可作为下一片实现依据；两个原失败保留，gateReleased只代表意图，scope样本预算不成为产品默认预算。

2/9保持；生产准入、ReportResources、恢复结清及浏览器承载均未实施，活动报告仍unavailable，不归档。本轮不复制实验源码到production，不安排下一开发任务。后续应先完成2.x生产提供者和实际恢复保证，再谈报告启用；原始源码及校准入口位于下文cache，后续不需要旧`/tmp`。

## 当前状态与成果

2026-10-28，HEAD=`7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`且起始clean；读取AGENTS、原tasks／design／调查、主线第十五轮安排及当前apply后，仅执行已授权1.2固定native真实校准。实际执行后取得本change delivery instructions并创建本记录。1.1已由主线审定，1.2现仅以本机固定x86_64／合成输入校准完成；2.x／3.x没有实施，完整提供者change未完成，不因新增delivery归档或开放报告。

本轮成果是可审查的默认拒绝seccomp策略、固定静态程序、可信原生监督／持久身份候选和实际失败／成功证据，均在cache。原生源码没有复制到production；没有改protocol、platform、admission、Adapter、UI或浏览器，未构建／测试产品路径。原报告仍6/13、活动页unavailable，2.1b／I5及科研质量保持开放。实际机制与限定由[investigation首节](investigation.md)维护，design新增范围说明；原架构图中的生产模块仍是拟实现。

独立证据根：`/home/joshua/.cache/scholoom-linux-isolation-calibration-r16-RqczuM/`。根目录保存首轮完整输入／结果，`after-wait4/`保存唯一必要策略修正及后续观察失败，`loss-only/`只续跑未执行的两种失联。固定`payload.c`无libc、ELF无动态解释器／运行库；每个scope实际20%CPU／64MiB／swap0／16tasks先读回，可信程序和只读输入均为本轮自有，没有真实凭据／用户库或profile。

## 实际验证

全部命令显式export TMPDIR到独立根／对应子根；既有cc、bwrap0.11.1、systemd259.5、Linux x86_64为真实提供者，没有安装、提权或手改cgroup委托。编译与样本动作先后顺序由各`first-result.json.compiles`及完整argv保存；所有实际实验阶段先编译三份C，均-Werror通过、stderr为空，再运行样本。没有重建同树共享产品产物或测试期间重建。

```sh
R16_ROOT=/home/joshua/.cache/scholoom-linux-isolation-calibration-r16-RqczuM
export TMPDIR="$R16_ROOT"
node "$R16_ROOT/calibrate.mjs" "$R16_ROOT"
export TMPDIR="$R16_ROOT/after-wait4"
node "$TMPDIR/calibrate.mjs" "$TMPDIR"
export TMPDIR="$R16_ROOT/loss-only"
node "$TMPDIR/calibrate.mjs" "$TMPDIR"
export TMPDIR="$R16_ROOT"
node "$R16_ROOT/check-evidence.mjs" "$R16_ROOT"
bash -n "$R16_ROOT/rebuild.sh"
```

以上是实际命令记录，不能在原根重跑覆盖证据。需独立重建时以`bash "$R16_ROOT/rebuild.sh"`复制已保留源码到新的cache根；本轮仅核该重建脚本语法，没有执行整轮回放。

| 实际结果 | 证据及判定 |
| --- | --- |
| 首轮exit1 | 根`first.log`／`first-result.json`。无filter控制真实送达自有TCP4／TCP6／Unix各1、UDP1，SCM读得合成诱饵；过滤组在init wait阶段失败，没有payload ready／动作，不能算策略拒绝通过 |
| wait4窄修后仍exit1 | `after-wait4/final.log`／`first-result.json`。仅增加可信bwrap reaper必要wait4，默认deny仍为EACCES，危险控制不重跑。filter-exposed／safe已进入、危险直接调用均-13、批准内容正确、无端点送达、各exit0；之后失联场景在SIGKILL前因exe路径字符串观察失败，三代已出现但不算失联验证 |
| 仅失联场景exit0 | `loss-only/final.log`／`first-result.json`。观察改用二进制dev／ino，仅跑未执行的controller／独立宿主SIGKILL。各目标六成员含三代／setsid，完整登记范围收尾；宿主场景还记录到独立controller parent-lost。三unit在兜底cleanup前已inactive，无补stop制造通过 |
| 一致性／追加只读核查通过 | `check-evidence.mjs`、`evidence-check-{first,final}.log`／`conditions-matrix.json`。核固定独立marker、真实syscall结果、未执行分支、两个失败、两种loss及活动／失配身份；13个登记PID旧出生身份均消失／不再匹配，八unit inactive、八条已知cgroup不存在。不是新的native实验 |
| 工件检查 | 本change strict、scholoom-dev schema、diff及独立补丁反向检查，日志同根；没有生产类型／生成映射变化，不重复类型／架构／kernel／UI／CI。主线内核15/15及UI5/6只作为交接基线，未当报告隔离或整合全绿 |

第一份单独supervisor编译有两条缩进warning，保存`supervisor-build-first.log`和`supervisor.build-first.c`，执行前补正；无本轮EDQUOT。三个实验输入及原始结果均保留，未用retry、sleep或延长期限改通过。scope的15秒仅是本次样本保护，不改任何生产期限、unknown或容量。

## 审查与问题处理

原生辅助请求配置gpt-6.1-sol／high、无历史fork，仅写固定payload及只读核bwrap等待路径；另一独立只读审查核三阶段源码／原始结果，认可本机固定native的1.2窄结论。其三项限制已进入investigation／design：FD数字过滤不是资源授权；SCM在ready后／动作G前入队，临时gateReleased记录意图；范围终态与只读reader不能被描述成生产停止授权／容量结清。独立记录在cache `independent-review.md`，辅助均结束关闭，没有常驻任务。

首失败由本机bwrap导入wait／waitpid及libc反汇编的wait4关系支持，45条最终BPF只比43条首策略多必要wait4，不改默认拒绝。第二失败是视图内/probe与宿主路径不一致，父改观察为已持有二进制物理身份；没有改样本或放宽断言、重跑已绿组。核查脚本也用物理身份计三代，不用完整路径文案。

临时armed／gate记录由原生端file fsync＋rename＋目录fsync落盘，活动期独立进程核boot、InvocationID、cgroup dev／ino、私有根和controller出生身份。loss中的读取发生在三代ready之后、SIGKILL之前；读失败／失配／事后返回unknown且无停止／容量动作。`gateReleased:true`先于动作G，不能证明已放行；2.4必须处理其崩溃窗口，不照搬该字段。观察器只记空或目录消失的组合结论，不保有原始empty事件文本，未作超过数据的声明。

## 未完成事项与下一步

本机固定原生链、OS及文件／句柄／scope／SIGKILL真实，输入和程序为固定合成样本；没有生产ReportResources批准字节、真实领域授权、worker／broker提供者、ProcessAdmission或恢复仓储装配。未实测动作G后才送达SCM、真实外部DNS协议、浏览器完整进程图、所有崩溃时间点／记录损坏、系统重启、Windows／Mac或其他Linux部署。不能由本校准宣称通用沙箱或生产策略可用。

收尾已核三阶段共八个自有unit／cgroup、13个登记成员出生身份、自有TCP／UDP／Unix服务及控制端原scope；只收尾本轮对象，未操作共享显示或他人执行。没有dev server、依赖安装／下载、用户库访问、Git提交／推送／PR／archive或其他树操作。全部必须输入、源码、编译及原始结果在Git／本cache，无现有/tmp前置。

按用户边界到1.2证据交回停止，2.x由主线验收后另行安排，不自动接schema、admission或生产Adapter。后续必须保留本次默认拒绝／wait4／FD与失联反例、区分实际资源权威和回执意图／确认，并在真实提供者中验证unknown及容量闭环。报告呈现、文本／可访问性、运行时分发和跨平台决策仍不由本片扩大。
