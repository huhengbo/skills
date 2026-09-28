# Nezha Dashboard API 参考（v1/v2 常用面）

所有路径相对于 `${NEZHA_BASE_URL}/api/v1`，除非另有说明。方法、字段以实际面板 Swagger 和返回值为准。

## Authentication

- `POST /login`：用户名密码登录，返回 JWT `token` 和 `expire`；仅在用户明确提供账号密码并授权时使用。
- `POST /refresh-token`：刷新登录 Token。
- `GET /profile`、`POST /profile`：读取/更新当前用户资料。
- `GET /api-tokens`、`POST /api-tokens`、`DELETE /api-tokens/:id`：管理 API Token；创建时限制 scope 和服务器白名单。
- Dashboard 的 MCP 入口通常是 `${NEZHA_BASE_URL}/mcp`，它不等同 REST API，只有面板启用 MCP 且用户要求时才使用。

## Inventory（服务器与指标）

- `GET /server`：服务器列表；支持面板版本提供的分页、标签或查询参数。常见返回字段：`id,name,uuid,host,state,online`。
- `PATCH /server/:id`：更新服务器展示信息或分组等可编辑字段。
- `GET /server/config/:id`：读取 Agent 配置；属于敏感信息，默认不回显。
- `POST /server/config`：写入 Agent 配置；修改前确认目标 ID 和变更字段。
- `POST /batch-delete/server`：批量删除服务器。
- `POST /batch-move/server`：批量移动服务器组。
- `POST /force-update/server`：强制刷新/更新服务器信息。
- `GET /server-group`、`POST /server-group`、`PATCH /server-group/:id`、`POST /batch-delete/server-group`：服务器组 CRUD。
- `GET /server/:id/metrics`：单台服务器历史指标。
- `GET /ws/server`：实时服务器流（WebSocket）。

典型 `state` 指标包括 `cpu`、`mem_used/mem_total`、`disk_used/disk_total`、网络流量与速率、`uptime`、TCP/UDP 连接数；展示前注明采样时间和单位。

## Monitoring

- `GET /service`、`GET /service/list`：服务监控列表。
- `GET /service/server`：服务与服务器关联视图。
- `GET /server/:id/service`：指定服务器的服务。
- `GET /service/:id/history`：服务历史数据。
- `POST /service`、`PATCH /service/:id`、`POST /batch-delete/service`：服务监控管理。
- `GET /alert-rule`、`POST /alert-rule`、`PATCH /alert-rule/:id`、`POST /batch-delete/alert-rule`：告警规则。
- `GET /notification`、`POST /notification`、`PATCH /notification/:id`、`POST /batch-delete/notification`：通知渠道。
- `GET /notification-group`、`POST /notification-group`、`PATCH /notification-group/:id`、`POST /batch-delete/notification-group`：通知分组。

## Automation / Network

- `GET/POST/PATCH /cron`、`POST /cron/:id/manual`、`POST /batch-delete/cron`：定时任务与手动触发。
- `GET /ddns`、`GET /ddns/providers`、`POST /ddns`、`PATCH /ddns/:id`、`POST /batch-delete/ddns`：DDNS。
- `GET/POST/PATCH /nat`、`POST /batch-delete/nat`：NAT 映射。

## Operations

- `POST /terminal` 创建终端会话，`GET /ws/terminal/:id` 建立终端流；这是远程执行能力，必须逐条展示命令并获得明确授权。
- `POST /file` 创建文件管理会话，`GET /ws/file/:id` 建立文件流；文件上传、覆盖、删除前必须确认路径和内容。
- `GET /transfer`、`POST /transfer/:id/cancel`、`POST /transfer/:id/retry`、`GET /ws/transfer`：文件传输任务。
- 管理员端点通常包括 `/user` 的 GET/POST，以及更高权限的设置接口；只有管理员明确授权时使用。

## Error handling

常见错误：`ApiErrorUnauthorized`（Token/认证方式/作用域错误）、404（版本或路径不匹配）、业务 `success:false`。保留 HTTP 状态码、错误字段和请求方法/路径，隐藏 Authorization、Cookie、密码、Token 和敏感配置。
