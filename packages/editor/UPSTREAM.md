# Quarto 源码来源

可视编辑采用 `quarto-dev/quarto` 的固定提交 `a83c5cc597e61a28700ceacda86c15b9ef565e82`。
`vendor/quarto/` 保留 editor、editor-types、editor-core、core、core-browser 的源码及原始文件声明；这些包在该基线均声明 MIT。许可文本来自同一基线的 `apps/vscode/LICENSE`。

`resources/` 中的 Pandoc writer、heading IDs 和 abbreviations 来自同一基线的 editor-server；转换调用由 Scholoom 的受控平台适配接管，未引入其 SQLite、Zotero 服务或独立文献权威。

原仓库：https://github.com/quarto-dev/quarto/tree/a83c5cc597e61a28700ceacda86c15b9ef565e82

构建只打包所需浏览器模块。React 使用本项目共同实例，宿主对话框、资源、转换及保存由 Scholoom 提供。升级须重新验证学术格式往返、未知语法保护及配套 Pandoc 资源。

本地适配包括可移植返回类型、公开图片资产出口、宿主只读状态刷新，以及让图片节点的全部地址经过宿主资源映射并呈现替代文字；普通编辑不会直接加载远端图片。
