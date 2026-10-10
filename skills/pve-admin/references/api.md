# PVE API 常用端点

根路径 `/api2/json`；脚本会自动补前缀。`{node}` 为节点名，`{type}` 为 `qemu`（虚拟机）或 `lxc`（容器），`{vmid}` 为整数 ID。参数以 JSON 对象通过 `--data` 传入。版本差异以 `GET /version` 与官方 API Viewer（`https://pve.proxmox.com/pve-docs/api-viewer/`）为准。

## 只读

| 目的 | 端点 |
|---|---|
| 版本 | `GET /version` |
| 节点列表/负载 | `GET /nodes`，`GET /nodes/{node}/status` |
| 全集群资源 | `GET /cluster/resources`（`type=vm\|storage\|node`） |
| 集群状态 | `GET /cluster/status` |
| 客户机列表 | `GET /nodes/{node}/{type}` |
| 客户机状态/配置 | `GET /nodes/{node}/{type}/{vmid}/status/current`，`.../config` |
| 快照列表 | `GET /nodes/{node}/{type}/{vmid}/snapshot` |
| 存储 | `GET /nodes/{node}/storage`，`GET /nodes/{node}/storage/{storage}/content`（`content=backup\|iso\|vztmpl`） |
| 任务 | `GET /nodes/{node}/tasks`，`.../tasks/{upid}/status`，`.../tasks/{upid}/log` |
| QEMU guest agent IP | `GET /nodes/{node}/qemu/{vmid}/agent/network-get-interfaces`（需虚拟机内装 agent） |
| 下一个可用 VMID | `GET /cluster/nextid` |

## 变更（均需 `--yes` 与用户授权）

| 动作 | 端点 | 说明 |
|---|---|---|
| 启动 | `POST .../{vmid}/status/start` | 异步，返回 UPID |
| 优雅关机 | `POST .../{vmid}/status/shutdown` | 可带 `timeout` |
| 强制停止 | `POST .../{vmid}/status/stop` | 相当于断电，高风险 |
| 重启 | `POST .../{vmid}/status/reboot` | |
| 修改配置 | `PUT .../{vmid}/config` | 先读后改，只传要改的键；部分项需重启生效 |
| 创建快照 | `POST .../{vmid}/snapshot` | `snapname`，QEMU 可加 `vmstate=1` |
| 回滚快照 | `POST .../{vmid}/snapshot/{snapname}/rollback` | 丢弃当前状态，高风险 |
| 删除快照 | `DELETE .../{vmid}/snapshot/{snapname}` | 高风险 |
| 备份 | `POST /nodes/{node}/vzdump` | `vmid`、`storage`、`mode=snapshot\|suspend\|stop`、`compress=zstd` |
| 克隆 | `POST .../{vmid}/clone` | `newid`、`name`、`full=1` |
| 迁移 | `POST .../{vmid}/migrate` | `target`，`online=1`（QEMU） |
| 删除客户机 | `DELETE .../{vmid}` | 可带 `purge=1`，不可逆，高风险 |

## 任务与错误

- 异步写操作 `data` 为 `UPID:node:...`；轮询任务状态，`status=stopped` 且 `exitstatus=OK` 才成功，`WARNINGS: n` 需读日志判断。
- 配置被锁（`lock: backup/snapshot/...`）时先查任务是否仍在运行，不要直接强制解锁。
- 401：Token 无效或格式错；403：角色/路径权限不足；500 含 `no such VM`：VMID 或节点错误；596/连接错误：节点不可达或证书校验失败。
- Token 开启“特权分离”时权限独立于用户，需单独授权。
