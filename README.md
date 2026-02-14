# huhengbo/skills

个人自用 Codex Skills 仓库，用于沉淀可复用的技能模板、接口参考和自动化操作指南。

## 目标
- 统一管理自用 skills
- 持续迭代已有 skills
- 让后续新增 skill 的结构和质量保持一致

## 目录约定
```text
skills/
  <skill-name>/
    SKILL.md
    agents/
      openai.yaml
    references/
    scripts/      (可选)
    assets/       (可选)
```

## 当前 Skills
- `cliproxyapi-management-api`
  - CLIProxyAPI 全量接口参考（核心 API、管理 API、Amp 路由）
  - Provider 增删改查请求规范
  - 安全调用模板（占位符，不含敏感信息）

## 新增一个 Skill（建议流程）
1. 使用 `skill-creator` 初始化骨架。
2. 在 `SKILL.md` 写清楚触发场景和执行流程。
3. 将详细规范放到 `references/`，保持 `SKILL.md` 精简。
4. 运行校验脚本（如 `quick_validate.py`）确保结构合法。
5. 提交到仓库，保持单次提交聚焦一个 skill 或一个变更主题。

## 命名规范
- skill 名称使用小写字母、数字、连字符（kebab-case）
- 示例：`cliproxyapi-management-api`

## 安全规范
- 严禁提交任何密钥、token、账号、真实内网地址
- 示例请求统一使用占位符：`<BASE_URL>`、`<API_KEY>`、`<MANAGEMENT_KEY>`

## 维护建议
- 每个 skill 变更附带简短变更说明
- 涉及接口更新时同步更新 `references/`
- 定期清理无效或重复 skill
