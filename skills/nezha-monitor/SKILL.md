---
name: nezha-monitor
description: 使用哪吒监控（Nezha）Dashboard API 查询和管理服务器、分组、服务监控、告警、通知、定时任务、DDNS、NAT、文件与终端操作。用户提到哪吒监控、Nezha 面板、Agent 状态、VPS 监控或需要调用哪吒 API 时使用。
---

# 哪吒监控 API Skill

本 Skill 面向需要让 Agent 操作 Nezha Dashboard 的任务。先确认面板基地址、Nezha 主版本（v1/v2）和凭证权限，再执行 API 请求；不得把 Token 写入文件、命令历史、日志、提交或回复。

## 凭证与请求

- 从环境变量读取 `NEZHA_BASE_URL` 与 `NEZHA_API_TOKEN`；不要猜测或硬编码凭证。
- 默认 API 根路径为 `${NEZHA_BASE_URL}/api/v1`。
- API Token 认证使用 `Authorization: Bearer $NEZHA_API_TOKEN`。旧版本或兼容接口可能使用 `Authorization: $NEZHA_API_TOKEN`，只有收到 `ApiErrorUnauthorized` 时才在确认版本后尝试兼容格式。
- 通用响应通常是 `{success,data,error}`；HTTP 200 不代表业务成功，必须同时检查 `success` 和 `error`。
- 使用 `scripts/nezha_api.py` 可减少重复请求；它不会打印 Token。
- 需要修改、删除、执行命令、终端、文件操作时，先明确用户目标、资源 ID 和影响范围；只读查询可直接执行。

## 工作流

1. `GET /api/v1/server` 验证地址、Token 和权限，记录服务器 ID、名称、UUID、在线状态、资源指标。
2. 按任务读取对应参考文档中的端点、查询参数和请求体；不要凭旧版接口猜字段。
3. 写操作后重新 GET 资源确认结果；批量删除、远程终端、文件写入、强制更新等高影响操作必须在执行前得到明确授权。
4. 对流式接口（`/ws/*`）使用支持 WebSocket 的客户端；普通 HTTP 客户端不要把它当 JSON 接口。
5. 返回给用户时只展示必要的监控数据和脱敏错误；不展示 Token、Cookie、私密配置或完整终端输出中的凭证。

## 功能路由

- 服务器、服务器组、实时指标、Agent 配置：阅读 [references/api.md](references/api.md) 的 Inventory 部分。
- 服务监控、告警、通知、Cron、DDNS、NAT：阅读相应章节。
- 终端、文件管理、传输：阅读 Operations 章节，并遵守高影响操作确认要求。
- API Token、作用域、MCP：阅读 Authentication 章节。

## 版本与兼容性

Nezha v1/v2 的认证、端点和字段存在差异。发现 404、401 或响应结构不符时，先读取 `/swagger/index.html`（若面板启用）或面板对应版本文档；不要自动降级到未授权或模拟数据。若面板启用了 API Token scope，只请求所需最小 scope。
