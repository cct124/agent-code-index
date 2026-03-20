# agent-code-index 当前进度

本文档记录当前仓库的运行状态、已经可验证的能力、尚未完成的缺口以及下一步开发建议。

## 1. 当前结论

截至 2026-03-20，当前项目已经从“可验证启动骨架”推进到“具备第一版真实存储与检索能力”的阶段。

当前状态可以概括为：

1. v1 架构和工程基础已稳定
2. 配置模型与项目级 embedding 锁定已落地
3. `project_metadata` 启动链路已落地并通过真实 SurrealDB 验证
4. `SurrealChunkRepository` 和 `SurrealSearchRepository` 已完成第一版实现
5. 轻量集成测试与真实 SurrealDB 集成测试已覆盖当前已落地链路
6. parser、embedding provider、索引主流程和 MCP tool 仍未落地

## 2. 当前项目结构

当前仓库采用 Yarn workspace 三包结构：

1. `packages/core`
2. `packages/infra`
3. `packages/mcp-server`

根目录当前还包括：

1. `design/v1/README.md`
2. `.env.example`
3. `vitest.config.ts`
4. `vitest.unit.config.ts`
5. `vitest.integration.config.ts`
6. `package.json`

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

### 3.3 当前测试覆盖

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

截至最近一次回归，集成测试结果为：

1. 9 个测试文件通过
2. 13 个测试通过

## 4. 当前仍未完成内容

以下能力仍未真正落地：

1. 仓库扫描实现
2. parser / tree-sitter 实现
3. embedding provider factory 与真实 embedding 调用链
4. chunk 切分与索引写入主流程
5. chunk/search 的正式 schema initialization 与索引定义
6. chunk 存储层自动写入 embedding 字段的完整闭环
7. 基于数据库向量索引的检索优化
8. MCP tool server 与具体工具实现
9. 真实 SurrealDB 环境下的端到端索引与检索测试

## 5. 当前风险与注意点

### 5.1 风险点

1. `project_metadata` schema 已具备幂等初始化，但 chunk/search 的正式 schema 与索引尚未落地
2. `SurrealSearchRepository` 当前采用应用侧余弦相似度排序，不是数据库侧向量索引检索
3. 当前 search 依赖候选记录中已有 `embedding` 字段，但 chunk 领域模型和写入主流程尚未把 embedding 正式打通
4. `createApp()` 已经是异步启动流程，后续接入真实 MCP server 时必须正确 await
5. 当前 embedding provider 仅支持 `voyage`，但配置模型已为扩展留口

### 5.2 开发注意事项

1. 后续新增存储表和索引时，应复用当前幂等 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 在实现索引主流程前，应先补齐 chunk/search 的 schema 与 embedding 存储模型

## 6. 下一步开发建议

建议按以下顺序继续推进。

### 6.1 第一优先级：补齐 chunk/search 的 schema 与 embedding 存储模型

建议先完成：

1. chunk 相关表结构定义
2. embedding 字段定义
3. 必要索引定义
4. 启动期 schema initialization 接入

原因：

1. 当前 chunk/search 虽已实现第一版行为，但底层 schema 仍未正式固化
2. 如果不先补 schema 和 embedding 存储模型，索引主流程无法稳定闭环

### 6.2 第二优先级：实现 parser 与 chunking 主流程

建议内容：

1. 在 `infra/parsing` 下接入 tree-sitter
2. 先支持 TypeScript 与 Python
3. 建立 parser factory
4. 实现 fallback parser
5. 定义 chunking 规则与 searchText 生成规则

### 6.3 第三优先级：实现 embedding provider factory 与真实 provider 调用

建议内容：

1. 定义 `EmbeddingProvider` contract
2. 新增 provider factory
3. 接入 Voyage client
4. 将 `EMBEDDING_*` 配置与 provider 初始化打通

### 6.4 第四优先级：实现索引与检索服务

当 parser、embedding 和 repository 都具备后，建议实现：

1. `index-repository-service`
2. `search-code-context-service`
3. `get-file-context-service`

### 6.5 第五优先级：实现 MCP tool 层

建议最后接入：

1. MCP server
2. index tool
3. search tool
4. file context tool

## 7. 当前进度结论

当前项目已经越过“纯骨架”和“只靠 mock 测试”的阶段，进入“核心存储与检索能力开始真实落地”的阶段。

当前最合理的开发重点是：

1. 先补齐 chunk/search schema 与 embedding 存储闭环
2. 再推进 parser、embedding provider 和索引服务
3. 最后接入 MCP tool 层
