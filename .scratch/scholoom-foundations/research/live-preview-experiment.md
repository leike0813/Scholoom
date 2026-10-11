# QMD／LaTeX 实时预览：本机实测

2026-10-09。关联 [#39](../issues/39-writing-live-preview.md)。用户要求先验证真实预览能力，UI 布局后置；本文记录实验，不替用户确认产品方案或性能门槛。

现有工具已经能做到小稿件停顿后约一秒更新。常驻 Quarto HTML 预览明显快于反复启动 CLI，原生 LaTeX 常驻编译也受益于较短轮询。长稿件的 Quarto 全文预览仍需数秒。没有据此证明逐字编辑时能在几十毫秒内重排整篇论文。

## 环境与样本

- Linux 6.8.0-142-generic x86_64；Xeon E5-2697A v4，64 个逻辑 CPU，约 126 GiB 内存。本机配置不能代表普通笔记本。
- Node 24.12.0；Quarto 1.9.37，自带 Pandoc 3.8.3；latexmk 4.87；MiKTeX 26.5／pdfTeX 1.40.29。PATH 中另有 Pandoc 2.12，本轮 Quarto 测量没有使用它。
- 小稿件：6 节、30 段重复合成正文，约 1,657 个空白分隔词、12 KB；QMD PDF 6 页，原生 LaTeX PDF 5 页。
- 长稿件：120 节、600 段，约 31,639 词、230 KB；QMD PDF 91 页，原生 LaTeX PDF 76 页。
- 都包含一个公式、静态折线图、表格、引文、书目和交叉引用；LaTeX 主文件通过 `\input{chapter}` 引入正文。图表读取已有 PNG，预览不运行科研计算。
- 样本英文、模板简单，公式与图表数量很少。没有用重复段落数量模拟重度 TikZ、数百公式或真实期刊模板的复杂度。

完整测量见 [原始结果 JSON](live-preview-experiment-results.json)。生成的源文稿、PDF、HTML 与逐命令日志位于 `/tmp/scholoom-preview-vRvlCt/`；临时目录可能被系统清理。脚本可以重新生成。

## 单次启动渲染

下表计时覆盖进程启动到退出，未包含浏览器显示；正文和公式分别实际修改后重渲染，没有把“文件未变、无事可做”当作增量速度。FIRST 是该文档本轮首次渲染，不是清空 OS／字体／工具缓存后的冷机实验。

| 路径 | 小稿件首次 | 小稿件正文／公式修改 | 长稿件首次 | 长稿件正文／公式修改 |
| --- | ---: | ---: | ---: | ---: |
| Quarto → HTML | 3.65 s | 3.31／3.31 s | 7.92 s | 8.02／8.03 s |
| Quarto → PDF | 4.62 s | 4.49／4.31 s | 10.85 s | 9.91／9.69 s |
| 原生 latexmk → PDF | 14.53 s | 2.09／1.99 s | 5.80 s | 2.11／2.24 s |

原生 LaTeX 首次包含 3 次 pdflatex、2 次 BibTeX；普通修改只需一次 pdflatex。小稿件首次比长稿件首次更慢，不能把这组顺序测量解读为“篇幅越长越快”；没有进一步分离首次工具初始化与系统缓存的代价。

命令均在合成文稿目录中执行：

```sh
quarto render main.qmd --to html --no-execute
quarto render main.qmd --to pdf --no-execute
latexmk -norc -pdf -synctex=1 -interaction=nonstopmode -halt-on-error \
  '-pdflatex=pdflatex -disable-installer -disable-write18 %O %S' main.tex
```

QMD PDF 元数据指定 `pdflatex`、`latex-auto-install: false`，并传入禁止安装／shell escape 的参数；使用已有宏包，没有安装依赖。HTML 中检查修订标记、书目及图表／表格／公式目标；PDF 用 `pdftotext` 检查实际修订和书目，读取 `pdfinfo` 页数。脚本首轮书目断言误要求标题大写，已改为大小写不敏感的语义片段检查，并从已完成测量续跑；前 12 条原始记录标注了从工具输出恢复计时。

## 常驻预览与浏览器实际显示

```sh
quarto preview main.qmd --to html --no-execute --no-browser --port 8765
latexmk -norc -pdf -synctex=1 -interaction=nonstopmode -halt-on-error \
  '-pdflatex=pdflatex -disable-installer -disable-write18 %O %S' \
  -pvc -view=none -e '$sleep_time=0.2;' main.tex
```

| 测量 | 小稿件实测 |
| --- | ---: |
| Quarto preview 启动到 HTML 可读取 | 3.47 s |
| 保存正文／公式／引用到 HTTP 返回新内容 | 0.91／0.75／0.79 s |
| 保存到浏览器自动刷新后的正文出现 | 1.17 s |
| 同次修改到浏览器中 MathJax 新公式排好 | 1.27 s |
| latexmk 默认轮询，保存到新 PDF 可读取 | 2.80／2.74 s |
| latexmk 0.2 s 轮询，保存到新 PDF 可读取 | 1.11／1.17 s |

长稿件在常驻 Quarto 预览中，保存到正文显示为 **5.14 s**，到公式排好为 **5.31 s**。另一轮为 5.32／5.51 s，但与 notebook 渲染重叠，单独标注，不作为干净计时。

HTTP 用 50 ms 间隔轮询修订标记。PDF 可读取计时包含 `pdftotext` 探测的开销，属于采样结果，不能等同编辑器里的 PDF 页面已经显示；正文／公式普通修改后也等待 latexmk 返回监测状态。引用重新编号等多轮场景必须另外判断完成状态。

浏览器测量由 Playwright 访问真实 localhost Quarto 服务，使用页面初始化时的 MutationObserver 在自动重载前后通过 localStorage 记录正文和 MathJax 出现的时间，与同机写源文件的时间戳比较；没有靠工具返回时间估算延迟，也没有手动刷新。已核对一处 MathJax 公式、一条引文、Figure／Table／Equation 编号及 640 px 图件加载，见 [真实预览截图](../prototypes/live-preview-actual.png)。截图中的修订时间戳是实验标记。

此次 MathJax 来自 CDN，浏览器测量使用已加载过资源的会话；离线首次打开尚未验证，分发时需要落实本地资源。

## 连续修改、依赖、失败与定位

- **连续保存**：10 次修改，间隔 100 ms。Quarto 最后一次修改后约 0.81 s 可读到最终版本，观察到 3 条渲染完成日志；计数可能包含前一个任务末尾日志，不能作为严格队列内部计数。latexmk 调整轮询后执行 2 次 pdflatex，最后一次修改后约 1.86 s 到最终版本与监测状态。两者都没有逐次排满十个旧版本。本轮是落盘修改，不包含 CodeMirror 输入、自动保存或 Agent 编辑接线。
- **QMD 书目依赖**：仅改 `refs.bib`，5 秒内书目未更新；随后保存 QMD，约 0.91 s 后新书目出现。这个安装版本的单文档 preview 不能据此视为已覆盖所有依赖变化；集成时需要处理文献库导出后的更新。
- **LaTeX 依赖**：仅改 `refs.bib`，约 1.49 s 后 PDF 出现新书目标题；仅换 PNG，约 1.51 s 后编译完成。后者把 PDF 首页实际栅格化并检查新折线的绿色像素，确认更新到了 PDF，未只看文件时间。
- **非法 YAML**：独立复核中 Quarto 输出 YAMLException，监测进程继续运行，HTTP 仍返回旧成功内容；改回合法正文约 1.02 s 恢复。第一次紧接连续修改的错误探测 30 秒超时，未捕获新日志；无法据此断言普遍不诊断，也未定位这次时序异常。
- **LaTeX 编译错误**：在已输出数页后插入未定义命令，本机 MiKTeX 的 `-halt-on-error` 编译失败后 `main.pdf` 不再存在。监测进程继续运行，修复后约 0.73 s 再次出现成功 PDF。因此不能把“旧成功 PDF 总会留在原路径”作为产品前提，应该保存独立的最后成功产物，并表达其对应版本。
- **SyncTeX**：真实 `.synctex.gz` 下，`synctex view` 从 `chapter.tex:1` 返回 PDF 第 1 页的坐标；以该坐标调用 `synctex edit` 返回同一章节第 1 行，列号为 -1。验证了这处多文件的双向行定位，没有验证所有宏／浮动图件、编辑器点击定位或 QMD 到生成 TeX 的映射。

本机 Quarto 1.9.37 的 `/opt/quarto/bin/quarto.js` 也可核对相关机制：`watchForFileChanges`（143116 行）默认至少 200 ms 轮询；`createChangeHandler`（143676 行）源文件变化有 50 ms debounce，并进入 renderQueue；这解释了为何常驻进程及合并变化值得测量，但源码分析不能替代上面的运行数据。

## 科研执行边界

另建合成 `.ipynb`，含一个已经保存的输出 `EXISTING-COMPUTATION-RESULT: 42`；代码单元如果执行会写入 `code-touched`。以 `quarto render result.ipynb --to html --no-execute` 渲染后：

- 旧输出仍在 HTML 中，代码单元没有运行，`code-touched` 未出现。
- 同一合成项目配置的 Node `pre-render` hook 写入了 `hook-touched`，说明 hook **仍然执行**。

这证明读取已存 notebook 输出可行，也证明 `--no-execute` 只关闭计算执行，不能承担“预览不会运行工程脚本”的全部约束。没有测试 QMD `freeze`／cache 的完整复用路径、Lua filters、外部工具和已有真实科研工程。

相关官方依据：[preview](https://quarto.org/docs/cli/preview.html)、[render](https://quarto.org/docs/cli/render.html)、[项目脚本](https://quarto.org/docs/projects/scripts.html)、[cache／freeze](https://quarto.org/docs/computations/caching.html)、[latexmk](https://ctan.org/pkg/latexmk)、[SyncTeX](https://ctan.org/pkg/synctex)。本轮性能结论来自实跑，未把上游 main 行为当作已安装版本的运行结果。

## 复现与亲自体验

在项目根运行，脚本只创建 `/tmp/scholoom-preview-*` 合成文稿与产物，不修改业务源码或工程依赖：

```sh
node .scratch/scholoom-foundations/prototypes/live-preview-benchmark.mjs
```

输出 `EXPERIMENT_DIR=...`。将它设为下列变量，再做监测实验；`--latex-only` 与 QMD 实验分别运行，避免编译任务相互干扰。

```sh
export PREVIEW_EXPERIMENT_DIR=/tmp/scholoom-preview-替换为刚才打印的后缀
node .scratch/scholoom-foundations/prototypes/live-preview-watch.mjs
node .scratch/scholoom-foundations/prototypes/live-preview-watch.mjs --latex-only
```

QMD 监测脚本预留最多 60 秒供浏览器访问，随后自动停止；脚本始终在 finally 中关闭启动的监测进程。脚本通过 Node 语法检查及真实运行，本轮所有预览进程与浏览器已关闭。

想手动编辑观察，可直接运行：

```sh
quarto preview "$PREVIEW_EXPERIMENT_DIR/qmd-small/main.qmd" --to html --no-execute
```

用自己的编辑器修改并保存同目录的 `main.qmd`，浏览器会自动刷新；结束按 Ctrl+C。这是 Quarto 原生实验入口，尚未接入 Scholoom 编辑器或 PDF 查看器。

尚未验证真实期刊模板、中文／XeLaTeX／LuaLaTeX、重度公式／图表、普通笔记本、跨平台、内存与 CPU 峰值、未保存缓冲区、旧 PDF 原子发布和取消正在运行的编译。短轮询的空闲开销也未测量。以上数据支持继续设计停顿后更新的体验，不构成最终响应承诺。
