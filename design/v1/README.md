# agent-code-index v1 设计文档

## 1. 文档目标

本文档定义 `agent-code-index` 第一版的系统设计，目标是先把“代码仓库索引 -> 语义检索 -> 上下文组装 -> 通过 MCP 对外提供能力”这条主链路打通。

第一版优先解决以下问题：

1. 将核心业务能力与对外协议层隔离。
2. 以 Node.js + TypeScript 为首个实现栈。
3. 聚焦索引、检索、上下文组装三项核心能力。
4. 先支持 MCP，后续可扩展到 HTTP、CLI 或其他 Agent 协议。
5. 底层先集成 Surreal 作为存储，`voyage-code-3` 作为 embedding 模型。
6. 同一项目在同一时间只启用一个 embedding 模型，不同项目可以通过 MCP 环境变量指定不同模型。

## 2. 设计原则

### 2.1 核心能力与协议解耦

索引、搜索、上下文拼装属于产品核心能力，不应直接依赖 MCP、HTTP 或 CLI。协议层只做请求适配、参数校验和结果映射。

### 2.2 Core 面向接口，Infra 负责实现

核心层通过 contracts 定义能力边界，不感知 Surreal、Voyage SDK 或具体文件扫描实现。基础设施层负责对接第三方系统，并通过依赖注入装配到核心层。

### 2.3 先打通最小闭环

第一版不追求多数据库、多模型、多租户或复杂代码图谱。只保证一条稳定、可验证的主流程：

1. 扫描仓库
2. 切块
3. 生成摘要或可检索文本
4. 调用 `voyage-code-3` 生成 embedding
5. 写入 Surreal
6. 执行语义检索
7. 返回 MCP Tool 可直接使用的上下文

### 2.4 模块职责清晰，依赖方向单向

允许的依赖方向如下：

1. `adapters -> core`
2. `bootstrap -> core`
3. `bootstrap -> infra`
4. `infra -> core`

不允许 `core` 依赖 `infra` 或 `adapters`。

### 2.5 项目级配置优先于全局模型配置

第一版采用项目级单模型配置策略。

设计要求：

1. 一个 MCP 配置实例只服务一个 `PROJECT_SPACE`
2. 一个 `PROJECT_SPACE` 只绑定一个 embedding provider 和一个 embedding model
3. 不同项目可通过环境变量选择不同模型
4. 模型配置一旦在数据库中初始化落库，后续默认不允许原地修改

## 3. 目标与非目标

### 3.1 第一版目标

1. 支持本地代码仓库扫描。
2. 支持将文件内容解析为 chunk 或 symbol-like block。
3. 支持通过 embedding 建立向量索引。
4. 支持结合元数据进行语义检索。
5. 支持将召回结果组装为适合 Agent 消费的上下文包。
6. 通过 MCP Tool 暴露以下能力：
   1. 索引仓库
   2. 搜索代码上下文
   3. 获取指定文件上下文

### 3.2 第一版明确不做

1. 多数据库适配
2. 复杂 AST 图谱与依赖关系分析
3. 后台任务队列系统
4. 多租户权限模型
5. Web UI
6. 完整插件系统
7. 改动影响分析

> 注：`explain-impact-service.ts` 是后续高价值扩展点，但不纳入 v1 必做范围。

## 4. 建议目录结构

```text
agent-code-index/
  package.json
  tsconfig.base.json
  README.md
  .env.example

  packages/
    core/
      package.json
      tsconfig.json
      src/
        contracts/
          embedding-provider.ts
          chunk-repository.ts
          search-repository.ts
          file-scanner.ts
          parser.ts
          context-builder.ts

        domain/
          chunk.ts
          search-query.ts
          search-result.ts
          context-packet.ts

        services/
          index-repository-service.ts
          search-code-context-service.ts
          get-file-context-service.ts

        utils/
          chunking.ts
          hashing.ts

      tests/
        unit/

    infra/
      package.json
      tsconfig.json
      src/
        storage/
          surreal/
            surreal-client.ts
            surreal-chunk-repository.ts
            surreal-search-repository.ts

        embedding/
          provider-factory.ts
          voyage/
            voyage-client.ts
            voyage-embedding-provider.ts

        parsing/
          parser-factory.ts
          fallback-parser.ts

        scanning/
          local-file-scanner.ts

      tests/
        integration/

    mcp-server/
      package.json
      tsconfig.json
      src/
        index.ts

        bootstrap/
          app.ts
          config.ts
          container.ts

        adapters/
          mcp/
            server.ts
            tools/
              index-repository-tool.ts
              search-code-context-tool.ts
              get-file-context-tool.ts
```

## 5. 分层设计

### 5.1 core

`core` 承载纯业务逻辑，定义系统真正稳定的抽象边界。

包含三类内容：

1. `contracts`：对外部依赖的抽象接口
2. `domain`：领域对象和数据结构
3. `services`：业务用例编排

这一层不能出现：

1. Surreal SDK 细节
2. Voyage SDK 细节
3. MCP 协议对象
4. 文件系统或网络调用的具体实现

### 5.2 infra

`infra` 提供所有外部系统接入实现，包括：

1. 存储实现
2. embedding 实现
3. 文件扫描实现
4. 解析实现

这一层负责把第三方 SDK 适配为 `core/contracts` 中定义的接口。

在包级结构上，`infra` 建议独立为单独包，并依赖 `core` 中定义的 contracts 与领域对象。

### 5.3 adapters

`adapters` 负责协议适配。第一版仅实现 MCP。

职责包括：

1. 暴露工具定义
2. 接收协议请求
3. 做输入参数映射和基础校验
4. 调用 `core/services`
5. 将结果转换为协议输出格式

协议层不承担核心业务规则，避免未来接入 HTTP 或 CLI 时重复实现核心逻辑。

### 5.4 bootstrap

`bootstrap` 负责应用装配：

1. 读取配置
2. 初始化第三方客户端
3. 创建基础设施实现
4. 绑定核心服务依赖
5. 启动适配器入口

在三包方案下，`bootstrap` 位于 `mcp-server` 包中，负责把 `core` 与 `infra` 装配成可运行的 MCP 服务。

### 5.5 shared 的处理策略

讨论中提到可以设置 `shared` 存放跨模块公共能力。但从 v1 范围看，公共工具目前集中在 `core/utils` 已足够。

建议：

1. v1 不强制建立 `shared/`
2. 仅当出现跨 `core`、`infra`、`adapters` 的稳定复用对象时，再抽出 `shared/`
3. 避免为了预留扩展而过早增加目录层级

### 5.6 core 与 MCP 的通信方式

在 v1 设计中，`core` 与 `adapters/mcp` 的关系不是远程服务调用，而是进程内的模块调用。

具体方式如下：

1. MCP tool 接收协议请求
2. tool 将 MCP 输入映射为 `core/services` 的输入对象
3. tool 直接调用对应 service 的 TypeScript 方法
4. service 再通过 `core/contracts` 调用由 `infra` 包提供的实现
5. tool 将 service 返回结果转换为 MCP 响应

因此，这里的“通信”本质上是函数调用，而不是 HTTP、消息队列或单独 RPC。

这样设计的原因是：

1. 第一版实现最简单，便于快速打通链路
2. 调试和测试成本最低
3. `core` 不需要感知 MCP 协议细节
4. 后续扩展 HTTP 或 CLI 时，只需新增 adapter，不需要改写核心业务

建议明确约束：

1. `core` 不得直接依赖 MCP 类型
2. `core/services` 只接收普通输入对象并返回普通领域结果
3. 协议映射、参数校验、错误转换放在 `adapters/mcp`
4. 依赖装配放在 `mcp-server/bootstrap/container`

### 5.7 包级职责划分

三包方案建议采用以下职责边界：

1. `packages/core`：纯业务能力与抽象定义
2. `packages/infra`：外部系统实现，例如 Surreal、Voyage、本地扫描与解析
3. `packages/mcp-server`：MCP 协议入口、应用装配与运行时启动

包级依赖关系建议保持为：

1. `infra -> core`
2. `mcp-server -> core`
3. `mcp-server -> infra`

不建议：

1. `core -> infra`
2. `core -> mcp-server`
3. `infra -> mcp-server`

## 6. 核心领域对象

### 6.1 Chunk

代表被索引的最小可检索单元，建议包含：

1. `id`
2. `repositoryId`
3. `filePath`
4. `language`
5. `content`
6. `summary` 或 `searchText`
7. `startLine`
8. `endLine`
9. `hash`
10. `metadata`
11. `embeddingProvider`
12. `embeddingModel`

### 6.2 SearchQuery

描述一次检索请求，建议包含：

1. `repositoryId`
2. `query`
3. `topK`
4. `filters`
5. `includePaths`
6. `excludePaths`

### 6.3 SearchResult

描述召回结果，建议包含：

1. `chunk`
2. `score`
3. `reason` 或 `matchMetadata`

### 6.4 ContextPacket

面向 Agent 消费的标准输出结构，建议包含：

1. `query`
2. `items`
3. `files`
4. `instructions`
5. `truncation` 信息

## 7. 核心接口设计

第一版只保留必要接口，控制抽象数量。

### 7.1 EmbeddingProvider

职责：输入文本列表，输出 embedding 向量。

建议接口语义：

```ts
interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}
```

要求：

1. 支持批量调用
2. 由实现层决定重试、限流与模型名配置
3. `core` 不感知 `voyage-code-3` 的细节
4. 每次索引与检索都必须使用与项目已落库配置一致的 provider 和 model

### 7.1.1 项目级模型约束

第一版不支持在同一个 `PROJECT_SPACE` 中混用多个 embedding 模型。

约束如下：

1. 同一项目在任一时刻只允许一个 active model
2. 不同项目可以使用不同 provider 和 model
3. 一旦项目元数据写入数据库，provider 与 model 默认锁定
4. 如果需要切换模型，建议新建 `PROJECT_SPACE` 并重新构建索引

### 7.2 ChunkRepository

职责：保存和管理 chunk 数据。

建议接口语义：

```ts
interface ChunkRepository {
  upsertMany(chunks: Chunk[]): Promise<void>;
  deleteByRepository(repositoryId: string): Promise<void>;
  findByFilePath(repositoryId: string, filePath: string): Promise<Chunk[]>;
}
```

### 7.3 SearchRepository

职责：执行向量检索与元数据过滤。

建议接口语义：

```ts
interface SearchRepository {
  semanticSearch(query: {
    repositoryId: string;
    embedding: number[];
    topK: number;
    filters?: Record<string, unknown>;
  }): Promise<SearchResult[]>;
}
```

说明：

1. `ChunkRepository` 偏写入与基于文件的读取
2. `SearchRepository` 偏检索能力
3. 即使底层暂时都由 Surreal 实现，接口职责仍应分开

### 7.4 FileScanner

职责：枚举仓库中的候选文件。

建议接口语义：

```ts
interface FileScanner {
  scan(rootPath: string): Promise<string[]>;
}
```

要求：

1. 支持忽略 `node_modules`、`.git`、构建产物目录
2. 支持基于扩展名或路径模式过滤
3. 第一版仅需本地文件系统实现

### 7.5 Parser

职责：将文件内容解析为 chunk 或 symbol-like block。

建议接口语义：

```ts
interface Parser {
  parse(input: { filePath: string; content: string }): Promise<Chunk[]>;
}
```

说明：

1. 第一版同时支持 AST 驱动切块与保守的 fallback parser
2. 优先保证可用性，再逐步增强语言感知能力
3. AST 解析能力由 `packages/infra` 提供，`core` 只依赖抽象接口

### 7.6 ContextBuilder

职责：将召回结果组织成 Agent 可直接消费的上下文。

建议接口语义：

```ts
interface ContextBuilder {
  build(input: {
    query: string;
    results: SearchResult[];
    tokenBudget?: number;
  }): Promise<ContextPacket>;
}
```

要求：

1. 处理截断策略
2. 尽量按文件聚合结果
3. 输出结构稳定，避免协议层重复加工

## 8. 核心服务设计

### 8.1 index-repository-service.ts

该服务负责索引链路总编排，是第一版最关键的写入用例。

推荐流程：

1. 接收仓库根目录与索引配置
2. 调用 `FileScanner` 枚举候选文件
3. 读取文件内容并交给 `Parser`
4. 对 chunk 执行必要的标准化、摘要或 search text 构建
5. 调用 `EmbeddingProvider` 批量生成向量
6. 将 chunk 与向量写入 `ChunkRepository` / `SearchRepository`
7. 返回索引统计结果

建议输出指标：

1. 已扫描文件数
2. 已解析文件数
3. 生成 chunk 数
4. 跳过文件数
5. 失败文件数
6. 总耗时

### 8.2 search-code-context-service.ts

该服务负责检索链路总编排。

推荐流程：

1. 接收自然语言查询和过滤条件
2. 生成查询 embedding
3. 调用 `SearchRepository.semanticSearch`
4. 必要时做规则过滤、去重和简单重排
5. 调用 `ContextBuilder` 输出 `ContextPacket`

第一版建议只做轻量重排：

1. 同文件结果去重
2. 提升高分结果的相邻 chunk
3. 降低明显重复内容权重

### 8.3 get-file-context-service.ts

该服务面向“按文件取上下文”的场景。

推荐流程：

1. 根据 `repositoryId + filePath` 查询 chunk
2. 重新按行号排序与合并
3. 输出适合 Agent 阅读的文件上下文包

典型用途：

1. 用户明确指定文件
2. 检索召回后进一步拉取全文件上下文
3. Agent 需要稳定的文件级阅读输入

### 8.4 explain-impact-service.ts

该服务不纳入 v1 实现，但建议预留位置。后续如果增加变更影响分析，可以基于索引数据、符号关系和引用关系扩展。

## 9. 基础设施设计

### 9.1 Surreal 存储

第一版由 Surreal 承担 chunk 持久化与检索支持。

建议职责拆分，代码位于 `packages/infra`：

1. `surreal-client.ts`：封装连接与基础执行能力
2. `surreal-chunk-repository.ts`：实现 `ChunkRepository`
3. `surreal-search-repository.ts`：实现 `SearchRepository`

建议存储内容至少包括：

1. chunk 基本信息
2. 文件与仓库元数据
3. embedding 向量
4. 可过滤字段，例如语言、路径、标签

### 9.1.1 本地与云端部署支持策略

第一版支持两种 SurrealDB 部署方式：

1. 本地自部署 SurrealDB
2. 云端托管的 SurrealDB

这两种部署方式在架构上不应被视为两种不同数据库适配，而应视为同一 `Surreal` provider 的两种运行配置。

因此，v1 不需要修改 `core`、不需要新增新的 repository contract，也不需要改变三包结构。主要变化应限制在 `packages/infra` 与 `packages/mcp-server`：

1. `packages/infra` 负责统一连接抽象
2. `packages/mcp-server` 负责配置读取与启动校验
3. 本地与云端差异不得泄漏到 `core`

### 9.1.1.1 PROJECT_SPACE 与 namespace 的关系

第一版采用方案 B：

1. `PROJECT_SPACE` 作为逻辑项目标识
2. SurrealDB `namespace` 由 `PROJECT_SPACE` 派生或按固定规则映射
3. `PROJECT_SPACE` 是 MCP 配置入口
4. `namespace` 是数据库隔离边界

建议规则：

1. 用户只配置 `PROJECT_SPACE`
2. 应用根据统一规则生成或校验 `namespace`
3. 不建议手工为同一项目分别维护不同的 `PROJECT_SPACE` 与 `namespace` 值

### 9.1.2 Surreal 客户端抽象要求

`surreal-client.ts` 应作为 Surreal 接入的唯一入口，负责屏蔽本地与云端部署差异。

建议职责包括：

1. 建立连接
2. 处理认证
3. 执行基础 query 或 transaction
4. 统一错误包装
5. 提供连接探测与能力校验接口

建议保持以下边界：

1. 本地与云端连接差异优先收敛在 `surreal-client.ts`
2. `surreal-chunk-repository.ts` 不直接处理部署差异
3. `surreal-search-repository.ts` 不直接处理部署差异

只有当未来云端与本地差异显著扩大，才考虑拆分为 `local-surreal-client.ts` 与 `cloud-surreal-client.ts`。v1 不建议预先拆分。

### 9.1.3 配置模型要求

为同时支持本地与云端部署，配置模型应显式覆盖连接方式与认证信息。

建议配置字段包括：

1. `SURREAL_URL`
2. `PROJECT_SPACE`
3. `SURREAL_DATABASE`
4. `SURREAL_USERNAME`
5. `SURREAL_PASSWORD`
6. `SURREAL_TOKEN`
7. `SURREAL_USE_TLS`
8. `SURREAL_DEPLOYMENT_MODE=local|cloud`

设计要求：

1. 不在 `core` 中分支判断本地或云端
2. 通过统一配置对象驱动 `surreal-client.ts`
3. 由配置决定认证方式、TLS 和连接细节
4. `namespace` 由 `PROJECT_SPACE` 派生，而不是要求使用者手工维护独立值

### 9.1.4 启动校验与能力探测

为了降低本地与云端环境差异带来的运行时问题，建议在应用启动时增加数据库校验步骤。

建议至少校验：

1. 数据库连通性
2. 鉴权是否成功
3. namespace 与 database 是否可用
4. 向量检索相关能力是否满足当前实现要求

这部分逻辑建议由 `packages/mcp-server` 在启动阶段调用，并依赖 `packages/infra` 暴露的健康检查能力。

### 9.1.5 Schema 与迁移要求

为保证本地与云端行为一致，建议尽早将 schema 初始化与索引创建视为基础设施责任，而不是人工前置步骤。

建议要求：

1. 表结构定义保持一致
2. 向量字段定义保持一致
3. 检索依赖的索引在不同部署环境中保持一致
4. schema 初始化过程可重复执行且可观测

v1 可以先不实现完整 migration 系统，但至少应在设计上预留 schema initialization 能力。

当前最小实现可以先在应用启动阶段显式执行 `project_metadata` 的 `DEFINE TABLE` 与 `DEFINE FIELD`，保证模型锁定依赖的元数据表不是人工预置步骤。

### 9.1.5.1 项目元数据与模型锁定

为了支持“不同项目可用不同模型，但单个项目模型不可变”，数据库中必须保存项目级索引元数据。

建议至少记录：

1. `projectSpace`
2. `namespace`
3. `embeddingProvider`
4. `embeddingModel`
5. `vectorDimension`
6. `indexVersion`
7. `createdAt`
8. `updatedAt`

初始化规则：

1. 如果项目元数据不存在，则按当前配置创建并写入
2. 如果项目元数据已存在，则启动时校验当前配置是否与落库配置一致
3. 如果 provider、model 或 vector dimension 不一致，则拒绝继续索引

这样可以把“模型锁定”从约定提升为系统规则。

### 9.1.6 运行时差异处理

本地与云端 SurrealDB 的主要差异通常体现在运行特性，而非业务语义。

需要重点考虑：

1. 云端环境的网络超时与重试
2. TLS 与证书配置
3. 权限与鉴权失败
4. 不同环境的版本差异

因此建议：

1. 对连接错误、鉴权错误、能力不支持错误分别建模
2. 对可重试错误采用有限重试
3. 对配置错误和 schema 错误尽早失败

### 9.2 Embedding Provider 策略

第一版默认 provider 为 Voyage，默认模型为 `voyage-code-3`，但整体设计需要允许后续扩展到其他 embedding provider。

建议职责拆分，代码位于 `packages/infra`：

1. `embedding/provider-factory.ts`：根据配置选择具体 provider
2. `embedding/voyage/voyage-client.ts`：封装 Voyage SDK 或 HTTP 调用细节
3. `embedding/voyage/voyage-embedding-provider.ts`：实现 `EmbeddingProvider`
4. 后续可新增 `embedding/<other-provider>/...`

第一版的实现策略：

1. 同一项目只启用一个 provider
2. 不同项目可启用不同 provider
3. 默认使用 `voyage-code-3`
4. provider 与 model 一旦为项目初始化，即默认锁定

应由实现层处理：

1. 批量大小控制
2. 重试与超时
3. 模型名配置
4. API Key 注入
5. 向量维度声明与校验

### 9.2.1 项目级 Embedding 配置

配置模型应从 `VoyageConfig` 演进为通用的 `EmbeddingConfig`。

建议字段包括：

1. `EMBEDDING_PROVIDER`
2. `EMBEDDING_MODEL`
3. `EMBEDDING_VECTOR_DIMENSION`
4. `EMBEDDING_API_KEY`
5. `EMBEDDING_BASE_URL`

说明：

1. Voyage 相关变量可以作为第一版兼容写法保留
2. 但内部配置模型应按 provider-neutral 的方式建模
3. 这样后续新增其他 provider 时，不需要改动 `core`

### 9.3 解析与扫描

第一版解析策略建议务实，但不再只依赖纯文本切块，而是优先采用 AST 或语法树驱动的语义切块。

1. `local-file-scanner.ts` 仅负责本地文件发现
2. `parser-factory.ts` 根据扩展名选择解析器
3. `fallback-parser.ts` 负责通用文本切块

这些实现同样建议位于 `packages/infra`，由 `mcp-server` 在启动时装配。

### 9.3.1 AST 工具选型

v1 解析层建议采用 `tree-sitter` 的 Node.js 原生绑定方案，作为 Python 与 TypeScript 的统一解析底座。

建议依赖：

1. `tree-sitter`
2. `tree-sitter-typescript`
3. `tree-sitter-python`

选择该方案的原因：

1. 当前主工程是 Node.js + TypeScript，接入成本低
2. 同一套解析框架即可同时覆盖 Python 和 TypeScript
3. 后续扩展到更多语言时，迁移成本更低
4. `core` 无需感知底层是原生绑定还是其他实现方式

这里的使用方式不是“直接引用 Rust 源码”，而是通过 npm 包使用 tree-sitter 对 Node.js 暴露的 API。底层实现细节由库本身封装，业务代码只在 TypeScript 中调用解析接口。

### 9.3.2 Node.js 集成方式

v1 采用方式一，也就是 Node 原生绑定方案。

推荐集成方式：

1. 在 `packages/infra/package.json` 中声明 tree-sitter 相关依赖
2. 在 `packages/infra/src/parsing` 中封装 parser 初始化逻辑
3. 按文件扩展名选择 TypeScript 或 Python grammar
4. 向上只暴露 `core/contracts/parser.ts` 所要求的 `Parser` 接口

建议目录补充为：

```text
packages/infra/
  src/
    parsing/
      parser-factory.ts
      fallback-parser.ts
      tree-sitter/
        tree-sitter-parser.ts
        languages/
          typescript-parser.ts
          python-parser.ts
```

职责建议如下：

1. `tree-sitter-parser.ts`：封装通用 parser 初始化、语言切换和节点遍历工具
2. `typescript-parser.ts`：提取 TypeScript 的类、函数、方法等 symbol chunk
3. `python-parser.ts`：提取 Python 的类、函数、方法等 symbol chunk
4. `fallback-parser.ts`：当语言不支持、解析失败或 chunk 过大时提供退化策略

### 9.3.3 切块策略

对于 Python 和 TypeScript，v1 建议按语义边界切块，而不是只按固定窗口切块。

优先切出的节点包括：

1. class
2. function
3. method
4. 可选的 top-level variable 或 export block

每个 chunk 至少应携带以下元数据：

1. `filePath`
2. `language`
3. `symbolName`
4. `symbolKind`
5. `startLine`
6. `endLine`
7. `parentSymbol`
8. `repositoryId`

建议规则：

1. 优先按完整函数或类切块
2. 当单个 symbol 过大时，再使用 fallback 策略做二次切块
3. 保留文件路径与父级符号信息，便于检索结果回溯
4. 对于无法可靠识别语义结构的文件，退回通用文本切块

### 9.3.4 Fallback 策略

在没有成熟 AST 策略前，或者在以下场景下，fallback parser 仍然需要保留：

1. 文件语言暂不支持
2. tree-sitter 解析失败
3. 单个函数或类过大，需要进一步切分
4. 非代码文本文件仍需进入索引链路

fallback parser 至少需要做到：

1. 能按固定大小和重叠窗口切块
2. 保留行号范围
3. 尽量维持块的可读性

### 9.3.5 工程约束

由于 tree-sitter 采用 Node 原生绑定方案，工程上需要额外注意：

1. 在本地开发、CI 和容器环境中验证依赖安装流程
2. 将 tree-sitter 及 grammar 依赖限制在 `packages/infra`，避免泄漏到 `core`
3. 通过 `parser-factory.ts` 隔离具体库，保留未来替换为 ts-morph、LibCST 或 WASM 方案的空间

## 10. MCP 适配层设计

第一版仅实现 MCP Server，相关代码位于 `packages/mcp-server`。

### 10.1 server.ts

职责：

1. 初始化 MCP server
2. 注册 tools
3. 将 tool handler 绑定到 `core/services`

### 10.2 index-repository-tool.ts

输入：

1. 仓库根路径
2. 可选过滤参数

输出：

1. 索引结果摘要
2. 失败文件统计

### 10.3 search-code-context-tool.ts

输入：

1. 查询语句
2. 仓库标识
3. 可选过滤条件

输出：

1. `ContextPacket`
2. 关键命中文件摘要

### 10.4 get-file-context-tool.ts

输入：

1. 仓库标识
2. 文件路径

输出：

1. 文件级上下文包

### 10.5 调用关系示意

MCP adapter 与核心模块之间建议采用以下调用链：

```text
MCP Request
  -> packages/mcp-server/adapters/mcp/tool handler
  -> packages/core/service.execute(input)
  -> packages/core/contracts
  -> packages/infra implementation
  -> core/service result
  -> MCP Response
```

这意味着 MCP 层是协议入口，不是独立业务层。业务规则、检索编排、上下文组装都应留在 `core/services`。

## 11. 启动与装配

### 11.1 config.ts

位于 `packages/mcp-server`，负责读取和校验配置，建议包括：

1. Surreal 地址与认证信息
2. Surreal 本地或云端部署模式
3. `PROJECT_SPACE`
4. 通用 embedding provider 配置
5. 默认扫描忽略规则
6. 默认检索 `topK`

其中：

1. `PROJECT_SPACE` 是逻辑项目标识
2. `namespace` 应由 `PROJECT_SPACE` 派生
3. embedding 配置应在启动时与数据库中已落库的项目元数据做一致性校验

### 11.2 container.ts

位于 `packages/mcp-server`，负责手工依赖注入，建议完成以下绑定：

1. `EmbeddingProvider -> 由 provider-factory 根据项目配置选择的具体实现`
2. `ChunkRepository -> SurrealChunkRepository`
3. `SearchRepository -> SurrealSearchRepository`
4. `FileScanner -> LocalFileScanner`
5. `Parser -> ParserFactory / FallbackParser`
6. `ContextBuilder -> 默认上下文构建实现`

其中 embedding 相关装配建议遵循：

1. 默认 provider 为 Voyage
2. 默认模型为 `voyage-code-3`
3. 具体 provider 实现由配置驱动选择，而不是在 container 中写死

### 11.3 app.ts

位于 `packages/mcp-server`，负责组装整个应用：

1. 加载配置
2. 初始化 container
3. 执行 Surreal 连接与能力校验
4. 校验 `PROJECT_SPACE` 的项目元数据与模型配置是否一致
5. 创建 MCP server
6. 启动服务

### 11.4 v1 打包与部署策略

v1 建议采用 workspace + 三包方案：`core`、`infra`、`mcp-server`。

推荐形态：

1. 根目录 `package.json` 作为 workspace 清单
2. `packages/core` 维护自己的 `package.json`
3. `packages/infra` 维护自己的 `package.json`
4. `packages/mcp-server` 维护自己的 `package.json`
5. `mcp-server` 依赖 `core` 和 `infra`
6. 构建 `mcp-server` 时将依赖一起打入最终产物
7. 运行时由 `mcp-server` 作为唯一部署单元启动 MCP server

需要强调的是，“最终一起打包部署”不等于“架构混在一起”。

分层仍然保持不变：

1. `core` 是业务能力模块
2. `infra` 是外部依赖实现模块
3. `mcp-server` 是协议入口与运行时装配模块

三包方案的主要收益：

1. 包边界比目录边界更明确
2. 后续增加 HTTP、CLI 时更容易复用 `core` 和 `infra`
3. `core` 的纯度更容易长期保持
4. `mcp-server` 可以专注协议接入与应用启动

三包方案的代价：

1. workspace 管理和构建脚本更复杂
2. TypeScript 配置需要按包维护
3. 包间版本和依赖关系需要更严格地管理

基于当前希望降低后续扩展成本的目标，v1 采用三包方案是可接受且合理的工程取舍。

## 12. 关键数据流

### 12.1 索引流程

```text
Repository Root
  -> FileScanner
  -> Parser
  -> Chunk[]
  -> EmbeddingProvider
  -> ChunkRepository / SearchRepository
  -> Index Summary
```

补充约束：

1. 索引开始前必须先确认当前 `PROJECT_SPACE` 已绑定的 provider 与 model
2. 如果项目未初始化，则创建项目元数据并写入当前模型配置
3. 如果项目已初始化但模型配置不一致，则拒绝继续索引

### 12.2 检索流程

```text
Natural Language Query
  -> EmbeddingProvider
  -> SearchRepository
  -> SearchResult[]
  -> ContextBuilder
  -> ContextPacket
  -> MCP Tool Response
```

### 12.3 文件上下文流程

```text
RepositoryId + FilePath
  -> ChunkRepository
  -> Chunk[]
  -> File Context Assembly
  -> MCP Tool Response
```

## 13. 工程约束与实现建议

### 13.1 TypeScript 约束

1. 打开严格模式
2. 核心接口和领域对象优先显式建模
3. 协议层与基础设施层避免把第三方 SDK 类型泄漏到 `core`

### 13.2 测试策略

第一版至少覆盖：

1. `core/services` 的单元测试
2. `fallback-parser` 的边界测试
3. `context-builder` 的截断与聚合测试
4. Surreal 与 Voyage 接口的基础集成测试

### 13.3 配置与环境变量

建议在 `.env.example` 中明确：

1. `SURREAL_URL`
2. `PROJECT_SPACE`
3. `SURREAL_DATABASE`
4. `SURREAL_USERNAME`
5. `SURREAL_PASSWORD`
6. `SURREAL_TOKEN`
7. `SURREAL_USE_TLS`
8. `SURREAL_DEPLOYMENT_MODE=local`
9. `EMBEDDING_PROVIDER=voyage`
10. `EMBEDDING_MODEL=voyage-code-3`
11. `EMBEDDING_VECTOR_DIMENSION`
12. `EMBEDDING_API_KEY`

## 14. 演进路径

在保持分层稳定的前提下，后续可按如下方向演进：

1. 新增 `packages/http-server`，复用 `core` 与 `infra`
2. 新增 `packages/cli`，复用 `core` 与 `infra`
3. 在 `packages/infra` 下增加其他存储实现
4. 在 `packages/infra` 下增加其他模型供应商
5. 在 `packages/core/services` 中新增 `explain-impact-service`
6. 引入更强的语言感知 parser 或 AST 图谱能力
7. 为模型切换提供“新建 PROJECT_SPACE 并重建索引”的迁移工具

## 15. v1 结论

第一版架构的核心是把“业务能力”“外部依赖”“协议适配”三者切开：

1. `core` 保持纯净，沉淀稳定能力边界
2. `infra` 承担第三方系统集成风险
3. `mcp-server` 负责对外暴露 MCP 能力，不侵入核心逻辑
4. `bootstrap` 在 `mcp-server` 中统一做配置和依赖装配

这样设计虽然比单包方案更重，但能在 v1 就建立稳定的包边界，同时为后续扩展 HTTP、CLI、替换数据库、替换 embedding provider 留出更清晰的演进路径。
