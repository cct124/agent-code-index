# @agent-code-index/mcp-server

`packages/mcp-server` 是当前项目的运行时装配与 MCP 协议接入模块，负责把 `core` 与 `infra` 组合成一个可启动、可通过 stdio 暴露 tools 的应用。

这一层的目标是：

1. 读取运行时配置
2. 创建并装配依赖容器
3. 在启动阶段执行必要校验
4. 注册并暴露当前可用的 MCP tools

当前阶段，`mcp-server` 已经具备完整的启动装配能力，并已真正对外暴露 MCP tools。

## 作为 npm 包使用

当前仓库采用双轨模式：

1. 开发态继续保留 Yarn workspace 依赖，方便在 monorepo 内联调 `core / infra / mcp-server`
2. 发布态通过单独的打包脚本生成 `package-dist/`，产出依赖闭合的 npm 包内容

也就是说，仓库里的 `packages/mcp-server/package.json` 仍然面向开发，而真正用于 npm 发布的是打包后生成的 `package-dist/package.json`。

### 生成发布产物

在仓库根目录执行：

```bash
yarn workspace @agent-code-index/mcp-server build:package
```

执行后会生成：

```text
packages/mcp-server/package-dist/
```

该目录包含：

1. 打包后的 CLI 和 ESM 入口
2. 用于发布的 `package.json`
3. `README.md`
4. `LICENSE`

当前 `package-dist` 的首要目标是提供稳定可安装的 CLI 产物，因此它优先保证运行时闭合与可执行性；开发态类型系统仍以 monorepo 内的 workspace 包为准。

如需本地验包，可继续执行：

```bash
yarn workspace @agent-code-index/mcp-server pack:package:dry-run
```

如需在真正发布前执行一次完整的发布前检查，可执行：

```bash
yarn workspace @agent-code-index/mcp-server check:release
```

这条命令当前会做两件事：

1. 校验 `packages/mcp-server/package.json`、`src/server.ts` 与 `package-dist/package.json` 的版本号一致
2. 在 `package-dist/` 内执行 `npm pack --dry-run`，确认最终会发布到 npm 的文件集合

### 安装

```bash
npm install -g @agent-code-index/mcp-server
```

或通过 `npx` 直接运行：

```bash
npx @agent-code-index/mcp-server
```

安装后可执行命令名为：

```bash
agent-code-index-mcp
```

### 运行

这个 CLI 会启动一个基于 stdio transport 的 MCP server，因此通常由 MCP host 以子进程方式拉起，而不是手工长期在终端前台运行。

最小运行前提仍然是提供完整环境变量，例如：

```bash
PROJECT_SPACE=demo \
SURREAL_URL=http://127.0.0.1:8000/rpc \
SURREAL_DATABASE=agent_code_index \
SURREAL_USERNAME=root \
SURREAL_PASSWORD=root \
EMBEDDING_PROVIDER=openai-compatible \
EMBEDDING_API_KEY=your-key \
EMBEDDING_VECTOR_DIMENSION=1024 \
agent-code-index-mcp
```

如果通过 MCP host 配置，推荐直接在 server 条目的 `command` 中使用 `agent-code-index-mcp`，并通过 `env` 注入项目级配置。

### 发布说明

为避免破坏当前 monorepo 开发流程，不建议直接从 `packages/mcp-server` 根目录执行 `npm publish`。

推荐流程是：

```bash
yarn workspace @agent-code-index/mcp-server build:package
yarn workspace @agent-code-index/mcp-server check:release
cd packages/mcp-server/package-dist
npm publish --access public
```

## 模块职责

当前 `mcp-server` 主要承担四类职责：

1. 配置加载与校验
2. 应用依赖装配
3. 启动阶段健康检查与元数据校验
4. MCP tool 注册与请求映射

## 当前目录结构

```text
src/
  adapters/
    shared/
    tools/
  bootstrap/
    app.ts
    config.ts
    container.ts
  server.ts
  index.ts
```

### bootstrap/config.ts

负责读取和校验运行时配置。

当前能力：

1. 读取 `PROJECT_SPACE`
2. 根据 `PROJECT_SPACE` 派生 Surreal namespace
3. 读取 Surreal 连接配置
4. 读取 embedding 配置
5. 读取索引链路默认参数
6. 读取 MCP adapter 默认参数，例如 `MCP_DEFAULT_REPOSITORY_ID`、`MCP_REPOSITORY_ROOT`
7. 读取日志输出配置，例如 `LOG_LEVEL`、`LOG_PRETTY`、`LOG_FILE_PATH`、`LOG_FILE_PRETTY`
8. 校验 embedding 必填配置

当前直接支持从进程环境变量读取配置，因此天然适合由 MCP host 在 `mcp.json` 中按 server 注入 env。

### bootstrap/container.ts

负责创建应用依赖容器。

当前已经装配：

1. `embeddingProvider`
2. `surrealClient`
3. `chunkSchema`
4. `projectMetadataSchema`
5. `chunkPreparationService`
6. `chunkRepository`
7. `fileChunkPreparationService`
8. `searchRepository`
9. `indexRepositoryService`
10. `searchCodeContextService`
11. `indexFilesService`
12. `deleteFilesService`
13. `projectMetadataRepository`

也就是说，当前运行时已经能拿到完整的最小索引链依赖图。

### bootstrap/app.ts

负责创建完整应用实例。

当前启动流程包括：

1. 加载配置
2. 创建容器
3. 执行 Surreal 健康检查
4. 执行 chunk schema 初始化
5. 执行 `project_metadata` schema 初始化
6. 校验或初始化项目元数据

### index.ts

当前导出 `createApp`、`createMcpServer`、`startStdioServer`、共享 resolver 和 tool 注册函数。

### adapters/shared

负责 MCP adapter 层共用的输入回填、参数清洗与校验辅助。

### adapters/tools

负责把 `core` use case 映射为真正的 MCP tools。

当前已实现并注册：

1. `index_repository`
2. `search_code_context`
3. `index_files`
4. `delete_files`
5. `get_file_context`

### server.ts

负责创建 `McpServer`、注册 tools，并提供 stdio 启动入口。

## 当前已经实现的功能

截至当前，`mcp-server` 已经具备以下能力。

### 1. 运行时配置模型

已实现：

1. Surreal 配置模型
2. Embedding 配置模型
3. 索引配置模型
4. 环境变量加载与校验逻辑

### 2. 启动期元数据锁定

已实现：

1. 首次启动写入项目元数据
2. 二次启动校验 provider/model/vectorDimension 一致性
3. 不一致时拒绝继续启动

### 3. 运行时依赖装配

已实现：

1. Embedding provider 装配
2. Surreal client 与 repository 装配
3. chunk preparation 服务装配
4. 默认索引服务装配
5. 文件级索引与删除服务装配

### 4. MCP tools 暴露

已实现：

1. 通过官方 MCP TypeScript SDK 创建真实 `McpServer`
2. 通过 stdio transport 暴露当前 server
3. `index_repository` tool 注册
4. `search_code_context` tool 注册
5. `index_files` tool 注册
6. `delete_files` tool 注册
7. `get_file_context` tool 注册
8. tool 输入参数清洗、默认值回填与错误映射

### 4.1 get_file_context 的当前语义

当前 `get_file_context` 已按最小可用原则落地：

1. 从已索引 chunk 中按 `repositoryId + filePath` 读取当前文件
2. 返回结构化 `chunks[]`
3. 同时返回一个面向 Agent 的 `assembledContext.content`
4. 当前实现不做截断，因此 `assembledContext.truncated = false`
5. 同时返回最小可用的 `contextPacket`
6. `assembledContext` 只是已索引 chunk 的连续文本视图，不等价于直接重读磁盘原文件

### 4.2 search_code_context 的当前语义

当前 `search_code_context` 已不再只是“返回原始检索命中列表”，而是同时返回一个 richer `contextPacket`：

1. 原始 `results[]` 仍保留，便于调试向量检索得分与召回原因
2. `contextPacket.items[]` 会先做去重，再按文件内相邻 chunk 合并
3. 合并后的 item 会补充 `estimatedTokens`、`mergedChunkIds`、`mergedFromCount`
4. `contextPacket.files[]` 会按最终返回 item 做文件级聚合摘要
5. `tokenBudget` 若传入，将驱动 `max_items` 截断，而不是只按 `topK` 生硬裁剪
6. `contextPacket.truncation` 会显式返回 `budgetTokens`、`estimatedTotalTokens` 与 `estimatedReturnedTokens`

### 5. 启动与索引链验证

已实现：

1. `createApp()` 单元测试
2. `createApp()` 真实 SurrealDB 集成测试
3. 真实整链路测试，验证 `prepare -> embed -> upsert -> search`
4. 基于子进程 stdio 的 MCP smoke test，验证真实 transport 接入

## MCP JSON 配置约定

当前 `mcp-server` 已经具备真实 MCP adapters 和 tools，配置模型也适合按 MCP server 进程做项目级隔离。

推荐约定是：

1. 一个 `mcp.json` server 条目对应一个 `PROJECT_SPACE`
2. 每个 server 条目通过 `env` 提供自己的 Surreal 与 embedding 配置
3. 不同项目不要复用同一个 `PROJECT_SPACE`
4. 同一个 `PROJECT_SPACE` 一旦写入 `project_metadata`，就不应再切换 provider / model / vectorDimension

### 必填环境变量

以下字段是当前配置模型要求的最小集合：

1. `PROJECT_SPACE`
2. `SURREAL_URL`
3. `SURREAL_DATABASE`
4. `EMBEDDING_PROVIDER`
5. `EMBEDDING_VECTOR_DIMENSION`
6. `EMBEDDING_API_KEY`

另外，Surreal 认证需要二选一：

1. `SURREAL_USERNAME` + `SURREAL_PASSWORD`
2. `SURREAL_TOKEN`

### 常用可选环境变量

1. `EMBEDDING_MODEL`
2. `EMBEDDING_BASE_URL`
3. `SURREAL_USE_TLS`
4. `SURREAL_DEPLOYMENT_MODE`
5. `DEFAULT_TOP_K`
6. `MCP_DEFAULT_REPOSITORY_ID`
7. `MCP_REPOSITORY_ROOT`
8. `DEFAULT_EMBEDDING_BATCH_SIZE`
9. `DEFAULT_EMBEDDING_CONCURRENCY`
10. `DEFAULT_SCAN_IGNORE_PATTERNS`
11. `DEFAULT_SCAN_INCLUDE_PATTERNS`
12. `DEFAULT_SCAN_GITIGNORE_PATH`
13. `SEARCH_NATIVE_CANDIDATE_MULTIPLIER`
14. `SEARCH_NATIVE_EF_SEARCH_MIN`
15. `LOG_LEVEL`
16. `LOG_PRETTY`
17. `LOG_FILE_PATH`
18. `LOG_FILE_PRETTY`

其中：

1. `MCP_DEFAULT_REPOSITORY_ID` 仅用于 MCP adapter 层在单仓库场景下回填缺省的 `repositoryId`
2. `MCP_REPOSITORY_ROOT` 仅用于 `index_repository` 与 `index_files` 这类需要访问文件系统的方法回填缺省的 `rootPath`
3. 它不会改变 `core` 层 use case 仍要求显式 `repositoryId` / `rootPath` 的事实；adapter 只是做默认值解析
4. 如果未来一个 server 要服务多个仓库，仍建议在每次 tool 调用时显式传入 `repositoryId`
5. `rootPath` 的解析优先级应为：tool 输入值 > `MCP_REPOSITORY_ROOT` > 校验错误
6. `embeddingBatchSize` 的解析优先级应为：tool 输入值 > `DEFAULT_EMBEDDING_BATCH_SIZE` > core 默认值
7. `embeddingConcurrency` 的解析优先级应为：tool 输入值 > `DEFAULT_EMBEDDING_CONCURRENCY` > core 默认值
8. `LOG_FILE_PATH` 若配置，则当前 server 会额外把日志写入本地文件，默认写结构化 JSON
9. `LOG_FILE_PRETTY=true` 时，文件日志会改为 pretty 文本格式，便于本地人工阅读
10. `DEFAULT_SCAN_INCLUDE_PATTERNS` 用于补充扫描阶段的白名单规则，采用逗号分隔；一旦命中，会覆盖 `DEFAULT_SCAN_IGNORE_PATTERNS` 与 `.gitignore` 的排除结果
11. `DEFAULT_SCAN_GITIGNORE_PATH` 若配置，则会读取该绝对路径指向的根 `.gitignore`，并将其中的排除规则并入扫描忽略集合
12. 如果未配置 `DEFAULT_SCAN_GITIGNORE_PATH`，但配置了 `MCP_REPOSITORY_ROOT`，则启动时会自动尝试读取 `MCP_REPOSITORY_ROOT/.gitignore`
13. 如果自动推导出的 `.gitignore` 文件不存在，则扫描器会忽略该步骤，不会导致启动失败
14. 如果没有配置 `MCP_DEFAULT_REPOSITORY_ID`，且调用 MCP tool 时也没有传 `repositoryId`，adapter 应直接返回校验错误，而不是猜测仓库身份
15. 如果没有配置 `MCP_REPOSITORY_ROOT`，且调用 `index_repository` / `index_files` 时也没有传 `rootPath`，adapter 应直接返回校验错误，而不是依赖工作目录推断仓库根目录

### 推荐的 mcp.json 形态

下面的示例体现的是“一个 server 对应一个项目配置”的推荐做法：

仓库内也提供了一份可直接参考、可带注释的示例文件：[.vscode/mcp.example.jsonc](../../.vscode/mcp.example.jsonc)。

```json
{
  "servers": {
    "agent-code-index-project-a": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "PROJECT_SPACE": "project_a",
        "SURREAL_URL": "ws://127.0.0.1:8100/rpc",
        "SURREAL_DATABASE": "default",
        "SURREAL_USERNAME": "surrealdb",
        "SURREAL_PASSWORD": "surrealdb",
        "SURREAL_USE_TLS": "false",
        "SURREAL_DEPLOYMENT_MODE": "local",
        "EMBEDDING_PROVIDER": "openai-compatible",
        "EMBEDDING_MODEL": "Qwen/Qwen3-Embedding-8B",
        "EMBEDDING_VECTOR_DIMENSION": "4096",
        "EMBEDDING_API_KEY": "${input:agentCodeIndexApiKey}",
        "EMBEDDING_BASE_URL": "https://api.siliconflow.cn/v1",
        "DEFAULT_TOP_K": "10",
        "MCP_DEFAULT_REPOSITORY_ID": "repo-a",
        "MCP_REPOSITORY_ROOT": "/workspace/repo-a",
        "DEFAULT_EMBEDDING_BATCH_SIZE": "16",
        "DEFAULT_EMBEDDING_CONCURRENCY": "8",
        "DEFAULT_SCAN_IGNORE_PATTERNS": "node_modules,.git,dist,build,.next,*.tsbuildinfo",
        "DEFAULT_SCAN_INCLUDE_PATTERNS": ".env.example,dist/schema.json",
        "DEFAULT_SCAN_GITIGNORE_PATH": "/workspace/repo-a/.gitignore",
        "SEARCH_NATIVE_CANDIDATE_MULTIPLIER": "20",
        "SEARCH_NATIVE_EF_SEARCH_MIN": "100",
        "LOG_LEVEL": "info",
        "LOG_PRETTY": "true",
        "LOG_FILE_PATH": "/tmp/agent-code-index/project-a.log",
        "LOG_FILE_PRETTY": "false"
      }
    },
    "agent-code-index-project-b": {
      "command": "node",
      "args": ["./packages/mcp-server/dist/index.js"],
      "env": {
        "PROJECT_SPACE": "project_b",
        "SURREAL_URL": "ws://127.0.0.1:8100/rpc",
        "SURREAL_DATABASE": "default",
        "SURREAL_USERNAME": "surrealdb",
        "SURREAL_PASSWORD": "surrealdb",
        "SURREAL_USE_TLS": "false",
        "SURREAL_DEPLOYMENT_MODE": "local",
        "EMBEDDING_PROVIDER": "voyage",
        "EMBEDDING_MODEL": "voyage-code-3",
        "EMBEDDING_VECTOR_DIMENSION": "1024",
        "EMBEDDING_API_KEY": "${input:voyageApiKey}",
        "DEFAULT_TOP_K": "10",
        "MCP_DEFAULT_REPOSITORY_ID": "repo-b",
        "MCP_REPOSITORY_ROOT": "/workspace/repo-b",
        "DEFAULT_EMBEDDING_BATCH_SIZE": "16",
        "DEFAULT_EMBEDDING_CONCURRENCY": "8",
        "DEFAULT_SCAN_IGNORE_PATTERNS": "node_modules,.git,dist,build,.next,*.tsbuildinfo",
        "DEFAULT_SCAN_INCLUDE_PATTERNS": ".env.example,dist/schema.json",
        "DEFAULT_SCAN_GITIGNORE_PATH": "/workspace/repo-b/.gitignore",
        "SEARCH_NATIVE_CANDIDATE_MULTIPLIER": "20",
        "SEARCH_NATIVE_EF_SEARCH_MIN": "100",
        "LOG_LEVEL": "info",
        "LOG_PRETTY": "true",
        "LOG_FILE_PATH": "/tmp/agent-code-index/project-b.log",
        "LOG_FILE_PRETTY": "false"
      }
    }
  }
}
```

### 为什么推荐这种方式

1. 当前 `loadConfig()` 直接读取进程环境变量，实现简单且可预测
2. `PROJECT_SPACE` 会派生 Surreal namespace，避免每个项目重复维护两套标识
3. 项目级 provider / model / vectorDimension 锁定已经在启动期校验，不容易混索引
4. 单仓库 server 可以通过 `MCP_DEFAULT_REPOSITORY_ID` 与 `MCP_REPOSITORY_ROOT` 降低 tool 调用时的重复参数
5. 未配置默认值时可以强制调用方显式传入 `repositoryId` 或 `rootPath`，避免作用域歧义
6. 这种方式比依赖工作目录推断仓库根目录更稳定、更可测试
7. 这种方式比“一个进程动态切多个项目”更符合当前 v1 的稳定性目标

### 当前限制

1. 当前已实现的 tools 包括 `index_repository`、`search_code_context`、`index_files`、`delete_files`、`get_file_context`
2. `search_code_context` 已具备 richer `ContextBuilder`、相邻 chunk 合并和 token budget 驱动的 `max_items` 截断，但跨文件重排与更复杂的 query-aware summarization 仍未落地
3. 当前更适合每个项目起一个独立 server 进程，而不是共享一个进程做多项目动态路由
4. `mcp.json` 中不建议直接提交明文 API key、token 或数据库密码

## 本地启动与最小接入示例

下面给出一个最小可运行的本地流程，用来验证当前 stdio MCP server 的实际接入方式。

### 1. 构建 server

在仓库根目录执行：

```bash
yarn build
```

构建完成后，stdio 入口为：

```text
./packages/mcp-server/dist/index.js
```

### 1.1 开发态直接运行 TypeScript 源码

为了本地联调和更容易定位启动时报错，当前仓库也支持直接运行 TypeScript 源码入口：

```bash
corepack yarn mcp:dev
```

这个命令实际会通过 `tsx` 运行：

```text
./packages/mcp-server/src/index.ts
```

并且会额外开启 Node.js 的 `development` 条件导出解析，因此 `mcp-server` 通过包名导入的 `@agent-code-index/core` 与 `@agent-code-index/infra` 在开发态也会优先落到各自的 `src/index.ts`，而不是旧的 `dist/index.js`。

建议：

1. 本地排查配置、启动和 stack trace 时，优先用源码入口
2. 稳定使用或对外共享配置时，优先用构建产物入口

### 2. 通过 MCP host 配置接入

如果使用支持 `mcp.json` 的 host，可配置一个最小条目。

开发态联调时，推荐直接运行源码入口：

```json
{
  "servers": {
    "agent-code-index-local": {
      "command": "corepack",
      "args": ["yarn", "mcp:dev"],
      "env": {
        "PROJECT_SPACE": "agent_code_index_local",
        "SURREAL_URL": "ws://127.0.0.1:8100/rpc",
        "SURREAL_DATABASE": "default",
        "SURREAL_USERNAME": "surrealdb",
        "SURREAL_PASSWORD": "surrealdb",
        "SURREAL_USE_TLS": "false",
        "SURREAL_DEPLOYMENT_MODE": "local",
        "EMBEDDING_PROVIDER": "openai-compatible",
        "EMBEDDING_MODEL": "Qwen/Qwen3-Embedding-8B",
        "EMBEDDING_VECTOR_DIMENSION": "4096",
        "EMBEDDING_API_KEY": "<your-api-key>",
        "EMBEDDING_BASE_URL": "https://api.siliconflow.cn/v1",
        "MCP_DEFAULT_REPOSITORY_ID": "agent-code-index",
        "MCP_REPOSITORY_ROOT": "/home/janex/project/ai-agent/agent-code-index",
        "DEFAULT_EMBEDDING_BATCH_SIZE": "16",
        "DEFAULT_EMBEDDING_CONCURRENCY": "8",
        "LOG_FILE_PATH": "/tmp/agent-code-index/local.log",
        "LOG_FILE_PRETTY": "false"
      }
    }
  }
}
```

这条配置的含义是：

1. host 会以子进程方式启动 `corepack yarn mcp:dev`
2. server 通过标准输入输出与 host 通信，而不是监听 HTTP 端口
3. `repositoryId` 与 `rootPath` 可在单仓场景下通过环境变量提供默认值
4. 日志会额外写入本地文件，便于联调时排查启动和运行问题

如果你更希望使用构建产物运行，可把上面的启动方式替换为：

```json
{
  "command": "node",
  "args": ["./packages/mcp-server/dist/index.js"]
}
```

### 3. 最小调用示例

接入成功后，可以直接让 host 调用以下 tool 参数。

先做一次全量索引：

```json
{
  "name": "index_repository",
  "arguments": {
    "mode": "full",
    "embeddingBatchSize": 16,
    "embeddingConcurrency": 8
  }
}
```

参数含义：

1. `embeddingBatchSize`：单次请求携带的 chunk 数量
2. `embeddingConcurrency`：允许同时并发的批次数量，默认 `1`

### 3.1 已验证的默认值与覆盖规则

截至 2026-03-23，当前仓库已经在本地开发态配置下完成过一轮 live 验证，验证场景为：

1. MCP host 通过 `corepack yarn mcp:dev` 直接启动 TypeScript 源码入口
2. embedding provider 使用 `openai-compatible`
3. embedding model 使用 `Qwen/Qwen3-Embedding-8B`
4. `PROJECT_SPACE` 使用独立的 `agent_code_index_qwen`，避免与旧的 Voyage 元数据冲突
5. `DEFAULT_EMBEDDING_BATCH_SIZE=16`
6. `DEFAULT_EMBEDDING_CONCURRENCY=8`

已确认的行为如下：

1. 当 `index_files` 或 `index_repository` 不显式传 `embeddingBatchSize` / `embeddingConcurrency` 时，adapter 会优先回填 `DEFAULT_EMBEDDING_BATCH_SIZE` 与 `DEFAULT_EMBEDDING_CONCURRENCY`
2. 当前 live 验证中，不显式传参时，日志已确认实际生效值为 `batchSize=16`、`embeddingConcurrency=8`
3. 当 tool 调用显式传入参数时，显式值会覆盖环境默认值
4. 当前 live 验证中，显式传 `embeddingBatchSize=4`、`embeddingConcurrency=2` 后，日志已确认实际生效值变为 `4 / 2`
5. 在 `16 / 8` 的默认配置下，已完成一次真实 `index_repository` 全量索引，结果为：`scannedFileCount=156`、`parsedFileCount=156`、`preparedChunkCount=1340`、`storedChunkCount=1340`、`failedFileCount=0`

因此，当前默认值优先级可以明确写成：

1. tool 显式输入
2. `DEFAULT_EMBEDDING_BATCH_SIZE` / `DEFAULT_EMBEDDING_CONCURRENCY`
3. `core` 层保守默认值 `32 / 1`

然后读取某个文件的已索引上下文：

```json
{
  "name": "get_file_context",
  "arguments": {
    "filePath": "packages/mcp-server/src/server.ts"
  }
}
```

预期结果要点：

1. 返回值中包含 `repositoryId`、`filePath`、`chunkCount`
2. `chunks[]` 会给出结构化 chunk 明细
3. `assembledContext.content` 会给出适合 Agent 连续阅读的文本

### 4. 调试判断标准

如果 stdio 接入正确，通常会观察到：

1. 启动日志中会出现 `Application startup completed`
2. `index_repository` / `index_files` 的日志中会带出 `batchSize` 与 `embeddingConcurrency`
3. 当日志字段中包含 `error: Error` 时，当前 logger 已会序列化 `name / message / stack`
4. 如果启动失败发生在 `project_metadata` 校验阶段，日志中应能直接看到类似 `Project metadata mismatch: expected ... received ...` 的完整错误信息，而不是只有空对象
5. host 能成功列出 5 个 tools
6. `index_repository` 可以在不显式传 `repositoryId` / `rootPath` 的情况下运行
7. `get_file_context` 可以在不显式传 `repositoryId` 的情况下返回目标文件的已索引上下文
8. 如果漏配 `MCP_DEFAULT_REPOSITORY_ID` 或 `MCP_REPOSITORY_ROOT`，server 会返回明确的校验错误，而不是猜测默认值

## 当前边界

`mcp-server` 当前明确还不负责：

1. 更完整的 `ContextPacket` 与检索结果二次组装
2. 定义核心业务语义
3. 实现具体存储和 embedding 技术细节

这些职责分别属于未来的协议适配层，以及 `core` / `infra`。

## 当前状态总结

从当前项目进度来看，`mcp-server` 已经不再只是配置占位层，而是已经具备：

1. 可运行的配置加载与校验能力
2. 可运行的应用容器装配能力
3. 启动阶段的真实数据库健康检查与元数据锁定能力
4. 对完整最小索引链的运行时装配能力
5. 可通过 stdio 对外暴露的 MCP tool server
6. 文件级已索引上下文读取能力

也就是说，当前 `mcp-server` 已经承担起“把系统真正启动起来、装配完成并暴露当前可用 tools”的职责；下一阶段主要集中在更完整的上下文包组装，而不是补最小可用 tool 集。
