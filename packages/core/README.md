# @agent-code-index/core

`packages/core` 是当前项目的核心业务模块，负责定义稳定的领域模型、抽象接口和核心用例编排。

这一层的目标是把“代码索引与检索系统真正关心的业务语义”从具体技术实现中分离出来。

因此，`core` 只描述“系统需要什么能力”和“业务链路如何编排”，不直接依赖以下内容：

1. SurrealDB
2. Voyage 或其他向量模型 SDK
3. 本地文件系统
4. MCP 协议对象与服务器实现

## 模块职责

当前 `core` 主要承担三类职责：

1. 定义领域模型
2. 定义外部依赖 contract
3. 定义索引主链路的核心服务编排边界

## 当前目录结构

```text
src/
  contracts/
  domain/
  services/
  index.ts
```

### contracts

用于定义 `core` 对外部能力的抽象依赖，目前已包含：

1. `ChunkRepository`
2. `SearchRepository`
3. `ProjectMetadataRepository`
4. `EmbeddingProvider`
5. `FileScanner`
6. `Parser`

这些接口由 `infra` 层实现，`core` 本身不关心具体实现来自 Surreal、本地文件系统还是第三方 embedding provider。

### domain

用于定义系统中的核心业务对象，目前已包含：

1. `PreparedChunk`
2. `Chunk`
3. `ProjectMetadata`
4. `SearchResult`

其中：

1. `PreparedChunk` 表示解析与切块阶段产出的待嵌入单元
2. `Chunk` 表示已完成 embedding、可直接存储和检索的单元
3. `ProjectMetadata` 用于锁定项目级 embedding 配置
4. `SearchResult` 表示语义检索返回结果

### services

用于定义核心用例编排。目前已经落地：

1. `DefaultIndexRepositoryService`

该服务负责串联以下业务步骤：

1. 调用仓库 chunk 准备服务生成待索引 `PreparedChunk`
2. 按批次调用 `EmbeddingProvider` 生成向量
3. 将结果收紧为带 embedding 的 `Chunk / IndexedChunk`
4. 调用 `ChunkRepository` 执行全量覆盖式写入

## 当前已经实现的功能

截至当前，`core` 已经具备以下能力。

### 1. 领域模型定义

已实现：

1. `PreparedChunk`
2. `Chunk`
3. `ChunkMetadata`
4. `ProjectMetadata`
5. `SearchResult`

### 2. 外部依赖抽象定义

已实现：

1. chunk 存储接口
2. 语义搜索接口
3. 项目元数据仓储接口
4. embedding provider 接口
5. 文件扫描接口
6. 文件解析接口

### 3. 索引主链路模型定义

已实现：

1. `PrepareRepositoryChunksInput`
2. `PrepareRepositoryChunksResult`
3. `RepositoryChunkPreparationService`
4. `IndexRepositoryInput`
5. `IndexRepositoryResult`
6. `IndexRepositoryFailure`
7. `IndexedChunk`
8. `IndexRepositoryService`

这些模型用于描述从“仓库内容”到“可写入索引的 chunk”这条主链路中的输入、输出和中间产物。

当前语义分层为：

1. `PreparedChunk` 用于 parser / chunk preparation 阶段
2. `Chunk` 与 `IndexedChunk` 用于 embedding 完成后的持久化与检索阶段

### 4. 默认索引服务实现

已实现：

1. `DefaultIndexRepositoryService`

当前实现特点：

1. 支持按批次生成 embedding
2. 当前默认使用串行批处理，而非多批次并发
3. 当前只定义 `full` 模式，即按仓库全量覆盖写入
4. 返回稳定的索引统计结果与失败文件列表

## 当前边界

`core` 当前明确不负责：

1. 具体扫描本地目录
2. 具体解析 TypeScript、Python 或 Markdown
3. 调用真实 Voyage HTTP 接口
4. 执行 SurrealDB 写入与查询
5. 暴露 MCP tools

这些能力都应由 `infra` 或 `mcp-server` 提供。

## 当前状态总结

从当前项目进度来看，`core` 已经不再只是纯类型占位层，而是已经具备：

1. 稳定的领域对象定义
2. 较完整的外部依赖抽象
3. 索引主链路的输入输出模型
4. 一个可运行的默认索引服务实现

也就是说，当前 `core` 已经承担起“定义业务边界”和“编排索引主流程”的职责，而具体技术实现继续留在 `infra` 和 `mcp-server` 中。
