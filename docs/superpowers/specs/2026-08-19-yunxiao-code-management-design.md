# 云效代码管理扩展设计

## 目标

在现有 `yunxiao-project-lifecycle` skill 中接入官方 Yunxiao MCP 的 `code-management` 工具集，支持常用 Codeup 仓库操作和合并请求流程，同时保留现有项目管理能力与 MCP-only 边界。

## 范围

- 读取仓库、分支、文件树、提交、代码对比和合并请求。
- 在用户明确要求时创建分支、写入文件、创建合并请求、发表评论、提交评审和合并请求。
- 支持组织成员查询；仓库成员的查询、添加、改角色和移除仅在当前 MCP 暴露并能验证对应工具时执行。
- 复用现有的项目绑定、写前读取、单次写入、写后回读和结果语义。

## 边界

- 不新建独立 skill，不改变 `yunxiao.toml` 格式，不实现第二套 Codeup/OpenAPI 客户端。
- 不做批量操作、部门同步或默认仓库推断。
- MCP 未提供仓库成员工具时返回 `CAPABILITY_MISSING`，不得用组织成员工具替代仓库权限操作。
- 合并、删除分支、合并后删除源分支等高风险动作仍要求用户明确表达。

## 实现位置

- 更新 `SKILL.md`、MCP setup 和 lifecycle policy，补充 `code-management` 工具与最小操作规则。
- 更新诊断脚本的默认 MCP toolset 和代码管理能力检查。
- 更新 README 与现有 doctor 测试，覆盖代码工具存在和缺失两条路径。

## 验收

1. 默认 MCP 配置包含 `code-management`，并能检测核心仓库/分支/提交/合并请求工具。
2. 缺少合并请求工具时，诊断结果明确为 `CAPABILITY_MISSING`，不执行任何写入。
3. 现有项目管理测试保持通过；文档明确仓库成员能力缺失时的行为。
4. 不引入新的凭据、Endpoint、绑定格式或 API 客户端。
