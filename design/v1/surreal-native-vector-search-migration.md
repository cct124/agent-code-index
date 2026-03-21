# Surreal 原生向量检索迁移实施指南

## 1. 文档目标

本文档用于指导 `agent-code-index` 从当前的“应用侧余弦相似度排序”迁移到 “Surreal 原生向量索引与 KNN 查询”。

目标不是重写整个检索链路，而是在保持 `core` 接口不变的前提下，替换 `infra` 层的 Surreal 搜索实现，并保留可控回退路径。

本文档覆盖以下内容：

1. 当前实现现状
2. 迁移目标
3. 接口保持不变的边界
4. schema 改造方案
5. 仓储替换方案
6. 测试改造方案
7. 灰度与回退策略
8. 实施顺序

## 2. 当前实现现状

当前语义检索实现位于 [packages/infra/src/storage/surreal/surreal-search-repository.ts](../../packages/infra/src/storage/surreal/surreal-search-repository.ts)。

当前行为为：

1. 先按 `repositoryId + filters` 查询候选 chunk
2. 再在 Node.js 应用层计算余弦相似度
3. 最后排序并截断 `topK`

当前 schema 位于 [packages/infra/src/storage/surreal/surreal-chunk-schema.ts](../../packages/infra/src/storage/surreal/surreal-chunk-schema.ts)。

当前 `chunk` 表中：

1. `embedding` 已可持久化
2. 已存在普通索引：`repositoryId`、`repositoryId + filePath`、`repositoryId + hash`
3. 尚未定义向量索引

当前 `core` 层接口位于 [packages/core/src/contracts/search-repository.ts](../../packages/core/src/contracts/search-repository.ts)，输入已经足够表达数据库原生向量检索：

1. `repositoryId`
2. `embedding`
3. `topK`
4. `filters`

因此，迁移重点不在 `core`，而在 `infra` 的 schema 和仓储实现。

## 3. 迁移目标

迁移完成后，检索链路应从：

1. `query text`
2. `query embedding`
3. `repositoryId + filters` 查询候选记录
4. 应用层 `cosineSimilarity`

切换为：

1. `query text`
2. `query embedding`
3. Surreal 原生向量索引
4. Surreal 原生 KNN 查询
5. 结果映射为 `SearchResult[]`

迁移后仍需保留：

1. `repositoryId` 约束
2. metadata filters
3. `tags` 过滤
4. `SearchRepository` 与 `SearchCodeContextService` 的现有对外契约

## 4. 官方能力假设与版本边界

根据 Surreal 当前官方文档结构，已确认当前版本公开支持：

1. Vector search indexes
2. HNSW index
3. Filtering through vector search
4. `vector::` 向量函数包

迁移实现时应以当前部署实例的实际版本再次核验，重点确认以下 SurrealQL 细节：

1. HNSW 索引定义语法
2. KNN 查询运算符语法
3. 距离函数名称和返回值语义
4. `WHERE` 过滤与向量检索组合方式

建议在实施前先执行：

1. `INFO FOR DB;`
2. `INFO FOR TABLE chunk;`
3. 在本地 Surrealist 或测试脚本中验证最小 KNN 查询

## 5. 接口保持不变的原则

以下接口建议保持不变：

1. [packages/core/src/contracts/search-repository.ts](../../packages/core/src/contracts/search-repository.ts)
2. [packages/core/src/services/search-code-context-service.ts](../../packages/core/src/services/search-code-context-service.ts)

原因：

1. `SearchRepository.semanticSearch(input)` 已经只暴露业务层所需信息
2. `SearchCodeContextService` 已经收敛了 `query text -> query embedding -> search`
3. 若此时修改 `core` 接口，只会放大迁移范围，不会提升迁移收益

结论：

1. 不改 `SemanticSearchInput`
2. 不改 `SearchRepository`
3. 不改 `SearchCodeContextService`
4. 只替换 `SurrealSearchRepository` 的内部查询策略

## 6. Schema 改造方案

目标文件：

1. [packages/infra/src/storage/surreal/surreal-chunk-schema.ts](../../packages/infra/src/storage/surreal/surreal-chunk-schema.ts)

### 6.1 保留现有字段定义

以下字段无需在本轮迁移中重构：

1. `chunkId`
2. `repositoryId`
3. `filePath`
4. `language`
5. `content`
6. `searchText`
7. `startLine`
8. `endLine`
9. `hash`
10. `metadata`

### 6.2 保留现有普通索引

以下索引应保留：

1. `chunk_repository_idx`
2. `chunk_repository_file_idx`
3. `chunk_repository_hash_idx`

原因：

1. 过滤条件仍然需要普通索引辅助
2. repository 范围约束依然是所有检索的前置条件

### 6.3 新增 embedding 向量索引

建议新增 HNSW 索引，命名示例：

```sql
DEFINE INDEX IF NOT EXISTS chunk_embedding_hnsw_idx
ON TABLE chunk
FIELDS embedding
HNSW
DIMENSION 4096
DIST COSINE
TYPE F32;
```

说明：

1. `DIMENSION` 必须与项目级 `EMBEDDING_VECTOR_DIMENSION` 一致
2. 距离度量建议与当前应用侧 `cosineSimilarity` 保持一致，即优先使用 `COSINE`
3. `TYPE F32` 或等价参数需以当前 Surreal 版本实际语法为准

### 6.4 维度配置收敛建议

当前 schema 是静态字符串，向量索引维度存在一个现实约束：

1. 同一 `chunk` 表若使用固定维度向量索引，则默认要求同一数据库下维度一致

当前项目已有项目级模型锁定机制，因此在 v1 可以接受这一前提。

建议：

1. v1 保持“单实例单维度”约束
2. 若未来需要同一实例内支持不同向量维度，应再设计按项目空间拆表或分库方案

## 7. 仓储替换方案

目标文件：

1. [packages/infra/src/storage/surreal/surreal-search-repository.ts](../../packages/infra/src/storage/surreal/surreal-search-repository.ts)

### 7.1 当前实现问题

当前实现的问题不是正确性，而是性能与扩展性：

1. 候选集全部拉回应用层
2. 应用层逐条计算相似度
3. 数据量增大后，CPU、网络和排序成本都会上升

### 7.2 目标实现

目标实现应改为：

1. 在 Surreal 查询中完成 KNN
2. 在数据库层完成距离排序和截断
3. 应用层只做结果映射

### 7.3 推荐内部结构

建议把 `semanticSearch` 拆成两个内部路径：

1. `nativeVectorSearch(...)`
2. `fallbackApplicationCosineSearch(...)`

调用策略：

1. 默认先尝试 `nativeVectorSearch`
2. 当数据库版本、索引状态或语法不兼容时，回退到旧实现
3. 回退时写 `warn` 日志，明确当前未使用原生向量索引

### 7.4 推荐查询结构

推荐目标查询形态如下，具体语法需按 Surreal 实际版本微调：

```sql
SELECT
  *,
  vector::distance::knn() AS distance
FROM chunk
WHERE repositoryId = $repositoryId
  AND ...filters...
  AND embedding <|$topK,COSINE|> $embedding;
```

或等价的版本相关写法。

结果映射建议：

1. 保持返回 `SearchResult[]`
2. 将数据库距离值转换为统一的 `score`
3. 若数据库返回的是距离而不是相似度，则建议做单调映射，例如：
   - `score = 1 - distance`，仅在距离范围明确时使用
   - 或直接把 `reason` 改为 `surreal vector knn`，并允许 `score` 表示排序分值而不是标准 cosine 值

更稳妥的 v1 方案：

1. `score` 可直接使用数据库返回的近邻分值或距离映射值
2. `reason` 从 `cosine similarity` 改为 `surreal vector search`
3. 不要求与旧实现的分值绝对一致，只要求排序语义一致

### 7.5 Filters 保持兼容

当前 filters 构造逻辑可以保留绝大部分：

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

建议继续保留 `buildFilterState(...)`，只替换最终 `SELECT` 语句的主体。

### 7.6 日志建议

迁移后新增以下日志字段：

1. `searchStrategy: "surreal-native-vector" | "application-cosine-fallback"`
2. `vectorDistanceMetric`
3. `nativeVectorIndexUsed`

如果 Surreal 版本支持 `EXPLAIN` 并能观察索引命中，可在 debug 日志中记录。

## 8. 测试改造方案

### 8.1 Schema 集成测试

目标：确保向量索引确实被创建。

建议：

1. 在 chunk schema 的集成测试中增加 `INFO FOR TABLE chunk;` 检查
2. 断言存在 `chunk_embedding_hnsw_idx`
3. 断言索引类型或定义片段中包含 HNSW / COSINE / DIMENSION 信息

### 8.2 SearchRepository 轻量集成测试

目标文件：

1. [packages/infra/test/storage/surreal/search-repository.integration.test.ts](../../packages/infra/test/storage/surreal/search-repository.integration.test.ts)

当前测试主要断言：

1. query 被调用
2. filters 被拼装
3. 应用侧排序结果正确

迁移后应改为断言：

1. 查询语句中包含原生 KNN 片段
2. `repositoryId` 和 filters 仍被正确绑定
3. `tags` 过滤仍然可用
4. 返回结果映射正确
5. `reason` 变为更中性的数据库检索描述

### 8.3 Real Integration

目标文件：

1. [packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts](../../packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts)

该测试目前已经覆盖：

1. `prepare`
2. real embed
3. upsert
4. `query text -> query embedding -> search`

迁移后应尽量保持上层断言不变，只让底层仓储实现切换到数据库原生向量检索。

这条测试的意义是：

1. 验证上层业务用例未受影响
2. 验证新仓储实现可以直接替换旧实现

### 8.4 回退路径测试

若保留 fallback，必须增加一组测试：

1. 当 native 查询抛出“索引不存在 / 语法不兼容 / 功能未启用”时
2. repository 自动回退到旧实现
3. 日志中明确记录 fallback

## 9. 灰度与回退策略

建议不要一次性删除旧实现。

### 9.1 第一阶段

1. schema 增加向量索引
2. repository 新增 native 查询实现
3. 默认启用 native
4. 保留 fallback

### 9.2 第二阶段

1. 在本地开发环境完成 SiliconFlow + SurrealDB 实测
2. 在真实数据集上检查排序质量
3. 观察日志中 native 命中与 fallback 比例

### 9.3 第三阶段

1. 当 native 路径稳定后，再考虑移除 fallback
2. 或通过配置显式控制是否允许 fallback

建议增加配置项：

1. `SEARCH_USE_NATIVE_VECTOR=true|false`
2. `SEARCH_ALLOW_NATIVE_FALLBACK=true|false`

v1 若不想新增配置，也至少应在仓储内部保留清晰的 fallback 分支。

## 10. 实施顺序

建议按下面顺序推进：

1. 修改 [packages/infra/src/storage/surreal/surreal-chunk-schema.ts](../../packages/infra/src/storage/surreal/surreal-chunk-schema.ts)，新增 HNSW 向量索引
2. 先补 schema 集成测试，确保索引创建逻辑成立
3. 修改 [packages/infra/src/storage/surreal/surreal-search-repository.ts](../../packages/infra/src/storage/surreal/surreal-search-repository.ts)，新增 native KNN 查询路径
4. 保留当前应用侧 cosine 逻辑作为 fallback
5. 更新 [packages/infra/test/storage/surreal/search-repository.integration.test.ts](../../packages/infra/test/storage/surreal/search-repository.integration.test.ts)
6. 运行 [packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts](../../packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts) 验证真实链路
7. 验证排序质量后，再考虑去掉 fallback

## 11. 实施完成标准

满足以下条件，可视为迁移完成：

1. `chunk` 表已存在原生向量索引
2. `SurrealSearchRepository` 默认使用数据库原生 KNN 检索
3. `SearchRepository` 与 `SearchCodeContextService` 对外接口未变化
4. 轻量测试与真实整链路测试全部通过
5. 真实 SiliconFlow + SurrealDB 环境下，查询结果相关性不劣于当前实现
6. 日志能区分 native 路径与 fallback 路径

## 12. 一句话迁移结论

本仓库最合理的迁移方式不是修改 `core`，而是：

1. 保持 `SearchRepository` 与 `SearchCodeContextService` 不变
2. 在 `SurrealChunkSchema` 中补向量索引
3. 在 `SurrealSearchRepository` 内部切换到原生 KNN 查询
4. 用 fallback 和真实整链路测试保障迁移安全
