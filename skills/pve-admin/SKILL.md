---
name: pve-admin
description: 通过 Proxmox VE（PVE）REST API 查询和管理节点、虚拟机（QEMU）、LXC 容器、存储、备份、快照、集群与任务。用户提到 PVE、Proxmox、qm/pct、虚拟机开关机、快照、vzdump 备份、PVE 存储或节点状态时使用。
---

# Proxmox VE 管理 Skill

通过 API Token 调用 PVE REST API。先确认集群/节点、目标 VMID 和 Token 权限，再执行；不得把 Token 写入文件、命令历史、日志、提交或回复。

## 凭证与请求

- 环境变量：`PVE_BASE_URL`（如 `https://pve.example:8006`）、`PVE_API_TOKEN`（`user@realm!tokenid=secret`）。不要猜测或硬编码。
- 自签名证书：优先 `PVE_CA_FILE` 指向受信 PEM；仅在用户确认后临时用 `PVE_INSECURE_TLS=1`。
- 认证头为 `Authorization: PVEAPIToken=<token>`；响应数据在 `data` 字段。
- 使用 `scripts/pve_api.py`（仅标准库，Windows/macOS/Linux 通用）：

```text
python scripts/pve_api.py GET /nodes
python scripts/pve_api.py POST /nodes/pve1/qemu/100/status/start --yes
```

脚本对 POST/PUT/DELETE 缺少 `--yes` 时拒绝执行；`--yes` 只在用户已授权该具体动作后添加。

## 工作流

1. `GET /version`、`GET /nodes` 验证地址、权限，记录节点名与在线状态。
2. 用 `GET /cluster/resources?type=vm` 定位 VMID、类型（qemu/lxc）、所在节点和当前状态，确认目标与用户所指一致。
3. 写操作前读取当前配置（`.../config`）与状态；执行一次写入；随后读回确认。
4. 异步操作返回 `UPID:...` 任务号：轮询 `GET /nodes/{node}/tasks/{upid}/status` 直到 `status=stopped`，且 `exitstatus` 为 `OK` 才算成功；失败时读 `.../log`。
5. 不自动重试结果不确定的写操作，先读回状态再决定。
6. 回复只展示必要字段，脱敏 Token、密码、cloud-init 密钥。

## 安全规则

- 只读查询可直接执行；启停、重启、快照创建、配置修改须目标明确。
- 删除 VM/CT/快照/备份/存储内容、回滚快照、强制停止（`stop` 而非 `shutdown`）、`purge`、修改防火墙/网络/集群/权限、磁盘缩容或覆盖恢复，执行前须用户对具体 VMID/对象明确授权。
- 请求“查看、解释、规划”不等于授权变更。
- 优先优雅动作（`shutdown`）而非 `stop`；变更网络或集群前确认不会切断自己的访问路径。
- 权限不足（HTTP 401/403）不要绕过；说明所需最小角色（只读用 `PVEAuditor`）。

## 参考

- `references/api.md`：常用端点、参数、任务轮询与错误语义。执行具体操作前读取。
