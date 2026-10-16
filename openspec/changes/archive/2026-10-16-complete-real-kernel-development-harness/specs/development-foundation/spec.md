## ADDED Requirements

### Requirement: 可操作的真实开发入口

`pnpm dev:browser` 和 `pnpm dev:desktop` SHALL 通过共同工作台与客户端接入真实科研内核，支持已实现的项目、文件、会话、科研能力、文献库、附件及阅读业务。默认调试配置 SHALL 为仓库 `.scholoom-dev/debug/`，支持 SCHOOLOOM_DATA_DIR 覆盖；结束调试 SHALL 保留配置和业务数据。真实命令及双宿主操作 SHALL 有可重复验证，受控响应限于外部模型和远程依赖边界。

#### Scenario: 双入口操作共同业务
- **WHEN** 用户运行两个 dev 命令并选择相同调试配置
- **THEN** 两端通过同一内核操作业务，用户操作产生的持久化事实和成果可由另一端读回

#### Scenario: 下一轮调试
- **WHEN** 全部调试进程结束后重新运行 dev 命令
- **THEN** 启动当前构建的新内核实例，并读取保留的配置和业务数据

#### Scenario: 真实模型业务交付
- **WHEN** 显式运行真实模型 UI 验收并注入 MiniMax 凭据
- **THEN** 研究指令从工作台进入内核，实际读取合成材料、执行工具并保存成果，另一宿主可打开成果；不以固定模型回复代替该项验收
