# agent-code-index 当前进度

本文档记录当前仓库的运行状态、已经可验证的能力、尚未完成的缺口以及下一步开发建议。

## 1. 当前结论

截至 2026-03-23，当前项目已经从“可验证启动骨架”推进到“索引与检索主链路可运行、真实存储与真实 embedding provider 端到端可验证、代码与 Markdown 智能 chunk 已落地，并已通过 MCP stdio 暴露核心工具”的阶段。

当前状态可以概括为：

1. v1 架构和工程基础已稳定
2. 配置模型与项目级 embedding 锁定已落地
3. `project_metadata` 启动链路已落地并通过真实 SurrealDB 验证
4. `SurrealChunkRepository` 和 `SurrealSearchRepository` 已完成第一版实现，并已切换到数据库原生 HNSW 检索路径
5. `DefaultIndexRepositoryService` 已完成并接入应用容器
6. `EmbeddingProvider` contract、provider factory、`VoyageEmbeddingProvider` 与 `OpenAI-compatible provider` 已落地
7. parser 与 chunking 已从 fallback 主流程演进到“tree-sitter 代码语义解析 + Markdown 章节切块 + fallback 兜底”的完整第一版实现
8. 启动、索引、embedding、parser 与 Surreal 存储主链路的第一版结构化日志已落地，并引入统一错误分类与日志脱敏策略
9. `mcp-server` 已支持通过环境变量把日志额外落盘到本地文件，默认写结构化 JSON，并可按配置切换为 pretty 文件日志
10. 轻量集成测试、真实 SurrealDB 集成测试和基于真实模板文件的 parser 集成测试已覆盖当前主链路
11. `query text -> query embedding -> search` 的 core service 已落地，检索已升级为正式用例
12. VoyageAI 真实 embedding 兼容性已补齐验证
13. OpenAI-compatible 与 Voyage 两条 provider 路径都已具备本地 SurrealDB 端到端索引与检索验证
14. `index_repository`、`search_code_context`、`index_files`、`delete_files`、`get_file_context` 已通过 MCP tool server 对外暴露
15. `search_code_context` 已升级为 `results + richer ContextPacket` 双轨输出，并具备相邻 chunk 合并、文件聚合和 token budget 驱动的 `max_items` 截断
16. `index_repository` 与 `index_files` 已支持 `embeddingConcurrency`，索引阶段已从串行批处理演进到固定 worker pool 并发批处理
17. 扫描链路已支持通过 `DEFAULT_SCAN_GITIGNORE_PATH` 注入根 `.gitignore` 规则，并可在未显式配置时自动从 `MCP_REPOSITORY_ROOT/.gitignore` 或 `process.cwd()/.gitignore` 发现排除规则，减少构建产物与日志文件对 RAG 数据库的污染
18. 以“索引、检索、文件级更新、文件上下文读取、MCP 暴露”作为 v1 功能闭环来看，当前实现已经达到可定版状态
19. 本地开发态 `mcp:dev + openai-compatible + Qwen/Qwen3-Embedding-8B` 配置已完成 live 验证，`index_files` 与 `index_repository` 均已确认支持 `DEFAULT_EMBEDDING_BATCH_SIZE / DEFAULT_EMBEDDING_CONCURRENCY` 默认值回填与显式参数覆盖
20. logger 已修正 `Error` 字段序列化行为，启动或 tool 异常现在可直接在日志中看到 `message` 与 `stack`

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
4. `SurrealChunkRepository` 按文件列表删除
5. `SurrealSearchRepository` 已收敛为单一的 native HNSW 检索路径
6. 当前 native 检索已采用“全部精确过滤条件数据库下推 + HNSW KNN”的正式基线
7. native HNSW 候选窗口参数已支持通过配置注入
8. 已具备 `EXPLAIN FULL` 级别的真实环境验证，可校验 KnnScan 的 index、k、ef，以及多精确过滤条件已进入执行计划
9. Surreal client、chunk repository、search repository 已接入统一结构化日志
10. Surreal 存储主链路已具备 `errCode / retryable / httpStatus` 错误分类与日志脱敏策略
11. 当前已支持通过 `metadata -> searchText` 的轻量语义头增强，让代码结构语义真正进入向量化输入

### 3.3 parser 与 chunking 能力

当前已经可验证：

1. `LocalFileScanner` 的仓库递归扫描与基础忽略规则
2. `FallbackParser` 的固定窗口切块与重叠窗口切块
3. `TypeScriptTreeSitterParser` 已可提取 class、function、method、constructor、getter、setter、field、private field、default export 等语义结构
4. `JavaScriptTreeSitterParser` 已可提取 class、function、method、constructor、getter、setter、field、private field、default export 等语义结构
5. `PythonTreeSitterParser` 已可提取 class、top-level function、method、property getter/setter、classmethod、staticmethod、async method 和 `self.xxx` 实例字段
6. `MarkdownParser` 已可按标题章节切块，并补充 `heading / headingPath / sectionLevel / docType / frontmatter`
7. `ParserFactory` 已能按文件扩展名分派到 TypeScript、TSX、JavaScript、JSX、Python、Markdown 和 fallback parser
8. `RepositoryChunkPreparationService` 的“扫描目录 -> 读取文件 -> 产出 PreparedChunk[]”主流程
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
8. 已补齐基于 `.env.development.voyageai` 的 VoyageAI 真实兼容性测试
9. `DefaultSearchCodeContextService` 已在 `core` 中落地，负责 `query text -> query embedding -> semantic search`

### 3.5 MCP tool 能力

当前已经可验证：

1. `packages/mcp-server` 已接入官方 MCP TypeScript SDK
2. 已可创建真实 `McpServer` 并通过 stdio transport 启动
3. `index_repository` 已完成 adapter 注册与调用映射
4. `search_code_context` 已完成 adapter 注册与调用映射
5. `index_files` 已完成 adapter 注册与调用映射
6. `delete_files` 已完成 adapter 注册与调用映射
7. `repositoryId` / `rootPath` 默认回填已收敛为共享 resolver
8. `get_file_context` 已完成 adapter 注册与调用映射，并返回最小 `ContextPacket`
9. `search_code_context` 已接入 `ContextBuilder`，统一产出 richer `ContextPacket`
10. tool 输入校验、参数清洗和错误结果映射已形成第一版实现
11. `embeddingBatchSize` / `embeddingConcurrency` 已支持通过 `DEFAULT_EMBEDDING_BATCH_SIZE / DEFAULT_EMBEDDING_CONCURRENCY` 以环境变量方式配置 tool 默认值

### 3.6 可观测性能力

当前已经可验证：

1. `core` 已定义跨包统一 `Logger` 抽象和标准日志字段约定
2. `mcp-server` 已使用 `pino` 作为统一日志实现
3. 开发态已支持 pretty 输出，生产态可直接输出结构化 JSON
4. 已支持通过 `LOG_FILE_PATH` 额外将日志落盘到本地文件，默认写结构化 JSON，并可用 `LOG_FILE_PRETTY=true` 切换为 pretty 文件日志
5. 启动、索引、embedding、parser、Surreal client、chunk repository、search repository 已使用统一 child logger 模式
6. 日志默认避免输出 token、password、apiKey 等敏感字段
7. 当日志字段中出现 `Error` 时，当前 logger 会稳定序列化 `name / message / stack`，便于定位启动失败与 provider 调用异常

### 3.7 索引主链路能力

当前已经可验证：

1. `DefaultIndexRepositoryService` 已在 `core` 中落地
2. 已支持“prepare -> batch embed -> full replace -> upsert”主流程
3. `mcp-server` 的 container 已装配 `chunkPreparationService / fileChunkPreparationService / embeddingProvider / chunkRepository / searchRepository`
4. `mcp-server` 的 container 已装配 `indexRepositoryService / searchCodeContextService / indexFilesService / deleteFilesService`
5. 已具备真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 链路集成测试
6. 已具备真实 SurrealDB + OpenAI-compatible provider 的 `query text -> query embedding -> search` 正式用例验证
7. 已具备真实 SurrealDB + Voyage provider 的 `prepare -> real embed -> upsert -> query embed -> search` 端到端验证
8. `index_repository` 与 `index_files` 已支持 `embeddingBatchSize + embeddingConcurrency` 双参数，embedding 批次会按固定 worker pool 并发执行，同时保留批次结果顺序
9. `index_repository` 当前默认仍采用 `full` 覆盖式重建语义，但删除旧数据发生在全部新 embedding 生成完成之后，避免在 embedding 失败时误删旧索引
10. `LocalFileScanner` 已支持合并根 `.gitignore` 规则，能自动排除 `dist`、`*.tsbuildinfo`、`.logs` 等构建与运行产物，降低 RAG 数据污染与 provider 400 风险

### 3.8 当前测试覆盖

当前已经落地的测试覆盖可以归纳为：

1. `mcp-server` 启动层的配置加载、应用装配与真实启动链路测试
2. `mcp-server` 的 MCP tool 注册、`listTools` 与 `callTool` 适配测试
3. `core` 层的 `DefaultIndexRepositoryService`、`DefaultSearchCodeContextService`、`DefaultIndexFilesService`、`DefaultDeleteFilesService` 单元测试
4. `infra` 层的 provider factory、Voyage provider、OpenAI-compatible provider 单元测试
5. OpenAI-compatible provider 与 Voyage provider 的 opt-in 真实 embedding 集成测试
6. `FallbackParser`、`ParserFactory`、`MarkdownParser`、TypeScript / JavaScript / Python tree-sitter parser 单元测试
7. `LocalFileScanner`、`RepositoryChunkPreparationService`、`RepositoryFileChunkPreparationService` 的单元测试
8. `RepositoryChunkPreparationService` 基于真实模板文件的集成测试
9. `SurrealChunkSchema`、`project_metadata` schema 与 repository 的轻量集成测试
10. `DefaultSurrealClient`、`SurrealChunkRepository`、`SurrealSearchRepository` 的轻量集成测试与真实 SurrealDB 集成测试
11. `surreal-log-utils`、`chunk-utils` 与 Surreal client 错误分类/日志相关单元测试
12. 真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 基线链路测试
13. 真实 SurrealDB + OpenAI-compatible provider 的 `prepare -> real embed -> upsert -> query embed -> search` 集成测试
14. 真实 SurrealDB + Voyage provider 的 `prepare -> real embed -> upsert -> query embed -> search` 集成测试
15. 子进程 stdio MCP smoke test 已验证真实 transport 接入与 `get_file_context` 调用
16. `search_code_context` 与 `get_file_context` 的 `ContextPacket` 相关单元测试已通过
17. `embeddingConcurrency` 并发批处理相关单元测试已通过
18. `.gitignore` 规则注入、自动发现与扫描忽略回退相关单元测试已通过

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
13. VoyageAI 真实 embedding 兼容性测试已通过，document/query 两类向量生成均正常
14. Voyage + Surreal 的真实 `prepare -> real embed -> upsert -> query embed -> search` 端到端测试已补齐
15. 自动发现 `.gitignore` 的 live 配置下，完整 `index_repository` 已重新验证通过，且语义检索结果中已不再混入 `.logs/agent-code-index.log`
16. 本地开发态 `corepack yarn mcp:dev` 配置下，`index_files` 已 live 验证默认使用 `DEFAULT_EMBEDDING_BATCH_SIZE=16` 与 `DEFAULT_EMBEDDING_CONCURRENCY=8`
17. 同一环境下，显式传入 `embeddingBatchSize=4` 与 `embeddingConcurrency=2` 已验证会覆盖环境默认值
18. 同一环境下，`index_repository` 已在 `16 / 8` 默认配置下完成一次全量索引，结果为 `scannedFileCount=156`、`parsedFileCount=156`、`preparedChunkCount=1340`、`storedChunkCount=1340`、`failedFileCount=0`

## 4. 当前未纳入 v1 定版阻塞的增强项

以下能力仍值得继续做，但当前判断不属于 v1 定版阻塞项：

1. 更多语言的 tree-sitter 语义解析支持，例如 Go / Java / Rust
2. 原生向量检索路径的进一步调优，例如更复杂过滤组合验证、`EF` 参数调优与候选窗口默认值调优
3. richer `ContextBuilder` 的下一阶段能力，例如跨文件重排、query-aware summarization 与更细粒度预算分配
4. parser metadata 的进一步增强，例如 imports、继承/implements、调用点与更完整的可见性/修饰信息
5. provider 级重试、超时、限流仍未形成正式能力；当前已落地的是索引服务层的批次并发控制，不等价于 provider 自身具备完整可靠性治理
6. provider / MCP / storage 跨模块统一错误码文档仍未形成
7. requestId / indexingRunId 等跨请求链路追踪字段尚未贯穿到全部模块

## 5. 当前风险与注意点

### 5.1 风险点

1. `SurrealSearchRepository` 已默认采用“全部精确过滤条件数据库下推 + HNSW KNN”的单一路径，但复杂过滤组合、不同数据分布和更大候选窗口下的表现仍需继续验证
2. 开发环境从 `2.4.1` 切到 `3.0.4` 时无法直接复用旧 RocksDB 数据目录，后续若要做版本升级而不是空库重建，必须单独遵循官方升级路径
3. native 路径虽然已支持候选窗口参数配置化，并有 `EXPLAIN FULL` 真实测试兜底，但当前默认值仍属于经验值，不是基于真实数据集调优后的最优值
4. 当前 parser 已具备 TypeScript、TSX、JavaScript、JSX、Python 和 Markdown 的第一版结构感知能力，但更多语言尚未覆盖
5. 当前已接入 Voyage 与 OpenAI-compatible provider，两条 provider 路径的真实 embedding 兼容性与本地 SurrealDB 端到端索引验证都已补齐，索引层并发能力也已落地，但 provider 级可靠性治理仍较薄
6. `createApp()` 已经是异步启动流程，当前 stdio MCP server 已正确 await；后续新增 transport 时仍需保持这一约束
7. 当前 embedding provider 已支持 `voyage` 与 `openai-compatible`，但 provider 级重试、超时、限流和并发控制仍未形成正式策略
8. 当前错误分类已覆盖第一版日志诊断需求，但尚未形成跨 provider / MCP / storage 的统一错误码文档
9. `PROJECT_SPACE` 一旦已绑定某组 embedding 元数据，切换到新的 provider/model/vectorDimension 时仍需使用新的 `PROJECT_SPACE` 或主动清理旧元数据；这一保护行为本周已在 live 启动验证中再次确认

### 5.2 开发注意事项

1. 后续新增存储表和索引时，应复用当前幂等 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 当前 tree-sitter 和 Markdown 解析能力都应继续限制在 `packages/infra`
5. 后续新增语言 parser 时，应复用当前 `ParserFactory + TreeSitterParser + fallback` 的分层模式
6. 后续若要继续提升吞吐，应优先在现有 `embeddingConcurrency` 能力基础上增强 provider 的重试、退避、限流和并发保护，而不是绕过当前索引服务抽象
7. 日志中不应输出 token、password、apiKey、Authorization 等敏感字段，新增日志点应复用当前脱敏工具

### 5.3 embedding 领域决策

当前关于 chunk 模型的领域决策如下：

1. `PreparedChunk` 只用于解析与切块阶段，不包含 embedding
2. `Chunk` 只用于已完成 embedding 的存储与检索阶段，embedding 为必选字段
3. 索引主链路通过显式的类型分层区分“待嵌入产物”和“可检索产物”

这样做的原因是：

1. 项目的核心目标是为 Agent 提供基于 RAG 的代码检索能力
2. 真正进入存储与检索主链路的 chunk 必须具备 embedding
3. 解析阶段与检索阶段使用不同类型，能够避免长期保持领域语义模糊

## 6. v1 定版判断与后续建议

### 6.1 是否可以定版 v1

当前结论：可以定版 v1。

判断依据：

1. 核心主链路已经闭环：扫描、切块、embedding、存储、检索、MCP tool 暴露都已落地
2. v1 对外最重要的 5 个 tools 已实现并可调用：`index_repository`、`search_code_context`、`index_files`、`delete_files`、`get_file_context`
3. `search_code_context` 与 `get_file_context` 已形成统一的 `ContextPacket` 出口，不再只是临时返回结构
4. `voyage` 与 `openai-compatible` 两条 provider 路径都已具备真实环境验证
5. SurrealDB `3.0.4` 下的 native HNSW 检索已经成为单一路径，并通过真实测试回归
6. 索引批次并发能力与 `.gitignore` 动态注入/自动发现能力都已落地，并通过单元测试与 live MCP 验证
7. 当前全量 `typecheck` 已通过，最近一次全量 unit tests 也已通过
8. 本地开发态 `mcp:dev`、Qwen embedding 路径、默认并发参数回填以及显式覆盖行为均已完成 live 验证

因此，如果 v1 的目标是“功能完整、架构稳定、可本地接入 MCP 的第一版”，当前已经满足。

但如果目标是“生产级 v1”，仍建议在发布标签前至少补一轮 provider 稳定性和错误模型收口。

### 6.2 后续建议

建议按以下顺序继续推进。

### 6.2 第一优先级：provider 稳定性与工程化收口

如果已经定版 v1，下一阶段更建议转入 v1.1，而不是继续扩大 v1 范围。

建议内容：

1. provider 重试、超时和限流策略验证
2. provider 级错误分类与日志字段统一
3. `.env.development.*` 使用说明与本地测试手册

原因：

1. 当前底层索引、检索与两条 provider 路径都已闭环，最大的次级风险已经从“能力缺失”转成“运行稳定性不足”
2. 这类问题会直接影响 v1 的可运维性，但不要求继续扩张 v1 的功能边界

### 6.3 第二优先级：增强检索质量与上下文后处理

建议先完成：

1. 在现有 richer ContextBuilder 之上继续补跨文件重排与 query-aware summarization
2. 继续收敛 get_file_context 与 search_code_context 的统一上下文包策略
3. 继续增强检索后的预算分配、上下文说明字段与主输出契约稳定性

原因：

1. 当前索引写入主流程、provider、存储、parser、5 个 MCP tools 和 search/file 双 `ContextPacket` 都已经落地
2. 项目当前最大的缺口已经收敛为“更高级的上下文重排与检索后处理质量仍需继续增强”

建议交付物：

1. 一版跨文件重排或 query-aware summarization 策略
2. 一组更稳定的 ContextPacket 主输出契约约束

### 6.4 第三优先级：增强检索质量与 native 路径调优

建议内容：

1. 丰富 `SearchRepository` 可过滤 metadata
2. 引入更稳定的结果去重与轻量重排
3. 在 `3.0.4` 基线下继续评估更复杂过滤组合、`EXPLAIN` 观测与候选窗口参数调优

建议交付物：

1. 一组基于真实数据分布的候选窗口与 `EF` 调优结论
2. 至少一版轻量去重或重排策略验证

### 6.5 第四优先级：扩展更多语言 parser 与 metadata 深度

建议内容：

1. 更完整的 TS/TSX metadata 提取
2. Python 装饰器、类属性和更多语义结构提取
3. 新增 Go / Java / Rust 中至少一门语言的 tree-sitter parser

建议交付物：

1. 至少一门新增语言的 parser + 单元测试
2. TS/Python 现有 parser 的 metadata 扩展用例

## 7. 当前进度结论

当前项目已经越过“纯骨架”和“只有 fallback parser”的阶段，进入“索引与检索主链路可运行、语义切块与文档结构化切块已落地、真实 provider 端到端验证已补齐、核心 MCP tools 已可调用”的阶段。

同时，Surreal 原生向量检索的 v1 基线也已经稳定：

1. 开发环境已完成 SurrealDB `3.0.4` 空库重部署验证
2. native HNSW 检索已作为唯一检索路径接入
3. 多精确过滤条件场景已通过真实仓储测试回归
4. 候选窗口参数已完成配置化，并补齐 `EXPLAIN FULL` 真实验证
5. native 主路径已经切换为“全部过滤数据库下推 + KNN”
6. `PreparedChunk` 与 `Chunk` 的语义边界已明确收紧

当前最合理的开发重点是：

1. 以当前实现定版 v1
2. 后续按 v1.1 优先补齐 provider 稳定性、错误分类与本地测试手册
3. 然后增强上下文后处理、检索排序、过滤能力与 native 参数调优
4. 最后扩展更多语言 parser 与 metadata 深度
