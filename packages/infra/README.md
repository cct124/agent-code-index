# @agent-code-index/infra

`packages/infra` 是当前项目的基础设施模块，负责把 `core` 中定义的抽象接口落到具体技术实现上。

这一层的目标是承接所有外部系统和运行时依赖，包括：

1. SurrealDB
2. Embedding provider
3. 本地文件系统
4. 具体 parser 与 chunking 实现

因此，`infra` 的职责不是定义业务语义，而是提供“业务能力所需的具体实现”。

## 模块职责

当前 `infra` 主要承担四类职责：

1. 存储实现
2. embedding 实现
3. 扫描与解析实现
4. 对 `core` 抽象的技术适配

## 当前目录结构

```text
src/
  embedding/
  parsing/
  scanning/
  services/
  storage/
  index.ts
```

### embedding

负责 embedding provider 的具体实现与工厂选择，目前已包含：

1. `createEmbeddingProvider`
2. `VoyageEmbeddingProvider`

当前能力：

1. 支持按配置选择 provider
2. 已具备 Voyage 的最小 HTTP 调用实现
3. 已对 embedding 结果条数和维度做基础校验

### parsing

负责把文件内容切分为可索引 chunk，目前已包含：

1. `ParserFactory`
2. `FallbackParser`

当前能力：

1. `ParserFactory` 已按扩展名分派到 tree-sitter、Markdown 和 fallback parser
2. `FallbackParser` 支持固定窗口切块和重叠窗口切块
3. 已能识别基础文件类型并为 chunk 填充语言信息

### scanning

负责发现本地仓库中的候选文件，目前已包含：

1. `LocalFileScanner`

当前能力：

1. 支持递归扫描本地目录
2. 支持基础忽略规则
3. 返回稳定排序的候选文件列表

### services

负责对基础设施级流程做封装，目前已包含：

1. `RepositoryChunkPreparationService`

当前能力：

1. 对齐并实现了 `core` 中定义的 `RepositoryChunkPreparationService` 抽象
2. 串联“扫描目录 -> 读取文件 -> 选择解析器 -> 产出 PreparedChunk”主流程
3. 处理二进制文件跳过逻辑

### storage

负责 SurrealDB 相关实现，目前已包含：

1. `DefaultSurrealClient`
2. `SurrealChunkSchema`
3. `SurrealProjectMetadataSchema`
4. `SurrealProjectMetadataRepository`
5. `SurrealChunkRepository`
6. `SurrealSearchRepository`

当前能力：

1. 真实连接、鉴权与健康检查
2. `project_metadata` schema 初始化与仓储读写
3. chunk schema 初始化
4. chunk 的写入、删除和按文件读取
5. 基于已存储 embedding 的数据库原生向量搜索

## 当前已经实现的功能

截至当前，`infra` 已经具备以下能力。

### 1. Embedding Provider 实现

已实现：

1. provider factory
2. Voyage provider 最小实现
3. provider 单元测试

### 2. 扫描与切块实现

已实现：

1. 本地文件系统扫描
2. fallback 文本切块
3. 仓库 chunk 准备服务

### 3. Surreal 存储实现

已实现：

1. Surreal client
2. `project_metadata` schema 与 repository
3. chunk schema 与 repository
4. search repository

### 4. 真实环境验证

已实现：

1. 真实 SurrealDB 集成测试
2. chunk 与 search 的真实存储/检索测试
3. 索引主链路中的真实 Surreal 写入和搜索验证

## 当前边界

`infra` 当前明确不负责：

1. 定义领域对象和业务语义
2. 决定项目级业务规则
3. 暴露 MCP 协议入口
4. 处理协议参数映射和响应格式

这些职责应分别由 `core` 和 `mcp-server` 承担。

## 当前状态总结

从当前项目进度来看，`infra` 已经不再只是空骨架，而是已经具备：

1. 可运行的存储层实现
2. 可运行的 embedding provider 实现
3. 可运行的扫描与切块实现
4. 与 `core` 抽象对齐的技术适配能力

也就是说，当前 `infra` 已经承担起“把核心抽象落到真实技术实现”的职责，并为上层索引链路提供了实际可执行的技术基础。
