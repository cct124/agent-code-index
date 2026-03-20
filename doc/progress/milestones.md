# agent-code-index 开发里程碑

本文档记录当前仓库已经完成的阶段性里程碑，重点描述“已经落地并可验证的成果”。

## 1. 里程碑概览

截至 2026-03-20，当前已完成的主要里程碑包括：

1. v1 架构设计与工程骨架完成
2. 配置模型与项目级元数据锁定落地
3. `project_metadata` schema 初始化与启动链路落地
4. 真实 SurrealDB 连接与启动验证落地
5. chunk/search 第一版真实存储与检索能力落地

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
2. 后续可以开始推进 schema/index、embedding 写入与索引服务闭环

## 7. 当前里程碑结论

截至当前，可以将阶段成果概括为：

1. 架构已定型
2. 配置已收敛
3. 项目级模型锁定已落地
4. 启动期 schema 初始化与元数据校验已落地
5. 真实数据库验证能力已建立
6. chunk/search 第一版存储与检索能力已落地

下一阶段不再是补工程骨架，而是把索引主链路真正闭环。
