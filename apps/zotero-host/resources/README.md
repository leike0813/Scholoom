# 固定兼容资源

BBT 9.0.68 使用 [versions.json](versions.json) 指向的原发布包，bootstrap、主包、Worker及translator均不修改。原包没有随仓提交；独立验收通过 `SCHOOLOOM_BBT_XPI` 指定本机资产，不读取用户Zotero安装或profile，不在启动时下载或更新。

`dateFormats.json` 从本仓2026-10-04原型的固定资源复用内容，按仓库格式保存；原来源是官方Zotero 10.0.5归档 `app/omni.ja` 的 `resource/schema/dateFormats.json`。Zotero及其复用实现按AGPL-3.0许可，版权归Corporation for Digital Scholarship、George Mason University及上游贡献者；完整来源见 [Zotero](https://github.com/zotero/zotero/tree/ca61760225d25191d0c65acbfd0c4f12a172d263)。BBT版权及许可仍保留在原包中，见[指定发布](https://github.com/retorquere/zotero-better-bibtex/releases/tag/v9.0.68)。

本目录版本清单不表示全类型、插件UI、自动导出、外部JSON-RPC／pull export或生产共同写入已兼容。原类型及字段的完整前置调查保存在本change的investigation；测试中有限SQL类型编号只属于合成Adapter。
