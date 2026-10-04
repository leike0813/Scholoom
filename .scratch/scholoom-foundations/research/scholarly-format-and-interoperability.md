# 学术阅读与写作格式的互操作事实

调查日期：2026-10-03。为 wayfinder 的[阅读与写作格式议题](../issues/11-reading-writing-format.md)核验官方文档和上游实现。依据限于所列资料；未安装组件、未运行转换，也不据此选择主格式、编辑器组件或版本。

## 核验结果

1. **QMD 可以用于不执行代码的学术写作。** Quarto 将写作功能与计算功能并列；可执行代码需要以引擎支持的代码单元形式出现，普通代码块可以只展示、不执行。文档也提供方程、引用、脚注、图表标题及交叉引用能力。因此，QMD 不等于每次写作都运行 R/Python/Jupyter；纯文本论述、TeX 数学和文献写作不需要因为扩展名而执行代码。[Quarto 技术写作与代码单元](https://quarto.org/docs/visual-editor/technical.html)、[Quarto 代码单元](https://quarto.org/docs/reference/cells/cells-knitr.html)、[Quarto 交叉引用](https://quarto.org/docs/authoring/cross-references.html)

2. **引用有两条不同路线。** Pandoc 的 citeproc 路线使用 `[@key]`、BibTeX/BibLaTeX/CSL 数据和 CSL 样式，负责生成排版后的引用与书目；LaTeX 输出也可选择 natbib 或 biblatex，让生成的 `.tex` 交由 BibTeX/Biber 流程处理。这些是不同的输出策略，不应描述成单一“引用支持”。Quarto 可在文档元数据中声明 bibliography，并在视觉编辑器中插入 Pandoc 引用语法。[Pandoc 引用手册](https://pandoc.org/MANUAL.html#citations)、[Quarto 技术写作](https://quarto.org/docs/visual-editor/technical.html)

3. **DOCX 修订/评论的已核实能力是读入。** Pandoc `--track-changes=accept`（默认）接受插入、删除并忽略评论；`reject` 丢弃插入、恢复被删除文本，同样忽略评论；`all` 把插入、删除和评论读成带 `insertion`、`deletion`、`comment-start`、`comment-end` 类的 AST spans，并附带作者、时间等信息。手册明确该选项只影响 DOCX reader。上游 reader 源码也显示评论正文和标记变成 spans；这是从 DOCX 提取注释/修订供后续处理，不是生成 Word 原生修订、评论线程或无损 round-trip 的承诺。[Pandoc track-changes 选项](https://pandoc.org/MANUAL.html#reader-options)、[DOCX reader 实现](https://github.com/jgm/pandoc/blob/8f949dbb0939d9a9a40d8198a752cd212a679445/src/Text/Pandoc/Readers/Docx.hs#L2722-L2785)

4. **DOCX 引用字段支持有边界。** Pandoc DOCX reader 源码明确处理 EndNote citation 和 CSL citation 字段，并把可解析的引用转为 Pandoc citation 数据；遇到无法解析的 EndNote 数据会告警并退回显示文本。Zotero/EndNote 书目字段在特定解析路径可被识别或省略，以便之后重新生成；这不等于保留 Word 中所有供应商字段、书目管理器状态或可编辑引用控件。普通可见引用文字也不自动恢复为结构化引用。[Pandoc DOCX reader 的引用字段处理](https://github.com/jgm/pandoc/blob/8f949dbb0939d9a9a40d8198a752cd212a679445/src/Text/Pandoc/Readers/Docx.hs#L2913-L2985)、[Pandoc DOCX reader 的引用数据映射](https://github.com/jgm/pandoc/blob/8f949dbb0939d9a9a40d8198a752cd212a679445/src/Text/Pandoc/Readers/Docx.hs#L2998-L3054)

5. **可视编辑覆盖常见 Markdown 学术语法，但保存会规范化源码。** Quarto visual editor 支持标题、格式、链接、图像、列表、表格、Pandoc 属性、方程、引用及常见交叉引用；可识别行内原始 LaTeX/HTML，也可插入 raw block。Markdown 保存由 Pandoc 生成，可能改写列表缩进、引号转义、表格标题位置、脚注布局等。已列出的不支持或降级项包括行内脚注转普通脚注、具名脚注改数字、示例列表和自动列表改普通编号列表、引用式链接改普通链接、MultiMarkdown 属性转 Pandoc 属性；非 YAML 标题块和非顶层 YAML 元数据块无法在 visual mode 正常载入。Raw LaTeX 在非 LaTeX 输出会被忽略，因而含大量原始宏的内容不能假定在所有目标格式中保留。[Quarto visual editor Markdown 写回及限制](https://quarto.org/docs/visual-editor/markdown)、[Quarto raw LaTeX 与 HTML](https://quarto.org/docs/visual-editor/technical.html)、[Quarto PDF 中 raw LaTeX 的输出边界](https://quarto.org/docs/output-formats/pdf-basics#raw-latex)

6. **原生 LaTeX 项目可直接围绕源码树编辑和编译；通用 AST 转换是另一种工作方式。** 多文件 `.tex`、主文件、`\input`/`\include`、类文件、包、图表资源与 bibliography 可由 LaTeX 编译链共同处理。Pandoc 则把输入格式解析成通用文档结构再写出目标格式；即便支持 LaTeX 输入，也不代表完整保留依赖宏包、模板、复杂宏展开和跨文件工程语义。对于深度定制的原生项目，应把直接编辑主 `.tex` 并运行其编译链视为保真路径；AST 转换视为有边界的内容迁移或导出，先用代表性文档验证。[Overleaf 主文档与多文件项目说明](https://docs.overleaf.com/getting-started/recompiling-your-project/the-main-document)、[Overleaf 多文件 LaTeX 项目](https://www.overleaf.com/learn/latex/Multi-file_LaTeX_projects)、[Pandoc LaTeX/PDF 输出及模板说明](https://pandoc.org/MANUAL.html#creating-a-pdf)、[Quarto 期刊模板与 Pandoc 模板关系](https://quarto.org/docs/journals/templates.html)

## 对议题讨论的事实边界

- LaTeX、QMD 与 Markdown 都能承载文本、公式或引文的部分工作；其编辑器、源码结构、编译链和跨格式语义并不相同。上述资料只能界定能力与损失风险，不能替用户判断主格式。
- “可以导入 Word 评论/修订”应明确限定为解析后进入 AST 的表示；“可以生成 Word 修订并重新往返”是不同能力，Pandoc 的该选项没有提供后者的依据。
- 在普通 QMD 之外直接编辑已有多文件 LaTeX 工程，和把 LaTeX 当成 Pandoc 输入格式转换，是两种不同的编辑/编译模型。raw 宏和项目模板越多，越不应承诺 AST 往返等价。
- 上述是文档与源码核验，未对特定稿件运行导入、导出或视觉编辑保存；实际内容兼容性仍需以用户代表性文件验证。
