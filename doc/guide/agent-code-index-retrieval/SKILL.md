---
name: agent-code-index-retrieval
description: "Use when a software engineering agent needs code search, semantic code retrieval, query rewrite, MCP tool usage, implementation tracing, test lookup, config wiring lookup, or indexing/search debugging with agent-code-index."
---

# agent-code-index Retrieval Skill

## 目标

这是一份给真实项目复用的 `SKILL.md` 模板，用于指导 Agent 把 `agent-code-index` 当作软件工程开发场景下的 RAG 与代码检索后端来使用。

这份技能主要解决以下问题：

1. 定位某个需求或缺陷对应的实现代码
2. 追踪服务装配、配置传递、容器 wiring 路径
3. 查找某个功能对应的 unit test 或 integration test
4. 使用 semantic retrieval 获取已索引代码上下文
5. 把用户的模糊需求改写成高质量 retrieval query

这不是一份通用文档问答技能。它的核心目标是帮助 Agent 更稳定地召回“可编辑、可修改、可验证”的代码和测试文件。

## 推荐放置位置

在真实项目里，建议把这份模板复制到以下任一位置：

1. `.github/skills/agent-code-index-retrieval/SKILL.md`
2. `.agents/skills/agent-code-index-retrieval/SKILL.md`
3. `.claude/skills/agent-code-index-retrieval/SKILL.md`

目录名建议与 frontmatter 里的 `name` 保持一致。

## 工具前提

这份模板默认项目已经通过 MCP 接入 `agent-code-index`，并暴露了类似工具：

1. `index_repository`
2. `search_code_context`
3. `index_files`
4. `delete_files`
5. `get_file_context`

同时默认仓库已经完成索引，并使用了偏代码检索的 embedding model。

工具调用约定：

1. 调用 `index_repository` 或 `index_files` 时，推荐默认不要显式传 `embeddingBatchSize` 与 `embeddingConcurrency`
2. 优先直接使用服务端默认值，避免不同调用方各自携带不一致的吞吐参数
3. 只有在需要做压测、限流、问题定位或临时调优时，才显式覆盖这两个参数
4. 当前 core 内置默认值为 `embeddingBatchSize=32`、`embeddingConcurrency=16`

基于当前评测结果，默认推荐是：

1. 默认生产选择：`voyage-code-3`
2. 在强约束、工程化 prompt 下的可选方案：`Qwen/Qwen3-Embedding-8B`

如果 query 质量无法被强控制，优先选择 `voyage-code-3`。

## 核心原则

在这条工具链里，retrieval quality 很大程度上取决于 query quality。

当前链路是：

1. Agent 先写 retrieval query
2. embedding model 把 query 编码成 query vector
3. 数据库用这个向量去搜索相近 chunk
4. Agent 再消费返回的 code context

因此，只要 query 写偏了、写散了、写得过长、或者过于偏文档表达，检索质量就会明显下降。

所以 Agent 必须把 retrieval query generation 当作一等公民，而不是把用户原话直接扔进检索。

## 什么时候启用这份技能

当用户提出以下类型的问题时，应启用这份技能：

1. “这个功能是在哪里实现的？”
2. “帮我追一下请求链路 / 调用链路”
3. “这个配置是怎么接到运行时里的？”
4. “帮我找相关测试”
5. “检索 / 索引 / 存储是在哪一层做的？”
6. “为什么搜索结果不对？”
7. “为什么索引、更新、删除或上下文读取行为异常？”

以下任务不应优先启用这份技能：

1. 写产品文案
2. 宽泛业务问答
3. 只靠文件名就能完成的简单定位
4. 解释与当前仓库无关的外部 API

## 检索策略

使用 `agent-code-index` 时，目标应优先是 code-location，而不是泛语义相似性。

优先目标：

1. implementation files
2. unit test / integration test
3. config wiring code
4. repository / service / container / bootstrap 相关文件

除非用户明确要求，否则应降低优先级：

1. README
2. design docs
3. progress / milestone 文档
4. lockfile
5. template 或示例文件

## Query 编写规则

每一条 retrieval query 都应遵守以下规则。

### 1. 一条 query 只做一个检索目标

反例：

- “帮我同时找实现、原理、部署、风险和示例”

正例：

- `trace provider factory wiring in code`
- `find LocalFileScanner includePatterns override implementation + unit test`

### 2. 优先使用仓库内部真实术语

如果仓库里已经有明确术语，优先使用：

1. class name
2. service name
3. tool name
4. config name
5. domain term

例如：

1. `LocalFileScanner`
2. `ContextPacket`
3. `register-tools`
4. `index-repository-service`
5. `provider-factory`

### 3. 优先短、工程化的 query

query 要尽量短、可控、面向工程任务。

推荐形态：

- `trace search_code_context tokenBudget path. find ContextPacket, context-builder, truncation logic, and related tests.`

除非模型已经被验证能稳定处理长自然语言输入，否则不要直接把冗长用户描述原样送进检索。

### 4. 显式表达代码偏好

如果目标是找代码，而不是找文档，要把偏好写清楚：

1. `prefer code over docs`
2. `need implementation + unit test`
3. `find wiring in code`
4. `prefer .ts implementation`

### 5. 不要混合不同抽象层级

不要把“架构总结型问题”和“代码定位型问题”写进同一条 query。

反例：

- `Explain the whole indexing architecture and show where concurrency is implemented`

正例：

- `trace embeddingBatchSize and embeddingConcurrency in code. find batching and worker concurrency path.`

## Query Rewrite Workflow

在调用 semantic retrieval 之前，先把用户请求改写成一条或多条工程化 query。

推荐流程：

1. 识别真实检索目标
2. 选择最窄、最偏代码的表达
3. 尽量注入仓库内部的精确术语
4. 必要时加上 `prefer code over docs` 之类的偏好约束
5. 如果任务本身混合多个目标，就拆成多条 query

### 改写示例

用户原话：

- “帮我看看索引是怎么接进 MCP 的”

改写：

- `locate index_repository wiring in code. find register-tools/createApp/container path, prefer .ts implementation and tests, not README/design docs.`

用户原话：

- “为什么 search_code_context 返回内容被截断了”

改写：

- `trace search_code_context tokenBudget in code. find ContextPacket, context-builder, truncation logic, and related tests.`

用户原话：

- “为什么有些 .gitignore 忽略的文件还是想被索引进去”

改写：

- `find includePatterns override logic in LocalFileScanner. need implementation + unit test for ignore/.gitignore override.`

## Multi-Query 策略

如果用户任务横跨多个层级，不要强依赖单条 query。

建议拆成多路并行 query，例如：

1. implementation query
2. test query
3. config / wiring query

例如对于“为什么索引 hang 住或者退出很晚”，可以拆成：

1. `find quality run cleanup path and surrealClient.disconnect call in code`
2. `find Surreal client disconnect implementation and tests`
3. `find app bootstrap/container lifecycle around search/index run`

然后再把多路结果合并分析。

## 推荐使用流程

1. 先把用户请求重写成一条或多条紧凑的工程化 query
2. 先调用一次 `search_code_context`
3. 检查 top files 是更偏 implementation 还是更偏 docs
4. 如果结果过于 doc-heavy，就继续 rewrite query
5. 如果已经定位到具体文件，就再调用 `get_file_context`
6. 如果仓库代码刚发生变化，就先调用 `index_files` 或 `index_repository`

## 常见失败模式

重点关注以下失败信号：

1. 大量重复命中同一个无关文件
2. 用户要代码，但 top results 被 README 或设计文档占满
3. 结果主要是 template、lockfile、config 之类的噪声文件
4. 结果虽然提到功能名，但没有真正可执行的实现逻辑

一旦出现这些情况，优先这样处理：

1. 缩短 query
2. 加强 code bias
3. 注入仓库内部真实 symbol 或 file-role 术语
4. 拆 query，不要把多个目标混在一起

## Agent 输出约定

完成检索后，Agent 的输出顺序应尽量是：

1. 最可能的 implementation files
2. 相关 tests
3. 重要 config / wiring files
4. 最后才是辅助性的 docs

如果检索质量看起来很弱，Agent 应明确说出来，例如：

1. `Top hits are too doc-heavy; rewriting query toward implementation files.`
2. `Results collapsed to repeated template files; treating this as low-confidence retrieval.`

## 真实项目模板区

下面这些占位符在复制到真实项目后需要替换。

### 项目上下文

- 项目名称：`{{PROJECT_NAME}}`
- 主要语言：`{{MAIN_LANGUAGES}}`
- 默认 embedding provider：`{{EMBEDDING_PROVIDER}}`
- repository id 约定：`{{REPOSITORY_ID_CONVENTION}}`
- 推荐 query 风格：`{{QUERY_STYLE}}`

### 仓库原生术语

列出这个项目里最值得优先写进 retrieval query 的内部术语：

1. `{{SERVICE_OR_CLASS_NAME_1}}`
2. `{{SERVICE_OR_CLASS_NAME_2}}`
3. `{{TOOL_OR_ENDPOINT_NAME_1}}`
4. `{{CONFIG_NAME_1}}`
5. `{{STORAGE_OR_INFRA_NAME_1}}`

### 需要降权的噪声文件

1. `{{NOISE_PATH_1}}`
2. `{{NOISE_PATH_2}}`
3. `{{NOISE_PATH_3}}`

### 推荐 query 形态

1. `trace {{FLOW_NAME}} in code. find {{SERVICE_NAMES}} and related tests.`
2. `find {{FEATURE_NAME}} implementation + unit test. prefer code over docs.`
3. `locate {{CONFIG_OR_WIRING_NAME}} path in code. find bootstrap/container/registration files.`

## 最小操作规则

1. 只要能 rewrite，就不要把长篇用户原话直接送进 retrieval
2. 优先仓库内部真实术语，不要只用泛化描述
3. 优先多条短 query，不要一条 query 承担过多目标
4. 把 retrieval quality 当作一等工程问题
5. 如果结果持续偏 docs，不要急着推理，先 rewrite query

## 总结

这份技能的目标，是让 `agent-code-index` 真正服务于软件工程开发，而不是只做一层泛化 semantic search。

核心纪律很简单：

1. 先把用户意图改写成高质量工程 query
2. 面向实现任务时，优先代码和测试，再看文档
3. 一旦发现检索质量弱，就尽快 rewrite，而不是在低质量候选集上继续推理

只要遵守这套纪律，`agent-code-index` 才会更像一个实用的 code-navigation / engineering-RAG 工具，而不是一个只会“搜到相关文字”的向量检索层。
