# 编码 Agent 开发环境：一手来源的事实

查阅日期：2026-10-04。子 Agent 调查后由主 Agent 核对正文，保留与本项目有关的事实；未启动开发服务、安装依赖或执行产品验收。

## GitHub Docs：环境 bootstrap 由仓库内声明式文件承担

来源：[Configure the development environment](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/customize-the-agent-environment)（GitHub Docs，2026-10-04 查阅）

- Copilot cloud agent 在临时环境中工作，仓库内的 setup workflow 可以预装工具与依赖，使构建、测试及检查有确定入口。
- 文档指出，让模型试错安装依赖可能慢且不可靠，私有依赖还可能无法下载。setup workflow 可作为普通 workflow 验证；步骤失败会跳过后续准备，Agent 仍可能在不完整环境中开工。
- 这些是 Copilot 的具体接入方式，Scholoom 未选择使用该服务；本项目可参考环境准备有明确入口、状态及失败诊断的思路。

## Anthropic Engineering：跨会话续做的最小构件

来源：[Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)（发布 2025-11-26，2026-10-04 查阅）

- 该团队的 web app 实验观察到跨会话接续困难、一次尝试过多功能留下半成品、过早声称完成，以及未充分验证实际应用等问题。
- 其实现准备初始化脚本、功能清单及进度记录，结合 Git 历史帮助后续会话起步；后续会话增量修改，并通过浏览器检查实际应用。
- 文章明确这是一种可能方案，实验主要针对 full-stack web app；它不证明固定角色流水线、JSON 功能账本或逐次提交适用于所有项目。Scholoom 的文档、提交及运行操作仍遵循已有决定和授权。

## 本地事实与判断边界

2026-10-04 本地核对：项目根尚无 `AGENTS.md`、`README.md`、`package.json` 或 CI workflow；OpenSpec 配置只有模板，当前基础决策主要位于本地 tracker。`git status --short` 显示 `.scratch/`、`CONTEXT.md` 和 `openspec/` 尚未被跟踪。

哪些操作需要预先授权、如何验收新会话起步能力、怎样组织交付，以及是否新增决策票，是主 Agent 与用户的项目判断；上述外部实践不直接成为规则。
