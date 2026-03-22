# @agent-code-index/mcp-server

`packages/mcp-server` 是当前项目的运行时装配与协议接入模块，负责把 `core` 与 `infra` 组合成一个可启动的应用。

这一层的目标是：

1. 读取运行时配置
2. 创建并装配依赖容器
3. 在启动阶段执行必要校验
4. 为后续 MCP tool/server 接入提供运行时入口

当前阶段，`mcp-server` 已经具备完整的启动装配能力，但还没有真正对外暴露 MCP tools。

## 模块职责

当前 `mcp-server` 主要承担三类职责：

1. 配置加载与校验
2. 应用依赖装配
3. 启动阶段健康检查与元数据校验

## 当前目录结构

```text
src/
  bootstrap/
    app.ts
    config.ts
    container.ts
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
7. 校验 embedding 必填配置

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
7. `searchRepository`
8. `indexRepositoryService`
9. `projectMetadataRepository`

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

当前只导出 `createApp`，作为后续 server 启动逻辑的复用入口。

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

### 4. 启动与索引链验证

已实现：

1. `createApp()` 单元测试
2. `createApp()` 真实 SurrealDB 集成测试
3. 真实整链路测试，验证 `prepare -> embed -> upsert -> search`

## MCP JSON 配置约定

当前 `mcp-server` 还没有真正的 MCP adapters 和 tools，但配置模型已经适合按 MCP server 进程做项目级隔离。

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
8. `DEFAULT_SCAN_IGNORE_PATTERNS`
9. `SEARCH_NATIVE_CANDIDATE_MULTIPLIER`
10. `SEARCH_NATIVE_EF_SEARCH_MIN`
11. `LOG_LEVEL`
12. `LOG_PRETTY`

其中：

1. `MCP_DEFAULT_REPOSITORY_ID` 仅用于 MCP adapter 层在单仓库场景下回填缺省的 `repositoryId`
2. `MCP_REPOSITORY_ROOT` 仅用于 `index_repository` 与 `index_files` 这类需要访问文件系统的方法回填缺省的 `rootPath`
3. 它不会改变 `core` 层 use case 仍要求显式 `repositoryId` / `rootPath` 的事实；adapter 只是做默认值解析
4. 如果未来一个 server 要服务多个仓库，仍建议在每次 tool 调用时显式传入 `repositoryId`
5. `rootPath` 的解析优先级应为：tool 输入值 > `MCP_REPOSITORY_ROOT` > 校验错误
6. 如果没有配置 `MCP_DEFAULT_REPOSITORY_ID`，且调用 MCP tool 时也没有传 `repositoryId`，adapter 应直接返回校验错误，而不是猜测仓库身份
7. 如果没有配置 `MCP_REPOSITORY_ROOT`，且调用 `index_repository` / `index_files` 时也没有传 `rootPath`，adapter 应直接返回校验错误，而不是依赖工作目录推断仓库根目录

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
        "DEFAULT_SCAN_IGNORE_PATTERNS": "node_modules,.git,dist,build,.next",
        "SEARCH_NATIVE_CANDIDATE_MULTIPLIER": "20",
        "SEARCH_NATIVE_EF_SEARCH_MIN": "100",
        "LOG_LEVEL": "info",
        "LOG_PRETTY": "true"
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
        "DEFAULT_SCAN_IGNORE_PATTERNS": "node_modules,.git,dist,build,.next",
        "SEARCH_NATIVE_CANDIDATE_MULTIPLIER": "20",
        "SEARCH_NATIVE_EF_SEARCH_MIN": "100",
        "LOG_LEVEL": "info",
        "LOG_PRETTY": "true"
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

1. 现在还没有真正的 MCP tool registration，所以这份约定描述的是“配置模型如何接入 MCP host”，不是“当前已经可直接启动的完整协议层”
2. 当前更适合每个项目起一个独立 server 进程，而不是共享一个进程做多项目动态路由
3. `mcp.json` 中不建议直接提交明文 API key、token 或数据库密码
4. [.vscode/mcp.example.jsonc](../../.vscode/mcp.example.jsonc) 当前提供的是配置字段和项目隔离方式示例；真正可运行的 server entry 仍要等 MCP adapters / tools 落地后再收口

## 当前边界

`mcp-server` 当前明确还不负责：

1. 真正初始化并启动 MCP server
2. 注册 MCP tools
3. 处理 MCP 请求和响应映射
4. 定义核心业务语义
5. 实现具体存储和 embedding 技术细节

这些职责分别属于未来的协议适配层，以及 `core` / `infra`。

## 当前状态总结

从当前项目进度来看，`mcp-server` 已经不再只是配置占位层，而是已经具备：

1. 可运行的配置加载与校验能力
2. 可运行的应用容器装配能力
3. 启动阶段的真实数据库健康检查与元数据锁定能力
4. 对完整最小索引链的运行时装配能力

也就是说，当前 `mcp-server` 已经承担起“把系统真正启动起来并装配完成”的职责；下一阶段再继续补协议入口和 MCP tools 即可。
