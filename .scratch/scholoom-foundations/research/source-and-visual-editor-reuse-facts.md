# 源码/可视共稿：可复用模块的事实核对

范围：只核对官方 primary sources（npm registry 元数据、GitHub API、raw 源码）。不含架构选型意见。
取源码处已记录 commit；未取源码处只记录文档/元数据。**未安装依赖、未构建、未运行。**
调查时间 2026-10-04。

后续完整固定源码查读见 [Quarto 宿主与复用边界](quarto-visual-editor-host-boundaries.md)：已找到现成 Schema、学术扩展、可注入 host 接口和许可文本。本文件保留初步核对范围；有关 Quarto 的未决问题以补充报告为准。

## 1. CodeMirror 6

- **形态**：一族独立 npm 包（`@codemirror/view`、`@codemirror/state`、`@codemirror/language`、
  `@codemirror/lang-*`、`@lezer/*`），没有单一“CM6 大包”。逐包引入即可。
- **许可证**：`codemirror/lang-markdown` GitHub API `spdx_id = MIT`；npm `latest` 元数据
  `"license":"MIT"`（`@codemirror/lang-markdown@6.5.2`，gitHead `f90daf6e`）。仓库
  `codemirror/dev` 的 `spdx_id` 为 `NOASSERTION`（逐包 LICENSE 为准）。
- **Markdown 支持**：`@codemirror/lang-markdown@6.5.2` 依赖 `@lezer/markdown@^1`、`@lezer/common`、
  `@codemirror/lang-html`、`@codemirror/language|state|view|autocomplete`。
  来源：<https://raw.githubusercontent.com/codemirror/lang-markdown/main/package.json>
  （HEAD `8f73fd5013a1aaa3d3319f9165fff3100d159124`）。
- **LaTeX**：**未在官方 `@codemirror/lang-*` 中找到 LaTeX 语言包**。本轮 GitHub `contents` 列表接口
  被限流返回空，故此条为“未验证到官方包”，不是“不存在”的断言。社区 TeX 包不在官方命名空间内。
- **React、worker 与离线接入**：本轮未核对官方接入文档、解析调度与所有资产依赖；不据包结构断言没有 worker 或网络需求。

## 2. Monaco

- **许可证**：`microsoft/monaco-editor` GitHub API `spdx_id = MIT`。
- **体积事实**：`monaco-editor@0.57.0` npm 元数据 `unpackedSize = 101,674,083` 字节
  （约 97 MB 解包体积，`fileCount = 1918`）。这是完整发布包的解包体积，不能与一个 CodeMirror 语言子包比较，也不等于选择模块后的应用打包体积或运行内存。
  来源：<https://registry.npmjs.org/monaco-editor/latest>。
- **可消费形态**：存在官方 npm 包。本轮未逐文件核对模块出口、worker 清单和 Electron 加载方式。
- **Markdown / LaTeX 语言**：本轮尝试 `monaco-editor/esm/vs/basic-languages/{markdown,latex}/*.js`
  均返回 404；请求路径混合了发布包与仓库路径，不能由此判断上游目录发生变化。**本轮未能取证内置语言清单**。
  不据此下“支持/不支持”结论。

## 3. Quarto 可视编辑器：真实存在的模块在哪

- **不在 quarto-cli**。`quarto-dev/quarto-cli` 当前默认分支为 Deno 改写版，目录为
  `src/{command,config,core,execute,format,preview,render,webui,...}`；对 `src/quarto/visual/editor/src/index.ts`
  取源码返回 404，import_map 中未出现 `prosemirror` / `codemirror` 依赖。
  （HEAD `04e334159fc4651f8524814352fc194ce7d54217`）
- **在 `quarto-dev/quarto` monorepo**（README 指明其包含 Quarto VS Code Extension）：
  - `packages/editor` —— ProseMirror 可视编辑器。`package.json`：`"private": true`、`"main": "./src/index.ts"`、
    依赖 `prosemirror-model|state|view|transform|schema-list|inputrules|history|tables|changeset`、
    `react@^18.3.1`、`diff-match-patch`、`semver` 等。
    <https://raw.githubusercontent.com/quarto-dev/quarto/main/packages/editor/package.json>
  - `packages/editor/src/pandoc/pandoc_to_prosemirror.ts` 与 `pandoc_from_prosemirror.ts` ——
    Pandoc AST ↔ ProseMirror 文档的双向转换；文件头 `Copyright (C) 2022-2026 by Posit Software, PBC`，
    内部通过 `../api/pandoc` 的 `PandocTokenReader` / `PandocAst` / `PandocExtensions` / `ProsemirrorWriter`。
    即：该模块已有 **Pandoc AST** 转换实现；本轮未核对完整 schema 与宿主接口，不能推断 Scholoom 必须从头实现 schema 或转换层。
  - `packages/editor-codemirror` —— Quarto 源码侧 CodeMirror 6 封装；依赖
    `@codemirror/lang-markdown@^6.5.2`、`@codemirror/lang-lezer`、`lang-xml`、`lang-html`、`lang-json`、
    `@codemirror/language`、`lint`、`search` 等。同样 `"private": true`。
  - `packages/` 下另有 `core`、`core-node`、`core-browser`、`editor-core`、`editor-server`、`editor-types`、
    `editor-ui`、`ojs`、`quarto-core` 等。
  （HEAD `a83c5cc597e61a28700ceacda86c15b9ef565e82`）
- **宿主边界**：`apps/vscode/package.json`（`"name": "quarto"`, `"version": "1.139.0"`）中
  `contributes.customEditors` 声明 `"viewType": "quarto.visualEditor"`，且
  `enablement: "editorTextFocus && !editorReadonly && editorLangId == quarto"`。
  已核对的 VS Code 应用通过 custom editor 使用该模块；其应用依赖 VS Code 文档模型。不能将此应用宿主依赖直接推广为底层 editor 必须依赖 VS Code，需继续追踪模块的公开 host 接口。
- **许可证声明仍需追溯**：`quarto-dev/quarto` 仓库 GitHub API `spdx_id = AGPL-3.0`，
  但根目录 **无 LICENSE 文件**（contents 列举仅 `.github/.vscode/.zed/apps/claude.md/package.json/...`），
  而 `packages/editor/package.json` 与 `packages/editor-codemirror/package.json` 内声明 `"license": "MIT"`。
  仓库根 fetch `LICENSE`、`LICENSE.md` 均 404。API 识别值不能代替版权文件；这不证明同一模块有冲突许可。主 Agent 再次读取固定 commit 的两个 package.json，确认其声明 MIT。纳入时仍应查找具体版权与许可文本及其适用范围。

## 4. 底层框架现状（区分“已有库”与“需自补”）

- Milkdown：`@milkdown/core@7.22.2` npm 元数据 `license: MIT`。本轮未查读解析器源码。
  **本轮未核对它对 Pandoc AST / 学术语法（公式、引文、
  交叉引用、capsule）的支持度**，不能视为 Quarto 可视层能力等价物。
- `@pandoc-tools/parser` 在 npm registry 返回 `Not Found`；Pandoc 官方 JS/WASM 运行时包名本轮未取证。
- 本轮找到的学术可视编辑实现为 Quarto 的 ProseMirror／Pandoc 模块。它是内部源码包，不能据此断言整个开源生态不存在可安装模块，也不能据 private 声明推断已有实现必须重写。

## 5. 未验证范围（明确声明）

1. GitHub `contents` API 在本轮多次被未认证限流返回空数组：CodeMirror `lang-*` 包清单、
   Monaco `basic-languages` 清单均未取得。
2. Monaco 内置 Markdown/LaTeX 语言支持未取证；worker 清单与 Electron 加载方式未取证。
3. CodeMirror 6 的 React 接入与解析调度未从官方文档逐条取证。
4. `quarto-dev/quarto` 未克隆、未构建、未运行任何测试；只读了 raw 文件与 package.json。
5. 未验证 Quarto 可视编辑器源码在非 VS Code 宿主下可运行性；未验证其对 `ef{}`/crossref/
   citations/`$math$`/capsule 的实际序列化保真度。**本报告不对“格式无损”“无需适配”作任何承诺。**

## 给主 Agent 的未决事实（按阻塞性排序）

1. **Quarto 许可适用范围**：已有固定 package 的 MIT 声明，仍需找到适用版权与许可文本。可继续评估技术边界，纳入分发前核对来源声明。
2. **Quarto 可视层是应用源码而非可安装库**：`packages/editor` 与 `editor-codemirror` 均 `private: true`、
   入口指向源码，已核对应用宿主为 VS Code custom editor。实际抽取边界、已有 schema 和 Pandoc 映射可保留的范围尚待查读。
3. **学术能力验收**：已有实现的公式、引文、交叉引用和不支持语法处理需查读与验收；本轮证据不足以判定要新建多少能力。
4. **Monaco 与 CodeMirror 6 的“语言/体积/worker”对比在本轮证据不足**：Monaco 解包体积约 97 MB
   已确证；内置 Markdown/LaTeX 支持与 worker 成本待补证。
5. **CodeMirror 6 无官方 LaTeX 语言包**为“未验证到”，需一次 `lang-*` 清单确认后才能定性。
