# CSL／原值差异的隔离证据

基线：`4b13183f7489d3cae12fd0a7d1a9e83fb33d7384`。本轮只做调查和规划；这些文件不是生产映射、通用转换器或新产品政策。

使用已接收普通期刊配方，在`/tmp/scholoom-csl-original-AUctoW`新建隔离configuration／library/profile；未打开真实或旧样本库、未创建额外研究项目。库、来源实例及题录身份均由实际共同provider分配，内容是合成样本。KernelApplication／broker／SQLite／WS／受管Electron／原BBT Worker均真实，没有内部替身或外部模型调用。原BBT9.0.68 XPI来自用户已提供的`/tmp/scholoom-zotero-bbt-assets/zotero-better-bibtex-9.0.68.xpi`，官方来源及Zotero10.0.5资源版本沿`apps/zotero-host/resources/versions.json`；仅核对manifest并独立解包，不改成员、不安装或下载。

复现脚本：[csl-original-probe.mjs](../csl-original-probe.mjs)。在本树先用已有直接工具入口构建kernel及host，完成后运行：

```sh
node openspec/changes/connect-zotero-host-bbt/evidence/csl-original-probe.mjs
```

脚本每次创建新隔离目录，保留全部库／profile／输出，结束只关闭自己持有的app；不会打开用户指定的库目录。若指定参数，它是新目录的父目录。固定`/usr/bin/xvfb-run`及`--no-sandbox`沿既有Linux测试夹具，不构成产品sandbox或其他平台验收。复现需要当前已构建产物及已有本地XPI，不自行准备依赖。

- [`observations.json`](observations.json) 保存实际输入、共同receipt、四阶段CSL／record／键／原值历史、导出依据及比较结果，包含本机隔离目录定位。
- `baseline.*.bib`、`title-only.*.bib`、`date-authors-only.*.bib`、`explicit-original-title.*.bib` 为每阶段原包直接返回的BibTeX／BibLaTeX，未人工修改。
- 第一阶段A/B revision为2/2；只改CSL题名后3/2；再改日期／作者后3/3。原值及固定键不变，两格式文本均与baseline相同。最后明确改A原值题名为4/3，两格式才采用新题名；B的歧义值继续按原值导出。
- B原creators全序为Chen作者→Li译者→Wang作者→Kim编辑；CSL只保留角色内顺序，没有跨角色位置。CSL更正加入机构名、姓名粒子／suffix和2025–2026日期范围／circa，不能据此构造唯一原始字符串／顺序。
- Extra逐字保留。BibLaTeX可见`pubstate = {raw-only}`，该值只在输入原Extra的Status行出现；不能把只覆盖几个CSL字段称完整CSL导出。BBT正常的title case也不等同陈旧。

首次构建与运行均通过。构建日志：`/tmp/scholoom-zotero-r6-kernel-build.log`、`/tmp/scholoom-zotero-r6-host-build.log`；运行日志：`/tmp/scholoom-zotero-r6-probe-first.log`。原始完整阶段读回、8份导出及监督记录保留在上述隔离目录；最终`scopeStopped: true`、`pluginClosed: true`、`unresolved: []`。公开工件没有凭据／启动token。

本轮没有重跑整套H1／100条整合／持续授权P1或全仓CI。Windows／macOS没有新增目标实跑；本机成功不能关闭Checks40315429083中的Windows失联分类或其他平台失败，也不证明CSL自动同步／完整I6／生产用户库启用。
