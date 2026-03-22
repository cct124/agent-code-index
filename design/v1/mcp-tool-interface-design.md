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
2. `DefaultIndexRepositoryService` 已通过 `index_repository` tool 对外暴露
3. `DefaultSearchCodeContextService` 已通过 `search_code_context` tool 对外暴露
4. `IndexFilesService` 已落地，并已通过 `index_files` tool 对外暴露
5. `DeleteFilesService` 已落地，并已通过 `delete_files` tool 对外暴露
6. `get-file-context-service` 尚未落地

因此，本文档中的接口分为两类：

1. `index_repository` / `search_code_context` / `index_files` / `delete_files`：已实现并已通过 MCP adapter 暴露
2. `get_file_context`：已按最小可用契约落地，后续再扩展更强的上下文包组装

## 3. 设计原则

### 3.1 Tool 名称使用稳定 snake_case

建议的公开 Tool 名称为：

1. `index_repository`
2. `search_code_context`
3. `index_files`
4. `delete_files`
5. `get_file_context`

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

### 3.5.1 需要访问文件系统的方法允许注入默认 repository root

对于需要直接读取仓库文件内容的 tool，adapter 可以通过环境变量注入固定仓库根目录。

推荐约定：

1. 新增环境变量 `MCP_REPOSITORY_ROOT`
2. 仅 `index_repository` 与 `index_files` 支持 `rootPath` 的默认回填
3. `rootPath` 的解析优先级为：tool 输入值 > `MCP_REPOSITORY_ROOT` > 校验错误
4. `search_code_context`、`delete_files`、`get_file_context` 不引入 `rootPath`

这样可以兼顾：

1. 单仓库 server 的简洁调用体验
2. 多仓库或特殊场景下的显式覆盖能力
3. 避免把不需要文件系统访问的方法和 `rootPath` 绑定在一起

### 3.6 文件级增量更新优先暴露两个核心方法

对于项目持续开发场景，v1 建议把文件级增量更新拆成两个核心 tool：

1. `index_files`
2. `delete_files`

不单独把 `update_files` 作为公开核心契约，原因是：

1. `index_files` 可以直接定义为“覆盖式重建文件索引”
2. 对已存在文件，`index_files` 内部应先删除旧 chunk 再重建
3. 对新增文件，`index_files` 直接建立索引
4. 对删除文件，调用 `delete_files` 更直接，不需要额外包装层

因此，v1 的公开契约优先保持为：

1. 新增文件：`index_files`
2. 修改文件：`index_files`
3. 删除文件：`delete_files`
4. 重命名文件：`delete_files(oldPaths)` + `index_files(newPaths)`

## 4. Tool 列表总览

| Tool                  | 当前状态 | 核心依赖                          | v1 输出形态               |
| --------------------- | -------- | --------------------------------- | ------------------------- |
| `index_repository`    | 已实现   | `DefaultIndexRepositoryService`   | 索引摘要                  |
| `search_code_context` | 已实现   | `DefaultSearchCodeContextService` | `results + contextPacket` |
| `index_files`         | 已实现   | `IndexFilesService`               | 文件级重建摘要            |
| `delete_files`        | 已实现   | `DeleteFilesService`              | 删除摘要                  |
| `get_file_context`    | 已实现   | `GetFileContextService`           | 返回文件级连续上下文包    |

## 5. 通用输入约束

所有 tool 共用以下通用约束：

1. 字符串输入先 `trim()` 再校验
2. 空字符串按未提供处理
3. `topK`、`embeddingBatchSize` 等数值字段必须为正整数
4. 未知 filter 字段直接拒绝，不做静默忽略
5. tool 输入不允许覆盖 `PROJECT_SPACE`、embedding provider、embedding model 等进程级配置
6. `repositoryId` 的解析优先级为：tool 输入值 > `MCP_DEFAULT_REPOSITORY_ID` > 校验错误
7. 仅 `index_repository` 与 `index_files` 使用 `rootPath` 解析规则：tool 输入值 > `MCP_REPOSITORY_ROOT` > 校验错误

## 6. index_repository

### 6.1 Tool 名称

`index_repository`

### 6.2 用途

触发一次仓库索引，将指定根目录下的内容扫描、切块、embedding 并写入存储。

### 6.3 输入 schema

```ts
interface IndexRepositoryToolInput {
  repositoryId?: string;
  rootPath?: string;
  mode?: "full";
  embeddingBatchSize?: number;
}
```

字段说明：

1. `repositoryId`：逻辑仓库标识，可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. `rootPath`：待索引仓库根目录，可选；未提供时由 adapter 尝试使用 `MCP_REPOSITORY_ROOT`
3. `mode`：当前仅支持 `full`，可选，默认 `full`
4. `embeddingBatchSize`：embedding 批大小提示，可选

校验规则：

1. `rootPath` 在 adapter 回填后不能为空
2. `mode` 目前若提供，则只能为 `full`
3. `embeddingBatchSize` 若提供，必须为正整数
4. `repositoryId` 在 adapter 回填后不能为空

### 6.4 Core 映射

直接映射到：

1. `DefaultIndexRepositoryService.execute(input)`

注意：adapter 在调用 `core` 前，必须先把最终解析后的 `repositoryId` 补齐为必填字段。

同样地，adapter 在调用 `core` 前，必须先把最终解析后的 `rootPath` 补齐为必填字段。

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

### 7.5 当前输出 schema

当前 `core` 已返回 `results + contextPacket` 双轨结果，因此 MCP 输出稳定为：

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
  contextPacket: {
    kind: "search";
    repositoryId: string;
    query: string;
    items: Array<{
      type: "search_match";
      id?: string;
      filePath: string;
      language: string;
      startLine: number;
      endLine: number;
      content: string;
      score?: number;
      reason?: string;
      metadata: Record<string, unknown>;
    }>;
    files: Array<{
      filePath: string;
      language: string;
      chunkCount: number;
      startLine: number;
      endLine: number;
    }>;
    instructions: string[];
    deduplication: {
      strategy: "none" | "chunk_id" | "file_path_line_range";
      inputItems: number;
      removedItems: number;
    };
    truncation: {
      truncated: boolean;
      strategy: "none" | "top_k" | "max_items";
      totalItems: number;
      returnedItems: number;
      omittedItems: number;
      limit?: number;
    };
  };
}
```

说明：

1. `results` 保留原始检索结果，便于调试与策略对比
2. `contextPacket` 提供统一的 Agent 消费出口
3. `contextPacket.deduplication` 明确去重策略与去重数量
4. `contextPacket.truncation` 明确截断策略、截断上限与省略数量
5. `chunk.embedding` 不建议默认暴露给 Agent，除非调试模式显式开启

### 7.6 后续演进方向

待 `ContextBuilder` 落地后，可演进为：

1. `results` 保留为调试字段或次级字段
2. `contextPacket` 增加更复杂的预算控制、相邻 chunk 合并和重排说明

## 8. index_files

### 8.1 Tool 名称

`index_files`

### 8.2 用途

对指定文件列表执行文件级覆盖式重建，把这些文件重新转换为 RAG 数据并写入存储。

该 tool 的目标不是“只追加新 chunk”，而是保证给定文件在存储中的索引结果与当前文件内容一致。

### 8.3 当前状态

当前已落地 `IndexFilesService`、`ChunkRepository.deleteByFilePaths(...)`、`RepositoryFileChunkPreparationService` 和 MCP adapter，并已通过 MCP tool 对外暴露。

### 8.4 输入 schema

```ts
interface IndexFilesToolInput {
  repositoryId?: string;
  rootPath?: string;
  filePaths: string[];
  embeddingBatchSize?: number;
}
```

字段说明：

1. `repositoryId`：逻辑仓库标识，可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. `rootPath`：仓库根目录，可选；未提供时由 adapter 尝试使用 `MCP_REPOSITORY_ROOT`
3. `filePaths`：待重建索引的相对文件路径列表，必填
4. `embeddingBatchSize`：embedding 批大小提示，可选

校验规则：

1. `rootPath` 在 adapter 回填后不能为空
2. `filePaths` 不能为空数组
3. `filePaths` 中每个元素 `trim()` 后不能为空
4. `filePaths` 中不允许重复路径
5. `embeddingBatchSize` 若提供，必须为正整数
6. `repositoryId` 在 adapter 回填后不能为空

### 8.5 语义约束

`index_files` 应定义为“覆盖式重建”，即：

1. 如果目标文件已有旧 chunk，先删除这些旧 chunk
2. 再读取当前文件内容并重新解析、embedding、写入
3. 如果目标文件原本没有索引数据，则直接新增

因此，调用方在“文件修改”场景下不需要先显式调用 `delete_files`，直接调用 `index_files` 即可。

如果 server 已配置 `MCP_REPOSITORY_ROOT`，调用方可以只传仓库内相对 `filePaths`，不再重复传入 `rootPath`。

### 8.6 Core 映射

当前映射为：

1. `IndexFilesService.execute(input)`
2. `ChunkRepository.deleteByFilePaths(input)`
3. `RepositoryFileChunkPreparationService.prepareFiles(input)`

### 8.7 输出 schema

```ts
interface IndexFilesToolResult {
  repositoryId: string;
  requestedFileCount: number;
  indexedFileCount: number;
  deletedChunkCount?: number;
  preparedChunkCount: number;
  embeddedChunkCount: number;
  storedChunkCount: number;
  failedFileCount: number;
  failedFiles: Array<{
    filePath: string;
    reason: string;
  }>;
}
```

说明：

1. `requestedFileCount` 表示请求处理的文件数
2. `indexedFileCount` 表示成功完成覆盖式重建的文件数
3. `deletedChunkCount` 可选；底层如果容易统计则返回，否则可先省略
4. `failedFiles` 保留逐文件失败明细

### 8.8 最小文本摘要

建议返回一条简短文本，例如：

`Indexed 3 files for repo-a: stored 18 chunks, failed 1 file.`

## 9. delete_files

### 9.1 Tool 名称

`delete_files`

### 9.2 用途

删除指定文件列表对应的全部 chunk，用于处理文件删除、旧路径清理、重命名前的旧路径移除等场景。

### 9.3 当前状态

当前已落地 `DeleteFilesService` 与 `ChunkRepository.deleteByFilePaths(...)`，并已通过 MCP tool 对外暴露。

### 9.4 输入 schema

```ts
interface DeleteFilesToolInput {
  repositoryId?: string;
  filePaths: string[];
}
```

字段说明：

1. `repositoryId`：逻辑仓库标识，可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. `filePaths`：待删除索引的相对文件路径列表，必填

校验规则：

1. `filePaths` 不能为空数组
2. `filePaths` 中每个元素 `trim()` 后不能为空
3. `filePaths` 中不允许重复路径
4. `repositoryId` 在 adapter 回填后不能为空

### 9.5 Core 映射

当前映射为：

1. `DeleteFilesService.execute(input)`
2. `ChunkRepository.deleteByFilePaths(input)`

### 9.6 输出 schema

```ts
interface DeleteFilesToolResult {
  repositoryId: string;
  requestedFileCount: number;
  deletedFileCount: number;
  deletedChunkCount?: number;
  missingFileCount?: number;
}
```

说明：

1. `deletedFileCount` 表示成功执行删除动作的文件数
2. `deletedChunkCount` 可选；底层如果容易统计则返回，否则可先省略
3. `missingFileCount` 可选；如果底层能区分“本来没有索引数据”的文件可返回，否则可先省略

### 9.7 最小文本摘要

建议返回一条简短文本，例如：

`Deleted indexed data for 2 files in repo-a.`

## 10. get_file_context

### 10.1 Tool 名称

`get_file_context`

### 10.2 用途

按仓库与文件路径拉取文件级上下文，供 Agent 做连续阅读或二次分析。

### 10.3 当前状态

当前已落地最小可用版本：`core` service 与 MCP tool 已实现，可返回结构化 `chunks[]`、`assembledContext` 和最小 `contextPacket`。

### 10.4 输入 schema

```ts
interface GetFileContextToolInput {
  repositoryId?: string;
  filePath: string;
}
```

说明：

1. `repositoryId` 可选；未提供时由 adapter 尝试使用 `MCP_DEFAULT_REPOSITORY_ID`
2. 真正调用未来的 `GetFileContextService` 前，adapter 仍必须解析出最终的必填 `repositoryId`

### 10.5 目标输出 schema

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
  contextPacket: {
    kind: "file";
    repositoryId: string;
    items: Array<{
      type: "file_chunk";
      filePath: string;
      language: string;
      startLine: number;
      endLine: number;
      content: string;
      metadata: Record<string, unknown>;
    }>;
    files: Array<{
      filePath: string;
      language: string;
      chunkCount: number;
      startLine: number;
      endLine: number;
    }>;
    instructions: string[];
    truncation: {
      truncated: boolean;
      totalItems: number;
      returnedItems: number;
    };
  };
}
```

说明：

1. `chunks` 提供结构化来源
2. `assembledContext` 提供对 Agent 更友好的连续文本
3. `contextPacket` 提供稳定的最小上下文包结构，便于后续统一多类上下文输出
4. 当前实现不截断，因此 `truncated = false`；后续可在 `GetFileContextService` 内扩展截断策略

## 11. 错误模型

### 11.1 目标

MCP adapter 层应对底层错误做稳定映射，避免直接把内部实现细节暴露给 Agent。

### 11.2 v1 建议错误结构

```ts
interface ToolErrorPayload {
  code:
    | "validation_error"
    | "configuration_error"
    | "startup_error"
    | "index_repository_error"
    | "search_code_context_error"
    | "index_files_error"
    | "delete_files_error"
    | "get_file_context_not_available"
    | "storage_error"
    | "provider_error";
  message: string;
  retryable?: boolean;
  details?: Record<string, unknown>;
}
```

### 11.3 当前约束

当前仓库还没有形成跨 provider / MCP / storage 的统一错误码文档，因此：

1. 上述 `code` 先作为 adapter 层的第一版稳定枚举
2. storage 层已有的 `errCode / retryable / httpStatus` 应尽量映射进入 `details`
3. provider 级错误分类待后续工程化收口后再统一

当缺失 `repositoryId` 且未配置 `MCP_DEFAULT_REPOSITORY_ID` 时，adapter 应返回：

1. `code = "validation_error"`
2. `message` 明确说明需要显式传入 `repositoryId` 或配置 `MCP_DEFAULT_REPOSITORY_ID`

当 `index_repository` 或 `index_files` 缺失 `rootPath` 且未配置 `MCP_REPOSITORY_ROOT` 时，adapter 应返回：

1. `code = "validation_error"`
2. `message` 明确说明需要显式传入 `rootPath` 或配置 `MCP_REPOSITORY_ROOT`

## 12. Tool 与 Core 映射总表

| Tool                  | Core service                      | 当前状态 | 备注                                 |
| --------------------- | --------------------------------- | -------- | ------------------------------------ |
| `index_repository`    | `DefaultIndexRepositoryService`   | 已可接入 | 可直接落 adapter                     |
| `search_code_context` | `DefaultSearchCodeContextService` | 已可接入 | 当前输出为 `results + contextPacket` |
| `index_files`         | `IndexFilesService`               | 已实现   | 覆盖式重建                           |
| `delete_files`        | `DeleteFilesService`              | 已实现   | 处理文件删除与旧路径清理             |
| `get_file_context`    | `GetFileContextService`           | 已实现   | 当前为最小连续文本组装               |

## 13. 示例

### 13.1 index_repository

输入：

```json
{
  "mode": "full",
  "embeddingBatchSize": 16
}
```

### 13.2 search_code_context

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

### 13.3 index_files

输入：

```json
{
  "filePaths": ["src/a.ts", "src/b.ts"]
}
```

### 13.4 delete_files

输入：

```json
{
  "filePaths": ["src/old-a.ts", "src/old-b.ts"]
}
```

### 13.5 get_file_context

输入：

```json
{
  "filePath": "src/shipping.ts"
}
```

## 14. 结论

当前仓库已经具备把 `index_repository`、`search_code_context`、`index_files`、`delete_files`、`get_file_context` 通过 MCP tool 暴露出去的核心 use case。

在单仓库部署场景下，建议进一步通过 `MCP_REPOSITORY_ROOT` 固定仓库根目录，使 `index_repository` 与 `index_files` 可以默认从 server 配置解析 `rootPath`，从而减少重复入参。

因此，下一阶段最合理的推进顺序是：

1. 在现有 `get_file_context` 之上补更完整的 `ContextPacket` 组装
2. 进一步统一多 tool 的错误码与错误详情模型
3. 继续补充更多上下文提取与检索后处理能力
4. 再补 `get_file_context` service 与 tool
5. 最后继续把 `search_code_context` 的 `contextPacket` 升级到 richer ContextBuilder 产物
