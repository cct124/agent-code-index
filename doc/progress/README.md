# agent-code-index 当前开发进度

## 1. 文档目的

本文档用于记录当前仓库的开发进度、已经完成的工作、当前可运行能力，以及下一步建议推进的开发事项。

当前时间点对应的实现状态是：

1. v1 架构设计文档已经完成并持续同步
2. workspace 三包骨架已经完成
3. 配置模型、项目元数据锁定、schema 初始化已经落地
4. 第一批单元测试与轻量集成测试已经落地并通过
5. chunk/search 的真实存储实现仍未完成

## 2. 当前项目结构

当前仓库采用 Yarn workspace 三包结构：

1. `packages/core`
2. `packages/infra`
3. `packages/mcp-server`

根目录当前还包括：

1. `design/v1/README.md`：v1 设计文档
2. `.env.example`：运行时环境变量模板
3. `vitest.config.ts`、`vitest.unit.config.ts`、`vitest.integration.config.ts`：测试配置
4. `package.json`：根工作区脚本与依赖定义

## 3. 已完成开发内容

### 3.1 架构与工程基础

已完成：

1. 采用 `core / infra / mcp-server` 三包结构
2. 已切换到 Yarn 4 workspace 管理
3. TypeScript project references 已打通
4. Prettier 已接入并提供格式化命令
5. 基础 JSDoc 注释规范已补齐到现有主要代码文件

### 3.2 配置模型

已完成：

1. 运行时配置已统一为项目级配置模型
2. 使用 `PROJECT_SPACE` 作为逻辑项目标识
3. `Surreal namespace` 由 `PROJECT_SPACE` 自动派生
4. embedding 配置已统一收敛为 `EMBEDDING_*`
5. 旧的 `VOYAGE_*` 兼容逻辑已经移除

当前关键环境变量：

1. `PROJECT_SPACE`
2. `SURREAL_URL`
3. `SURREAL_DATABASE`
4. `SURREAL_USERNAME` / `SURREAL_PASSWORD` 或 `SURREAL_TOKEN`
5. `SURREAL_USE_TLS`
6. `SURREAL_DEPLOYMENT_MODE`
7. `EMBEDDING_PROVIDER`
8. `EMBEDDING_MODEL`
9. `EMBEDDING_VECTOR_DIMENSION`
10. `EMBEDDING_API_KEY`

### 3.3 项目元数据锁定

已完成：

1. 在 `core` 中定义了 `ProjectMetadata` 领域模型
2. 在 `core` 中定义了 `ProjectMetadataRepository` 仓储契约
3. 在 `infra` 中实现了 `SurrealProjectMetadataRepository`
4. 在 `infra` 中实现了 `SurrealProjectMetadataSchema`
5. 在 `mcp-server` 启动阶段接入了 schema 初始化
6. 在 `mcp-server` 启动阶段接入了项目元数据读取与写入逻辑
7. 已实现同一 `PROJECT_SPACE` 下 provider/model/vectorDimension 不一致时拒绝启动

当前启动时会执行的关键流程：

1. 加载配置
2. 创建容器
3. 执行 Surreal 健康检查
4. 执行 `project_metadata` 的 schema 初始化
5. 读取 `PROJECT_SPACE` 对应的项目元数据
6. 不存在则初始化写入
7. 已存在则校验 embedding 配置是否一致

### 3.4 Surreal 基础设施

已完成：

1. `SurrealClient` 抽象已定义
2. `DefaultSurrealClient` 已实现连接、鉴权、health check
3. local / cloud 的统一配置模型已纳入当前配置体系

当前仍是骨架状态的部分：

1. `SurrealChunkRepository`
2. `SurrealSearchRepository`

这两个类目前仍保留 `not implemented yet` 占位异常。

### 3.5 测试基础设施

已完成：

1. 已接入 `vitest`
2. 已拆分 `test`、`test:unit`、`test:integration` 三类脚本
3. 已新增 unit 与 integration 的独立配置文件

当前已落地测试：

1. 配置加载单元测试
2. 应用启动编排单元测试
3. `project_metadata` 仓储轻量集成测试
4. `project_metadata` schema 初始化轻量集成测试

## 4. 当前可验证能力

截至当前，已经可以验证的能力包括：

1. 环境变量配置是否正确加载与校验
2. `PROJECT_SPACE` 到 namespace 的派生规则是否生效
3. embedding 必填配置是否被严格校验
4. 应用启动时是否会先做 Surreal 健康检查
5. 应用启动时是否会先确保 `project_metadata` schema 存在
6. 首次启动时是否写入项目元数据
7. 二次启动时是否对 embedding 配置进行锁定校验

## 5. 当前尚未完成内容

以下能力仍未真正落地：

1. 仓库扫描实现
2. parser / tree-sitter 实现
3. embedding provider factory 与真实 embedding 调用链
4. chunk 切分与索引写入主流程
5. `SurrealChunkRepository` 的真实写入与查询实现
6. `SurrealSearchRepository` 的真实向量检索实现
7. MCP tool server 与具体工具实现
8. 真实 SurrealDB 环境下的端到端集成测试

## 6. 当前开发风险与注意点

### 6.1 风险点

1. `project_metadata` 已完成，但 chunk/search 的 schema 还未设计与初始化
2. 当前 integration test 仍是轻量级替身测试，不是连接真实数据库的端到端测试
3. `createApp()` 已经是异步启动流程，后续接入真实 MCP server 时必须正确 await
4. 当前 embedding provider 仅支持 `voyage`，但配置模型已为扩展留口

### 6.2 开发注意事项

1. 后续新增存储表时，应复用当前 schema initialization 模式
2. 后续新增 provider 时，应沿用 `EMBEDDING_*` 的统一配置接口
3. 不应在 `core` 层引入任何 Surreal 或 MCP 细节
4. 在实现 chunk/search 前，应先明确对应的领域模型与 schema 设计

## 7. 下一步开发建议

建议按以下顺序继续推进。

### 7.1 第一优先级：实现 chunk 与 search 的真实存储层

建议先完成：

1. `SurrealChunkRepository`
2. `SurrealSearchRepository`

建议目标：

1. 定义 chunk 表结构
2. 定义必要索引
3. 实现 `upsertMany`
4. 实现 `deleteByRepository`
5. 实现 `findByFilePath`
6. 实现 `semanticSearch`

原因：

1. 当前项目最核心的主链路还缺少真实存储落地
2. 没有这一步，后续 parser、embedding、MCP tool 都无法形成真正闭环

### 7.2 第二优先级：补充 chunk/search 的 schema initialization

在 `project_metadata` 已经采用启动期显式 schema 初始化的前提下，下一步建议新增：

1. chunk 相关表的 `DEFINE TABLE`
2. search 相关字段与索引定义
3. 向量检索所需索引定义

目标是让 schema 初始化能力从单表扩展到完整索引主链路。

### 7.3 第三优先级：实现 parser 与 chunking 主流程

建议内容：

1. 在 `infra/parsing` 下接入 tree-sitter
2. 先支持 TypeScript 与 Python
3. 建立 parser factory
4. 实现 fallback parser
5. 定义 chunking 规则与 searchText 生成规则

### 7.4 第四优先级：实现 embedding provider factory 与真实 provider 调用

建议内容：

1. 定义 `EmbeddingProvider` contract
2. 新增 provider factory
3. 接入 Voyage client
4. 将 `EMBEDDING_*` 配置与 provider 初始化打通

### 7.5 第五优先级：实现索引与检索服务

当 parser、embedding、repository 都具备后，建议实现：

1. `index-repository-service`
2. `search-code-context-service`
3. `get-file-context-service`

这一步会把 v1 的核心闭环真正串起来。

### 7.6 第六优先级：实现 MCP tool 层

建议最后接入：

1. MCP server
2. index tool
3. search tool
4. file context tool

原因是协议层应建立在核心能力已经稳定的前提上。

## 8. 下一步测试建议

在当前测试基础上，建议继续补充：

1. `SurrealChunkRepository` 的单元测试与集成测试
2. `SurrealSearchRepository` 的单元测试与集成测试
3. 真实 SurrealDB 环境下的端到端集成测试
4. 未来 parser/chunking 的规则测试
5. 未来 embedding provider factory 的配置驱动测试

## 9. 当前结论

当前项目已经完成了从“纯设计”到“可验证启动骨架”的阶段性落地。

可以将当前开发状态概括为：

1. 架构已定型
2. 配置已收敛
3. 项目级模型锁定已落地
4. schema 初始化已落地
5. 测试基础设施已建立
6. 核心索引与检索主链路尚未实现

因此，下一阶段最合理的开发重点，不再是继续补工程骨架，而是开始实现真正的索引、存储、检索能力。
