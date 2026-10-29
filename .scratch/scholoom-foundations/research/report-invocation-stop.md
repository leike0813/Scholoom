# systemd InvocationID 定向停止的候选依据

2026-10-30。供[报告design第23轮](../../../openspec/changes/add-interactive-research-reports/design.md#第23轮原版本恢复资格module)的M管理门校准使用，不是已部署或通过T1的停止实现。

官方systemd v259.5固定commit为`b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a`。`GetUnitByInvocationID(ay) → o`返回按该ID寻址的专用Unit对象路径；源注释明确路径只在InvocationID不变时有效。调用方提交已持久的非零16字节原ID，使用返回的opaque路径调用Unit.Stop／Kill；不能换成名称路径。[Manager源码](https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/dbus-manager.c#L600-L643)

该路径的方法分发再次从invocation映射取对象，原ID已失效时失败，不退回同名unit；授权异步等待后也重走消息解析。因此它能保护query至最终受理之间的同名换代。普通StopUnit(name,mode)、名称对象路径和Ref均不具有这种语义；Ref只防对象回收，不冻结运行周期。[路径解析](https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/manager.c#L3334-L3379)、[授权后重新处理消息](https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/shared/bus-polkit.c)

这条接口没有原cgroup的dev／ino或目录FD条件。Stop返回异步job，不能据此宣称原范围已经为空；job后续执行、完整后代与无迁移保证、原范围对象及stopped落盘仍须分别核查。Kill经manager执行也不等于调用方原目录FD上的cgroup.kill事务。[Unit方法](https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/dbus-unit.c)、[job执行](https://github.com/systemd/systemd/blob/b3d8fc43e9cb531d958c17ef2cd93b374bc14e8a/src/core/job.c)

原native settle通过已核目录FD的openat(cgroup.kill)写入并读events；M的只读cgroup视图不能直接照用。但manager在自己的执行环境处理invocation请求，故保留M只读视图仍有值得真实校准的路线，无需先假定放开M全部cgroup写权。[内核cgroup语义](https://github.com/torvalds/linux/blob/v6.12/Documentation/admin-guide/cgroup-v2.rst#L1020-L1033)

主线已在本机普通UID实际执行只读XML接口核查：

```sh
busctl --system --xml-interface introspect org.freedesktop.systemd1 /org/freedesktop/systemd1 org.freedesktop.systemd1.Manager
```

退出0，XML公布GetUnitByInvocationID。未调用Stop／Kill／Ref或启动、修改任何unit。接口公布不是动作权限、竞态或完整停止的运行证明。本机为systemd259.5-0ubuntu3.4；官方v259.5源码与发行版补丁的行为对应仍待实际校准。

完整定版源码／man／请求回执、静态正反例和本机XML在`/home/joshua/.cache/scholoom-round22-acceptance-noQKV1/stop-identity-research/`；独立研究为RESULT.md，本机只读结果为installed-inspection.json。未执行系统权限、账户、安装、策略、服务或T1/T2，未修改生产代码；停止与容量权威仍沿原records及唯一ProcessAdmission。
