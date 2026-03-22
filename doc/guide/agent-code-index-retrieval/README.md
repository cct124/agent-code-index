# agent-code-index Retrieval Skill 模板使用说明

这份 README 用于说明如何把当前目录下的模板复制到真实项目中，并替换占位符，形成可直接被 Agent 使用的 `SKILL.md`。

## 当前文件

本目录包含：

1. `SKILL.md`：真实项目可复用的技能模板
2. `README.md`：复制、落位、替换占位符的操作说明

## 适用场景

适合以下项目：

1. 需要对代码仓库做 semantic retrieval
2. 需要通过 Agent 定位实现代码、测试、配置 wiring
3. 需要通过 MCP 暴露索引和检索工具
4. 需要对 query rewrite 进行规范化

## 如何复制到真实项目

建议步骤如下：

1. 在目标项目中选择技能放置位置
2. 创建与 `name` 一致的目录名
3. 复制 `SKILL.md`
4. 按目标项目替换占位符
5. 检查 frontmatter 与目录名是否一致
6. 让 Agent 在真实任务中试跑并微调

推荐落位：

1. `.github/skills/agent-code-index-retrieval/SKILL.md`
2. `.agents/skills/agent-code-index-retrieval/SKILL.md`
3. `.claude/skills/agent-code-index-retrieval/SKILL.md`

## 必须替换的内容

### 1. 项目上下文

在 `SKILL.md` 中找到这部分并替换：

1. `{{PROJECT_NAME}}`
2. `{{MAIN_LANGUAGES}}`
3. `{{EMBEDDING_PROVIDER}}`
4. `{{REPOSITORY_ID_CONVENTION}}`
5. `{{QUERY_STYLE}}`

### 2. 仓库原生术语

把真实项目里最关键的内部术语填进去，例如：

1. 核心 service 名称
2. 核心 class 名称
3. MCP tool / endpoint / command 名称
4. 配置项名称
5. storage / infra / adapter 组件名称

这些词会显著影响 retrieval query 的质量。

### 3. 噪声文件路径

把真实项目中容易误召回、但对代码定位帮助不大的路径填进去，例如：

1. template 目录
2. generated 目录
3. lockfile
4. 示例脚本目录
5. 仅用于演示的 playground 文件

### 4. 推荐 query 形态

把模板里的 query shape 替换成更像你项目的表达方式。

例如：

1. 如果项目是前端应用，就多写 component / route / state / hook 相关形态
2. 如果项目是后端服务，就多写 handler / service / repository / schema 相关形态
3. 如果项目 heavily 依赖配置装配，就强化 bootstrap / container / provider / registration 相关词

## frontmatter 注意事项

`SKILL.md` 顶部这两项很重要：

1. `name`
2. `description`

注意：

1. `name` 应尽量与目录名一致
2. `description` 是技能发现入口，要写清触发场景
3. `description` 里应包含真实会触发的关键词，例如：
   - code search
   - semantic retrieval
   - implementation tracing
   - config wiring
   - query rewrite

## 建议的落地方式

不要把模板当作静态文档直接照搬。推荐这样落地：

1. 先复制模板
2. 先替换占位符
3. 用 5 到 10 个真实工程任务试跑
4. 记录最容易误召回的文件和最有效的 query 形态
5. 把这些经验继续补回 `SKILL.md`

也就是说，这份模板应该随着项目实际使用持续迭代。

## 推荐验证方法

在真实项目接入后，建议至少验证以下任务：

1. 找实现代码
2. 找 unit test
3. 找配置 wiring
4. 找索引 / 检索 / 存储链路
5. 找最近一次修复相关路径

如果出现以下现象，说明模板还需要继续调：

1. query 过长，结果偏 README
2. query 过泛，结果命中大量无关文件
3. top results 总是同一个 template 文件
4. 代码和测试召回比例明显偏低

## 最后建议

如果真实项目也是软件工程开发型 RAG，建议优先把这三部分调好：

1. 仓库原生术语列表
2. 噪声文件列表
3. 推荐 query 形态

这三部分通常比“简单复制模板”更能决定最终效果。
