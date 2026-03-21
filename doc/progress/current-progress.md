# agent-code-index 当前进度

本文档记录当前仓库的运行状态、已经可验证的能力、尚未完成的缺口以及下一步开发建议。

## 1. 当前结论

截至 2026-03-21，当前项目已经从“可验证启动骨架”推进到“索引主链路可运行、真实存储与检索可验证、代码与 Markdown 智能 chunk 已落地”的阶段。

当前状态可以概括为：

1. v1 架构和工程基础已稳定
2. 配置模型与项目级 embedding 锁定已落地
3. `project_metadata` 启动链路已落地并通过真实 SurrealDB 验证
4. `SurrealChunkRepository` 和 `SurrealSearchRepository` 已完成第一版实现
5. `DefaultIndexRepositoryService` 已完成并接入应用容器
6. `EmbeddingProvider` contract、provider factory、`VoyageEmbeddingProvider` 与 `OpenAI-compatible provider` 已落地
7. parser 与 chunking 已从 fallback 主流程演进到“tree-sitter 代码语义解析 + Markdown 章节切块 + fallback 兜底”的完整第一版实现
8. 轻量集成测试、真实 SurrealDB 集成测试和基于真实模板文件的 parser 集成测试已覆盖当前主链路
9. MCP tool server 与具体工具实现仍未落地

## 2. 当前项目结构

当前仓库采用 Yarn workspace 三包结构：

1. `packages/core`
2. `packages/infra`
3. `packages/mcp-server`

根目录当前还包括：

1. `design/v1/README.md`
2. `.env.example`
3. `.env.development`
4. `vitest.config.ts`
5. `vitest.unit.config.ts`
6. `vitest.integration.config.ts`
7. `package.json`

## 3. 已完成能力

### 3.1 配置与启动能力

当前已经可验证：

1. 环境变量加载与校验
2. `PROJECT_SPACE` 到 namespace 的派生规则
3. embedding 必填配置校验
4. Surreal 健康检查
5. `project_metadata` schema 初始化
6. 首次启动写入项目元数据
7. 二次启动时 embedding 配置锁定校验

### 3.2 Surreal 基础设施能力

当前已经可验证：

1. `DefaultSurrealClient` 连接、鉴权、健康检查
2. `SurrealProjectMetadataRepository` 真实读写
3. `SurrealChunkRepository` 批量写入、按仓库删除、按文件读取
4. `SurrealSearchRepository` 基于已存储 embedding 的语义检索

### 3.3 parser 与 chunking 能力

当前已经可验证：

1. `LocalFileScanner` 的仓库递归扫描与基础忽略规则
2. `FallbackParser` 的固定窗口切块与重叠窗口切块
3. `TypeScriptTreeSitterParser` 已可提取 class、function、method 和函数值变量
4. `PythonTreeSitterParser` 已可提取 class、top-level function 和 method
5. `MarkdownParser` 已可按标题章节切块，并补充 `heading / headingPath / sectionLevel / docType / frontmatter`
6. `ParserFactory` 已能按文件扩展名分派到 TypeScript、Python、Markdown 和 fallback parser
7. `RepositoryChunkPreparationService` 的“扫描目录 -> 读取文件 -> 产出 Chunk[]”主流程
8. 二进制文件跳过逻辑
9. 超大语义节点会自动回退到重叠窗口切块，而不是直接丢弃

### 3.4 embedding 能力

当前已经可验证：

1. `EmbeddingProvider` contract 已在 `core` 中定义
2. `createEmbeddingProvider` 已可按配置创建 provider
3. `VoyageEmbeddingProvider` 已具备最小 HTTP 调用能力
4. `OpenAICompatibleEmbeddingProvider` 已具备最小 HTTP 调用能力
5. provider factory 已支持 `voyage | openai-compatible`

### 3.5 索引主链路能力

当前已经可验证：

1. `DefaultIndexRepositoryService` 已在 `core` 中落地
2. 已支持“prepare -> batch embed -> full replace -> upsert”主流程
3. `mcp-server` 的 container 已装配 `chunkPreparationService / embeddingProvider / chunkRepository / searchRepository / indexRepositoryService`
4. 已具备真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 链路集成测试

### 3.6 当前测试覆盖

当前已经落地并通过的测试包括：

1. 配置加载单元测试
2. 应用启动编排单元测试
3. `project_metadata` schema 轻量集成测试
4. `project_metadata` 仓储轻量集成测试
5. `SurrealClient` 真实集成测试
6. `project_metadata` 真实集成测试
7. `createApp()` 真实集成测试
8. `SurrealChunkRepository` 轻量集成测试
9. `SurrealChunkRepository` 真实集成测试
10. `SurrealSearchRepository` 轻量集成测试
11. `SurrealSearchRepository` 真实集成测试
12. `FallbackParser` 单元测试
13. `LocalFileScanner` 单元测试
14. `RepositoryChunkPreparationService` 单元测试
15. `ParserFactory` 单元测试
16. `MarkdownParser` 单元测试
17. `TypeScriptTreeSitterParser` 单元测试
18. `PythonTreeSitterParser` 单元测试
19. `RepositoryChunkPreparationService` 基于真实模板文件的集成测试
20. `DefaultIndexRepositoryService` 单元测试
21. 真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 集成测试

截至最近一次回归，以下验证已通过：

1. parser 相关 unit 测试 6 个文件通过，10 个测试通过
2. parser 相关 integration 测试 1 个文件通过，1 个测试通过
3. parser 相关测试、全量 `typecheck` 与全量 `build` 已串行通过
4. OpenAI-compatible provider 相关 unit 测试已通过
5. 真实 SurrealDB 环境下的启动链路、chunk/search 仓储和索引整链路测试已通过

## 4. 当前仍未完成内容

以下能力仍未真正落地：

1. JavaScript / JSX 等更多语言的 tree-sitter 语义解析支持
2. 基于数据库向量索引而不是应用侧余弦排序的检索优化
3. MCP tool server 与具体工具实现
4. 检索结果到 `ContextPacket` 的完整上下文组装服务
5. 面向真实外部 embedding 服务的端到端索引测试
6. parser metadata 的进一步增强，例如 decorator、visibility、import/export 等结构信息

## 5. 当前风险与注意点

### 5.1 风险点

1. `project_metadata` 与 chunk schema 已落地，但检索仍然是应用侧余弦相似度排序，不是数据库原生向量检索
2. `SurrealSearchRepository` 当前采用应用侧余弦相似度排序，不是数据库侧向量索引检索
3. 当前 parser 已具备 TypeScript、Python 和 Markdown 的第一版结构感知能力，但更多语言尚未覆盖
4. 当前已接入 Voyage 与 OpenAI-compatible provider，但真实第三方 provider 的端到端索引链路仍缺实网验证
5. `createApp()` 已经是异步启动流程，后续接入真实 MCP server 时必须正确 await
6. 当前 embedding provider 已支持 `voyage` 与 `openai-compatible`，但 provider 级重试、限流和并发控制仍较薄

### 5.2 开发注意事项

1. 后续新增存储表和索引时，应复用当前幂等 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 当前 tree-sitter 和 Markdown 解析能力都应继续限制在 `packages/infra`
5. 后续新增语言 parser 时，应复用当前 `ParserFactory + TreeSitterParser + fallback` 的分层模式
6. 后续若要提升吞吐，应优先增强 provider 的重试、退避和批次并发控制，而不是绕过当前索引服务抽象

### 5.3 embedding 领域决策

当前关于 `Chunk.embedding` 的领域决策如下：

1. 对最终系统语义来说，embedding 应该是必选
2. 对当前过渡代码来说，暂时保留为可选是可以接受的
3. 这种“过渡性可选”状态不应长期保留

原因是：

1. 项目的核心目标是为 Agent 提供基于 RAG 的代码检索能力
2. 真正进入索引与检索主链路的 chunk 最终都应具备 embedding
3. 当前之所以暂时保留为可选，只是为了在分阶段落地时保持模型迁移成本可控

后续收敛方向应为：

1. 在索引主流程稳定后，将 embedding 从“过渡性可选”收紧为“面向索引产物的必选字段”
2. 必要时区分“原始 chunk”和“已索引 chunk”模型，避免长期保持领域语义模糊

## 6. 下一步开发建议

建议按以下顺序继续推进。

### 6.1 第一优先级：实现 MCP tool 层与上下文服务

建议先完成：

1. `search-code-context-service`
2. `get-file-context-service`
3. MCP server 与 tool registration
4. index/search/file-context 三个 MCP tool 的输入输出适配

原因：

1. 当前索引写入主流程、provider、存储与 parser 都已经落地
2. 项目当前最大的缺口已经变成“能力已存在，但还没有真正通过 MCP 对外暴露”

### 6.2 第二优先级：增强检索与排序质量

建议内容：

1. 丰富 `SearchRepository` 可过滤 metadata
2. 引入更稳定的结果去重与轻量重排
3. 评估数据库侧向量索引能力，逐步替换应用侧余弦排序

### 6.3 第三优先级：扩展更多语言 parser

建议内容：

1. JavaScript / JSX
2. 更完整的 TS/TSX metadata 提取
3. Python 装饰器、类属性和更多语义结构提取

### 6.4 第四优先级：真实外部 provider 端到端验证

建议补齐：

1. 真实 OpenAI-compatible provider 的集成测试
2. 本地 SurrealDB + 实际 embedding provider 的整链路验证
3. provider 重试、超时和限流策略验证

## 7. 当前进度结论

当前项目已经越过“纯骨架”和“只有 fallback parser”的阶段，进入“索引主链路可运行、语义切块与文档结构化切块已落地”的阶段。

当前最合理的开发重点是：

1. 先把 MCP tool 层和上下文服务补齐
2. 再增强检索排序和数据库侧向量能力
3. 最后扩展更多语言 parser 与真实 provider 端到端验证
