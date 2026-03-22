# agent-code-index 开发里程碑

本文档记录当前仓库已经完成的阶段性里程碑，重点描述“已经落地并可验证的成果”。

## 1. 里程碑概览

截至 2026-03-22，当前已完成的主要里程碑包括：

1. v1 架构设计与工程骨架完成
2. 配置模型与项目级元数据锁定落地
3. `project_metadata` schema 初始化与启动链路落地
4. 真实 SurrealDB 连接与启动验证落地
5. chunk/search 第一版真实存储与检索能力落地
6. 索引写入主流程落地
7. 多 provider embedding 接入能力落地
8. 代码 AST 解析与 Markdown 结构化 chunk 能力落地
9. 第一版结构化日志、错误分类与脱敏能力落地
10. metadata 驱动的 searchText 增强与 OpenAI-compatible / SiliconFlow 实网验证落地
11. `query text -> query embedding -> search` 正式检索用例落地
12. Surreal 原生向量检索迁移与 3.0.4 基线验证落地
13. VoyageAI 真实 embedding 兼容性验证落地
14. 真实 embedding provider 与 Surreal 端到端索引闭环验证落地
15. MCP tool server 与文件级增量索引能力落地

## 2. 里程碑一：架构设计与工程骨架完成

已完成：

1. `core / infra / mcp-server` 三包架构落地
2. Yarn 4 workspace 管理落地
3. TypeScript project references 打通
4. Prettier 接入并提供格式化命令
5. v1 设计文档形成并持续同步

该里程碑的意义是：

1. 明确了包级职责边界
2. 形成了后续扩展 parser、embedding、MCP tool 的稳定工程基础

## 3. 里程碑二：配置模型与项目级元数据锁定落地

已完成：

1. 运行时配置统一为项目级配置模型
2. 使用 `PROJECT_SPACE` 作为逻辑项目标识
3. `Surreal namespace` 由 `PROJECT_SPACE` 自动派生
4. embedding 配置统一收敛为 `EMBEDDING_*`
5. `ProjectMetadata` 领域模型与仓储契约落地
6. provider/model/vectorDimension 的项目级锁定校验落地

该里程碑的意义是：

1. 保证同一 `PROJECT_SPACE` 下不会混用 embedding 配置
2. 为后续索引与检索链路提供稳定的模型约束

## 4. 里程碑三：project_metadata 启动链路落地

已完成：

1. `SurrealProjectMetadataRepository` 落地
2. `SurrealProjectMetadataSchema` 落地
3. `createApp()` 启动阶段接入健康检查
4. `createApp()` 启动阶段接入 schema 初始化
5. `createApp()` 启动阶段接入元数据首次写入与二次校验
6. `project_metadata` schema 初始化已修正为幂等执行

该里程碑的意义是：

1. 当前应用启动链路已经具备真实环境可验证性
2. 后续新增存储表时可以复用相同的 schema initialization 模式

## 5. 里程碑四：真实 SurrealDB 验证能力落地

已完成：

1. `DefaultSurrealClient` 真实连接测试落地
2. `project_metadata` 真实仓储测试落地
3. `createApp()` 真实启动链路测试落地
4. Vitest workspace 包源码别名已补齐，测试运行时解析稳定
5. `healthCheck` 已修正为兼容当前 WebSocket RPC 连接方式的轻量查询验证

该里程碑的意义是：

1. 当前仓库已不再只依赖轻量 mock 测试
2. 关键启动与元数据链路已经在本机真实 SurrealDB 上通过验证

## 6. 里程碑五：chunk/search 第一版真实存储与检索能力落地

已完成：

1. `SurrealChunkRepository` 已实现 `upsertMany`
2. `SurrealChunkRepository` 已实现 `deleteByRepository`
3. `SurrealChunkRepository` 已实现 `findByFilePath`
4. `SurrealSearchRepository` 已实现 `semanticSearch`
5. chunk 仓储的轻量集成测试与真实 SurrealDB 集成测试已落地
6. search 仓储的轻量集成测试与真实 SurrealDB 集成测试已落地

当前这一版的实现特点是：

1. chunk 采用稳定 record id 写入
2. chunk 按 `startLine / endLine` 稳定排序返回
3. search contract 与持久化映射已经稳定
4. 该阶段的检索能力为后续 native 向量检索迁移提供了稳定的存储与查询映射基础

该里程碑的意义是：

1. 核心存储与检索主链路已经从占位状态进入可运行状态
2. 后续可以继续围绕索引服务、parser metadata 和数据库侧向量能力做增强

## 7. 里程碑六：索引写入主流程落地

已完成：

1. `PrepareRepositoryChunksInput / Result` 已在 `core` 中收敛
2. `IndexRepositoryInput / Result` 已在 `core` 中收敛
3. `DefaultIndexRepositoryService` 已完成并通过单元测试
4. 已支持 `embeddingBatchSize` 批处理
5. 已支持全量覆盖模式下的 `delete -> upsert`
6. `mcp-server` container 已完成 `indexRepositoryService` 装配
7. 已补齐真实 SurrealDB 环境下的 `prepare -> embed -> upsert -> search` 集成测试

该里程碑的意义是：

1. 项目已经具备真正可运行的索引写入闭环
2. 后续接入 MCP tool 时无需再回头补索引核心编排

## 8. 里程碑七：多 provider embedding 接入能力落地

已完成：

1. `EmbeddingProvider` contract 已在 `core` 中定义
2. `createEmbeddingProvider` 已在 `infra` 中落地
3. `VoyageEmbeddingProvider` 最小 HTTP 实现已落地
4. `OpenAICompatibleEmbeddingProvider` 最小 HTTP 实现已落地
5. provider factory 已支持 `voyage | openai-compatible`
6. `mcp-server` 配置层已支持 `EMBEDDING_PROVIDER=openai-compatible`
7. `.env.development` 已改为正式的 OpenAI-compatible provider 配置路径
8. provider factory、Voyage provider 与 OpenAI-compatible provider 单元测试已落地

该里程碑的意义是：

1. “文本 -> 向量”这一步不再完全缺失
2. 项目已不再被单一 provider 命名和接入路径绑定
3. 硅基流动这类 OpenAI-compatible embeddings 服务可以正式接入

## 9. 里程碑八：代码 AST 解析与 Markdown 结构化 chunk 能力落地

已完成：

1. `chunk-utils.ts` 已统一 chunk 创建、searchText 标准化、hash 计算和窗口切块工具
2. `TreeSitterParser` 公共基类已落地
3. `TypeScriptTreeSitterParser` 已支持 class、function、method、constructor、getter、setter、field 和 default export 提取
4. `JavaScriptTreeSitterParser` 已支持 class、function、method、constructor、getter、setter、field 和 default export 提取
5. `PythonTreeSitterParser` 已支持 property getter/setter、classmethod、staticmethod、async method 和实例字段提取
6. `MarkdownParser` 已支持标题章节切块
7. `markdown-section-chunker.ts` 已支持 `heading / headingPath / sectionLevel / docType / frontmatter` metadata
8. `ParserFactory` 已按扩展名分派到 TypeScript、TSX、JavaScript、JSX、Python、Markdown 和 fallback parser
9. `RepositoryChunkPreparationService` 已通过真实模板文件完成集成验证
10. parser 相关单元测试与集成测试已补齐并通过

该里程碑的意义是：

1. 项目已经从“统一 fallback 切块”演进到“语言感知 + 文档结构感知 + fallback 兜底”的完整第一版能力
2. 真实项目代码文件和 Markdown 文档的检索基础质量已显著提升

## 10. 里程碑九：第一版结构化日志、错误分类与脱敏能力落地

已完成：

1. `core` 已定义统一 `Logger` 抽象与标准字段约定
2. `mcp-server` 已引入 `pino` 作为统一日志实现
3. 启动、索引、embedding、parser 主链路已接入结构化日志
4. `DefaultSurrealClient`、`SurrealChunkRepository`、`SurrealSearchRepository` 已接入统一 child logger
5. Surreal 存储主链路已具备 `errCode / retryable / httpStatus` 错误分类
6. token、password、apiKey 等敏感字段已纳入统一脱敏策略
7. 日志、错误分类与脱敏相关单元测试已补齐

该里程碑的意义是：

1. 当前仓库已经具备第一版可用的运行时观测能力
2. 后续扩展 MCP tool 与上下文服务时，可以沿用统一日志字段和错误分类策略，而不是继续散落 `console` 输出

## 11. 里程碑十：metadata 驱动的 searchText 增强与 OpenAI-compatible / SiliconFlow 实网验证落地

已完成：

1. `chunk-utils.ts` 已支持将 language、symbolKind、symbolName、parentSymbol、部分高价值 tags、Markdown 文档信息拼入轻量语义头
2. `searchText` 已成为当前 document embedding 的统一增强输入
3. `SurrealSearchRepository` 已支持 `tags` 精确过滤
4. `OpenAICompatibleEmbeddingProvider` 已补齐 opt-in 的真实集成测试
5. 真实 SurrealDB + OpenAI-compatible provider 的 `prepare -> real embed -> upsert -> query embed -> search` 已完成整链路验证

该里程碑的意义是：

1. parser metadata 已不再只是“存下来”，而是开始真实进入向量化检索主链路
2. 当前项目已经可以用低成本的 SiliconFlow 模型做真实 embedding 验证

## 12. 里程碑十一：`query text -> query embedding -> search` 正式检索用例落地

已完成：

1. `DefaultSearchCodeContextService` 已在 `core` 中落地
2. 新 service 已统一封装 `query text -> query embedding -> semantic search`
3. `mcp-server` container 已装配 `searchCodeContextService`
4. service 单元测试已补齐
5. 真实 SurrealDB + OpenAI-compatible provider 的整链路验证已改为走正式 service，而不是调用方手工传 embedding

该里程碑的意义是：

1. 检索链路已经从“调用方自己先算 embedding 再传给 repository”升级为可复用的正式业务用例
2. 后续 MCP tool 与上下文服务可以直接依赖 core use case，而不是重复拼装 query embedding 流程

## 13. 里程碑十二：Surreal 原生向量检索迁移与 3.0.4 基线验证落地

已完成：

1. `SurrealChunkSchema` 已引入 HNSW 向量索引定义，并收敛 embedding 维度注入
2. `SurrealSearchRepository` 已切换为单一的 native HNSW 检索路径
3. 当前 native 路径已采用“全部精确过滤条件数据库下推 + HNSW KNN”的正式策略
4. 开发用 SurrealDB 已完成 `3.0.4` 空库重部署验证
5. 已确认旧 `2.4.1` 数据目录不能直接被 `3.0.4` 复用，开发环境需走空库重建或官方升级路径
6. `metadata` 字段 schema 已修正为兼容 `3.0.4` 的 `TYPE object FLEXIBLE` 语法顺序
7. 多精确过滤条件 + HNSW KNN 的最小复现场景与真实仓储测试均已通过
8. native 候选窗口参数已完成配置化，支持 `SEARCH_NATIVE_CANDIDATE_MULTIPLIER / SEARCH_NATIVE_EF_SEARCH_MIN`
9. 已补齐 `EXPLAIN FULL` 真实环境测试，可验证 KnnScan 的 index、k、ef
10. 已补齐“多精确过滤条件真实下推到 native KNN 查询计划”的真实测试与单元测试

该里程碑的意义是：

1. 仓库已经从“应用侧余弦排序”为主，演进到“数据库原生向量检索”为主的正式基线
2. `3.0.4` 已成为当前开发环境下经过真实测试验证的 Surreal 向量检索版本基线
3. 后续对更复杂过滤组合和候选窗口调优的工作，已经建立在真实可观测的数据库执行计划之上

## 14. 里程碑十三：VoyageAI 真实 embedding 兼容性验证落地

已完成：

1. 新增 `.env.development.voyageai` 作为 Voyage 本地测试环境模板
2. 新增 `VoyageEmbeddingProvider` 的真实集成测试
3. 已验证 document/query 两类 embedding 调用均能正常返回向量
4. 已确认当前 `VoyageEmbeddingProvider` 的模型、鉴权与维度校验路径可正常工作

该里程碑的意义是：

1. `voyage` provider 不再只有单元测试，而是具备真实 API 兼容性验证
2. Voyage provider 的模型、鉴权与维度校验路径已经具备真实环境基线

## 15. 里程碑十四：真实 embedding provider 与 Surreal 端到端索引闭环验证落地

已完成：

1. `index-repository.real.integration.test.ts` 已验证基于测试 provider 的 `prepare -> embed -> upsert -> search` 真实 SurrealDB 基线链路
2. `index-repository.real-embedding.integration.test.ts` 已验证 OpenAI-compatible provider 的 `prepare -> real embed -> upsert -> query embed -> search` 端到端链路
3. `index-repository.real-voyage.integration.test.ts` 已验证 Voyage provider 的 `prepare -> real embed -> upsert -> query embed -> search` 端到端链路
4. 两条真实 provider 路径都已经通过 `createApp()` 装配后的正式容器执行，而不是调用方手工拼装最小链路

该里程碑的意义是：

1. 项目当前不只验证了 provider API 兼容性，也验证了 provider、索引服务、Surreal 存储和检索之间的真实闭环
2. 后续工作重点可以从“补链路是否能跑通”转向“MCP 暴露、稳定性和检索质量增强”

## 16. 里程碑十五：MCP tool server 与文件级增量索引能力落地

已完成：

1. `IndexFilesService` 已在 `core` 中落地
2. `DeleteFilesService` 已在 `core` 中落地
3. `ChunkRepository.deleteByFilePaths(...)` 已落地
4. `RepositoryFileChunkPreparationService` 已在 `infra` 中落地
5. `packages/mcp-server` 已接入官方 MCP TypeScript SDK
6. 已实现真实 `McpServer` 创建与 stdio transport 启动入口
7. `index_repository`、`search_code_context`、`index_files`、`delete_files`、`get_file_context` 五个 tools 已注册并可调用
8. `repositoryId` / `rootPath` 默认回填已收敛为共享 resolver
9. MCP tool 注册与调用、文件级索引/删除、按文件删除仓储能力相关测试已补齐
10. `get_file_context` 已升级返回最小 `ContextPacket`，并补齐子进程 stdio smoke test

该里程碑的意义是：

1. 项目已经从“索引与检索能力存在，但未对 Agent 暴露”推进到“核心能力已可通过 MCP 正式调用”
2. 文件修改/删除场景已经具备增量索引能力，不再只支持全仓重建
3. 下一阶段的主要缺口已经收敛为 richer 上下文包组装与检索后处理

## 16. 当前里程碑结论

截至当前，可以将阶段成果概括为：

1. 架构已定型
2. 配置已收敛
3. 项目级模型锁定已落地
4. 启动期 schema 初始化与元数据校验已落地
5. 真实数据库验证能力已建立
6. chunk/search 第一版存储与检索能力已落地
7. 索引写入主流程已落地
8. 多 provider embedding 接入能力已落地
9. 代码 AST 解析与 Markdown 结构化 chunk 能力已落地
10. 第一版结构化日志、错误分类与脱敏能力已落地
11. metadata 驱动的 searchText 增强与 OpenAI-compatible / SiliconFlow 实网验证已落地
12. `query text -> query embedding -> search` 正式检索用例已落地
13. Surreal 原生向量检索迁移与 `3.0.4` 基线验证已落地
14. VoyageAI 真实 embedding 兼容性验证已落地
15. 真实 embedding provider 与 Surreal 端到端索引闭环验证已落地
16. MCP tool server 与文件级增量索引能力已落地

下一阶段不再是补工程骨架，而是先将现有检索能力收敛为正式 use case：

1. 将 richer 上下文包能力通过 MCP tool 与上下文服务对外暴露
2. 再增强 provider 稳定性、排序、更复杂过滤组合验证与候选窗口调优
