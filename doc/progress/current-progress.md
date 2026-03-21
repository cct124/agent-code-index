# agent-code-index 当前进度

本文档记录当前仓库的运行状态、已经可验证的能力、尚未完成的缺口以及下一步开发建议。

## 1. 当前结论

截至 2026-03-21，当前项目已经从“可验证启动骨架”推进到“具备第一版真实存储、检索与最小 embedding 接入能力”的阶段。

当前状态可以概括为：

1. v1 架构和工程基础已稳定
2. 配置模型与项目级 embedding 锁定已落地
3. `project_metadata` 启动链路已落地并通过真实 SurrealDB 验证
4. `SurrealChunkRepository` 和 `SurrealSearchRepository` 已完成第一版实现
5. parser 与 chunking 第一版主流程已落地
6. `EmbeddingProvider` contract、provider factory 与 `VoyageEmbeddingProvider` 最小实现已落地
7. 轻量集成测试与真实 SurrealDB 集成测试已覆盖当前已落地链路
8. 完整索引写入编排和 MCP tool 仍未落地

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

### 3.3 parser 与 chunking 能力

当前已经可验证：

1. `LocalFileScanner` 的仓库递归扫描与基础忽略规则
2. `FallbackParser` 的固定窗口切块与重叠窗口切块
3. `RepositoryChunkPreparationService` 的“扫描目录 -> 读取文件 -> 产出 Chunk[]”主流程
4. 二进制文件跳过逻辑

### 3.4 embedding 能力

当前已经可验证：

1. `EmbeddingProvider` contract 已在 `core` 中定义
2. `createEmbeddingProvider` 已可按配置创建 provider
3. `VoyageEmbeddingProvider` 已具备最小 HTTP 调用能力
4. provider factory 与 Voyage provider 单元测试已落地

### 3.5 当前测试覆盖

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

截至最近一次回归：

1. unit 测试 5 个测试文件通过，12 个测试通过
2. 默认 integration 测试 5 个测试文件通过，7 个测试通过，5 个真实测试跳过
3. 启用真实 SurrealDB 后 integration 测试 10 个测试文件通过，14 个测试通过

## 4. 当前仍未完成内容

以下能力仍未真正落地：

1. tree-sitter 驱动的语言感知 parser 实现
2. embedding 批量生成并写入存储的完整索引编排
3. 基于数据库向量索引的检索优化
4. MCP tool server 与具体工具实现
5. 真实 SurrealDB 环境下的端到端索引与检索测试
6. Markdown-aware parser 的结构化实现

## 5. 当前风险与注意点

### 5.1 风险点

1. `project_metadata` schema 已具备幂等初始化，但 chunk/search 的正式 schema 与索引尚未落地
2. `SurrealSearchRepository` 当前采用应用侧余弦相似度排序，不是数据库侧向量索引检索
3. parser 当前仍然是 fallback 策略，尚未具备 AST 级语言感知切块能力
4. 当前虽已接入最小 embedding provider，但索引主流程仍缺“扫描 -> 切块 -> 向量生成 -> 存储写入”的统一编排
5. `createApp()` 已经是异步启动流程，后续接入真实 MCP server 时必须正确 await
6. 当前 embedding provider 仅支持 `voyage`，但配置模型已为扩展留口

### 5.2 开发注意事项

1. 后续新增存储表和索引时，应复用当前幂等 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 当前 parser/chunking 已可用，但后续需要将 tree-sitter 能力限制在 `packages/infra`
5. 在实现完整索引主流程时，应先在 `core` 中收敛索引服务输入输出模型，再补执行编排

### 5.3 embedding 领域决策

当前关于 `Chunk.embedding` 的领域决策如下：

1. 对最终系统语义来说，embedding 应该是必选
2. 对当前过渡代码来说，暂时保留为可选是可以接受的
3. 这种“过渡性可选”状态不应长期保留

原因是：

1. 项目的核心目标是为 Agent 提供基于 RAG 的代码检索能力
2. 真正进入索引与检索主链路的 chunk 最终都应具备 embedding
3. 当前之所以暂时保留为可选，只是为了在 parser、embedding provider 和索引服务尚未完成前允许分阶段落地

后续收敛方向应为：

1. 在索引主流程打通后，将 embedding 从“过渡性可选”收紧为“面向索引产物的必选字段”
2. 必要时区分“原始 chunk”和“已索引 chunk”模型，避免长期保持领域语义模糊

## 6. 下一步开发建议

建议按以下顺序继续推进。

### 6.1 第一优先级：实现索引写入主流程

建议先完成：

1. 在 `core` 中定义 `index-repository-service` 的输入输出模型
2. 串联扫描、切块、批量 embedding 与存储写入
3. 输出稳定的索引统计结果与失败明细
4. 明确 v1 的全量重建或覆盖写入策略

原因：

1. 当前 parser/chunking、chunk/search 存储和 embedding provider 已具备最小能力
2. 项目当前最大的缺口已经变成“主链路编排缺失”，而不是单点组件缺失

### 6.2 第二优先级：实现索引与检索服务

建议内容：

1. `index-repository-service`
2. `search-code-context-service`
3. `get-file-context-service`

### 6.3 第三优先级：增强 parser 为 tree-sitter 与 Markdown-aware 实现

建议内容：

1. 在 `infra/parsing` 下接入 tree-sitter
2. 先支持 TypeScript 与 Python
3. 建立语言感知 parser
4. 为 Markdown 文档接入 `unified + remark-parse`
5. 保留 fallback parser 作为退化路径

### 6.4 第四优先级：实现 MCP tool 层

建议最后接入：

1. MCP server
2. index tool
3. search tool
4. file context tool

## 7. 当前进度结论

当前项目已经越过“纯骨架”和“只靠 mock 测试”的阶段，进入“核心存储与检索能力开始真实落地”的阶段。

当前最合理的开发重点是：

1. 先把索引主链路真正闭环
2. 再增强 parser 的语言与文档结构感知能力
3. 最后接入 MCP tool 层
