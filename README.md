# skills

可复用的 Agent Skills 集合，用于标准化运维操作、API 参考和自动化工作流。核心行为遵循可移植的 Agent Skills 模型；各客户端的元数据只是适配层，不得重新定义 skill 本身。

## 快速安装

| 方式 | 说明 |
|---|---|
| CC Switch | 图形界面添加本仓库后一键安装，见 [在 CC Switch 中添加本仓库](docs/cc-switch.md) |
| Claude Code 插件市场 | 本仓库提供 `.claude-plugin/marketplace.json`，可作为 marketplace 添加 |
| 手动复制 | 把 `skills/<skill-name>/` 整个目录复制到客户端的 skills 目录（如 `~/.claude/skills/`） |

## 仓库结构

```text
skills/
  <skill-name>/
    SKILL.md             任务入口
    references/          详细的规范与参考资料
    scripts/             可选的确定性辅助脚本
    tests/               可选的 skill 本地回归测试
    assets/              可选的静态资源
    agents/              可选的客户端适配
    .claude-plugin/      可选的 Claude 适配
```

`skills-manifest.json` 是已维护 skill 的名称、版本和分发方式的权威清单。`.claude-plugin/marketplace.json` 与各 skill 的插件元数据必须与它保持一致。

## 已维护的 skills

- `aliyun-infra` — 阿里云 CLI 运维、短信、CAS 证书、DNS/OSS 部署及安全的基础设施工作流。
- `cliproxyapi-management-api` — CLIProxyAPI 接口参考及带保护的 provider 管理工作流。
- `tencentcloud-infra` — 腾讯云 `tccli` 运维，带 profile/地域及变更安全控制。
- `werss-official-account` — 基于 WeRSS 的微信公众号搜索、订阅、文章研究和 feed 地址。
- `yunxiao-project-lifecycle` — 云效项目 / Codeup / 流水线 / 制品仓库 / 应用交付 / 测试的生命周期管理及项目绑定。
- `nezha-monitor` — 哪吒监控 Dashboard API 查询，以及带保护的服务器、监控、告警、网络、文件和终端操作。
- `pve-admin` — Proxmox VE REST API 查询，以及带保护的 VM/LXC、快照、备份和任务操作。

## 渐进式披露

`SKILL.md` 应保持精简，使常规任务可以直接加载。它应当说明：

- skill 适用的场景；
- 如何确定上下文和操作目标；
- 高层执行流程；
- 硬性安全闸门和结果语义；
- 详细规则应加载哪份 reference。

服务命令目录、schema、长命令表、操作矩阵、故障排查和针对具体对象的详细策略放在 `references/`。每条规范性规则只保留一个明确的权威来源，不要在 `SKILL.md` 与 reference 之间重复拷贝。

详见[编写指南](docs/authoring.md)。

## 跨平台策略

已维护的 skill 及其权威辅助脚本必须支持 **Windows、macOS 和 Linux**。WSL 或 Git Bash 不视为原生 Windows 支持。

可执行的跨平台辅助脚本优先使用 Python 或 Node.js。仅当存在等价的、与平台无关的权威路径时，`.sh` 脚本才可作为便利封装保留。命令在不同平台差异明显时，特定 shell 的配置示例必须同时给出其他受支持平台的等价写法。

## 校验

运行与 CI 相同的全仓库检查：

```text
python scripts/validate_repo.py --with-tests
```

该命令会校验 skill 结构、本地引用、分发元数据、密钥卫生、`.gitignore` 策略，以及所有发现的 Python/Node 测试。GitHub Actions 在 Windows、macOS 和 Linux 上执行同一条命令。详见[校验说明](docs/validation.md)。

对单个可移植 skill，也可在可用时使用 Agent Skills 参考校验器：

```text
uvx --from skills-ref agentskills validate <skill-dir>
```

## 安全与变更规则

- 不得提交密钥、令牌、cookie、授权头、私钥或带密钥的备份。
- 可复用示例使用占位符；环境 / 项目绑定与可复用的 skill 内容分开存放。
- 变更前先读取当前状态，外部系统允许时在变更后验证结果。
- 破坏性或高影响操作必须有明确的目标和动作意图。
- 对结果不确定的写操作，必须先通过读取确认副作用是否已发生，再决定是否重试。
- 优先做窄范围更新，避免整体替换对象或列表，并尽可能检测并发状态变化。

## 维护

- 每次提交聚焦于一个 skill 或一个更新主题。
- API 或安全规则变化时，更新权威 reference，而不是在多个文件中重复同一规则。
- 复现过的故障，在修复之前或同时补回归测试。
- 保持 `skills-manifest.json`、marketplace 元数据和各 skill 的版本元数据同步。
- 从规范性的 skill 文件中清除过时示例和历史假设；设计 / 历史文档须明确标注为非规范性。
