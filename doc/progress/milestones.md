# agent-code-index 开发里程碑

本文档记录当前仓库已经完成的阶段性里程碑，重点描述“已经落地并可验证的成果”。

## 1. 里程碑概览

截至 2026-03-21，当前已完成的主要里程碑包括：

1. v1 架构设计与工程骨架完成
2. 配置模型与项目级元数据锁定落地
3. `project_metadata` schema 初始化与启动链路落地
4. 真实 SurrealDB 连接与启动验证落地
5. chunk/search 第一版真实存储与检索能力落地
6. 索引写入主流程落地
7. 多 provider embedding 接入能力落地
8. 代码 AST 解析与 Markdown 结构化 chunk 能力落地
9. 第一版结构化日志、错误分类与脱敏能力落地

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
3. search 先按 `repositoryId + filters` 查询候选记录
4. search 在应用侧计算余弦相似度并截断 `topK`

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
3. `TypeScriptTreeSitterParser` 已支持 class、function、method 和函数值变量提取
4. `PythonTreeSitterParser` 已支持 class、top-level function 和 method 提取
5. `MarkdownParser` 已支持标题章节切块
6. `markdown-section-chunker.ts` 已支持 `heading / headingPath / sectionLevel / docType / frontmatter` metadata
7. `ParserFactory` 已按扩展名分派到 TypeScript、Python、Markdown 和 fallback parser
8. `RepositoryChunkPreparationService` 已通过真实模板文件完成集成验证
9. parser 相关单元测试与集成测试已补齐并通过

该里程碑的意义是：

1. 项目已经从“统一 fallback 切块”演进到“语言感知 + 文档结构感知 + fallback 兜底”的完整第一版能力
2. 真实项目代码文件和 Markdown 文档的检索基础质量已显著提升

## 10. 当前里程碑结论

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

## 11. 当前里程碑结论

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

下一阶段不再是补工程骨架，而是将现有能力通过 MCP tool 与上下文服务真正对外暴露。
