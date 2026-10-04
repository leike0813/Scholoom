# Node 与 Quarto 运行时分发事实

核对日期：2026-10-04。关联 [#12 技术栈](../issues/12-technology-stack.md)。仅查阅官方文档和已有固定源码，不安装、运行或打包。本文记录工具能力和约束；具体版本、分发选择及应用接线未验证。

## 独立 Node 内核

- Node 官方提供按平台选择的预构建二进制和发布周期。应用可以携带固定版本的独立 Node；选择适当的受支持 LTS、最低系统要求和目标架构，须在实现时与实际依赖核对。[下载](https://nodejs.org/en/download)、[发布周期](https://nodejs.org/en/about/previous-releases)
- Electron 的 `ELECTRON_RUN_AS_NODE` 受 `runAsNode` fuse 控制，关闭后相关 `child_process.fork` 行为也受影响。复用 Electron 二进制执行 Node 是可选机制，不能默认其打包配置一定启用。[Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses)
- Electron 原生模块可能需要针对 Electron ABI 重建；独立 Node 与 Electron 中加载的原生产物不能自动视为通用。已选 better-sqlite3 位于 Node 内核，应按该 Node 运行时和各平台构建并验收。[原生模块](https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules)
- electron-builder 的文件配置提供应用资源与 ASAR 外部文件的打包入口，可用于放置独立二进制、内核文件和其依赖。本文核对的是 v26 文档，实际配置字段随所选工具版本确认。独立 Node 不默认理解 Electron 的 ASAR 虚拟文件系统。[Application Contents](https://www.electron.build/v26/docs/contents/)

推论：携带独立 Node 能给 #09 的 GUI／CLI 共用内核提供明确运行入口，并允许独立升级；代价是额外二进制体积及平台构建维护。该推论不证明具体启动、取消、升级或三平台产物已经可用。

## Quarto 与学术渲染

- Quarto 官方安装包捆绑匹配的依赖，包含 Pandoc、Typst、Deno、Mermaid、esbuild 与 Dart Sass；官方建议第三方打包保留这组依赖以避免版本错配。故引用 Quarto 的组件能力，并不意味着应自行重写 QMD 渲染，也不意味着可以任意替换其 Pandoc。[Quarto FAQ](https://quarto.org/docs/faq/)
- `quarto run` 的 TypeScript 使用随 Quarto 提供的 Deno；Python 和 R 使用外部解释器。这个 Deno 服务于 Quarto 自身工程脚本，不能直接推断应替代 Scholoom 的 Node 内核。[项目脚本](https://quarto.org/docs/projects/scripts.html)
- `QUARTO_PYTHON`、`QUARTO_R` 等变量允许指定执行环境。已选 Quarto editor-server 的固定源码通过配置 `pandocPath` 调用 Pandoc；接入时仍须配对编辑转换的参数、Lua 资源及 AST 版本。[环境变量](https://quarto.org/docs/advanced/environment-vars.html)、[固定 Pandoc 执行适配](https://github.com/quarto-dev/quarto/blob/a83c5cc597e61a28700ceacda86c15b9ef565e82/packages/editor-server/src/core/pandoc.ts)
- Quarto 的 LaTeX PDF 路线需要 TeX 分发，官方推荐 TinyTeX；可使用已有 TeX 与编译工具链。TinyTeX 初始包并不包含所有论文宏包、期刊类和字体，官方尺寸说明不能作为本项目实际包体测量。[PDF 前提](https://quarto.org/docs/output-formats/pdf-basics.html#prerequisites)、[PDF 引擎](https://quarto.org/docs/output-formats/pdf-engine.html)
- QMD 支持纯写作与普通展示代码块；科研代码执行和工程渲染沿 #11／#09 的共同执行授权与记录处理。携带 Quarto 不替代已有的执行边界。[学术格式调查](scholarly-format-and-interoperability.md)

## 待实现验收

固定 Node／Quarto 版本及来源声明；独立内核在未装开发工具的机器上启动；原生模块实际加载；Quarto editor 的转换配对；中文字体和代表性期刊模板；已有多文件 LaTeX 工程；断网条件下已有依赖的渲染；平台签名、路径和执行权限。附加模板、宏包、字体、远程资源及研究代码环境须按实际工程准备，不能由“内置渲染器”推断所有稿件均能离线编译。
