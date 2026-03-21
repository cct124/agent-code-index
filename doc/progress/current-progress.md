# agent-code-index 当前进度

本文档记录当前仓库的运行状态、已经可验证的能力、尚未完成的缺口以及下一步开发建议。

## 1. 当前结论

截至 2026-03-21，当前项目已经从“可验证启动骨架”推进到“索引主链路可运行、真实存储与检索可验证、代码与 Markdown 智能 chunk 已落地”的阶段。

当前状态可以概括为：

1. v1 架构和工程基础已稳定
2. 配置模型与项目级 embedding 锁定已落地
3. `project_metadata` 启动链路已落地并通过真实 SurrealDB 验证
4. `SurrealChunkRepository` 和 `SurrealSearchRepository` 已完成第一版实现，并已切换到 native HNSW 优先的检索路径
5. `DefaultIndexRepositoryService` 已完成并接入应用容器
6. `EmbeddingProvider` contract、provider factory、`VoyageEmbeddingProvider` 与 `OpenAI-compatible provider` 已落地
7. parser 与 chunking 已从 fallback 主流程演进到“tree-sitter 代码语义解析 + Markdown 章节切块 + fallback 兜底”的完整第一版实现
8. 启动、索引、embedding、parser 与 Surreal 存储主链路的第一版结构化日志已落地，并引入统一错误分类与日志脱敏策略
9. 轻量集成测试、真实 SurrealDB 集成测试和基于真实模板文件的 parser 集成测试已覆盖当前主链路
10. `query text -> query embedding -> search` 的 core service 已落地，检索已升级为正式用例
11. MCP tool server 与具体工具实现仍未落地

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
4. native HNSW 候选窗口参数 `SEARCH_NATIVE_CANDIDATE_MULTIPLIER / SEARCH_NATIVE_EF_SEARCH_MIN` 已接入配置模型
5. Surreal 健康检查
6. `project_metadata` schema 初始化
7. 首次启动写入项目元数据
8. 二次启动时 embedding 配置锁定校验

### 3.2 Surreal 基础设施能力

当前已经可验证：

1. `DefaultSurrealClient` 连接、鉴权、健康检查
2. `SurrealProjectMetadataRepository` 真实读写
3. `SurrealChunkRepository` 批量写入、按仓库删除、按文件读取
4. `SurrealSearchRepository` 已切换为 native HNSW 优先检索，并保留应用层余弦 fallback
5. 当前 native 检索已采用“全部精确过滤条件数据库下推 + HNSW KNN”的主路径
6. native HNSW 候选窗口参数已支持通过配置注入
7. 已具备 `EXPLAIN FULL` 级别的真实环境验证，可校验 KnnScan 的 index、k、ef，以及多精确过滤条件已进入执行计划
8. Surreal client、chunk repository、search repository 已接入统一结构化日志
9. Surreal 存储主链路已具备 `errCode / retryable / httpStatus` 错误分类与日志脱敏策略
10. 当前已支持通过 `metadata -> searchText` 的轻量语义头增强，让代码结构语义真正进入向量化输入

### 3.3 parser 与 chunking 能力

当前已经可验证：

1. `LocalFileScanner` 的仓库递归扫描与基础忽略规则
2. `FallbackParser` 的固定窗口切块与重叠窗口切块
3. `TypeScriptTreeSitterParser` 已可提取 class、function、method、constructor、getter、setter、field、private field、default export 等语义结构
4. `JavaScriptTreeSitterParser` 已可提取 class、function、method、constructor、getter、setter、field、private field、default export 等语义结构
5. `PythonTreeSitterParser` 已可提取 class、top-level function、method、property getter/setter、classmethod、staticmethod、async method 和 `self.xxx` 实例字段
6. `MarkdownParser` 已可按标题章节切块，并补充 `heading / headingPath / sectionLevel / docType / frontmatter`
7. `ParserFactory` 已能按文件扩展名分派到 TypeScript、TSX、JavaScript、JSX、Python、Markdown 和 fallback parser
8. `RepositoryChunkPreparationService` 的“扫描目录 -> 读取文件 -> 产出 Chunk[]”主流程
9. 二进制文件跳过逻辑
10. 超大语义节点会自动回退到重叠窗口切块，而不是直接丢弃

### 3.4 embedding 能力

当前已经可验证：

1. `EmbeddingProvider` contract 已在 `core` 中定义
2. `createEmbeddingProvider` 已可按配置创建 provider
3. `VoyageEmbeddingProvider` 已具备最小 HTTP 调用能力
4. `OpenAICompatibleEmbeddingProvider` 已具备最小 HTTP 调用能力
5. provider factory 已支持 `voyage | openai-compatible`
6. `searchText` 已承载高信号 metadata 语义头，并作为 document embedding 的直接输入
7. 已补齐 opt-in 的真实 OpenAI-compatible / SiliconFlow provider 集成测试
8. `DefaultSearchCodeContextService` 已在 `core` 中落地，负责 `query text -> query embedding -> semantic search`

### 3.5 可观测性能力

当前已经可验证：

1. `core` 已定义跨包统一 `Logger` 抽象和标准日志字段约定
2. `mcp-server` 已使用 `pino` 作为统一日志实现
3. 开发态已支持 pretty 输出，生产态可直接输出结构化 JSON
4. 启动、索引、embedding、parser、Surreal client、chunk repository、search repository 已使用统一 child logger 模式
5. 日志默认避免输出 token、password、apiKey 等敏感字段

### 3.6 索引主链路能力

当前已经可验证：

1. `DefaultIndexRepositoryService` 已在 `core` 中落地
2. 已支持“prepare -> batch embed -> full replace -> upsert”主流程
3. `mcp-server` 的 container 已装配 `chunkPreparationService / embeddingProvider / chunkRepository / searchRepository / indexRepositoryService`
4. `mcp-server` 的 container 已装配 `searchCodeContextService`
5. 已具备真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 链路集成测试
6. 已具备真实 SurrealDB + OpenAI-compatible provider 的 `query text -> query embedding -> search` 正式用例验证

### 3.7 当前测试覆盖

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
22. `surreal-log-utils` 单元测试
23. `DefaultSurrealClient` 日志与错误分类单元测试
24. `chunk-utils` 的 searchText 语义增强单元测试
25. 真实 OpenAI-compatible provider 集成测试
26. 真实 SurrealDB + OpenAI-compatible provider 的 `prepare -> real embed -> upsert -> query embed -> search` 集成测试
27. `DefaultSearchCodeContextService` 单元测试
28. native HNSW 候选窗口配置项与注入路径单元测试
29. `SurrealSearchRepository` 的 native 窗口参数与非法配置校验测试
30. `SurrealSearchRepository` 的 `EXPLAIN FULL` 真实环境验证测试

截至最近一次回归，以下验证已通过：

1. parser 相关 unit 测试 6 个文件通过，10 个测试通过
2. parser 相关 integration 测试 1 个文件通过，1 个测试通过
3. parser 相关测试、全量 `typecheck` 与全量 `build` 已串行通过
4. OpenAI-compatible provider 相关 unit 测试已通过
5. 真实 SurrealDB 环境下的启动链路、chunk/search 仓储和索引整链路测试已通过
6. Surreal 存储层日志、错误分类和脱敏策略相关单元测试已通过
7. searchText 的 metadata 注入策略与 tags 检索过滤相关测试已通过
8. `DefaultSearchCodeContextService` 单元测试已通过
9. 开发用 SurrealDB 已在空库重部署后验证通过 `3.0.4`，项目级真实 HNSW 搜索链路可用
10. 在干净的 `3.0.4` 环境中，`repositoryId + 多个精确过滤条件 + HNSW KNN` 的最小复现场景与真实仓储测试均已通过
11. native HNSW 候选窗口参数配置化已完成，并通过 unit test 与真实 EXPLAIN FULL 测试验证
12. native 主路径已切换为“全部过滤数据库下推 + KNN”，并通过 unit test 与真实 EXPLAIN FULL 计划断言验证

## 4. 当前仍未完成内容

以下能力仍未真正落地：

1. 更多语言的 tree-sitter 语义解析支持，例如 Go / Java / Rust
2. 原生向量检索路径的进一步调优与回退策略收敛，例如更复杂过滤组合验证、`EF` 参数调优、候选窗口默认值调优与 fallback 收敛
3. MCP tool server 与具体工具实现
4. 检索结果到 `ContextPacket` 的完整上下文组装服务
5. Voyage provider 的实网端到端索引测试
6. parser metadata 的进一步增强，例如 imports、继承/implements、调用点与更完整的可见性/修饰信息
7. requestId / indexingRunId 等跨请求链路追踪字段尚未贯穿到全部模块

## 5. 当前风险与注意点

### 5.1 风险点

1. `SurrealSearchRepository` 已默认采用“全部精确过滤条件数据库下推 + HNSW KNN”的主路径，但复杂过滤组合、不同数据分布和更大候选窗口下的表现仍需继续验证
2. 开发环境从 `2.4.1` 切到 `3.0.4` 时无法直接复用旧 RocksDB 数据目录，后续若要做版本升级而不是空库重建，必须单独遵循官方升级路径
3. native 路径虽然已支持候选窗口参数配置化，并有 `EXPLAIN FULL` 真实测试兜底，但当前默认值仍属于经验值，不是基于真实数据集调优后的最优值
4. 当前 parser 已具备 TypeScript、TSX、JavaScript、JSX、Python 和 Markdown 的第一版结构感知能力，但更多语言尚未覆盖
5. 当前已接入 Voyage 与 OpenAI-compatible provider，其中 OpenAI-compatible / SiliconFlow 已具备 opt-in 的实网验证；Voyage 的实网端到端验证仍未补齐
6. `createApp()` 已经是异步启动流程，后续接入真实 MCP server 时必须正确 await
7. 当前 embedding provider 已支持 `voyage` 与 `openai-compatible`，但 provider 级重试、限流和并发控制仍较薄
8. 当前错误分类已覆盖第一版日志诊断需求，但尚未形成跨 provider / MCP / storage 的统一错误码文档

### 5.2 开发注意事项

1. 后续新增存储表和索引时，应复用当前幂等 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 当前 tree-sitter 和 Markdown 解析能力都应继续限制在 `packages/infra`
5. 后续新增语言 parser 时，应复用当前 `ParserFactory + TreeSitterParser + fallback` 的分层模式
6. 后续若要提升吞吐，应优先增强 provider 的重试、退避和批次并发控制，而不是绕过当前索引服务抽象
7. 日志中不应输出 token、password、apiKey、Authorization 等敏感字段，新增日志点应复用当前脱敏工具

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
3. 在 `3.0.4` 基线下继续评估更复杂过滤组合、`EXPLAIN` 观测、候选窗口参数调优与 fallback 收敛，逐步收紧 fallback 使用范围

### 6.3 第三优先级：扩展更多语言 parser

建议内容：

1. JavaScript / JSX
2. 更完整的 TS/TSX metadata 提取
3. Python 装饰器、类属性和更多语义结构提取

### 6.4 第四优先级：真实外部 provider 端到端验证

建议补齐：

1. 真实 OpenAI-compatible provider 的集成测试
2. Voyage provider 的本地 SurrealDB + 实际 embedding provider 整链路验证
3. provider 重试、超时和限流策略验证

## 7. 当前进度结论

当前项目已经越过“纯骨架”和“只有 fallback parser”的阶段，进入“索引主链路可运行、语义切块与文档结构化切块已落地”的阶段。

同时，Surreal 原生向量检索的 v1 基线也已经稳定：

1. 开发环境已完成 SurrealDB `3.0.4` 空库重部署验证
2. native HNSW 检索已作为默认路径接入
3. 多精确过滤条件场景已通过真实仓储测试回归
4. 候选窗口参数已完成配置化，并补齐 `EXPLAIN FULL` 真实验证
5. native 主路径已经切换为“全部过滤数据库下推 + KNN”

当前最合理的开发重点是：

1. 先把 MCP tool 层和上下文服务补齐
2. 再增强检索排序和数据库侧向量能力
3. 最后扩展更多语言 parser 与更多 provider 端到端验证
