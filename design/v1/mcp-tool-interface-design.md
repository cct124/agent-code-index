# agent-code-index MCP Tool Interface 设计

## 1. 文档目标

本文档定义 `agent-code-index` 对 Agent 暴露的 MCP Tool 接口契约。

这份文档关注的是：

1. Tool 名称
2. 输入输出 schema
3. 字段稳定性与默认值
4. adapter 层与 `core/services` 的映射关系
5. 错误模型与当前实现边界

这份文档不重复讨论：

1. 包分层与依赖方向
2. Surreal schema 与检索实现细节
3. parser 与 embedding provider 的底层技术方案

这些内容分别见：

1. [README.md](README.md)
2. [surreal-native-vector-search-migration.md](surreal-native-vector-search-migration.md)

## 2. 当前状态

截至 2026-03-22，MCP 暴露层的状态是：

1. `packages/mcp-server` 已完成配置加载、容器装配与启动期校验
2. `DefaultIndexRepositoryService` 已落地，可作为 `index_repository` 的核心 use case
3. `DefaultSearchCodeContextService` 已落地，可作为 `search_code_context` 的核心 use case
4. `get-file-context-service` 尚未落地
5. MCP server、tool registration、协议输入输出映射尚未落地

因此，本文档中的接口分为两类：

1. `index_repository` / `search_code_context`：可立即进入 adapter 实现
2. `get_file_context`：先冻结契约，待 `core` service 落地后再实现

## 3. 设计原则

### 3.1 Tool 名称使用稳定 snake_case

建议的公开 Tool 名称为：

1. `index_repository`
2. `search_code_context`
3. `get_file_context`

原因：

1. 与 `core/services` 的命名语义一致
2. 对 Agent 与跨语言调用方更稳定
3. 避免将 TypeScript 文件名直接暴露为外部契约

### 3.2 Adapter 只做协议映射，不重写业务规则

MCP adapter 负责：

1. 输入校验
2. 默认值填充
3. 调用 `core/services`
4. 输出结构映射
5. 错误转换

MCP adapter 不负责：

1. 重新实现索引逻辑
2. 重新实现检索逻辑
3. 直接操作 Surreal 或 embedding provider

### 3.3 Tool 输出优先使用稳定 structured payload

建议每个 tool 在 adapter 层统一返回两类信息：

1. 结构化 payload：供 Agent 程序化消费
2. 简短文本摘要：供 MCP client 直接展示

v1 设计重点在结构化 payload，不以自然语言文本为主契约。

### 3.4 一个 MCP server 实例服务一个项目配置

当前项目采用项目级配置锁定：

1. 一个进程读取一组环境变量
2. 一个 `PROJECT_SPACE` 绑定一组 provider / model / vectorDimension
3. Tool 输入不负责切换 embedding 配置

MCP `mcp.json` 中推荐通过不同 server 条目完成项目级隔离。

### 3.5 单仓库场景允许 adapter 注入默认 repositoryId

在当前设计里，`repositoryId` 仍然是 `core` use case 的稳定业务键，但 MCP adapter 可以为单仓库部署提供默认值回填能力。

推荐约定：

1. `core/services` 继续要求显式 `repositoryId`
2. MCP tool 输入中的 `repositoryId` 可以为可选字段
3. 当 tool 输入未提供 `repositoryId` 时，adapter 可使用 `MCP_DEFAULT_REPOSITORY_ID` 回填
4. 若 tool 输入与 `MCP_DEFAULT_REPOSITORY_ID` 都未提供，则返回 `validation_error`

这样可以兼顾：

1. 单仓库 server 的调用简洁性
2. 多仓库场景下的显式路由能力
3. 领域层与协议层的职责分离

## 4. Tool 列表总览

| Tool                  | 当前状态 | 核心依赖                          | v1 输出形态             |
| --------------------- | -------- | --------------------------------- | ----------------------- |
| `index_repository`    | 可实现   | `DefaultIndexRepositoryService`   | 索引摘要                |
| `search_code_context` | 可实现   | `DefaultSearchCodeContextService` | `SearchResult[]` + 摘要 |
| `get_file_context`    | 待实现   | `GetFileContextService`           | 文件上下文包            |

## 5. 通用输入约束

所有 tool 共用以下通用约束：

1. 字符串输入先 `trim()` 再校验
2. 空字符串按未提供处理
3. `topK`、`embeddingBatchSize` 等数值字段必须为正整数
4. 未知 filter 字段直接拒绝，不做静默忽略
5. tool 输入不允许覆盖 `PROJECT_SPACE`、embedding provider、embedding model 等进程级配置
6. `repositoryId` 的解析优先级为：tool 输入值 > `MCP_DEFAULT_REPOSITORY_ID` > 校验错误

## 6. index_repository

### 6.1 Tool 名称

`index_repository`

### 6.2 用途

触发一次仓库索引，将指定根目录下的内容扫描、切块、embedding 并写入存储。

### 6.3 输入 schema

```ts
interface IndexRepositoryToolInput {
  repositoryId?: string;
  rootPath: string;
  mode?: "full";
  embeddingBatchSize?: number;
}
```

字段说明：

1. `repositoryId`：逻辑仓库标识，可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. `rootPath`：待索引仓库根目录，必填
3. `mode`：当前仅支持 `full`，可选，默认 `full`
4. `embeddingBatchSize`：embedding 批大小提示，可选

校验规则：

1. `rootPath` 不能为空
2. `mode` 目前若提供，则只能为 `full`
3. `embeddingBatchSize` 若提供，必须为正整数
4. `repositoryId` 在 adapter 回填后不能为空

### 6.4 Core 映射

直接映射到：

1. `DefaultIndexRepositoryService.execute(input)`

注意：adapter 在调用 `core` 前，必须先把最终解析后的 `repositoryId` 补齐为必填字段。

### 6.5 输出 schema

```ts
interface IndexRepositoryToolResult {
  repositoryId: string;
  mode: "full";
  summary: {
    scannedFileCount: number;
    parsedFileCount: number;
    skippedFileCount: number;
    preparedChunkCount: number;
    embeddedChunkCount: number;
    storedChunkCount: number;
    failedFileCount: number;
  };
  failedFiles: Array<{
    filePath: string;
    reason: string;
  }>;
}
```

说明：

1. `summary` 字段保持与 `IndexRepositoryResult` 高度一致
2. `failedFiles` 保留原始失败明细，不在 adapter 层重写原因文本

### 6.6 最小文本摘要

建议返回一条简短文本，例如：

`Indexed repository repo-a: scanned 120 files, stored 486 chunks, failed 2 files.`

## 7. search_code_context

### 7.1 Tool 名称

`search_code_context`

### 7.2 用途

接收自然语言查询，生成 query embedding，执行语义检索并返回候选代码上下文。

### 7.3 输入 schema

```ts
interface SearchCodeContextToolInput {
  repositoryId?: string;
  query: string;
  topK?: number;
  filters?: {
    filePath?: string;
    language?: string;
    hash?: string;
    startLine?: number;
    endLine?: number;
    symbolName?: string;
    symbolKind?: string;
    parentSymbol?: string;
    heading?: string;
    docType?: string;
    sectionLevel?: number;
    tags?: string | string[];
  };
}
```

字段说明：

1. `repositoryId`：逻辑仓库标识，可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. `query`：自然语言查询，必填
3. `topK`：返回结果数，可选，默认使用 `DEFAULT_TOP_K`
4. `filters`：精确过滤条件，可选

当前支持的 filter 白名单：

1. `filePath`
2. `language`
3. `hash`
4. `startLine`
5. `endLine`
6. `symbolName`
7. `symbolKind`
8. `parentSymbol`
9. `heading`
10. `docType`
11. `sectionLevel`
12. `tags`

校验规则：

1. `query.trim()` 后不能为空
2. `topK` 若未提供，adapter 从进程配置填默认值
3. `topK` 必须为正整数
4. 未在白名单中的 `filters` 字段直接报错
5. `repositoryId` 在 adapter 回填后不能为空

### 7.4 Core 映射

直接映射到：

1. `DefaultSearchCodeContextService.execute(input)`

注意：adapter 在调用 `core` 前，必须先把最终解析后的 `repositoryId` 补齐为必填字段。

### 7.5 v1 输出 schema

当前 `core` 返回的是 `SearchResult[]`，因此 v1 的 MCP 输出应先稳定为：

```ts
interface SearchCodeContextToolResult {
  repositoryId: string;
  query: string;
  topK: number;
  resultCount: number;
  results: Array<{
    score: number;
    reason: string;
    chunk: {
      id: string;
      repositoryId: string;
      filePath: string;
      language: string;
      content: string;
      searchText: string;
      startLine: number;
      endLine: number;
      hash: string;
      metadata: Record<string, unknown>;
    };
  }>;
  contextPacket?: never;
}
```

说明：

1. v1 不要求 `ContextPacket`
2. 输出中保留 `reason`，用于区分后续检索策略变化
3. `chunk.embedding` 不建议默认暴露给 Agent，除非调试模式显式开启

### 7.6 v2 演进方向

待 `ContextBuilder` 落地后，可演进为：

1. `results` 保留为调试字段或次级字段
2. 主输出升级为 `contextPacket`

## 8. get_file_context

### 8.1 Tool 名称

`get_file_context`

### 8.2 用途

按仓库与文件路径拉取文件级上下文，供 Agent 做连续阅读或二次分析。

### 8.3 当前状态

当前只有契约设计，`core` service 尚未落地，因此该 tool 仍处于预留状态。

### 8.4 输入 schema

```ts
interface GetFileContextToolInput {
  repositoryId?: string;
  filePath: string;
}
```

说明：

1. `repositoryId` 可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. 真正调用未来的 `GetFileContextService` 前，adapter 仍必须解析出最终的必填 `repositoryId`

### 8.5 目标输出 schema

```ts
interface GetFileContextToolResult {
  repositoryId: string;
  filePath: string;
  chunkCount: number;
  chunks: Array<{
    id: string;
    filePath: string;
    language: string;
    content: string;
    startLine: number;
    endLine: number;
    metadata: Record<string, unknown>;
  }>;
  assembledContext: {
    content: string;
    truncated: boolean;
  };
}
```

说明：

1. `chunks` 提供结构化来源
2. `assembledContext` 提供对 Agent 更友好的连续文本
3. 是否截断由未来 `GetFileContextService` 负责定义

## 9. 错误模型

### 9.1 目标

MCP adapter 层应对底层错误做稳定映射，避免直接把内部实现细节暴露给 Agent。

### 9.2 v1 建议错误结构

```ts
interface ToolErrorPayload {
  code:
    | "validation_error"
    | "configuration_error"
    | "startup_error"
    | "index_repository_error"
    | "search_code_context_error"
    | "get_file_context_not_available"
    | "storage_error"
    | "provider_error";
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}
```

### 9.3 当前约束

当前仓库还没有形成跨 provider / MCP / storage 的统一错误码文档，因此：

1. 上述 `code` 先作为 adapter 层的第一版稳定枚举
2. storage 层已有的 `errCode / retryable / httpStatus` 应尽量映射进入 `details`
3. provider 级错误分类待后续工程化收口后再统一

当缺失 `repositoryId` 且未配置 `MCP_DEFAULT_REPOSITORY_ID` 时，adapter 应返回：

1. `code = "validation_error"`
2. `message` 明确说明需要显式传入 `repositoryId` 或配置 `MCP_DEFAULT_REPOSITORY_ID`

## 10. Tool 与 Core 映射总表

| Tool                  | Core service                      | 当前状态 | 备注                            |
| --------------------- | --------------------------------- | -------- | ------------------------------- |
| `index_repository`    | `DefaultIndexRepositoryService`   | 已可接入 | 可直接落 adapter                |
| `search_code_context` | `DefaultSearchCodeContextService` | 已可接入 | 当前输出先保持 `SearchResult[]` |
| `get_file_context`    | `GetFileContextService`           | 未实现   | 先冻结接口                      |

## 11. 示例

### 11.1 index_repository

输入：

```json
{
  "rootPath": "/workspace/repo-a",
  "mode": "full",
  "embeddingBatchSize": 16
}
```

### 11.2 search_code_context

输入：

```json
{
  "query": "shipping quote service factory create method",
  "topK": 5,
  "filters": {
    "language": "typescript",
    "tags": ["static"]
  }
}
```

### 11.3 get_file_context

输入：

```json
{
  "filePath": "src/shipping.ts"
}
```

## 12. 结论

当前仓库已经具备把 `index_repository` 与 `search_code_context` 通过 MCP tool 暴露出去的核心 use case，但还缺少协议层实现与 `get_file_context` service。

因此，下一阶段最合理的推进顺序是：

1. 先按本文档实现 `index_repository` 与 `search_code_context` adapter
2. 再补 `get_file_context` service 与 tool
3. 最后把 `search_code_context` 从 `SearchResult[]` 升级到 `ContextPacket`
