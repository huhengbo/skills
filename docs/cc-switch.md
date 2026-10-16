# 在 CC Switch 中添加本仓库

[CC Switch](https://github.com/farion1231/cc-switch) 的 Skills 页面可以把一个 GitHub 仓库登记为「技能仓库」，再从中一键安装 skill，并按应用（Claude Code、Codex、Gemini CLI 等）分别启用。本教程说明如何添加本仓库 `huhengbo/skills`。

> 以下界面名称依据 CC Switch 官方用户手册（`docs/user-manual/zh/3-extensions/3.3-skills.md`）整理。不同版本的界面可能略有差异，以你安装的版本为准。

## 1. 准备

- CC Switch 需 **v3.7.0 或以上**（Skills 功能首次引入的版本）。建议使用最新版。
- 安装方式：
  - **macOS**（12 及以上）：`brew install --cask cc-switch`，或下载 `.dmg`。
  - **Windows**（10 及以上）：下载 `.msi` 安装包，或绿色版 `Portable.zip`。
  - **Linux**：Arch 用 `paru -S cc-switch-bin`；Debian/Ubuntu 用 `.deb`（`sudo dpkg -i`）；Fedora 等用 `.rpm`；通用可用 `.AppImage`。需要 glibc 2.35+ 与 WebKitGTK 4.1。
  - 下载地址：<https://github.com/farion1231/cc-switch/releases>
- 能访问 GitHub。CC Switch 以 zip 压缩包方式下载仓库，国内网络不通时请先配置代理。

## 2. 添加仓库

1. 打开 CC Switch，点击左侧栏的 **Skills**。
2. 点页头的 **⋯** 菜单，选择 **仓库管理**（也可以在「发现」视图中点 **仓库** 按钮，选择 **添加或管理仓库**）。
3. 在对话框中填写：

   | 字段 | 填写 |
   |---|---|
   | 仓库 URL | `huhengbo/skills`（也可以填完整地址 `https://github.com/huhengbo/skills`） |
   | 分支 | `main`（默认值） |
   | 技能路径 | `skills`（本仓库的 skill 都在该目录下；留空则扫描整个仓库，通常也能识别） |

4. 点击 **添加仓库**。成功后页面会提示识别出几个技能，本仓库当前应为 7 个（见 [README](../README.md#已维护的-skills)）。

## 3. 安装 skill

1. 切换到 **发现** 视图，找到需要的 skill（例如 `yunxiao-project-lifecycle`）。
2. 在 **安装到** 中选择要启用的应用，例如 Claude Code。
3. 点击该行的 **安装**，等待完成。安装后会直接在所选应用中启用。

在 **已安装** 页面里，每行是一个 skill，每列是一个应用，可用格子里的开关随时启用或关闭；勾选多行可批量启用或停用。

skill 默认保存在 `~/.cc-switch/skills/`，再同步到各应用目录（如 Claude Code 的 `~/.claude/skills/`）。同步优先使用软链接，失败时复制。Windows 上只用软链接需要开启开发者模式。

## 4. 更新与卸载

- **更新**：点 **⋯** 菜单里的 **检查更新**，再点单项的 **更新**，或点 **全部更新**。更新会替换本地目录，本地改动只保留在备份里。仓库有新提交后，如果「发现」里看不到新内容，先点 **重新读取仓库**。
- **卸载**：在「已安装」里点该行 **⋯** 菜单的 **卸载**。卸载前会自动备份到 `~/.cc-switch/skill-backups/`，可通过 **从备份恢复** 找回。
- **删除仓库**：在「已添加的仓库」列表中点仓库右侧的删除按钮。已安装的 skill 会保留，但之后无法再从该仓库更新。

## 5. 安装后还需要做什么

部分 skill 需要先配置凭据或 MCP 才能使用，安装只是复制文件，不会替你配置：

- `yunxiao-project-lifecycle`：需要云效个人访问令牌和云效 MCP，见 [mcp-setup.md](../skills/yunxiao-project-lifecycle/references/mcp-setup.md)。
- `aliyun-infra`：需要安装 `aliyun` CLI 并配置 profile，见 [setup.md](../skills/aliyun-infra/references/setup.md)。

首次使用时，直接让 agent 执行相应任务，它会按 skill 内的指引一步步带你完成。令牌和 AccessKey 只在本机终端输入，不要发到聊天里。

## 常见问题

| 现象 | 处理 |
|---|---|
| 添加后提示识别 0 个技能 | 确认分支为 `main`；技能路径填 `skills` 或留空；点 **重新读取仓库** |
| 添加或安装时报 403 / 429 | GitHub 访问受限或限流，稍后重试，或检查代理 |
| 添加或安装时报 404 | 仓库名或分支写错；私有仓库不在官方文档说明的支持范围内 |
| 新装的 skill 在 Claude Code 里看不到 | 在「已安装」里确认 Claude Code 那一列已开启，然后新开一个 Claude Code 会话 |
