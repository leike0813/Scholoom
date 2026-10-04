# 第五轮精简证据

详细结论见[阅读交互报告](../../../../research/zotero-host-reader-results.md)，运行方式见[原型 README](../../README.md)。

- `reader/`：最终运行 `/tmp/scholoom-host-prototype-ASCiyY` 的原始 JSON、真实附件 PDF、原插件 sidecar、两张页面截图和带原行号的退出日志节选。
- `boundary-regression/`：共享接口回归 `/tmp/scholoom-host-prototype-1md8NZ` 的真实两端读写／导出及停机核对。
- `artifact-observations.json`：原归档与安装工件、PDF.js 提取模块、接口传输的 PDF 字节核对。
- `jasminum-source-observations.json`：原 XPI 中私有保存函数与 Reader 编辑函数的位置及事实。
- `browser-launch-failure.json`：首次浏览器缓存不匹配的失败；指定已有 Chromium 后通过，没有安装依赖。
- `validation-observations.json`：语法、JSON、文档链接、保存前后字段及临时 token 检查结果。

5 项浏览器、3 项主链路检查通过；主链路第一项汇总上述浏览器检查，不能相加为独立功能覆盖数量。截图分别展示 Methods 的真实第二页，以及刷新后保存的书签名称。书签保存经原 Reader 编辑事件完成，companion 没有直接写 sidecar。

此处没有保存 IPC 发现文件或短期 token、宿主与 XPI 二进制、第三方 PDF.js 构建产物或完整库。临时运行目录保留完整日志和安装树；目录只在本机存在，不作为永久交付路径。完整参考宿主仍有退出错误，功能与落盘检查通过不等同生命周期兼容。
