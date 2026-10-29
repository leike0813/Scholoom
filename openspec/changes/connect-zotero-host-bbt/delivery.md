# 实际交付与交接

## 81e2c35的Windows实跑（2026-10-29）

专项40790713243／zotero-original job123174946195：stdin2/2、两条发现／故障收尾2/2、共同事务与原包组合10通过／1失败，宿主smoke8通过／2不适用跳过。真实resetKeyOnChange事件本轮已经到达并通过：偏好读取[true]、共同revision3、正式键／SQL／原包map均为ScholoomPreserved2026，host保持ready，通知后及重启的四份两格式导出与原XPI字节对照通过；不再沿用c29夹具未就绪作为当前结论。

剩余原包失败仍是百条例停机发布endpoint的EPERM。原日志`windows-81e2c35-zotero.log`、一次下载的artifact12862365036及trace保全；`windows-81e2c35-endpoint-before-stop.json`的mode33206显示文件可写，ACL查询5秒被终止，尚无ACL结论。只读query现改为仅输出已知整数／布尔值的JSON，不加载序列化程序集或模块；仍保留5秒／16KiB上限，不扩大为生产权限修复。该Windows修订待目标验证，当前类型／Biome及已知源码payload静态自检通过。

新故障例将安全停止回执单独落盘；两份workflow仅排除该例的configuration与项目私有数据库子树，保留trace／安全JSON。该例旧上传中的endpoint属于已停止测试实例，未含模型凭据；后续不依赖或上传该连接记录。Windows普通持久资源配方未由这些结果补齐，2.3／4.2与最终收尾保持开放。

## c29a93a的Windows回执与夹具前置整改（2026-10-29）

专项40789279376的zotero-original job123170165749仍失败：stdin2/2、并发发现替换1项、共同事务8项／冲突1项及原包smoke8通过／2不适用跳过；百条例仍在停机发布endpoint.json时EPERM，新增reset例在fixture建立前报undefined.catalog，未到偏好触发，不能写作Windows reset保护失败或通过。原日志`windows-c29a93a-zotero.log`及artifact12861390661保留。故障收尾诊断例的默认5秒准备窗口在application动态导入耗时约4998ms后结束，尚未初始化库；这不是其被测的停机收尾阶段。

整改仅等待既有内核启动预算limits.lifecycleMs，以及Electron明确app.whenReady后再读取已同步建立的manual-start fixture；没有增加原有Agent业务5秒断言或改生产期限。百条例在停机前保存有界文件mode／size／身份与Windows目标及目录的只读ACL／attributes观测，查询失败明确留errorCode，不改变原停机结果；不保存token、endpoint正文、实际SID或完整环境，不修现场权限。新增查询最长5秒且输出16KiB，Windows分支待实跑。Linux最小复验`windows-fixture-final-bbt.log`2/2、52秒，覆盖百条及reset；`windows-fixture-final-lifecycle.log`1/1、11.5秒；tools类型、两文件Biome及diff通过，均未重建或改变生产代码。

只读Windows资源调查`windows-zotero-resources-scout.md`确认无现成只读ACL／reparse／目录句柄扫描器，privateDirectory是可写修复入口，不能拿来替代resolver核查。现有私有资源配方仍只有设计中明确的Linux布局；Windows真实注入原包装配与普通持久布局分别记录，不凭前者宣称后者已可用，也不在本轮诊断顺带加入未经目标验证的新原生能力。

## 正式键偏好触发与通知缓存修复（2026-10-29）

3.2完成，当前46/50。真实未改BBT9.0.68启用resetKeyOnChange、消费真实modify事件后，旧实现保护了共同键，却让原包先污染候选map、吞下setter拒绝并跳过cacheTouch，通知后两格式仍导出旧题名；原失败和四份导出在`/home/joshua/.cache/scholoom-finish-active/reset-key-protection/`。现共同投影的library.editable只在当前AsyncLocalStorage owner的keys／creators操作阶段为true，提交等待及通知阶段只读；原包按其既有readonly分支采用共同正式键，继续刷新缓存。不改原包、偏好、setter／SQL保护或共同授权，也未通过禁用缓存掩盖候选。

先构建host后冻结，最终`reset-key-final-kernel.log`为11/11、56.5秒：8项共同事务／CAS／迟到回调／SQL及通知保护，加真实百条补键／题名／两格式／kernel重启、真实reset事件／host重启、大小写冲突。偏好实际读取true；通知后及重启后的共同记录／SQL／原包map均保留正式键，四份导出均为新题名，五个原执行成员与XPI逐字节一致。新事件例为生产JournalCatalog／ZoteroHost与真实共同库组合，题名提交后显式刷新投影并触发Notifier；不声称普通managed RPC会向既存host推送题名事件。作者原包整合及更广产品动作仍属后续变更。host构建／按package脚本typecheck、tools类型、Biome与架构264文件0 findings通过；初次误指不存在的tsconfig.node.json仅为命令错误，正确入口已通过。独审`reset-key-editability-independent-review.md`直接核原包消费及读回／字节证据，无确证P1/P2，联合结果由主线接收。

Windows的0ed2c97／专项40784928035原输入负正对照2/2、共同事务8/8、冲突1项、原包生命周期8通过／2项既有不适用跳过；百条例已完成共同提交及两格式并重启到真实导出，停机发布endpoint.json遭EPERM，整例失败。原日志`windows-fd0-job.log`、原artifact及trace保全，不能以部分成功关闭2.3／4.2。新增并发发现替换校准及停机发布失败仍须收尾的修复由公共生命周期记录承接；不以该修复宣称原EPERM根因已解。Windows普通持久资源布局仍未实施。

## Windows私有stdin的固定源码机制与fd 0修正

固定Electron44.5.1官方源码表明Windows GUI初始化无条件将process.stdin替换为立即EOF的模拟流；控制台环境变量与日志开关不会取消替换，精确commit／Node／Chromium来源见[调查报告](../../../.scratch/scholoom-foundations/research/electron-windows-private-stdin.md)。第二次目标run40783183335／job123149728204的合成对照实际读到默认及ELECTRON_NO_ATTACH_CONSOLE两组均0字节，期望26字节；两个共同库原包例仍以空封套失败。其日志`windows-electron-stdin-red-job.log`保留，未把变量当修复。

主线保留原command-worker／一时私有launchInput／继承管道／原生Job和认证，将managed入口改为公开fs.createReadStream读取fd 0。highWaterMark=8193，实际输入累计超过8192即拒绝；按原字节保留Buffer后一次UTF8解析，不因分片拆坏字符。JSON.parse错误改为固定无载荷诊断，防止语法异常带回启动token；connectHost原schema、实例、token认证与启动期限不变，没有新增argv／环境凭据、临时token文件或自动fallback。Windows最小对照现用模拟process.stdin的0字节作负对照，真实fd 0须取得26字节，均沿同一program／launchInput／Job，源码及原失败保留。

独立`fd0-bootstrap-independent-review.md`无P1/P2，229项内存检查核8192字节边界、分片、解析无凭据回显及原连接验证，不能代替Windows实跑。harness／host及tools类型、host构建和相关Biome通过；初始host类型错误已用同源HostBootstrap消除，未放宽校验。前一版Linux原包1/1、44.9秒；最终Buffer聚合版`zotero-fd0-final-linux` **1/1，45.9秒**，覆盖实际百条补键、更正、两格式和重启。本节在目标回执前仍不关闭2.3／4.2；Windows最终结果尚待对应提交的CI，不把Linux通过当Windows修复已验。

## 首批Linux I6接收与Windows私有输入定位（2026-10-29）

按用户确认的首批范围，主线已完成2.1／2.2／3.1／4.1，当前45/50。除下节真实普通入口、百条事务、冲突、两格式及重启外，最终`zotero-final-i6`两例**2/2，29.8秒**覆盖实际harness工具和提交后观察丢失。后者真实共同commit已成功，原ID查询得原回执、不重放；监督继续保留scopeStopped=true、pluginClosed=false及原unresolved关联，查询不清unknown。前者实际父worker调用原生态工具并取得原包结果，只有模型HTTP受控。原始`.bib`／JSON、持久记录和监督证据都在cache对应目录。原值权威10/10及映射核对见所属delivery；这里不声称Windows、完整生命周期或真实科研质量通过。

推送`6218d7f`后，Windows专项run40782057133的zotero-original job123145932489已完成：独立共同事务**8/8**，原包Electron生命周期**8通过／2个原有平台不适用跳过**；两个真实共同BBT调用均在managed入口解析私有启动封套时失败，`JSON.parse(input)`报Unexpected end of JSON input。原生scope已停，但pluginClosed=false，保留unknown；没有把根进程退出或生命周期替身通过当共同接线通过。原日志`windows-zotero-first-job.log`、artifact12857658005保留，job整体failure。

当前新增仅测试的Windows最小输入对照：同一runCommand／原生Job／program模式／launchInput，输入为固定合成字符串，只落盘receivedBytes；默认环境与固定ELECTRON_NO_ATTACH_CONSOLE=1分别观察。它不读取认证token或改生产参数，不预判环境变量就是根因。workflow在原包步骤前运行该对照、失败仍保留后续原包结果并上传；代码静态／类型核查后交目标验证，未运行的Windows结果不能计通过。Linux报告sandbox与其他全仓平台状态单列，3.2／2.3／4.2／5.x仍按原未完判据推进。

## 首批范围确认、事务归属与派生SQL保护（2026-10-29）

用户明确按既定首批范围完成，茉莉花、复杂映射及Reader写回另立变更，承接见[后续提议](../extend-zotero-ecosystem-compatibility/proposal.md)。原包兼容与共同文献权威要求不变；Windows原包、完整I6和原任务3.2／4.2／5.x仍须其真实结果，不由范围确认自动勾选。

主线先补JournalCatalog的独立creator草稿／保存接口，未新增产品动作、授权、原包入口或CSL双写。5项独立真实library测试及原BBT两例先通过，独审仍复现旧异步回调混入新操作、提交等待期接受迟到保存、插件SQL污染共同投影三个问题。进一步复用AsyncLocalStorage为每个操作绑定独立身份，operation结束即关闭写入阶段并继续占有提交／读回／通知；插件SQL用SQLite authorizer保护共同表／视图及同名临时对象，禁止attach／detach和writable_schema，保留实际缓存／settings读写。提交／通知阶段拒绝追加当前通知批次，避免无界重新入队；已提交回执始终保留，未知效果和容量保护不变。

8项独立模块用真实LiteratureCatalog／SQLite及共同commit，无broker、原包或模型，覆盖整组CAS、CSL／固定键／身份保留、容量、原异步反例、提交／读回迟到保存、SQL／通知绕行及提交后失败。`creators-guards.log` **8/8，4.9秒**；当前host build通过。随后真实kernel／library／broker／受管Electron／BBT9.0.68两例**2/2，51.1秒**，路径`creators-guards-bbt`，含百条补键／两格式／更正／重启及全库冲突／撤权拒绝；宿主smoke的原包导出／原成员逐字节对照与启动中关闭两例**2/2，8.2秒**，路径`bbt-archive-regression`。独审的原反例与整改复核沿`creators-independent-review.md`，未取得复核结论前不关闭事务整项。上述creator是独立Module准备，不是茉莉花接入或完整creator SQL兼容。

窄复核又复现TEMP普通表重命名后遮蔽投影，SQLite authorizer未提供新名称，原名称保护不足。已按动作明确拒绝插件ALTER TABLE，并在原SQL回归中保留temp.shadow→LiTeRaTuRe代表例；独审仅对该原反例作最终静态确认，指定范围无剩余发现。父实际重建后，`creators-sql-final` **8/8，4.6秒**，真实原包百条补键／更正／两格式／重启`zotero-sql-final-bbt` **1/1，46.8秒**；固定已采用键拒改补断言`fixed-key-intent-final` **1/1，3.4秒**。同源recordLimits导出、harness／host及tools类型、architecture（14模块／264文件／0 findings）和生成器自检通过。首次架构失败因async_hooks未声明，现仅journal-catalog精确登记；没有放宽整个main路径。最初发现及全部修正结果保留，不把普通绿测当完整SQL审计。

新增测试直接沿Playwright加载真实源类，需要宿主package声明type=module；其实际main／preload构建仍显式.cjs，真实宿主结果已复验。原值字节上限仅从共同protocol叶重导出，无新DTO或持久权威。测试中Promise.withResolvers因项目ES2023类型基线失败，已改为本地Promise gate，不提高项目基线。

Windows原包独立job和跨平台可信XPI准备已接入原workflow／fixture；Linux两个原包smoke已通过，Windows尚待实际目标回执。Linux系统helper两个正例此前在CI因已安装目标／祖先不满足生产保护而失败；测试现独立记录完整安装前置，不安全安装核明确拒绝，safe-permission变化例只在确有安全基线时运行，本机**25/25**。生产helper校验没有放宽或修改系统文件。macOS入口失败诊断另沿实际entrypoint：原场景唯一产品窗口，失败后快照已有标题，缺标题首次出现／桥／握手时点；本轮只补失败时有界DOM／bridge观测，不加期限、不宣称根因已修。

本节所有工件相对根为`/home/joshua/.cache/scholoom-finish-active/`，无需现有/tmp，未触碰真实用户库或启动开发服务器。

## N2.5普通入口整合接收（2026-10-29）

主线据以下互补结果及独立审查完成N2.5，当前41/50，完整E4／I6及其他原任务继续开放。不是把不同profile拼成一次执行：同profile的普通CLI／共用bootstrap冷启动与重启由bbt-idb-wait三轮3/3证明；追加未知ID及撤权由bbt-native-authority-final1/1（59.1秒，用例46.6秒）证明。后者在restart末观察新command已登记后撤write/send，未交付文本、records及原共同回执不变；实际发生在插件启动前，返回outcomeUnknown，scopeStopped=true／pluginClosed=false。恢复grant仍拒绝原生新请求，未知记录没有清除。首版错误要求所有阶段都返回permissionDenied的失败保留于bbt-native-authority.log；当前分别接受受理阶段合法的permissionDenied／outcomeUnknown，均要求拒绝且数据不变，不扩大成功条件。

产品入口证据另在native-product-entry-tuescq：接受脚本native-product-entry.mjs对先前已停止的合成配置调用真实library.backup/restore，获得不同libraryId，显式授权后关闭准备实例，离线重绑本机设置及已验固定资源。既有静态harness读取实际构建Workbench并调用产品kernelBootstrap.configureServer；冷引导发生于该真实插件准备，页面随后POST原同源bootstrap端点并显示已连接。实际页面响应的endpoint用于真实KernelClient两格式原包导出，489／510字节产物均含三条题录及预置固定键；监督kernel实例与页面响应一致，scopeStopped／pluginClosed均true、unresolved空，静态宿主exit0、普通CLI stop为stopped。不声称点击UI导出按钮、浏览器产品部署或正式Electron分发通过。

设置／失效／错库的普通入口三例bbt-settings-joint为3/3（40.8秒）；资源身份／权限／替换25/25及原初始化恢复／共同查询证据继续适用。docs/development.md更新实际普通布局、唯一helper依赖、缓存等待与命令入口。native-bbt-independent-review逐项核新增撤权／unknown、设置与资源结果，再读产品静态入口脚本、真实bundle／产品plugin／facts及两份产物，补齐设计表要求的产品静态承载入口，无新增确证P项。无测试IPC或原包结果替身、无开发服务器／依赖安装／真实库／产品模型调用；所有输入及结果均在Git／cache。

## 普通原包冷启动、bootstrap接续与缓存删除修正（2026-10-29）

真实Linux普通布局已越过sandbox前置，但初始system-helper-bbt及bbt-native-bootstrap均在cold fillKeys失败。新增有界Worker debug／dump诊断后，bbt-idb-observation三次一通过／两失败，两失败明确记录IndexedDB delete blocked；原9.0.68的DatabaseFactory在blocked立即拒绝字符串，主侧只见unspecified。blocked发生于Cache.close后的删除阶段，确切连接／事务释放时序未逐项观察，不能据此推断唯一未释放连接。SQL last-modified缺列错误被原包catch并返回空值，不能把该warning当作致命事件唯一根因；本片未编造修改时间、改原XPI或伪造缓存。

自有worker-bridge对固定BetterBibTeXCache的blocked只留诊断并继续等待同一native request；原success／error不拦截，其他数据库不变，没有重复delete或新期限。原30秒启动与unknown收尾保持。事件边界测试bbt-bridge-selfcheck为1/1，明确blocked不完成、success／error原样交付及其他数据库不变，indexedDB为显式EventTarget替身。host构建／类型及tools类型、Biome通过，architecture为14模块／264文件、0 findings，strict通过。

最终bbt-idb-wait真实重复三次全部通过（3/3、2.6分钟，零跳过／重试／flaky）：新隔离配置离线准备并关闭准备实例→普通CLI start及fillKeys→真实两格式导出→stop→desktop共用bootstrapKernel ensure重新起进程→查原共同回执、不重放写入→再次两格式原包导出→stop。三套cold／restart JSON共同提交和records一致，两个补键各一次revision、原固定键完整保持，六阶段kernel实例均与各自监督记录对应，scopeStopped／pluginClosed均true、unresolved为空。共12份实际导出文件保留；bootstrap API接线真实，尚未运行正式打包Electron桌面入口，不能将其写为分发验收。历史bbt-worker-diagnostic的重启监督身份断言失败保留：当时重启仅查询共同回执未启动新host，当前用真实export触发后才核新实例。

系统helper例外仅资源树唯一槽位链接至既有root管理目标；25/25资源校验包含原21保护、固定目标／错槽／链接替换及安全权限变化。独审初轮P2系统祖先见证缺权限已修为同一identity加uid／gid／mode并复核闭合，无目录mtime依赖。native-bbt-independent-review核诊断、原包／普通设置、两阶段真实导出和完整停止，缓存等待追加审查及最终三轮证据核对无新增确证P项。主线据同次ready和完整停止接受N2.4；N2.5另经上节追加整合接收，Windows及更广Item／事务／Reader范围不由本组三次关闭。失败配置及unknown记录均保留在cache，不清旧记录或重放旧操作。

## 系统helper普通窗口的新证据（2026-10-29）

主线对既有系统helper的固定槽位链接已验证普通Electron确实到达sandboxed renderer：NNP1、Seccomp2、filter1、CapEff0和两层NSpid均有实际记录。显示预检通过后，普通窗口同样到达renderer，但capturePage返回UnknownVizError；没有把namespace的EACCES或截图错误当作sandbox未开启。两轮自有scope／cgroup／已见PID均收尾，原始观察器误判DBus sentinel的失败保留。精确事实及cache入口见[investigation](investigation.md#普通electron与既有系统helper校准2026-10-29)。

没有改生产资源树校验、调用原BBT或用户库，也没有把这组结果当报告全浏览器OS隔离。N2.4／5仍须受控系统依赖方案、真实原包ready及正常停止／重启；现有39/50不变，不用额外普通spawn或全局放开链接绕过。

## 主线接收与资源边界整改（2026-10-29）

主线已接入本轮N2.1–3，并保留N2.4／5的原失败。独立审查发现bootstrap未纳入资源集合、启动前重新采纳替换资源两项P2，现统一以初始化时的固定集合与见证核查：固定树有界遍历4096项，成员及祖先核类型、uid、权限和真实位置，bootstrap为必需普通文件；资源目录以NOFOLLOW／O_DIRECTORY打开并通过自有目录FD枚举，版本文件从同一经核对FD有界读取64KiB+1，读前后及扫描末尾复核见证。资源树内使用完整文件见证，树外祖先绑定dev／ino／birthtime，避免无关kernel状态变化误拒绝；末次路径及持有FD都重查权限，所有句柄在finally关闭。未以路径存在替代对象身份或扩大原包执行权限。

`/home/joshua/.cache/scholoom-finish-active/zotero-resource-rereview.md`末节确认两项祖先追加发现均修正、限定复核无新增发现。主线先构建冻结产物，`main-final-kernel.{log,json}`为118/118（0跳过／失败／flaky），覆盖普通CLI／恢复／HostConnection／报告及材料相关内部接线；`main-final-ui.{log,json}`为10/10双宿主。随后两项祖先修正仅重建kernel并补跑`zotero-resources.spec.ts`，`zotero-resources-final21.{log,json}`为21/21（0跳过／失败／flaky），涵盖扫描中替换目录、祖先权限变更及无关状态写入；不把此前118项算作这两项修正已实跑。最终tools类型和资源Biome分别见`main-final-tools2.log`、`zotero-resources-final-biome.log`。架构与根lint已通过，旧warnings／infos保留。

主线另在全新隔离配置显式指定现有系统sandbox helper做一次环境对照；Electron仍报自身SUID helper前置失败，renderer未ready，scopeStopped=true、pluginClosed=false、observations为空。原始输入与结果为本轮生态cache的`sandbox-system-helper*`；同进程stop的unknown保留，脚本退出后独立inspect才确认stopped（`sandbox-system-helper-after-exit.json`）。未改helper权限、安装、提权或增加no-sandbox，未重放旧未知操作。本轮资源安全整改不解决该OS前置，39/50和完整E4／I6继续开放。

## 当前交回：N2.1–3已实施，N2.4／5真实原包受阻（cb5f7ed）

2026-10-29，起点`cb5f7ed30f69b45301c83f296268578051b84e0b`且clean。新派发明确授权实施，取代下文第十六轮阶段停止；本节是实际中途交付，历史规划保留作依据。已完成N2.1规格补齐、N2.2独立恢复及N2.3私有绑定；N2.4装配代码已接，但实际普通原包配方未达到ready，N2.5普通原包／desktop整合未通过。当前apply为39/50，剩余11项。主线已明确要求冻结已验证增量、按原完整目标`failed`交回，不再试flag、安装、提权或改sandbox权限；原答复保存于本轮cache的`coordinator-final-scope.log`。完整E4／I6及change仍开放。

本轮证据根为`/home/joshua/.cache/scholoom-finish-active/zotero-ecosystem/`（以下相对证据路径均在此根）。TMPDIR、profile、合成库、结果与调查脚本均在其中；固定输入为Git中的源码／构建入口、已装依赖，以及`/home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/zotero-better-bibtex-9.0.68.xpi`。不依赖当前/tmp，不改旧profile或真实用户库。可重建命令、独立补丁和文件清单见该根`report.md`、`increment.patch`与`manifest.json`。

### 已实现接线与审查修复

- `HostConnection`抽出`recoverHostSupervision`／`HostRecovery`，恢复与设置／资源分离；`ZoteroOperations.recover`在`ManualApplication.initialize`首步完成同一ProcessAdmission记账，library就绪后`bind`，原super之后的harness恢复顺序保留。missing／disabled／invalid配置均先核旧监督；幂等保留旧command身份、坏记录与未知事实，scope已停但plugin未决不占原生槽。不连接旧进程、不按PID猜停机、不重放领域操作。
- 新私有叶`host-settings.ts`以唯一schema派生类型，有界16KiB、配置目录绑定、未知字段拒绝、私有所有权／权限核查及冻结快照。新`zotero-resources.ts`只接受固定Linux x64离线布局，资源根由kernel目录派生；核固定成员、路径／权限、Electron与BBT版本，惰性提供稳定`beforeLaunch`。没有公共写端口、凭据、库grant或请求自报exec／env／root；合成资源单测只证明验证行为，不证明可执行包可用。
- `serveKernel`供应真实`status.instanceId`和设置读取结果，经`KernelApplication`构造尾参到生态接点；HostConnection仅透传可信DISPLAY／XAUTHORITY和操作私有TMPDIR。architecture仅登记两叶Module的原生适配。普通CLI已能冷启动绑定真实合成库、inspect／独立replaceTitle及stop/start重读设置；N1回执查询始终独立。原包操作才惰性核资源；没有新增生产Xvfb、普通spawn或sandbox绕过参数。
- 独立只读审查发现P2：共同提交已成功后若设置变化，已受理callback／交付误用`checkUnchanged`会拒绝既成结果。`settings-changed-red.log`先复现；修复将初始入口／beforeLaunch的设置检查与已受理操作的实时`checkLibrary`分开，仍核当前库、read/write/send及有效执行，导出revision重读后也复核。`reviewed.log`真实提交红／绿例通过，CSL、键和其他原值不变；审查复核无残留发现。设置不是撤权渠道，库授权继续有效。两名辅助均gpt-6.1-sol/high、无历史fork，已关闭；最终判断由父负责。

设计仍以原N2初始化顺序图及唯一设置表为事实源；本轮补delta的恢复／持久绑定场景，不改正式规格、公共DTO或library权威。`manual.ts`仅生态构造／初始化接点，`application.ts`／`lifecycle.ts`仅zoteroRuntime供应，未改别域handler及恢复。

### 实际验证、首次失败与结果

生产修改后先使用已装TypeScript构建kernel再测试，最终源码对应`build-reviewed.log`；测试期间没有重建共享产物。以下批次有重叠，不能相加成不同用例总数；原始日志保留各阶段源码与首失败。

| 入口／证据 | 实际结果与边界 |
| --- | --- |
| `node node_modules/typescript/bin/tsc -p apps/kernel/tsconfig.json`；tools的`--noEmit -p tsconfig.tools.json` | 最后构建及tools类型通过，`build-reviewed.log`／`types-reviewed.log`。首次`build-first.log`的schema validator不提供TS guard错误已修，未降类型约束 |
| Playwright kernel的cli-runtime、host-connection恢复代表及zotero-resources | `independent.log`：23 passed (1.8m)，含真实普通CLI／库及N1/P1、恢复和合成资源验证；不是原包通过 |
| HostConnection实际送达、未知不重放、读／写callback超时及容量、同owner恢复、停止持久化失败；错库 | `boundary.log`：9 passed (29.6s)，原unknown／完整停止保证保留 |
| 最后P2修复后CLI设置变化及恢复／坏记录／满槽／幂等代表 | `reviewed.log`：7 passed (40.2s)。`settings-changed-red.log`为旧行为失败；`recovery-red.log`为initialize前未保留活动槽的首红例。另`recovery-final.log`曾4失败：有效旧记录夹具受umask002写为664，按原安全契约显式0600后通过，未放宽生产校验 |
| opt-in普通持久原包：`SCHOOLOOM_ZOTERO_NATIVE_COLD=1`，`tests/kernel/zotero-host.spec.ts`的ordinary persistent例 | `native-first.log`先被新复制Electron目录775拒绝，尚未启动host；仅新私有副本移除组写位后`native-second.log`仍失败。增加私有同次诊断并构建后，`native-diagnostic.log`／`native-host-failure.log`取得SUID sandbox原始错误。未达到ready／两格式／重启断言，不以CLI清洗后的unavailable猜根因 |
| 保留失败现场后普通CLI重启，只查询原operationId | `inspect-failed-native.mjs`、`failed-native-readback.json/.log`：notFound；native仍outcomeUnknown，共同revision／键／原值和监督记录不变。没有重放、换ID或清unknown；notFound不证明无效果 |
| 主线批准的唯一新配置sandbox对照 | `sandbox-contrast.mjs`、`sandbox-contrast-result.json/.log`／`sandbox-contrast-summary.json`：只在缓存副本加诊断、仅该实验加`--disable-setuid-sandbox`，实际No usable sandbox，renderer未创建，observations=[]、sandboxProven=false、verdict=unavailable。未把flag带入生产，未证实具体userns／LSM根因 |
| 最终结构／格式／生成检查 | `architecture-final.log`：14 modules／259 files／0 findings；最终Biome、生成归一一致性、strict、schema及diff结果见`report.md`。这些不能代替原包实跑或跨平台验收 |

第一次原包失败的profile由`native-profile.json`定位：`tmp/scholoom-library-bbt-5Tf77y/configuration`。原始stderr为`setuid_sandbox_host.cc:166`，要求chrome-sandbox的root owner／4755；同次监督为scopeStopped=true、pluginClosed=false、pendingCallbacks=0。获准对照仅禁用SUID fallback，仍在renderer前报No usable sandbox；其路径由`sandbox-contrast-directory.json`定位。上游开关依据保留在`chromium-switches.cc`及`.base64`，描述本身不证明当前环境具备安全sandbox。

两次均保留真实unknown／旧记录，不以scopeStopped冒充pluginClosed。对照同进程serve的最初stop为unknown（脚本自身仍活），await serve关闭并且脚本退出后独立inspect才确认stopped；`sandbox-contrast-summary.json`同时保留initialInProcessStop与afterProcessExit。原操作只读查询脚本亦完成stop；不清锁、删目录或停止共享显示。没有UI服务、外部模型付费调用、依赖安装或真实用户库访问。

内部library／broker／CLI／WS／ManagedCommands／文件与原生归属均真实；恢复测试的fixed-host是声明的Node协议夹具，资源单测是未执行的合成文件，P1代表例只替换外部HTTP模型。原包例使用未修改BBT9.0.68和已装Electron，但新普通配方被OS前置阻断；独立对照的复制host仅加观察，不是生产运行成功。旧隔离注入绿色不抵消该失败。Windows原包、本轮desktop GUI、macOS managed及正式分发未通过或未运行。

### 原2.1–5.2的实际差距与续做

| 原任务 | 已有成果与仍缺完成依据 |
| --- | --- |
| 2.1 E1／E2／E5 | 普通期刊来源实例／schema44原值／正式键共同provider已实际消费，reading契约与MaterialReading也已在树中；复杂映射、Zotero Reader sidecar／PDF新字节写回及E5联合验收未完成。不能再泛称“未收到文献／阅读设计”，也不据端口存在关闭写回 |
| 2.2 E3事务 | 已验最多100条／256KiB现有题录一次共同原子commitRecords、CAS及稳定结果查询；创建／删除／附件／组织等广范围save事务未适配，不能以逐条提交或fixture SQL冒充 |
| 2.3 E4装配 | 既有注入原包／Linux监督及主线Windows公共HostConnection24项已接收；本轮普通绑定／先恢复已验，新普通原包sandbox受阻。Windows原包／正式分发未验，macOS受管执行不可用 |
| 3.1 同源与人工／Agent入口 | 既有真实broker／认证WS／共同库／原工具及N1已验；普通新配置的原包入口没有ready，不以inspect／replaceTitle或旧注入覆盖整个生产入口 |
| 3.2 SQL／保存／缓存 | 既有普通期刊派生SQL、CAS、固定键、通知／缓存及共同提交读回已验；更广Item／事务／材料映射尚缺，无第二库权威 |
| 4.1–4.2 真正整合 | 既有隔离真实路径证据保留；本轮普通冷启动原包两格式／重启与desktop组合未完成，完整跨平台原包及I6继续开放 |
| 5.1–5.2 审查／最终交付 | 本独立片已有审查、P2红绿及必要构建检查；此记录是中途交接。完整proposal判据、跨模块整合及最终验收由主线负责，原整体任务不勾 |

下一步先由主线解决Linux目标sandbox前置或明确新的受审配方，再在**全新**隔离身份验证N2.4的ready／插件关闭和N2.5普通CLI／desktop两格式／重启；旧未知操作只查原ID，不重放，不自动解除。主线指令与本轮完整任务失败结果一致；独立N2.1–3可审收，不据39/50或静态检查宣称整体完成。E6删除恢复、真实用户库、其他字段／多来源、外部接口、自动同步及正式分发仍不在已验范围。

## 第十六轮主线接收

四份N2规划工件已保全提交并合入dev，两轴冻结审查均0确证发现。主线核当前Manual／KernelApplication初始化、HostConnection旧恢复及serve实例来源，接收独立恢复→叶设置／固定资源→真实原包装配→普通入口整合顺序，接缝决定已写回design。N2.1仍需规格补齐及实际签名核对，N2.2–5均未实施；本轮不再派发开发，不将规划接收算作生产接线。

共同产物实跑N1普通CLI／撤权三例3/3（18项边界组合内），原包／独立原值UI双宿主2/2（整组7通过1失败），原值／CSL草稿与不重放保护保持。完整构建、全包／tools类型、架构及八份生成映射通过，证据根`/home/joshua/.cache/scholoom-round16-integration/`。新Linux普通持久原包装配、Windows原包及真实用户库仍未验；不能以既有隔离注入正例证明N2配方可启动。macOS受管执行继续不可用，完整E4／I6不归档。

## 当前交回：N2精确规划（7aff2c7）

2026-10-28，共同HEAD `7aff2c763504f0ddf3b2304eb6ea18b7ef0e389c`、起始clean。已消费下面第十五轮主线验收及共同计划最新安排，N1.2与两个消费者不再等待／重跑。本轮实际完成的是**源码调查及N2实施规划**，只修改原investigation／design／tasks／本记录；没有生产实现、settings文件、loader、资源登记或新规格落地。已有delivery用于记录这次调查交接，未新建delivery或伪写N2实现成果。

### 本轮成果及需主线审查的精确增量

- investigation新增当前启动链和监督／准入源码依据，现状图说明恢复还在首次host.start；design的N2节维护目标顺序、精确schema、错误、所有权和验收，不另建配置或进度台账。
- 建议唯一`<canonical dataDirectory>/host-settings.json`，首版仅生态leaf和单项离线资源登记；绑定实际libraryId及配置目录，显式禁用／无效分开，无默认grant。离线资源根固定派生在同配置的`native-resources/zotero-journals-v1/`，复用现有applicationDirectory文件访问保护，schema也不接受任意root。固定Linux x64 Electron＋managed入口布局不接受请求executable／env／目录，不把普通安装包index当managed。短期凭据不持久化；settings不替代库、键或回执权威。
- 先交独立N2.2：抽`recoverHostSupervision({directory, admission})`，在Manual.initialize首步完成原scope记账，library就绪后再绑定，programs／harness恢复在后。无设置／禁用／配置坏或无资源也必须先核旧监督；scope已停但插件／领域未决不占原生槽，坏记录保留现场并保守计入单host，只有记账无法建立才禁止发布执行入口。没有全局停用开关或解除unknown API。
- 公共候选另包括真实serve status.instanceId供应、HostConnection仅DISPLAY／XAUTHORITY／操作TMPDIR及稳定beforeLaunch透传、两个私有叶Module的architecture适配登记。**这些均未实现或接入**，主线需审签名、两处初始化调用及配置目录绑定语义；不再问D14-2／3。后续N2.1先补批准delta，再分独立恢复／叶设置／原包装配／普通入口整合，不把本轮规划当自动实施授权。

资源存在性／显示仅在确需原包时惰性校准；独立inspect／replaceTitle不额外依赖显示。首片不启动产品Xvfb、不复制测试env包装或默认no-sandbox；新配方若需额外平台能力，带真实失败交主线，不猜成功。N1、共同授权、原值／CSL分离、键保护及100项原子提交均复用。完整E4／I6、E6／真实用户库、Windows原包、macOS managed execution及正式分发没有新增通过结论。

### 实际命令、原失败与未运行边界

本轮独立根为`/home/joshua/.cache/scholoom-zotero-n2-97Zf3t/`，多行payload使用bash且先export其中tmp为TMPDIR。只读核查不依赖旧/tmp，未读取真实用户配置／库或操作其他树。

| 命令／动作 | 本轮实际结果及证据 |
| --- | --- |
| `git rev-parse HEAD`、`git status --short` | 起点如上且clean，无同步／旧补丁应用／提交。结束仅原四工件改动 |
| 当前apply及investigation／design／tasks instructions | 已读取并保存本轮cache；按scholoom-dev续做原change，CLI ready不证明N2实现。实际调查后已取delivery instructions再更新本记录 |
| 只读源码／测试核对、`node <cache>/collect-source.mjs` | 保存20个当前源码文件片段至source-evidence.txt；可从本树同HEAD重建。包括serve持锁／实例、Manual初始化、配置及项目路径保护、现有监督与准入、固定资源／包入口及环境白名单，未执行其中业务方法 |
| `openspec validate connect-zotero-host-bbt --strict`、`openspec schema validate scholoom-dev` | 均通过，strict-final.log／schema-final.log；验证结构不证明N2已实现。新图人工核对图文／顺序，未运行Mermaid渲染器 |
| `git diff --check`、四文件范围核对、`git apply --reverse --check <cache>/planning.patch` | 均通过，仅原四工件；独立补丁和manifest同cache。没有更改正式规格／公共schema，无需build／类型／生成重跑。R16三项规划已勾，新增N2五项实施均未勾 |

本轮**没有新的业务测试首失败、修复或绿例**。第一次补写investigation因旧标题上下文不匹配被apply_patch拒绝、未写入，核当前标题后正确应用；这不是业务失败。上轮主线内核15/15及原值动作2/2只作已接收证据，整合UI5/6的项目保存失败、CI目标未验均原样保留，不从静态规划关闭。未运行CLI／BBT／Electron／显示／UI或CI查询，没有启动任何服务、安装或下载依赖。

只读辅助gpt-6.1-sol/high、无历史fork，承担HostConnection恢复／ProcessAdmission及已有测试事实提取；父负责设置／资源／启动链、公共签名取舍及最后核查。已按原源码抽查retainUnknown及目录准备try外的缺口，辅助已关闭。本轮没有内部模块替身、合成库或外部模型调用；下一实施片的真实／替身边界见design验收表。

### 接续入口与停止点

下一步交主线审查design中恢复、真实父实例、受限环境和冷启动路径绑定hook，优先批准N2.1／2独立恢复切片；N2设置／loader及原包冷启动待后续实施，不把两者与旧N1只读接续混记。后续任务均保持未勾，2.3／3.1及整个change仍未完。原N1消费者候选已合入，不再应用历史cache补丁。

本轮必需工件为Git原change四文件，独立增量`/home/joshua/.cache/scholoom-zotero-n2-97Zf3t/planning.patch`；instructions／校验／源片段和重建脚本同根。不需要XPI／DISPLAY／当前/tmp或历史probe。没有自有后台进程、profile／项目或服务要停止，没有碰共享显示；到此停止等主线验收，不提交／推送／PR／归档。

## 第十五轮主线验收

N1.2已保全合入，冻结成果两轴审查无确证问题。主线补齐`isolated-kernel`及`zotero-original`四处旧消费者断言：无native配置查询当前库返回原回执／notFound，错库返回instanceMismatch；原撤权、草稿、写入次数和记录历史断言保留。完整构建／类型及生成映射检查通过；主线定向内核15/15包含普通CLI三例与隔离内核四例，原值动作真实BBT双宿主2/2通过。命令与首次结果在`/home/joshua/.cache/scholoom-round15-acceptance/`的main-kernel／main-ui日志及JSON，原消费者候选现已接入实跑。

整合UI总计5/6：另一个文件恢复后保存的Electron场景失败，交项目R16.1，未将整合写成全绿。N1自身范围通过；N2下一片只细化既定唯一宿主配置、离线资源与恢复屏障的精确实施规划，不提前开放原包或真实用户库，完整E4／I6继续开放。所有必需输入在Git／cache，无现有/tmp内容前置。

## 当前交回：N1.2普通CLI只读回执

2026-10-28，起点`58eda1404fcc60036ce0e0f3ce30d5453ce1ee30`且clean。已按主线授权及D14-1／2／3=A/A/A实施N1.2，取本轮apply及实际执行后的delivery instructions；任务进度33/42。本片只完成普通共同回执核查及限定回归，N2、2.3／3.1整体、完整E4／I6及真实用户库仍开放。下面R14主线决定和调查段是当时回执，N1未实现／待选择等旧状态由本节覆盖，不再等待重复授权。

### 实际变化与调用路径

- `apps/kernel/src/zotero.ts::checkLibrary/result`：抽出原共同库授权／身份核查，`check`继续保留native门，其他四操作不放宽。`result`查询前后核read、Agent send及当前library.status.id；Agent复用kernel已有`harness.executionFacts`且要求verified，并在返回前核signal。schema、CLI转发、manual handler、architecture声明及library记录表均未改；不新增开关、结果台账或native设置。
- 普通`CLI start`→ensureKernel／serve→真实WS／broker→ZoteroOperations→唯一`library.commitResult`→交付前复核的路径已经运行，无测试私有IPC或native供应。成功／拒绝回执保留原修订；notFound不启动host、不重放或解除旧unknown。P1的rememberLibrary→rememberCatalog及后续模型read/send准入保持原实现。
- `tests/kernel/cli-runtime.spec.ts`新增三个必要代表例，原有CLI科研测试不变；`docs/development.md`补普通result入口与四操作限制。对应设计图为design的N1只读查询图；没有增加生命周期或装配行为。

### 首次失败、最终命令与证据

所有命令在本树运行，先`export TMPDIR=/home/joshua/.cache/scholoom-zotero-n1-W0TDq6/tmp`；Node为本机24.12.0，仅用已有依赖。证据根`/home/joshua/.cache/scholoom-zotero-n1-W0TDq6/`，以下均为其中相对路径。

| 命令／阶段 | 真实结果与证据 |
| --- | --- |
| 旧已验产物：`node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/cli-runtime.spec.ts --grep 'ordinary CLI queries\|result rechecks' --output <证据根>/red-results` | **2 failed**：普通CLI已启动，但result因native门返回unavailable；读取后撤权例同样先被该门拒绝。`red.log`及red-results原trace保留；并非超时或缺原包 |
| `pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel build` | 通过，实际重建kernel并复制原迁移／architecture资源；`build.log`。未重建desktop／zotero-host或共享包，后续测试期间冻结产物 |
| `node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/cli-runtime.spec.ts --grep 'ordinary CLI queries\|Zotero result' --output <证据根>/green-results` | **3 passed (1.2m)**，单例42.2s／75ms／15.4s；`green.log`。普通start及stop/start均按原ID查成功／拒绝／提交后观察丢失回执及notFound，原值／CSL／固定键和revision不因查询变化；错库instanceMismatch、撤read permissionDenied及其余四方法unavailable均实测 |
| 同上第二、第三例 | 真实provider读结果后同步撤read，交付被拒绝。Agent仅用read_zotero_result取得notFound后撤send，下一轮及重启均failed且外部模型请求数不增长；未依赖原包／DISPLAY |
| `node_modules/.bin/tsc --noEmit -p tsconfig.tools.json`；`node scripts/check-architecture.ts` | 通过，`tools.log`为空且exit 0；`architecture.log`为14模块／254文件／0 findings |
| `node_modules/.bin/biome check apps/kernel/src/zotero.ts tests/kernel/cli-runtime.spec.ts` | 首次新增测试有格式／import顺序及两处非空断言提示，已用内置apply_patch修正；最终2文件通过，不修改生成文件或放宽规则 |
| `node packages/protocol/scripts/contract-types.mjs --patch`及`node <证据根>/check-generated.mjs` | 生成映射按最终schema核对；原始候选7文件仅仓库格式差异，经同一Biome格式化逐文件比较完全相同，`generated-verified.log`。候选保存在cache，未应用到源码 |

未知观察例只在真实commitRecords提交后的libraryChanged订阅中抛出观察故障，准备调用未取得成功结果；随后关闭准备实例，用普通CLI查原requestId。每个准备写入仅一次，未知的那次只增加一条修订；稳定回执早于当前record的修订也原样返回。此处不冒称产生或解除HostConnection的原生unknown记录，没有启动任何host。

### 真实与受控边界、审查及消费者缺口

内部library／SQLite／broker／WS／普通CLI进程／harness worker／项目文件均真实，数据为新建合成题录。仅有两种时序注入：提交后订阅抛错、真实commitResult读取后撤read；没有伪造持久回执。P1子例的外部模型HTTP使用已有createModelServer，可信测试构造只供应该模型端点及合成凭据；它不证明普通CLI模型配置已交付，不供应IsolatedZotero。项目／配置和原失败目录保留在cache，未删除已登记项目。

gpt-6.1-sol/high只读辅助（无历史fork）核对权限／执行端口及改动，父Agent抽查决定。确认kernel早已消费harness.executionFacts，broker仅在每次call入口核signal，所以result自己的交付前执行复核有必要。审查还发现本轮封闭写集外的**四处旧消费者断言**需要随批准契约迁移：

1. `tests/kernel/isolated-kernel.spec.ts`：错libraryId由旧native门unavailable改为当前库身份instanceMismatch。
2. `tests/ui/zotero-original.spec.ts`：无native配置的准备内核按当前库查询应返回notFound；错库应instanceMismatch；native绑定错误但查询仍指当前真实库时，原未派发requestId应返回notFound并保留pending／CSL草稿，不能再期待native门报错。辅助初步把最后一处推断成instanceMismatch，父按实际queryInput／当前libraryId复核纠正为notFound。

这些消费者文件本轮**未修改、未运行**。精确独立候选`consumer-alignment.patch`和可重建脚本`consumer-alignment.mjs`仅在证据根，`git apply --check`通过；它们不是已经接入或通过的源码。父整合时须先应用N1实现及消费者契约迁移，再按所属入口复验。不能将当前3/3记作旧isolated-kernel／双宿主GUI组全绿，也不能为了保留旧断言重新绑回native门。没有运行BBT、图形、全仓CI或Windows／macOS目标；显示helper／CI未改。

### 交回与停止点

原change仍未完成，仅N1.2勾选。本树独立增量为证据根`n1-implementation.patch`，旧消费者迁移为单独`consumer-alignment.patch`（未应用／未运行）；依赖共同58eda140，无新增公共schema／存储／库提供者要求。父负责提交及消费者整合验收；N2继续按design细化唯一kernel设置、可信离线资源与加载／恢复契约，本轮没有实现其任何部分。

接续依据为Git内本change及测试，命令、原失败、脚本、profile／项目和补丁全部在上述cache根；`manifest.json`／`cleanup-status.json`记录工件与自有CLI停止核对，不依赖现有/tmp、XPI或DISPLAY。自有准备实例／CLI／harness及模型HTTP均已收尾，辅助Agent关闭；未启动开发或静态UI服务，不停止共享显示或其他项目进程。没有安装、提交、推送、PR、归档或真实用户库访问，到此停止等父验收。

## 第十四轮主线验收及后续决定

本轮四工件保全合入，两轴审查无本线确证问题。用户委托主线选择后，D14-1／2／3均选A：下一片先实施已有授权下普通CLI的只读result；未来native绑定只归kernel宿主设置，首个原生片用可信操作者离线固定资源。选择及理由由design维护，N1窄例外已进delta，N1.2仍未实现；不扩大其他四操作、真实用户库或默认库权限。N2具体装配契约继续后置，不提前建通用配置框架。

本轮没有生态生产／原包新实跑。新f4ab1e5 Linux内核唯一失败在scope测试无DISPLAY的新Xvfb预检返回127，未进入后代收尾业务；原日志／trace在`/home/joshua/.cache/scholoom-round14-acceptance/`，不能据127猜定缺少哪个程序。该有限环境问题下一片交计算线独占helper／CI处理，生态只实现N1，不并改显示夹具。完整E4／I6仍开放，见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十四轮验收后的安排)。

## 当前交回：普通CLI接续／原包装配调查规划（R14）

2026-10-28，HEAD `f4ab1e5f1ed17ae9af656c1f9945005a2786d911`，起始clean。本轮仅调查和下一片规划，修改本change的investigation／design／tasks／本记录；没有生产实现、配置或schema变更。已取当前apply及实际调查后的delivery instructions。R14三项规划完成后累计31/42，新增N1两项仍等待D14-1及后续实施授权；CLI ready不代表候选批准或完整change完成。

### 已查清与推荐方案

源码证据集中在[investigation当前节](investigation.md#当前调查普通cli重启与原包装配缺口f4ab1e5)，候选／精确写集／验收及选项在[design当前片](design.md#当前规划普通入口结果核查与原包装配分片f4ab1e5)。这两个工件是本轮事实源，不另建配置或进度台账。

- 普通CLI已转发五项生态方法，但start→ensureKernel→serve不加载IsolatedZotero；程序内构造和测试私有IPC可注入，并且重启测试每次重传。当前绿色CLI／UI消费了真实内核，却没有证明普通start能自行恢复原包装配。
- 五方法共用配置门，所以即使result只是读library.commitResult，普通未配置宿主时仍在此前返回unavailable。此结论来自当前调用链静态核对；本轮没有启动普通CLI或将其伪写成实跑失败。原值／来源／正式键、库原子提交及稳定结果提供者已经存在，不再等待文献交同一能力。
- **推荐先评审N1**：仅使普通CLI在重启后按当前库授权核查原requestId，保持共同回执／notFound语义和持续外发；其他四方法仍按现有隔离门拒绝。无需原包、DISPLAY、安装、native凭据或新仓储；也不解除原宿主unknown、自动重放或写真实库。因为当前规格仍全隔离，此只读例外是D14-1选择，不是本轮已批准或已实现行为。
- **N2原包装配仍受阻**：普通入口的唯一持久启用绑定、可信资源解析／交付、正式包固定受管入口及平台环境尚未定。默认index隐藏窗口、资源版本URL或测试env／no-sandbox都不等于产品提供者。N2复用已有JournalCatalog、ZoteroHost、HostConnection／ManagedCommands；来源／键／回执仍唯一归library，不接受renderer任意executable或新增一份配置镜像。

需选择：D14-1，A先交N1只读例外（推荐）或B保持所有生态方法隔离、暂用library.commitResult客户端；D14-2，native绑定选共同kernel宿主设置或只读部署manifest作为唯一权威；D14-3，固定原包／宿主资源选可信操作者离线准备或正式分发提供。后两项不阻塞N1技术细化，当前均未选定；没有默认全授权、启用真实库或持久化短期token的隐含批准。

### 实际工作、验证与未跑

| 命令／核查 | 实际结果／边界 |
| --- | --- |
| git status --short／rev-parse HEAD | 开始clean，HEAD如上；未同步、提交或重放旧patch |
| 当前AGENTS、阶段约定、主线第十三轮安排及原tasks/design/delivery／源码rg、带行号只读 | 核对bootstrap／CLI／serve、构造及测试IPC、普通包入口、资源版本、host listener、库授权／稳定查询及五工具登记。旧设计目标没有冒充真实提供者 |
| apply／delivery instructions | 续做及交回指引已读取，JSON位于本轮cache；只勾本轮实际调查规划，不勾N1／N2实施、2.3／3.1／E4／I6 |
| 主线保全输入和路径核查 | preserved-tmp的原XPI、static-ui及create-ui-config均存在；当前Git内display helper、可信隔离入口及所查工具路径可访问，不依赖现有/tmp内容。只做存在／路径核查，没有运行图形／原包或声称DISPLAY仍可用 |
| OpenSpec strict、diff及规划增量检查 | strict／git diff --check通过；独立补丁反向git apply --check通过。新Mermaid仅人工核对图文，未做渲染器验收；不将结构校验视为候选运行结果 |

本轮没有新的业务测试失败、修复或通过结论。R13原Host wait expired及后续显示修正保留在前轮节；主线本轮main-kernel-result.json为13 expected／0 unexpected，main-ui-result.json为6 expected／0 unexpected，属于已接收结果，未重跑。主线e3c815b／Windows专项40613967285各专项通过与Checks40613967267完整Windows692通过46失败42跳过分别表达，不能据计数宣布新候选或稳定性通过。本轮未查询CI、构建、运行CLI／host／BBT／UI、安装／下载依赖或启动服务。

只读辅助Agent（gpt-6.1-sol/high、fork_context:false）核五方法权限／来源／结果／P1及回调边界，主Agent抽查关键源码，负责普通启动链和最终方案；辅助未编辑或验证。当前隔离原包／GUI真实接线沿已接收R13及主线回执。候选N1／N2没有任何新增真实接线或替身运行；未来验收明确内部broker／库／文件／进程真实，P1外部模型可受控并单列模型装配，不伪称普通CLI模型配置已完成。

### 不依赖现有/tmp的交接入口及停点

本轮独立根`/home/joshua/.cache/scholoom-zotero-r14-To16RE/`，TMPDIR为其tmp子目录；apply／delivery JSON、校验日志、manifest及planning.patch在该根。必需调查依据为当前Git原工件和源码，没有新增独立调查程序遗留在/tmp。临时根不含真实用户库、项目、profile或运行中的执行／服务，辅助Agent已结束，无须停止其他进程。

后续如获原包／UI实施片，固定输入仅用`/home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/zotero-better-bibtex-9.0.68.xpi`、同目录static-ui.mjs及上一级create-ui-config.mjs；在本树cwd生成新cache绝对.mts配置、独立UI_PORT／UI_DATA_DIR／TMPDIR，图形动作前重新xdpyinfo预检。N1无需XPI或图形。Git内历史probe只作旧证据，不执行其历史/tmp默认值，也不让旧运行目录成为普通产品配置。

下一步由主线／用户先选D14-1；若A获选，先明确本change的窄规格例外，再按design精确写集及N1任务另行授权实施。N2配置／资源分支继续等D14-2／D14-3及所需公共提供者，不假装规划闭合。到本次规划增量交回停止；完整E4／I6、真实用户库／E6、安装分发、平台原包及科研质量均未关闭。没有push／PR／归档、其他树操作或真实用户数据访问。

## 第十三轮主线验收

显示前置helper及四消费者已保全合入，独立两轴审查无本线确证问题。完整构建／类型／架构通过；主线内核组合13/13包含两个真实BBT原包代表例、Electron renderer／Worker完整收尾及两个显示拒绝反例，原值动作双宿主2/2。已有DISPLAY经预检复用，未停止共享显示，也未把Node监督替代原包通过。旧unknown现场仍保留，新Xvfb成功路径未验。

原BBT9.0.68 XPI已保全到`/home/joshua/.cache/scholoom-round13-acceptance/preserved-tmp/zotero-better-bibtex-9.0.68.xpi`，与旧原件逐字节一致；本次测试实际使用新路径。新静态UI入口也在同根，解包目录可由原XPI重新创建。下一片仅调查生产装配／普通CLI持久配置的最小差距，见[共同计划](../../../.scratch/domain-development/parallel-development-plan.md#第十三轮验收后的安排)；真实用户库、完整E4／I6、复杂映射及平台仍开放。
## 已接收：真实原包测试显示前置（R13）

2026-10-28，起始clean，HEAD `ba29ee61ac6f8700cfe6a9fbaa529a8a7a75aad1`。本轮按主线第十二轮安排只修测试显示前置，复用已构建且同源的共享／kernel／desktop／zotero-host产物；没有生产源码或协议变化、重建或依赖变更。R13三项完成后累计28/37；完整E4／I6、CLI持久配置、跨平台原包及真实用户库继续开放。

### 原失败现场与不能证明的因果

先只读主线`/home/joshua/.cache/scholoom-round12-acceptance-NagGbw/zotero-ecosystem/sync-kernel.log`、对应trace及注解中的`sync-tmp/scholoom-library-bbt-vZkRMr`。operation为JRNL0002／revision3／固定键的原值导出快照；原监督host=b71f00f5-ba41-4865-91dd-3084c16e8d5c、command=1d5379b2-37af-45bf-aa82-b40099536378，scopeStopped=true、pluginClosed=false、unresolved=[]。这是读导出，没有待提交写operationId；没有初始化或重放该配置、清锁或修改其记录。只读副本在本轮证据根original-{operation,supervision}-readonly.json。

原记录及trace没有该次Xvfb stderr／ready证据。主线另一次`xvfb-nolock-probe.log`有/tmp锁文件写入失败且:99已预检，但不能据相似错误给原次超时定唯一根因。本轮在全新cache配置／profile／身份上运行原夹具，baseline.log再次Host wait expired／hostStartupFailed、收尾未确认；该新现场同样保留，不重试原配置。可证明的测试缺口是四处强制新Xvfb且没有显示预检；受管环境白名单也不自动继承DISPLAY、XAUTHORITY或TMPDIR。

### 实际修改及所有权

- 新`tests/fixtures/zotero-host/display.ts::electronTestCommand`服务全部四个实际消费者。已有DISPLAY用真实xdpyinfo预检；失败即以display preflight明确环境缺证，不另起显示。仅缺DISPLAY时以原xvfb-run -a -e /dev/stderr运行xdpyinfo，确认可创建后才返回对应宿主命令；失败保留有限stderr。预检复用现有runCommand及原生完整归属／收尾，5秒仅为测试环境探测预算，不改生产期限或停止保证。
- helper返回现有`/usr/bin/env`及显式TMPDIR／所选DISPLAY／必要XAUTHORITY参数，再exec既有Electron或原xvfb-run；统一解析Electron、no-sandbox、entry及尾参，kernel仍在尾部追加operation.json。无自制launcher、普通spawn兜底、生产env字段或system access放开。
- 四消费者仅替换命令构造：kernel的zotero-host、zotero-host-supervision、zotero-host-scope和UI的zotero-original。scope保留真实Browser／renderer及ready后忙Worker、取消并等待runCommand拒绝、核全部metrics PID退出；再核共享DISPLAY仍可连接。没有单列Worker PID或把显示服务纳入自有scope，没有停止共享:99。
- scope文件增加两个代表前置拒绝：已有不可达DISPLAY不改投新显示；缺DISPLAY且新Xvfb临时目录不可用时在Electron启动前报环境失败。其他产品／领域符号、表单、授权、unknown／稳定查询、容量和锁保护均未改。design顶部已先落本片方案；无新增产品行为，不改正式规格或另建公共契约。

### 实际命令、首次失败与最终结果

证据根`/home/joshua/.cache/scholoom-zotero-r13-viZvn3/`；TMPDIR为其tmp子目录，所有新配置／库／profile及结果保留。已有本地XPI `/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`实际manifest核version=9.0.68及插件id，仅读取／隔离解包，未下载或改成员。Node24.12.0／Electron44.5.1，Linux及已预检DISPLAY=:99；测试期间没有重建产物。

| 验证 | 实际结果／首次失败保留 |
| --- | --- |
| 原夹具新配置单跑explicit original selection | 1失败；baseline.log／baseline-results。Host wait expired、hostStartupFailed及原包收尾未确认，与主线旧现场分别保留 |
| 首轮必要内核组合 | kernel-first.log：5通过1失败，34.3秒。原包明确选择／独立题名／两格式及两种监督、两种前置拒绝均通过；scope在全部PID退出后因本轮漏import execFileSync失败，非停止或原包失败 |
| scope修正后仅该项复跑 | scope-final.log：1/1通过，3.0秒。补import，没有改断言、时限或重跑其余已绿原包例。本片六项各有最终通过依据，不称首组一次6/6 |
| 静态产品单条原值UI双宿主 | ui-first.log在临时.ts配置加载阶段因import.meta模块格式失败，未启动用例；改临时.mts后ui-second.log：2/2通过，2.9分钟，两个宿主各约1.2分钟，原90秒用例预算不变 |
| tools／格式／架构 | tools-first.log的缺execFileSync错误随上述import修正；tools-final.log为tsc --noEmit -p tsconfig.tools.json通过。biome-first.log保留两个格式差异，内置apply_patch修正后biome-final.log检查5文件0警告；architecture.log为14模块254文件0发现 |
| 收尾 | OpenSpec strict及git diff --check通过；完整增量含新helper，反向git apply --check通过。无schema／生成映射变化，不重跑24项、全BBT、TeX或全仓CI |

内核首组命令（环境前缀均为上述TMPDIR、DISPLAY=:99及SCHOOLOOM_BBT_XPI）：

```sh
node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/zotero-host.spec.ts tests/kernel/zotero-host-scope.spec.ts tests/kernel/zotero-host-supervision.spec.ts --grep 'explicit original selection|display preparation|existing managed commands reclaim|actual managed BBT' --workers=1 --output=<证据根>/kernel-first-results
node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/zotero-host-scope.spec.ts --grep 'existing managed commands reclaim' --workers=1 --output=<证据根>/scope-final-results
```

UI用证据根playwright.ui.config.mts沿原UI配置仅替换静态承载／绝对路径／独立输出，端口42569，执行`playwright test --config=<该文件> tests/ui/zotero-original.spec.ts --workers=1`。承载为用户指定static-ui.mjs、当前树构建产品和原可信startIsolatedKernel；没有DEV样例或开发服务器。原UI动作、CSL草稿／CAS及请求／回执丢失／重启查询断言均保留，没有复制文献实现或复写其fixture。

真实边界：共同library／broker／SQLite、受管原生进程、HostConnection认证WS、Electron／Worker和未修改BBT实际导出。题录／来源实例是合成输入，私有监督例继续标注injected adapter；shutdown-error及UI传输丢失是原有明确故障注入，不替代共同库权威。没有外部模型科研质量结论。original-title.json、original-actions.json及监督工件保留实际原值／CSL／固定键／回执及进程依据；当前成功代表例最终scopeStopped=true、pluginClosed=true、unresolved=[]，fresh-supervision.json与失败baseline目录分列。原同步unknown现场仍未关闭或改写。

### 审查、限制与交回

只读辅助Agent（gpt-6.1-sol/high、fork_context:false）给出四调用点、白名单及scope边界，主Agent抽查并实现。自查entry／尾参顺序、受认证stdin供应、原生归属与清理：env直接exec保留受管树，显示服务不属于执行；预检异常不是业务成功或自动安装／提权／清配额理由。收尾:99仍可读，本轮静态server已退出，UI窗口与可信内核／原包执行由各原fixture收尾；不删除登记项目或旧轮目录。

新Xvfb成功创建路径在本机未验；已验新建前置失败和已有显示真实路径，不据Linux样本承诺无DISPLAY环境或跨平台原包。原同次超时唯一原因仍缺stderr，不能回填已确认插件关闭。最新用户提供基线29cd728／40591705520的Linux内核750通过26跳过、UI126通过32失败6跳过，Windows723通过11失败42跳过及macOS人工UI13通过1失败，均与本轮结果分列；未查询／等待新CI或触发全仓测试。

本片增量与manifest在本证据根，依赖ba29ee6既有受管／库／原包接线，写集仅一个测试helper、四消费者及本change三份文档。停止于本片Linux显示适配及真实原包／对应UI代表例交回；完整E4／I6、CLI持久配置、其他字段／多来源／自动同步、E6及真实用户库均未启用或关闭。无生产源码、依赖安装／下载、提交／push／PR／归档、Git同步或他树操作。

## 已接收：同源码Windows实际送达监督子项（R10）

当前HEAD为`4312262c1a1f432ccd706dd1eb6ff6468765fd4e`，起始clean，主线已保全接入R9并同步。本轮仅只读消费新共同源码Windows目标实跑，修改本tasks／delivery，不改生产或测试代码。**Windows未派发拒绝／实际送达后未知／稳定关联与重启不重放代表边界已通过，本监督子项闭合；完整E4／I6继续开放。** 下文R9的Windows待验和旧trace是当时交回事实，当前目标结果以本节为准。

### 同源码、实际命令与结果

- Run：本仓Windows execution diagnosis [40476577132](https://github.com/leike0813/Scholoom/actions/runs/40476577132)，headSha与当前HEAD完整相同；job `122096177677`（execution）。run已completed且总体failure，不能据此把每个步骤或用例计失败。
- Host步骤：`Verify delivered host mutations retain uncertainty`，08:57:45–08:58:26 UTC（2026-10-27），success。原始命令为`pnpm --config.optimisticRepeatInstall=false exec playwright test --config playwright.kernel.config.ts tests/kernel/host-connection.spec.ts --workers=1 --output test-results/windows-host`，逐例24/24通过，39.5秒，无skip；第7项host-connection:159的失联写入例1.4秒通过。构建步骤`pnpm --config.optimisticRepeatInstall=false build:shared`已于08:54:12 UTC成功，先构建后运行目标，期间无重建。
- 原始日志：主线交接`/tmp/scholoom-round9-acceptance-IER31D/windows-diagnosis.log`中host步骤38行与本轮`gh run view ... --job 122096177677 --log`下载逐字相同；不是只读workflow定义或以step success推定24项均通过。availability／Agent等其他步骤失败交所属线，本轮不归因或计关闭。
- Artifact：`12721785916`，`windows-execution-diagnostics`，492078字节；只读下载至`/tmp/scholoom-zotero-r10-evidence-MzsXX9/windows-execution-diagnostics-12721785916.zip`。实际成员`windows-host/host-connection-transport--4a66c-ion-or-replay-it-on-restart/mutation-loss.json`已提取为同目录`mutation-loss.windows.json`，非旧caf9025／b2f3b50的trace。

### 实际送达与稳定关联核对

核对当前源测试及固定host：同一用例先在未ready时调用wait，断言unavailable且unresolved为空；启动后wait进入真实invoke，先通过已有sample.read回调报到，测试观察原caller后读取已持久监督文件，再主动drop。收到回调意味着实际handle已通过HostConnection的在途／scope／可信context核对，不以内存unresolved出现代替送达。Windows该用例完整通过，包含其后outcomeUnknown、关闭及新连接start拒绝不重放的断言。

工件实际值：caller=`caller`；accepted.hostInstanceId=`616cb438-10e9-4f77-9907-ae8be021eb80`、commandInstanceId=`8abd8138-8b94-43fc-8a0f-eb715a3c4a9a`、unresolved=`[stable-domain-operation]`。closed仍为相同host／command实例，state=unknown、scopeStopped=true、pluginClosed=false、pendingCallbacks=0，稳定操作关联保持，reason=hostConnectionLost。该JSON未另存handle字符串或拒绝码／重启回执；这些边界的依据是同源码用例断言与逐例通过日志，不能伪称JSON直接记录了所有事件。正常关闭、回调超时仍跟踪／占容量、恢复占用及启动授权等其余原有监督用例也在这24项中，但不推广为所有原包、平台或生产路径已验收。

真实／夹具边界沿R9：Windows真实受管Node固定host、认证WS、RpcPeer、OS原生归属和监督文件；固定host的wait挂起及drop断联是故障夹具，非BBT或共同库业务写入。正式回归没有R9临时save调度gate，没有模型或文献库替身。

### 首次失败、校验与停点

历史失败保留：Checks `40455958976`／caf9025完整Windows组中的原host-connection:159，预期outcomeUnknown而实际unavailable，见主线`ci-baseline-failures.log:2740`附近；更早R9红例及校准仍保留。该旧源码／旧trace不能证明本轮修正后结果。新4312262 host步骤本次首个目标实跑24/24通过，无本轮新的目标失败，也未通过重试／sleep／加timeout获得通过。

本轮执行只读`gh run view`核run/head/job/逐例日志、`gh api .../actions/runs/40476577132/artifacts`核元数据及下载指定artifact，使用已有unzip读取目标成员。只消费远端先build后test证据，没有本地重建或重复监督／BBT／TeX测试。收尾OpenSpec strict、git diff --check及文档增量反向git apply --check通过；没有代码／schema变化，无需重跑类型／架构或生成映射。

新Checks `40476577071`／4312262在本轮查询时仍in_progress，不把启动计通过，也不轮询等待其他线。用户指定最近完整组基线仍单列：40455958976／caf9025，Linux743通过1失败26跳过、Windows687通过41失败42跳过、macOS人工UI13通过1失败；原生定向和fallback／入口不替代完整组。本轮仅关闭上述Windows监督子项，不能把availability、Agent、并发启动、原包业务或完整E4／I6计关闭。

证据、原始日志／run快照／artifact、精确成员来源及仅两份文档的增量补丁在`/tmp/scholoom-zotero-r10-evidence-MzsXX9/`，manifest列引用。R10完成后任务累计25/34，原2.3／4.2等完整前置继续开放。到本片验收记录交回即停止，没有生产实现、依赖安装／下载、开发服务器、真实用户库、Git同步／提交／push／PR／归档或其他树操作；仅下载了本仓安全CI工件。

## 已接收：E4断联写入夹具送达边界（R9）

基线及当前HEAD为`0b788151b5e17665a26d9286dfd1d12f6e2e0c30`，开始时clean。本轮按“第八轮验收后的收敛安排”只处理Windows host-connection:159的取证与夹具因果；原R8已接收，GUI由文献消费。R9三项完成后累计24/33，其余原任务及跨平台／生产／整体I6保持开放。本节替代旧轮的当前状态，不应用历史累计patch或修改已接收原值API。

### 原始失败与校准结论

已只读核对本仓Checks `40447074031`／b2f3b50，Windows job `122000779926`，artifact `12710309824`。证据在`/tmp/scholoom-zotero-r9-ci-jLNM0gAs/`；目标trace为`baseline/kernel/host-connection-transport--4a66c-ion-or-replay-it-on-restart/trace.zip`，提取事件、原job日志及evidence-manifest.json同目录。trace只记录unresolved轮询通过及写请求拒绝码unavailable，缺host.invoke派发／宿主接收、落盘及原错误消息事件，不能把它写成Windows已派发写入被错误分类的证明。

源码核对`HostConnection.call`与`RpcPeer.request/close`：未决身份先同步入内存，写请求等待save后才request；drop为读，不等待该保存。RpcPeer已关闭时拒绝新请求为unavailable；待决写请求的lossCode才是outcomeUnknown。因此原测试的内存轮询不证明写请求已发出。保守未决身份仍须保留，不能因错误码unavailable就自动重放或清除监督记录。

Linux既有真实固定host校准保存在`/tmp/scholoom-zotero-r9-calibration/before-dispatch.mjs`及`.log`：仅对该实例save增加一次诊断调度gate，在实际保存／request前停住；旧轮询条件已满足，此时先drop，放行save后得到`unavailable / RPC连接已关闭`。随后实际scopeStopped=true、pluginClosed=false、unknown及原稳定关联保留。内部WS、ManagedCommands、原生归属、RPC和磁盘写入真实；该gate不是Windows时序测量或正式回归，也没有新增生产钩子。它证明原断言允许一个未派发顺序；原Windows trace缺失的顺序仍不能反推。临时脚本生成器首次因未导入join失败，未启动宿主；改由内置工具落稿后实验一次通过，未删除临时目录。

### 实际修正与范围

- `tests/fixtures/zotero-host/fixed-host.mjs`：既有wait在进入invoke后先await已有sample.read回调，再保持不完成；不增加公共方法、假结果或睡眠。
- `tests/kernel/host-connection.spec.ts`原失联用例：先断言未ready调用为unavailable且unresolved为空，再用相同稳定身份开始真实写请求；等待实际回调携带原caller到达，读取已持久的监督关联后才drop。原outcomeUnknown、unknown／完整原生停止及重启不重放断言保留；新mutation-loss.json保留实际caller、持久意图及关闭事实。
- 仅更新本change的design/tasks/delivery。`HostConnection`、broker、schema、kernel生命周期、期限／容量／回调收尾、原值API、harness及UI均未改。既有“独立认证及操作范围的公共监督”规格已要求未知保留与不重放，本轮无新行为或规格增量。

### 实际验证与首次结果

Node24.12.0，Linux本机；先用已有tsc构建kernel，再测试，测试期间未重建。构建按原脚本复制migration和architecture到ignored产物，没有依赖安装或开发服务器。

| 检查／命令 | 实际结果及证据 |
| --- | --- |
| baseline构建后原用例单跑 | 1/1通过，1.8秒；`/tmp/scholoom-zotero-r9-baseline-{build,tests}.log`。Linux原例偶然通过不否定CI失败或其因果缺口 |
| 新报到断言先跑旧fixture | 预期1失败，6.1秒，caller为undefined；`/tmp/scholoom-zotero-r9-receipt-red.log`及`-receipt-red-results/`保留。证明原fixture无实际送达报到，不是生产错误分类修复的红例 |
| 最终kernel build及tools类型 | `node_modules/.bin/tsc -p apps/kernel/tsconfig.json`与`tsc --noEmit -p tsconfig.tools.json`均0退出；final-build.log／tools-types.log |
| 定向监督 | `node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/host-connection.spec.ts --workers=1 --output=/tmp/scholoom-zotero-r9-final-results`：24/24通过，31.5秒；final-tests.log。覆盖修正用例、同身份重复写、正常关闭、回调超时仍跟踪／占容量、恢复与私有启动撤权等已有代表边界 |
| 格式／语法／架构／OpenSpec／diff | Biome两文件0警告，fixed-host的node --check通过；架构14模块253文件0发现，strict及git diff --check通过。无schema变化，不重生映射；未重跑BBT或TeX |

上述日志统一前缀`/tmp/scholoom-zotero-r9-`。最终结果目录保留实际`mutation-loss.json`；受测内部固定host、认证回环WS、ManagedCommands、OS原生归属及监督文件均真实，固定host的wait不完成／drop断联是明确故障夹具，没有文献库或模型替身。唯一诊断调度gate仅存在临时校准脚本，正式回归不靠它。测试与实验均收尾自己创建的执行，隔离目录保留。

### CI截点、审查及交回

只读辅助Agent（gpt-6.1-sol/high，fork_context:false）只做本仓CI／artifact取证，主Agent抽查trace的poll／拒绝事件及manifest；代码和验证由主Agent完成。自查确认wait只用于当前失联和同身份重复写场景，callback沿原handle、scope及可信context核对；没有放宽未知／停止／容量保证。本轮不需要新的产品或架构选择。

CI查询截点为2026-10-27 05:35:33 UTC：Checks `40454653610`／0b78815仍in_progress，Windows job `122025046610`仍test:kernel；Windows diagnosis `40454653566`已成功，但实际命令未运行host-connection.spec.ts，artifact `12711359112`也无此例trace。均不计修正后Windows通过。已完成基线仍按用户给出的b2f3b50记录：Linux734通过1失败23跳过，Windows715通过4失败39跳过，macOS人工UI13通过1失败；本轮未触发CI或等待其他线。

本地增量及日志清单在`/tmp/scholoom-zotero-r9-handoff-Zgn8sR/`，`fixture.patch`依赖当前0b78815及其真实公共监督，不是旧累计patch；包含两份测试工件和本change三份文档，反向git apply --check只读核对。Windows需主线将此增量接入后按同一有界场景真实复验；当前只能交回可核查的夹具修正，不能关闭该目标平台失败或整体E4／I6。没有真实用户库、BBT／TeX、文献UI、安装／下载依赖、提交／push／PR／归档或跨树操作。

## 已接收：明确原值选择与独立题名更正（R8）

2026-10-27，基线及当前HEAD为`8a2f0ce522dfbab4110e63e84e542f6660e6115e`，本轮开始时clean。已按用户D1–D3直接实施隔离内核／Agent片；不再等待同步或产品选择，不应用旧累计patch。当前R8.1–R8.4完成，累计21/30；原change其余任务、完整I6、E5/E6、真实用户库和跨平台均未关闭。下文规划／等待是各轮历史，不能覆盖本节及design顶部当前DTO。

### 实际行为与所有权

- `protocol/zotero.ts`增加inspect／replaceTitle，export增加selectionRequired/exported分支与逐条expression；复用共同CSL／OriginalRecord／receipt，business映射仅增加四行。未修改library权威、原包、原值投影或存储台账。
- `ZoteroOperations.read/inspect`实际经broker读取同revision的get／record及唯一schema44期刊identity；题名准确比较，其他字段始终notComparable，结果最多100条／256KiB。缺题名、多原值或不支持形态unavailable，修订竞争contentChanged，不反猜、扫描或循环重读。
- `ZoteroOperations.run`在缺expression时返回核对结果，不创建profile／启动原包或给新文本。明确选择实际identity及revision后才沿既有HostConnection／受管Electron导出；关闭后复核共同依据和read/send，返回实际expression／revision／正式键。host的managed出口仅补结果tag和expression，无原包流程修改。
- `replaceTitle`独立提交准确原title，完整保留其他原值、CSL、来源及正式键／pinned；复用一次共同commitRecords、CAS、稳定requestId及结果查询。已有回执返回queried，未知不重放。生产时限、容量、unknown及关闭保证未放宽。
- manual／CLI与architecture仅添加两个生态操作，kernel消费增加library.get；harness增加`inspect_zotero_originals`、`replace_zotero_original_title`，保留原工具及所有成功结果的rememberLibrary→rememberCatalog登记。表达是可信调用边界内的操作选择；工具要求按用户明示选择、不确定询问，不把模型填boolean当人类授权证据。runtime／application及FileEdit／报告／TaskPort／programs未改。

design变更总览已核对为当前真实隔离分层，先前候选／人工确认provider等待仅属历史。GUI交接契约：以实际sourceId/revision调用inspect，展示CSL与原值、identity、题名比较及其余不可比较；按明确选择提交expression。独立题名动作提交准确title及原identity/revision，成功后消费receipt.results中的新revision并刷新；CAS失败重新核对且保留草稿，未知用原requestId查询。复用文献单一草稿／详情，尚未实现GUI，不改CatalogItemForm或新建来源／同步表。

### 首次失败、真实结果及命令

Node24.12.0／TypeScript7.0.2／Electron44.5.1，Linux本机。沿固定资源清单使用已有BBT9.0.68原XPI `/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`，夹具从原包隔离解包；未安装、下载或修改原包。日志统一前缀`/tmp/scholoom-zotero-r8-`，manifest和可审查增量在`/tmp/scholoom-zotero-r8-handoff-hggAcT/`。

| 检查 | 实际结果／证据 |
| --- | --- |
| 先红：构建旧kernel／host后只跑explicit original selection | 预期1失败：未选expression仍返回BBT文本。red.log、red-results/及red-kernel-build.log／red-host-build.log保留 |
| 首次实现构建／类型 | kernel-first.log保留TS2589/2590；将共同commit DTO先显式定型后kernel-second.log通过。tools-first.log保留TS18048；对真实核对结果增加缺失检查后tools-second.log通过 |
| 初绿真实原包整合 | first-tests.log：10/10，包含新3项、既有100条／冲突／未知／撤权／实际worker工具／only-export重启 |
| 最终构建 | 已安装tsc顺序构建protocol、harness、kernel，按原脚本复制migration和architecture；host目录用electron-vite build。final-{protocol,harness,kernel,host}-build.log均0退出 |
| 受影响类型／格式／架构 | `tsc --noEmit -p tsconfig.tools.json`及host tsconfig通过，protocol／harness／kernel由构建检查；final-tools-types.log、final-host-types.log。Biome改动9文件0警告；architecture为14模块253文件0发现，分别final-biome.log／final-architecture.log |
| 最终定向内核组合 | final-tests.log：48/48，2.4分钟。architecture5、broker4、HostConnection24、library-records2、实际Electron scope1、原包监督2、共同库／BBT10 |
| 生成映射／规格／diff | final-generated.log中全部8份映射对最终schema及Biome格式逐字相同。strict首次仅因新增Requirement超过500字符返回1，openspec-first.log保留；去重并拆清核对契约及场景后final-openspec.log通过。probe的node --check及git diff --check通过 |

最终组合命令（构建完成后执行，期间未重建产物）：

```sh
SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi node_modules/.bin/playwright test --config playwright.kernel.config.ts tests/kernel/zotero-host.spec.ts tests/kernel/zotero-host-supervision.spec.ts tests/kernel/zotero-host-scope.spec.ts tests/kernel/host-connection.spec.ts tests/kernel/library-records.spec.ts tests/kernel/broker.spec.ts tests/kernel/architecture.spec.ts --workers=1 --output=/tmp/scholoom-zotero-r8-final-results
```

新回归实际核对：CSL题名及日期范围／机构作者更正后完整原值和固定键保留；未选表达无文本，boolean额外字段invalidRequest；明确原值两格式保留原题名；独立更正后仅原title改变且两格式采用新值；稳定重复请求只查询、不执行不同新题名；实际CSL竞争拒绝旧CAS；缺题名／多来源／错identity拒绝。未知样本在真实共同提交后由订阅观察故意抛错，返回outcomeUnknown，原requestId查到committed且revision只增加一次。Agent用真实worker工具读取实际核对／回执后更正与导出，only-export持续外发P1在下一轮和重启均阻止新的模型请求。结果目录包含original-title.json、fill.json、两格式100条文本和harness.json。

内部kernel／broker／library SQLite、WS、受管进程及原生归属、Electron、原BBT Worker均真实；题录／来源实例为合成输入。替身只有Agent外部模型HTTP的确定工具响应，以及未知回执用例的提交后观察故障注入；不替换共同存储／SQL／事务或用合成身份绕过生产授权。隔离配置、库、profile、项目和结果目录保留，测试关闭自己创建的执行；收尾未见本树managed host或kernel CLI残留。调查probe只做必要新契约调用迁移与语法检查，未重跑已接收四阶段研究。

### 审查、增量依赖及停点

只读独立审查（gpt-6.1-sol/high）核对同revision读取、无选择不启动、题名只改原字段、未知查询、薄注册及P1，未发现可确证缺陷；审查未执行构建／测试，实跑结论以上述日志为准。后续GUI独立消费时仍须验其真实交互和草稿保护；未把审查视为全平台或真实模型科研质量证明。

本地`slice.patch`完整依赖当前8a2f0ce共同基线，另拆`contracts.patch`→`integration.patch`→`docs.patch`供符号审查：先同源schema／生成映射，再kernel／host／harness／注册／必要测试，再事实源文档。未要求独立拣取其中不完整子集，主线应按最终schema重核映射；不含历史累计patch或其他树私有实现。manifest列文件及日志，反向git apply --check只读验证补丁覆盖当前增量。

最新外部CI仍为39be889／40432749785：Linux709通过9失败23跳过；Windows641通过54失败39跳过7未运行；macOS不可用校准2通过、人工入口3通过1失败。本轮不主动触发全仓、不修无关平台，不以Linux定向结果计Windows通过，也未重复整套H1 smoke、UI或真实模型科研验收。

在本片后端／Agent和GUI消费者契约交回处停止。其他字段／多来源、自动双写或CSL导出、GUI接入、原值恢复／删除E6、生产装配及完整I6均未实施或关闭；没有真实库操作、依赖变更、开发服务器、提交／push／PR／归档或跨树操作。

## 第七轮主线接收及产品选择

CSL／原值四阶段调查及原包证据已接收，主线在隔离库独立重跑evidence/csl-original-probe.mjs退出0；更正CSL后原值及导出保持，显式更正original题名才改变原包导出。用户已确认D1–D3：差异或无法比较时先明确选择采用原值，Agent可依用户明示指令选择、不确定询问；独立更正所选原值；首片仅唯一期刊原值题名。决策事实源为领域票08，design／delta spec及R6.4已更新，未将新政策记为已实现。

主线真实zotero-host七项带固定XPI复验7/7通过，保留only-export持续外发授权及重启保护。原始证据为`/tmp/scholoom-round7-acceptance-SdxHy8/zotero-ecosystem/probe.log`、`main-zotero.log`；初次主线组合缺显式XPI环境的7个skip不计通过，随后独立带环境实跑。

下一片先闭合具体DTO／任务，再实现隔离内核及Agent的显式原值选择和独立题名更正。GUI需求交文献后续消费，不复制草稿或抢改表单；自动同步、其他表达／字段、多来源、真实用户库及完整I6仍开放。

## 当前状态：CSL／原值差异规划

2026-10-27，本树HEAD已核对为`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`，起始clean，实际同步／构建／本树持续外发P1复验由用户交接的`/tmp/scholoom-round6-acceptance-dXuzCA/`四份验收／同步JSON及本树日志提供。普通期刊真实切片和P1已接收，本轮没有返工或回退；没有应用旧patch、等待同步或操作其他树。

本轮**只调查和规划**，没有新生产实现。修改限本change的investigation/design/specs/tasks、已有delivery及隔离证据。已形成可审查推荐A＋B1与D1–D3决定项，见[design本轮节](design.md#csl更正与原值导出差异的待决方案4b13183)；产品默认导出／用户确认身份、独立原值更正或一次明确双表达更正、下一片字段／来源范围仍待用户选择。没有把推荐写成已批准自动双写，也没有新增库权威或修改元数据表单。R6实际状态以tasks为准，原3.x／E5／E6／整体I6不因此完成。

### 实际调查与证据

完整结果与源码定位见[investigation当前节](investigation.md#当前调查csl更正与原值导出的差异4b13183)、[隔离证据README](evidence/csl-original-4b13183/README.md)和[observations.json](evidence/csl-original-4b13183/observations.json)。复用已接收普通期刊样本配方，新建`/tmp/scholoom-csl-original-AUctoW`，没有打开用户库或更改旧样本库。两个正式键固定，原值含日期、跨角色完整creator顺序和Extra未知行。

| 本轮操作／检查 | 实际结果及边界 |
| --- | --- |
| `node_modules/.bin/tsc -p apps/kernel/tsconfig.json` | 0退出；仅重建既有ignored产物，日志`/tmp/scholoom-zotero-r6-kernel-build.log` |
| host目录`../../node_modules/.bin/electron-vite build` | 0退出；日志`/tmp/scholoom-zotero-r6-host-build.log`。沿已有Node24／Electron44.5.1／BBT9.0.68，未安装或下载依赖 |
| `node openspec/changes/connect-zotero-host-bbt/evidence/csl-original-probe.mjs` | 首次0退出，8次两格式实际导出完成，日志`/tmp/scholoom-zotero-r6-probe-first.log`。构建完成后才运行，运行期间不重建 |
| CSL题名更正 | A revision 2→3，CSL新值可读；原值／键／pinned和原值历史不变，两格式仍与baseline相同 |
| CSL日期／作者歧义更正 | B revision 2→3，2025–2026日期范围／circa、机构名／粒子／suffix及译者分组可读；原date及creator全序保持，两格式仍为原值 |
| 显式original题名对照 | A revision 3→4，只有所选原值题名更正，原值历史多一条，原Extra及固定键不变；两格式出现新题名；共同commitResult与实际receipt相同 |
| 归属及数据保护 | 最终scopeStopped=true、pluginClosed=true、unresolved=[]；app已close，隔离库、profile和输出保留，没有登记额外研究项目。原XPI仅核对manifest并解包，未改成员 |

内部KernelApplication、library／broker／SQLite、认证WS、ManagedCommands、OS归属、Electron和BBT Worker均真实；样本内容／来源实例为合成输入，没有内部provider／SQL替身，没有外部模型调用。原包的title case和Extra的pubstate输出是观察值，不能拿文本字面不等作为陈旧门禁。本轮只证明当前双表达行为及一个显式原值对照，不是CSL逆映射／生产同步或真实科研质量验收。

没有新的首次运行失败；CSL更正后导出未跟随是**预期调查反例**，并非被修复的生产缺陷，不能写成“自动同步修复通过”。此前主线已验P1不在本轮重跑。收尾`node --check`、四阶段读回／8份文本及共同依据一致性断言、38个本地Markdown文件链接检查、OpenSpec strict及`git diff --check`通过；新增图人工核对图文，未做渲染器验收。Biome按项目配置排除了OpenSpec工件，首次命令返回no files processed，未将它计作lint通过；语法和实际运行由前述检查证明。当前16/26仅增加三项调查规划成果。

### 契约核对与仍缺的提供者

只读辅助Agent（gpt-6.1-sol/high）梳理表单／共同provider，主Agent抽查关键事实：`library.update`只改CSL等共同题录，`commitRecords`可分别显式提交metadata/original/key且共同CAS、历史和稳定回执已有。分离要求的准确来源是已接收`define-library-zotero-record-authority`的delta，而非假称它已归档进`openspec/specs`。原值upsert是完整对象替换，日期／姓名／跨角色顺序没有唯一逆映射；历史查询不等于已提供历史回退、原值删除或操作者审计。

推荐A首片的已有原值提交不缺新存储provider，当前等待的是D1–D3产品选择、明确人工意图及单一草稿入口归属。D1若强制人工确认，可信确认provider目前不存在；B2的CSL导出映射、C2的来源版本／合并、完整单对象恢复也未交付，不能拿读过设计当已接入。具体schema／事务／冲突／通知／恢复及文件符号依赖已列design，生态不替文献创建映射权威或改生产表。

### CI基线与停点

已读取最新`6b22d60 / Checks40315429083`原始日志和平台清单：Linux内核689/9/16、Windows628/49/30分别为通过／失败／跳过，macOS入口3通过／1失败。Windows失联回归期望outcomeUnknown而实际unavailable需按受理阶段诊断；本轮不把它归因于超时、不更改生命周期或计关闭。其他context-session／文献／生命周期失败及其分工见investigation和主线计划，本轮没有重跑全仓或目标平台。

到本次可决策规划交回处停止：先请主线／用户确认D1–D3，再拆获准实现子范围。现有持续外发授权、正式键、来源副本新实例规则和真实用户库禁用保持。没有新生产代码、UI、依赖安装／下载、开发服务器、提交／push／PR／归档或跨树操作。

本轮规划增量为`/tmp/scholoom-zotero-r6-handoff-tR2Jiq/planning.patch`，基线4b13183；同目录manifest列出16份仅本change的工件、构建／调查／校验日志及仍缺选择。完整反向`git apply --check`通过，不自动应用到其他树。复现脚本和必要读回／导出证据已留在本change，不依赖临时包作为唯一事实源。

## 前轮状态（已接收）：共同库期刊切片

2026-10-27，基线 `1026796d854b8f568c3e819f13268a9638980bc1`，起始工作区干净。用户直接授权本轮最多100条普通期刊隔离接线；未同步／等待文献实际提供者条件已失效。下文第三／四轮及更早待办为历史证据，不是当前阻塞。当前任务13/22，仅R5.1–R5.4本片完成；整个change、3.x完整条件、I6、生产启用和跨平台未关闭。

### 主线验收：持续外发授权P1

独立Standards审查发现生态工具直接返回库结果，没有像共同题录工具一样保存会话已使用的库身份，下一轮模型可能再次发送旧导出而不复查库授权。主线在真实Kernel／broker／受管原包／worker、仅外部模型受控的only-export回归中确认：撤回send后旧实现仍completed，应拒绝模型请求；首次1失败保留在 `/tmp/scholoom-round6-acceptance-dXuzCA/zotero-send-red.log`。

主线只修改harness的生态工具结果回调及唯一装配点，在成功返回前复查执行资格并复用 `rememberCatalog` 保存库身份，不增表或伪造资源。既有异步授权、最终同步准入和重启检查继续负责read/send。重编译harness后，原回归1/1通过，覆盖当前内核下一轮及重启，撤权后模型请求数均未增加；证据为同目录 `zotero-send-build.log`、`zotero-send-green.log`，根tools类型及改动Biome通过。原审查者追加只读复核确认P1闭合；没有把其静态结论写成实跑，也不由此关闭完整I6。全体组合验证和同步派发由公共接入delivery引用本轮证据。

### 实际接线与同源结果

- `packages/protocol/src/zotero.ts` 复用真实library record／receipt／key schema，提供fillKeys/export/result及私有有界读回；`operations.ts`和生成business映射注册，未复制文献字段／正式键权威。schema44期刊字段／作者声明来自已归档固定schema调查，只接受明确原值，不逆猜CSL。
- `apps/kernel/src/zotero.ts` 经真实broker消费read/write/send、record、commitRecords、commitResult；配置只在可信构造时明确绑定隔离libraryId、受管启动和固定原包目录。人工CLI与harness三个薄工具共用该handler和可信上下文。`manual.ts`只增workspace／handler／close，`application.ts`只增配置及构造器末尾生态端口，保留全部根工具和其他领域构造参数；architecture声明同步。
- `apps/zotero-host/src/main/journal-catalog.ts` 实际执行SQLite SQL，Item/saveTx只在外层补键事务暂存候选，原包KeyManager.fill完成后一次共同commitRecords。已有正式键／pinned只读自library；同库全范围大小写冲突由library一次拒绝，不改名。SQL／Item／通知／BBT缓存可丢弃，未增加持久库权威。
- `managed.ts` 使用真实认证WS／HostConnection／ManagedCommands／OS原生归属／Electron／Chromium Worker和未修改9.0.68原包。确认共同回执后通过单个私有读回，由kernel按原选择读取最多100条、累计512KiB；不放宽公共64次回调、停止保证或时限。BBT超过10条必经的ProgressWindow由headless进度记录承接，记录实际headline／百分比并在dispose收尾，不伪装可见Zotero窗口。
- 提交成功而回读／通知失败返回committed回执和独立有界诊断；未知保留原operationId及监督事实，查询共同结果，不重放。已存在回执的fillKeys返回`queried`，不声称新选择已执行，也不伪造历史通知状态。导出在完整关闭后重新核对read/send及原revision/key/pinned，由kernel返回所用共同依据。

对应原design依赖图：T21/T22的普通期刊实际提供者已接入，T31/T32/T41仅完成本片；更广映射、偏好事件、材料和生产保护维持开放。

### 最终实际验证

证据目录：`/tmp/scholoom-zotero-r5-evidence-mwaFJn/`，包含首次100条失败工件、最终kernel/smoke产物、日志、补丁及manifest。固定资产为用户提供的`/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`，manifest实际核对version=9.0.68及id，官方来源沿`resources/versions.json`，每个夹具从原XPI独立解包；未下载或修改原包。仅Linux本机，隔离profile／库／项目／端口，项目与结果目录保留，测试自行关闭所属执行。

最终构建先于测试，测试期间未重建共享产物：protocol／kernel使用已有`node_modules/.bin/tsc -p <tsconfig>`，host使用已有`electron-vite build`。此前共享依赖构建完成，最终14个包及tools全部`tsc --noEmit`通过。没有启动开发服务器。

| 验证 | 实际结果 |
| --- | --- |
| kernel定向：zotero-host、host-connection、zotero-host-supervision、library-records、broker、architecture | **43/43**，1.8m，日志`final-kernel-tests.log` |
| 本片6条真实整合（包含于43） | 100条中99条一次补缺键及一条固定键；两格式文本；共同original标题更正后保持键并刷新；真实CLI停止重启读回；未选中大小写键冲突全部拒绝；旧revision／缺原值／越库拒绝；快照受理后撤write及send；共同提交后观察故障保留unknown／查真实回执／不重放；真实harness工具 |
| 原包smoke | **10/10**，44.8s，`xvfb-run -a env SCHOOLOOM_BBT_XPI=... node_modules/.bin/playwright test --config playwright.config.ts tests/smoke/zotero-host.spec.ts` |
| 类型／生成／架构／OpenSpec | 14包＋tools通过；8份生成映射从最终schema独立重算一致；architecture零findings；OpenSpec strict通过。Biome零错误，6条警告均为未改动的harness非空断言 |

新增整合内部kernel、library、broker、WS、受管命令、SQLite、文件和原包均真实；仅harness外部模型使用合成Anthropic响应。期刊内容及来源是合成输入，不是真实科研质量。未知样本在真实共同提交后让实际workbench事件订阅者抛错，持久回执仍committed；没有替换SQL/provider或制造假回执。既有H1/supervision的显式样本Adapter仍属替身，其通过不冒充本轮真实提供者结果。

### 首次失败、诊断与审查

1. 初次构建遇TS泛型展开／无效错误码，收窄实际消费端口及上下文类型后修复，未缩减共同事务。初次宿主启动未ready并保留unknown；定位CJS产物外置了仅import导出的workspace入口，改为构建时内联既有workspace依赖。未修改原包或用普通spawn回退。
2. 首次实际事务和文本成功后，测试因列表顺序假设及BBT title case转换失败；改为按固定标题选择合成对象、按语义核对文本，保留固定H1引用键oracle。
3. 首次100条返回committed＋刷新失败，回执／99条键已持久化。先尝试顺序回调仍失败，继续定位到每操作累计64回调上限；改为一个私有读回回调，kernel内部有界读取真实provider。首次失败产物见`first-100-results`；最终100条回归保护此边界，未扩大容量或超时。
4. 曾在一次TS检查失败后误跑4条诊断用例；这次4/4不计最终验收。最终类型修复后重新构建，再完成上述43/43及10/10。首次／中间日志均保留，不把它们覆盖为成功。
5. 首次带`--config.optimisticRepeatInstall=false`的pnpm构建仍触发自身锁文件核对及本地workspace链接整理，日志下载0、added0、版本未升级。后续改用已有直接工具入口，未再触发；本轮没有主动执行install命令。新增依赖声明仅指向已有client/protocol workspace包，锁文件没有新增外部版本。
6. 原生只读scout（gpt-6.1-sol/high）核对接口／原子提交／权限／未知边界，主Agent复核并采纳queried区分、共同committed读回闸门和kernel导出依据。其“receipt必须有error/results”判断与当前schema的外层required不符，且稳定回执已严格等值实跑，不改共同契约；其快照来源疑问由交付前相等复核和kernel权威回填处理。scout未跑测试，最终验收由本会话执行；已关闭该只读子Agent，无写入子任务。

### 可审查增量与停止边界

补丁位于本证据目录：`01-contracts.patch` → `02-host.patch` → `03-integration.patch` → `04-docs.patch`，另有完整`round5.patch`。共同依赖是已同步的1026796；不应用历史累计补丁、不复制其他树私有实现。01提供protocol/schema/export及生成映射；02为生态私有宿主／workspace资源声明；03为kernel/harness/architecture和必要回归；04为本change及开发入口文档。完整反向`git apply --check`及diff检查用于核对补丁覆盖当前增量；无提交／push／PR／archive。

剩余：CSL单独编辑到Zotero原值的同步映射、复杂类型／关系、多原值选择、resetKeyOnChange事件、显式来源重绑定UI、E5材料写回、E6删除恢复、新建／删除／附件／组织事务、自动／外部导出及迁入不在本片。缓存更正本轮验证的是共同original字段修订，不能据此宣称全部共同题录映射完成。未知监督仍保护目录，稳定committed结果查询不会自动清除监督未决状态；恢复／清理策略须后续明确范围。

尚需主线决定下一片的字段同步及完整I6验收范围；Windows/macOS、全仓CI、真实科研质量与真实用户库启用无新增通过结论。本轮在补丁及本记录交回处停止，不自动展开下一阶段。

## 第四轮验收E1修复

2026-10-26，主线`/tmp/scholoom-round4-acceptance-JCUBNw/acceptance.md`及`host-callback-repro.mts/.log`确认P2：外层300ms超时后丢失仍活跃callback，2000ms关闭可误报完整closed。本节E1是验收问题编号，不关闭文献E1–E3／E6。当前HEAD仍为`eaf38be1ac2d350120805859175fc82cf9c36927`，0519904已在树内；只针对前轮已有工作区做增量，没有同步、回滚或覆盖既有成果。

### 根因与本轮改动

已搜索全部HostConnection／connectHost装配、callback／inflight／call／stop／close路径：公共main客户端在外层超时／失联后不替内核取消已受理provider；旧call finally直接删entry，而stop只等entry.work，因此RPC结束后丢失完成跟踪及操作名额。

`apps/kernel/src/host-connection.ts`复用原entry.work：给调用者的work仍按原预算返回或拒绝；entry.work改为原请求结束后继续等待已受理callback的drained，finally只关接受闸门，真正drain后才删entry。status增加pendingCallbacks，完整closed另要求inflight为空。请求错误仍向调用方报告，写入unresolved不由drain清除；scopeStopped只确认OS归属，不代替callback完成。

关闭仍按原有界预算核对drained；未结束则unknown、保留内部操作名额／必要未决事实和profile保护。回调之后完成会释放内部操作容量，但不会抹去关闭超时或写效果unknown；依赖均完成且正常shutdown有依据时可正常closed。不新增生命周期Module，不修改platform command／admission、原包、时限、文献provider或生产装配。

测试仅扩展`host-connection.spec.ts`三例和固定host的一个只读fire-and-forget夹具入口：读／写超时仍保留活跃回调；64条只读回调持续占用容量，完成后可继续操作并正常关闭。现有关闭竞态、取消、失联及写回调早返回用例继续运行；超时和失联均走同一finally／drain路径，不扩展重复矩阵。

### 红绿证据与实际验证

证据根目录`/tmp/scholoom-ecosystem-round4-8fMisa/`。Linux，既有Node24.12.0／Electron44.5.1、未修改BBT9.0.68，隔离profile和合成catalog。真实固定host、ManagedCommands、原生归属、认证WS；仅callback provider用gate替身，不证明真实文献事务或用户库行为。

- `red.log`／`test-results/host-callback-round4-red`：旧实现**1失败／2通过**，只读外层超时后callbackFinished=false仍closed，精确复现主线根因。
- 首次容量夹具`capacity-red.log`只受理45/64：peer控制响应优先导致部分callback未先受理。固定夹具让已发送callback先交付后返回外层结果，未延长时限；`capacity-red-confirmed.log`随后确认旧实现会接收第65条无callback操作，违反容量约束。两份失败日志分别保留。
- 修复后kernel定向 **26/26，38.2秒**（host-connection＋zotero-host-supervision）；补充断言写入未知关联仍保留后，三项回归再次 **3/3，13.2秒**。日志`kernel-green.log`、`final-regressions.log`，trace分别在`test-results/host-callback-round4-green`与`host-callback-round4-final-regressions`。
- 原包smoke **10/10，43.3秒**，`smoke.log`／`test-results/host-callback-round4-smoke`。正常／错误shutdown、late-save、flush、Worker原回归保留。

本轮命令先完成`pnpm --config.optimisticRepeatInstall=false --filter @scholoom/kernel --filter @scholoom/zotero-host build`再测试，测试期间未重建产物。包typecheck同样带该pnpm配置；tools tsc、定向Biome、architecture **13模块／205文件／0 findings／0 exceptions**、生成器self-test通过。raw生成的6处原有换行差异经格式化与当前映射一致（`mapping-check.json`），未改生成文件。没有改platform command，因此未重复其专用矩阵。

只读辅助审查因所选gpt-6.1-sol模型容量不足未运行，记录真实错误`Selected model is at capacity`；没有声称取得新独立审查结论。主方逐项核对调用点、首失败及实跑结果；保持指定主配置，不操作其他树，特别未访问或打断research-task-workspace。

### 可审查增量与停止边界

`/tmp/scholoom-ecosystem-round4-8fMisa/callback-drain-fix.patch`只含本轮六个文件：监督实现、测试、固定夹具、design／tasks／本delivery。它以该目录`before/`保存的本轮起点为前态，依赖现有第三轮公共监督及OpenSpec工件；不是全部eaf38be到当前的总差异，不能直接用于缺少前轮源码的裸0519904。`patch-manifest.json`记录依赖与验证，不替换第三轮补丁或历史证据。

本轮R4.1完成，当前9/18；只交回验收E1修复及最小复验，待主线复核，不宣布完整关闭保证无条件接收、I6或整个change完成。E1–E3／E6、真实provider／HostCatalog、生产装配、Windows／macOS与全仓CI继续开放。未安装依赖、启动开发服务器、写真实库、改原BBT或其他树；未提交／推送／PR／归档／reset。

## 第三轮独立监督与原包修复

2026-10-26，用户在同步修复后明确恢复。本树恢复HEAD为`eaf38be1ac2d350120805859175fc82cf9c36927`，只读验证`0519904`／`b838402`均为祖先，恢复时clean。同步证据消费 `/tmp/scholoom-sync-recovery-wyn13R/{recovery.md,synchronized.json}`；主线本树13项内核／9项原包结果只作为同步及既有切片验证，本轮不冒领为新监督结果。直接使用本树正式公共源码，没有再复制临时基线、同步其他树或重做研究。

本轮R3.1–R3.4完成，当前**8/17，整change及I6未完成**。公共监督不依赖programs、BBT或文献；原包接线通过明确样本Adapter独立校准。没有安装依赖、写真实用户库、启动常驻开发服务、提交／推送／PR／归档或改Git历史。保留共享历史／来源、统一v5→v6、资源叶schema、projectId／多窗口及既有图片相关工件，未整文件覆盖公共装配。

### 实际文件与符号

| 切片 | 本轮变化与完成依据 |
| --- | --- |
| 公共私有启动供应 | `apps/kernel/src/commands.ts`的CommandWorkspace／prepare／start增加launchInput；`platform/command.ts`在有界stdin发送前重新授权，不改变普通execute。commandInstanceId贯通准入与启动，凭据不进argv/env或监督文件 |
| 公共生命周期／客户端 | 新`protocol/src/host.ts`与`client/src/host.ts`及子路径导出集中声明／校验私有host消息，复用RpcPeer；不登记为产品业务或引入第二套RPC。新`kernel/src/host-connection.ts`提供独立认证listener、scope ready、操作／回调资格、正常关闭及未知恢复。`architecture.json`仅增加该受控文件的fs/promises权限 |
| 公共恢复占用 | `platform/admission.ts`的retainUnknown按原command身份幂等计入；reserve可绑定owner。即使现容量满，未知scope仍保留，且同内核已有原reservation不重复计数。原生停止／归属后端未改；scope确已停而插件未知时仅保护profile |
| 原包修复 | `environment.ts`明确Gecko profiler inactive，profiling操作不支持；固定9.0.68日志信封中的phase/task结构化进入`host.status().pluginErrors`，shutdown任务错误使unknown且重试不能抹掉。原包及执行成员未修改 |
| 调用方与必要回归 | `host-connection.spec.ts`＋`fixed-host.mjs`验证纯公共Module；`zotero-host-supervision.spec.ts`＋`managed-bbt.cjs`组合真实受管Electron／原包／Worker／双向调用与正常／错误关闭。原smoke补关闭诊断，开发说明更新真实入口和限制 |

公共操作只在独立peer内部注册；产品businessSchemas／harness工具和CLI没有新增成功替身，生成映射不拼接。原调用principal／作用域由内核绑定，回调authorize必须核对本次操作及对象；读操作不可升级写回调。写关联同步保留，原结果到达就关闭handle受理闸门，已经受理的回调继续参与结果／关闭等待。未知效果只保存关联，不成为文献提交权威。

### 本轮实际验证与首失败

Linux，运行器Node24.12.0，Electron44.5.1，既有锁定依赖和原9.0.68资产。全部先构建再测试；测试期间未重建所消费产物。

| 命令／操作 | 结果／证据 |
| --- | --- |
| `pnpm --filter @scholoom/protocol --filter @scholoom/platform --filter @scholoom/client --filter @scholoom/kernel build`；审查修复后再构建platform／kernel | 通过；原生process-scope构建及kernel迁移／architecture资源复制沿原脚本 |
| host build／host typecheck；`tsc --noEmit -p tsconfig.tools.json` | 通过。host验证由辅助实现者独立运行，主方对新增监督及所有tools再次核对 |
| `SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/{host-connection,zotero-host-supervision,zotero-host-scope,managed-commands,command-observation,platform-command-contracts,process-admission,rpc}.spec.ts --output test-results/host-round3-reviewed` | **56/56，1.1分钟**；实际使用shell展开前等价的8个明确文件参数。日志`/tmp/scholoom-ecosystem-round3-Ky7fg8/kernel-reviewed.log`；正常及故障的`supervision.json`在输出目录 |
| 原包smoke（原9项＋关闭吞错） | **10/10，43.2秒**。`/tmp/scholoom-profiler-shutdown-LlzaJ2/{first-failure.log,final-smoke.log,green-results/}`保留红绿证据：修复前注入原包释放失败仍closed，修复后unknown且有结构化关闭错误；正常关闭无shutdown任务错误 |
| 类型／Biome／架构／生成器 | 定向源码与测试Biome无诊断；13模块／205文件，0 findings／0 exceptions；generator self-test通过。raw生成有6处既有换行差异，Biome格式化后与当前映射逐字节一致，未顺带改映射，依据`generated-format-diff.patch` |

首次启动供应回归实际失败：子进程stdin为空；trace在`test-results/host-connection-red`。公共固定host首次10/10，审查扩展后56项最终通过。原包监督首次组合为16通过／2失败（`test-results/host-supervision-round3`）；原因是Electron夹具用固定argv下标误取带运行参数的位置，profile尚未创建。改为从尾部读取可信固定参数后2/2、5.9秒（`bbt-supervision-second`）；最终使用显式XPI并每轮解包到隔离目录，完整56项再次通过。没有放宽生产／测试时限。

正常受管原包结果为`closed, pluginClosed=true, scopeStopped=true`；注入Notifier释放错误后为`unknown, pluginClosed=false, scopeStopped=true`，原生占用已释放而profile仍保护。固定样本通过真实补键和两格式导出，生产仍false。Xvfb／`--no-sandbox`仅在固定测试命令使用，非产品分发／sandbox保证。DBus环境诊断保留，不把非插件shutdown的系统stderr一概当业务失败。

模拟边界：固定host的业务callback及身份是显式测试输入；原包的catalog为H1合成SQLite／有限SQL视图，数字ID／关系不作生产承诺。WS、stdin、受管命令、Electron／Chromium、原包及两个translator、SQLite／文件均真实；没有调用真实library提交、harness、模型、用户库、外部导出或Reader。

独立只读审查发现并处理9项局部风险：重复操作ID的异步登记、读取handle升级写回调、已受理／迟到回调未纳入等待、abort清理泄漏、启动关闭竞态、坏恢复证据被清理覆盖、满容量恢复漏计及同内核重复计数。必要回归验证调用方可见行为；专项复核未发现剩余具体问题。审查者未执行测试，最终实跑由主方完成，整change最终审查仍未关闭。

### 补丁、依赖与剩余前置

本轮交回 `/tmp/scholoom-ecosystem-round3-Ky7fg8/` 下三份补丁和`patch-manifest.json`：`public-supervision.patch`为公共源码／调用方／测试；`bbt-lifecycle.patch`为本线原包修复及实际组合；`planning-docs.patch`为同change与开发说明。没有本地提交。公共切片不依赖programs或本线BBT私有文件；私有增量依赖当前树已有H1成果及公共切片，不是完整H1迁入包。

三份补丁对当前工作区的reverse／check通过，未实际应用或回滚；公共补丁另在以`0519904`生成的临时索引上`git apply --cached --check`通过（`public-base-check.json`），没有复制公共源码、改实际index或工作树。收尾OpenSpec strict／schema、本地链接、tracked及新增文件空白检查通过，apply确认8完成／9未完成。原包五个实际执行成员与固定XPI逐字节一致。

接入顺序为已同步`0519904`公共基础 → 本轮公共监督切片并构建／定向验证 → 既有H1＋本轮原包增量 → 文献E1–E3实际provider后另做共同装配／I6。补丁检查不代表已经合入dev或同步其他消费者。

来源恢复／复制默认新实例、显式确认才重绑；正式键同库大小写不敏感冲突、不改名／覆盖固定键；**有界多对象原子提交及稳定查询已定，不再待选逐条方案**。等待的是文献正式schema／provider、E6删除恢复及生产授权；材料sidecar／新PDF字节仍由对应提供者承接。Windows／macOS、分发、真实用户库、外部接口、迁入、自动导出及完整CI没有新增通过结论。到本轮独立切片交回停止，不自动展开下一阶段。

## 前两轮状态与成果（历史记录）

2026-10-25，按用户“实现该change”及随后允许锁文件安装／Electron准备的授权，完成独立H1阶段；**整个change尚未完成，I6真实共同库接线仍受阻**。任务进度以[tasks](tasks.md)为准；没有提交、推送、PR、归档或同步正式规格。

- `apps/zotero-host/src/main/host.ts` 提供私有ZoteroHost及status/start/fillKeys/export/close。固定BBT原bootstrap、主包、Worker与两种translator实际执行，模块只消费注入Adapter，不创建产品文献权威。
- `environment.ts` 承接固定原包所需对象环境和私有文件范围；`workers.ts`、sandbox preload及隐藏renderer提供真实Chromium Worker／IndexedDB，资源来自受限本地scheme，网络及新窗口拒绝。
- 合成SQLite和有限SQL视图只在 `tests/fixtures/zotero-host/catalog.cjs`；它们不是正式类型目录、引用键／修订／身份提供者。默认产品入口仍为外壳，没有启用共同库、人工CLI／Agent生态操作或真实用户库写入。
- 局部关闭、未知保存与OS完整归属分别表达。已受理写入保留等待；迟到操作结束可重试close；shutdown／flush未知不能被再次空清理抹成closed。Worker失联后的只读导出等待可结束，窗口销毁不依赖renderer响应。
- 固定资源清单及来源／许可在 `apps/zotero-host/resources/`，随现有host目录包规则包含；原XPI未内置。构建增加host模块、preload和Worker页面，`architecture.json`只补受控vm／preload访问。开发说明已更新独立入口和限制。

[design](design.md)的总览和时序图仍表达完整目标；当前只有私有Module／原包／显式Adapter段真实，broker／共同文献／长驻监督连线未实现。H1状态不能替代图中的生产角色与领域提交确认。

### 第二阶段交接结果

按用户最新指令，本轮在同一树／change继续，消费主线正式快照 `/tmp/scholoom-phase2-handoff-VZS5mS`，完成消费者核对、公共需求与监督候选及两项隔离失败校准，然后停止。**本轮未修改业务源码、未接入他域私有实现，任务仍4/13**；没有因文档交接完成勾选共同提供者或整合任务。使用原生只读辅助Agent，保持`gpt-6.1-sol/high`，没有新Agent终端或常驻协调者。

- 主线`acceptance.md`已独立接收H1，复验原包9项与Electron归属1项通过。其结论没有扩大到I6、生产、完整正常shutdown或多平台。
- 已读文献B批design、tasks／delivery及`library.ts`／`catalog.ts`实际快照。开放metadata、单条CAS、内部事务和持久摄取批次存在；来源实例／原值保留、正式键固定状态／冲突、多Item提交／稳定结果查询均未交付。精确路径、符号、消费者需求及反例只维护于[investigation第二阶段交接](investigation.md#第二阶段正式交接与消费者核对)，本记录引用，不另建进度账本。
- 阅读材料及报告两个design和实际位置schema已分别消费。**E5“未收到设计”已解除**；sidecar转换／新PDF字节提交仍无真实提供者。报告独立，不作为BBT或基础综合前置；没有复制或合并对方change。
- 计算`ManagedCommands`／`program`观察快照已消费。`started`不证明Electron或BBTready，`cancel`回执不证明停止；现可复用原生准入、固定程序、日志背压及stopped。计算快照C3需其提供者修复，不在生态改超时或复制programs记录。
- [E4公共候选](design.md#第二阶段e4长驻监督公共候选)已细化到宿主实例／操作身份、一次性stdin供应、独立回环listener、双向RPC、ready、正常shutdown、失联、重启unknown及文件／符号写集。推荐独立host listener，保留共享product listener选项。**未生成公共源码补丁**：跨模块启动供应与监督记录语义待确认；不能把公共候选当已授权实现。

公共依赖顺序：P0由计算拆command观察增量、修C3，经dev验证后用户同步；P1确认宿主私有启动供应／listener／恢复记录并独立校准；P2接真实原包与固定样本、补当前shutdown差距；最后在文献E1–E3实际交付后做P3共同接线／I6。P0/P1明确不依赖programs私有包、项目数据库迁移或本树BBT私有实现；对应文件与验收以design的P0–P3表为准。

## 实际验证

### H1已有实现记录

本机Linux、Node24.12.0、Electron44.5.1，使用现有锁文件。`pnpm install --frozen-lockfile`及`pnpm setup:electron`成功；package.json／pnpm-lock.yaml没有版本变更。安装初次提示内核bin尚未构建，随后 `pnpm build:shared` 成功生成共享包及内核，不以缺bin警告掩盖构建结果。

| 命令／操作 | 结果与实际范围 |
| --- | --- |
| `pnpm --filter @scholoom/zotero-host build` | 成功生成index.cjs、host.cjs、sandbox preload及Worker资源；没有启动开发服务器 |
| `pnpm build:shared` | 所选16个workspace的共享包／内核构建成功；没有重做公共业务实现 |
| host tsconfig与根 `tsconfig.tools.json` 的 `tsc --noEmit` | 通过；核对真实源码与测试类型 |
| `node scripts/check-architecture.ts` | 13模块、199源码文件、0 findings、0 granted exceptions |
| `SCHOOLOOM_BBT_XPI=/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/zotero-host.spec.ts --output test-results/zotero-host` | **9/9，41.2秒**：空库、显式补键／已有键、两种原包导出、正常通知／无通知反例、实际进程重启读回、版本失败、启动取消、迟到保存、卡住renderer、悬空链接、在途导出失联及未知flush。若干风险边界属于同一端到端场景，非9种完整产品能力 |
| `xvfb-run -a node node_modules/@playwright/test/cli.js test --config playwright.config.ts tests/smoke/entrypoints.spec.ts --grep 'compatibility host'` | **1/1，3.9秒**：既有默认隐藏外壳入口回归通过 |
| `node node_modules/@playwright/test/cli.js test --config playwright.kernel.config.ts tests/kernel/zotero-host-scope.spec.ts` | **1/1，3.6秒**：实际Electron Browser／Tab及忙Worker在现runCommand原生归属下启动，取消返回前退出。未改平台契约；仅Linux，未接真实host角色或共同库 |
| `node tests/fixtures/zotero-host/catalog.cjs` | fixture读取、同对象、SQL、回滚、提交后通知及通知失败、skipNotifier和重开自检通过；仅检查替身自身一致性，不是生产事务验收 |
| 固定资源／原包核对 | 日期资源解析内容与既有10.0.5静态来源一致；9.0.68整份XPI及bootstrap、主包、Worker、BibTeX／BibLaTeX成员未改。没有运行外部Zotero或使用其用户profile |
| `pnpm lint`及定向Biome | 全仓通过，保留71条warning和35条info；本轮源码、配置及测试的定向检查通过，无诊断。未顺带修改全仓既有提示 |
| `openspec validate connect-zotero-host-bbt --strict`、本地链接及diff检查 | 规格结构通过；规划工件本地链接0处失效；已跟踪差异和23个新增文件空白检查通过，新增JSON可解析 |

BBT原资产来自versions清单的精确官方发布地址，保存于 `/tmp/scholoom-zotero-bbt-assets/`。每轮样本位于新的 `/tmp/scholoom-bbt-*`，scope夹具位于 `/tmp/scholoom-owned-electron-*`。最终H1结果在 `test-results/zotero-host`，其中主样本保留 `bibtex.bib`、`biblatex.bib`、`updated.bib`及`restarted.bib`；其他结果／失败trace沿 `test-results/smoke` 与 `test-results/kernel`。这些临时工件保留为调查与复验依据；没有批量删除或接管其他进程。XPI不是项目依赖，也没有被安装到真实Zotero。

scope测试通过Xvfb并仅对固定夹具使用 `--no-sandbox`，不能作为产品Chromium sandbox或真实分发证明。H1测试中的内部Adapter是明确替身，Electron／原包／Worker／SQLite／文件和重启真实；没有模型请求。Windows／macOS、自动导出、外部JSON-RPC／pull export、生产大库及签名分发未验收。

### 第二阶段实际校准与检查

本轮没有业务实现变化，故未重跑整套H1／全仓CI。先执行 `pnpm --filter @scholoom/zotero-host build`，成功后才运行样本；测试期间未重建共享产物，没有新安装依赖。

`xvfb-run -a node /tmp/scholoom-eco-phase2-nHIkpI/bbt-multi-item.cjs` 首次运行退出0，两项独立断言通过，首次日志及JSON结果保留同目录，不以重跑替代首轮证据。真实Electron44.5.1（内嵌Node24.21.0／Chromium152.0.7977.130）、运行器Node24.12.0；两份全新profile和合成SQLite，不操作真实库。原包执行成员来自既有固定9.0.68发布资产，实验只在Adapter的第二次Item.save注入异常，不修改原包。

| 校准／已注入失败 | 预期与实际结果 | 不能据此推出 |
| --- | --- | --- |
| 原`fill`选择两条缺键，第二条拒绝 | 第一条提交、第二条无持久键；一条modify，host降为degraded；原包map仍有第二条候选，断言通过 | 不能把所有条目报未保存，也不能用候选继续导出；不是共同库正式键／稳定提交查询测试 |
| 原`fillMissing`开启条件后调用，第二条拒绝 | 外层事务回滚两条、零modify；map仍有两个候选，断言通过 | 内部方法由实验直接调用，未经过host业务封装；不证明产品回滚后的ready或缓存已修复 |
| 两项原包关闭日志 | 均出现`shutdown done failed`／缺失`Services.profiler.IsActive`，而局部close为`localResourcesClosed` | 退出0只表示预定反例断言成立，**不是正常插件shutdown验收通过**。新差距已进入2.3／P2，未在本轮文档范围内修改业务代码 |

原`Orchestrator.run`会吞shutdown任务异常，故此失败没有抛回H1的原shutdown Promise；新spec场景明确监督层不能把局部closed升级为完整正常停止。P2需修实际兼容缺口并保护同类失败边界，不能删错误日志或返回占位成功。本轮没有声称已修复任何业务缺陷。

本轮新增交接文字经独立只读辅助复核，未发现具体事实错误或矛盾；确认P1不依赖programs私有实现、P0–P3没有提前解除E1–E4、E5只解除设计等待，profiler差距仍待修。审查者未运行工具链，结论只针对文档与已读源码事实，不是跨域接线／生命周期验收。

本轮收尾检查：`openspec validate connect-zotero-host-bbt --strict`、`openspec schema validate scholoom-dev`通过；本change的32个本地文件链接均存在；`git diff --check`及23个新增文件的空白检查通过。原XPI中的bootstrap、主包、Worker及两种translator与实验后执行成员逐字节相同。当前apply仍为4完成／9未完成，CLI的ready只表示规划工件可读。

与主线接收的`H/zotero-ecosystem`逐文件比较，23个文件相同，仅本change的investigation、design、tasks、delivery和spec delta这5份工件变化，清单保留在 `/tmp/scholoom-eco-phase2-nHIkpI/changed-from-accepted-snapshot.json`。临时审查增量为 `/tmp/scholoom-eco-phase2-nHIkpI/phase2-planning.patch`，以主线已接收的本线快照为前态；它只含上述5份规划／交接工件，**不是公共源码补丁，也不能用于宣称dev已接入**。

原包反例细节与精确执行成员行号在investigation，不把临时脚本作为生产依赖。临时样本、首次日志和JSON保留为本阶段可复验依据，未批量清理。未重跑typecheck、架构、全部H1和完整CI：本轮源码／配置／依赖与接收快照相同，只增加校准证据及工件；先前结果与主线独立复验分别保留。

## 审查与问题处理

独立只读审查依据实际Module、契约和测试，发现并用可复现反例修复了：悬空symlink写越界、迟到操作后关闭不可重试、renderer卡住使收尾无上限、就绪后Worker故障仍ready、在途只读导出阻止局部销毁、shutdown失败在空重试时误报closed。主方另修复启动被取消后重新变ready的竞态；原失败与最终通过分别保留，不将静态意见当作实际测试结果。

最后两项修复经同一审查者静态复核，未发现剩余具体P1/P2；其未运行测试，运行结果由主方提供。收尾类型检查发现新增失联测试缺少窗口空值守卫，补齐后根工具类型检查与最终9项实际回归通过。

初次原包装载因blob Worker URL／资源CSP适配停在startup，改为本地受限scheme的固定Worker桥并开放明确包资源来源；未改原成员或延长生产等待时限。测试一度在29MB Buffer的通用deep-equal中耗费约40秒，trace证实业务已完成；改用Buffer字节比较后同一路径数秒完成。测试总预算包含既有30秒操作上限及收尾，不修改生产时限。

显式补键回归发现BBT偏好迁移会重新启用自动补键。沿原包配置为全新自有profile标记autoPinMigrated，并保留fillKeyAfter=0；测试确认启动缺键为空、显式调用才写入。没有裁剪原包启动图，也不把此行为当作迁入已有用户设置的规则。

## 未完成事项与下一步

1. E1–E3政策已定，所需真实来源／原字段／正式键／有界多对象原子提交及稳定查询提供者仍缺，不再等待相反A/B编号的范围选择；不以H1 SQLite或公共开放CSL代替。
2. E4独立认证监督及原包shutdown修复已在本树Linux校准，公共／私有补丁交回；共同产品装配、其他平台与实际dev接入仍开放。完整停止继续分别核对插件与原生scope，不以局部closed代替。
3. E5两份设计交接已闭合，材料新字节／sidecar共同记录转换未闭合；BBT样本不等报告，不实施Reader或茉莉花。E6题录／附件删除恢复仍缺，status明确生产不可用；不执行迁入／自动导出／外部接口／真实用户库路径。
4. 完整I6、整体审查及最终delivery任务保持未完成，不归档或声称整个change已交付。本轮未重跑全仓CI，主线已关闭问题及同步定向结果与本轮结果分别记录，不把未诊断失败归因于超时或称全仓绿色。

继续沿当前 `tasks.md`／`delivery.md`，不需要用户重述已给出的实施及锁文件安装授权；需要的是实际跨线接口结果和必要架构输入，不是再次批准同样动作。
