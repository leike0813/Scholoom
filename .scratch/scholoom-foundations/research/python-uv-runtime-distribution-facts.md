# uv Python 运行时与分发：事实核对

范围：仅核对 uv 官方文档与官方仓库源码，用于判断「科研应用接入 Python 工具」时的运行时可获得性。本文件不做架构决策。

核对时间 2026-10-04。来源为 `astral-sh/uv` 仓库 `main` 分支 `docs/` 下的 Markdown 源文件，以及 `docs.astral.sh` 生成的参考页。

## 事实

1. **uv 管理的 Python 不是 CPython 官方发行版。** 文档明确写道 Python 官方不发布可分发二进制，uv 使用 Astral `python-build-standalone` 项目的预构建发行版，并直接链到其 quirks 文档作为行为差异的说明。
   来源：`docs/concepts/python-versions.md`（Managed Python distributions 段）。

2. **已有解释器与首次下载须分开判断。** 默认 `python-preference=managed` 优先已有托管安装，也可以选择已有系统安装；找不到合适解释器时才下载。可选 `system` / `only-managed` / `only-system` 改变偏好或限制来源，不将默认行为概括为“系统解释器优先”。[Python 版本选择](https://docs.astral.sh/uv/concepts/python-versions/)、[使用已有 Python](https://docs.astral.sh/uv/guides/install-python/)。

3. **发现顺序是先托管目录、再 PATH。** 检索顺序为 `UV_PYTHON_INSTALL_DIR` 下的托管安装，然后是 `PATH` 上的 `python` / `python3` / `python3.x`（Windows 另查注册表与 Microsoft Store）。虚拟环境解释器会被单独检查后再走上述路径。托管版本优先取较新 patch，系统版本取第一个匹配而非最新。找不到系统版本时才去查可下载的托管版本。
   来源：`docs/concepts/python-versions.md`（Discovery of Python versions）。

4. **自动下载可以完全关闭。** `python-downloads` 设置项可禁用自动下载，另有 `--no-python-downloads` 可传给任意命令；文档指出关闭下载不需要同时改变 preference。
   来源：`docs/concepts/python-versions.md`（Disabling automatic Python downloads）。

5. **离线有明确 CLI 契约。** `--offline`／`UV_OFFLINE` 禁用网络，只使用本地缓存和本地文件。没有单独指南文件不能推断不支持离线；缓存是否覆盖具体工具的所有依赖仍须验证。[CLI 离线选项](https://docs.astral.sh/uv/reference/cli/#uv-run--offline)、[缓存](https://docs.astral.sh/uv/concepts/cache/)。

6. **缓存目录与运行时目录是两件事。** storage 文档把 cache 描述为「可丢弃但宜长期存在」，Unix 下为 `$XDG_CACHE_HOME/uv` 或 `$HOME/.cache/uv`；Python 解释器装在 `UV_PYTHON_INSTALL_DIR`，项目虚拟环境可用 `UV_PROJECT_ENVIRONMENT` 另行指定。
   来源：`docs/reference/storage.md`、`docs/concepts/projects/config.md`（`UV_PROJECT_ENVIRONMENT` 段）。

7. **`uv.lock` 是跨平台的 universal lockfile，描述的是 Python 包解析结果而非系统依赖。** 文档称其记录解析出的精确版本；lockfile 由 `uv sync` / `uv run` 自动创建与更新，可用 `--locked`（不更新，不一致则报错）、`--frozen`（不校验是否最新）、`--no-sync`（不检查环境）控制。文档同时指出新版本发布不会使 lockfile 过期。
   来源：`docs/concepts/projects/layout.md`（The lockfile）、`docs/concepts/projects/sync.md`（Automatic lock and sync）。

8. **平台覆盖有明确分级。** Tier 1：macOS（Apple Silicon / x86_64）、Linux x86_64、Windows x86_64。Tier 2（仅保证能构建）：Linux PPC64LE / RISC-V64 / aarch64 / armv7 / i686 / s390x、Windows arm64。
   来源：`docs/reference/policies/platforms.md`。

## 未验证边界

- **资源尚未在本地准备时需要获取。** Python 与依赖可来自下载、已有安装或预置本地资源。首次在线下载与完整预置后的离线执行分别验收，本次未运行断网样本。
- **特定科研工具的离线准备尚未验证。** 官方已定义 offline 行为，但缓存覆盖、原生 wheel、源码构建和资源搬移仍须按实际工具测试。
- **`uv.lock` 不覆盖系统层依赖。** 文档只谈 Python 包解析结果，未涉及编译器、libGL、libmagic、ffmpeg、pandoc、LaTeX 等科研常见系统依赖；它们的缺失不会表现为 lockfile 失配。
- **`python-build-standalone` 的行为差异影响面未评估。** 按实际工具与包验证；不从发行方式推断一定等同于用户已有解释器。
- **`uv tool run`、PEP 723 脚本内联依赖、`tool.uv.lock` 等路径未核对**，其离线与锁定语义不在本次范围。
- 本次不执行 Python、不做网络安装，以上结论全部来自文档文本，无实测支撑。

## 官方入口

[解释器与来源](https://docs.astral.sh/uv/concepts/python-versions/)、[项目环境配置](https://docs.astral.sh/uv/concepts/projects/config/)、[锁定与同步](https://docs.astral.sh/uv/concepts/projects/sync/)、[项目 lockfile](https://docs.astral.sh/uv/concepts/projects/layout/)、[存储位置](https://docs.astral.sh/uv/reference/storage/)、[平台分级](https://docs.astral.sh/uv/reference/policies/platforms/)。正文所列源文件均来自官方仓库对应文档，本节提供可直接阅读的页面；平台和版本信息随最终基线再次核对。
