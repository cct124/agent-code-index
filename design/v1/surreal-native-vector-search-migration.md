# Surreal 原生向量检索迁移实施指南

## 1. 文档目标

本文档用于指导 `agent-code-index` 从原先的“应用侧余弦相似度排序”迁移到 “Surreal 原生向量索引与 KNN 查询”。

目标不是重写整个检索链路，而是在保持 `core` 接口不变的前提下，替换 `infra` 层的 Surreal 搜索实现。

截至 2026-03-21，这份文档已经从“迁移计划”转为“迁移结果 + 后续调优说明”：

1. HNSW schema、native KNN 查询和真实环境验证已经完成
2. 当前仓库默认只保留数据库原生检索路径
3. 文中涉及 fallback、灰度阶段与实施顺序的段落，应优先按“历史决策记录”而不是“当前待办”理解

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

截至 2026-03-21，当前实现已经完成 v1 迁移，默认行为为：

1. 在 SurrealDB 中执行“全部精确过滤条件数据库下推 + HNSW KNN”原生查询
2. 应用层仅做 distance 到 score 的单调映射、排序稳定化与 `topK` 截断
3. v1 已不再维护应用侧余弦 fallback

当前 schema 位于 [packages/infra/src/storage/surreal/surreal-chunk-schema.ts](../../packages/infra/src/storage/surreal/surreal-chunk-schema.ts)。

当前 `chunk` 表中：

1. `embedding` 已可持久化
2. 已存在普通索引：`repositoryId`、`repositoryId + filePath`、`repositoryId + hash`
3. 已定义 HNSW 向量索引

当前 `core` 层接口位于 [packages/core/src/contracts/search-repository.ts](../../packages/core/src/contracts/search-repository.ts)，输入已经足够表达数据库原生向量检索：

1. `repositoryId`
2. `embedding`
3. `topK`
4. `filters`

因此，当前文档除保留迁移设计外，也记录已验证的版本边界与落地结果。

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

## 4. 官方能力确认与版本边界

根据 Surreal 官方文档和官方文档仓库中的公开示例，当前可以确认以下细节：

1. Surreal 已公开支持向量索引、HNSW、KNN 运算符和 `vector::distance::knn()`
2. HNSW 索引定义语法为 `DEFINE INDEX ... HNSW DIMENSION <n>`，并可选指定 `TYPE`、`DIST`、`EFC`、`M`
3. HNSW 查询写法是 `<|K|>` 或 `<|K,EF|>`，其中第二个参数是搜索 effort，不是距离度量
4. 若在 KNN 运算符中显式写入 `COSINE`、`EUCLIDEAN`、`MANHATTAN`、`MINKOWSKI` 等距离参数，则走的是 brute-force 路径，而不是 HNSW 索引路径
5. `vector::distance::knn()` 返回的是本次查询中已计算出的距离值，不是 cosine similarity
6. `WHERE` 过滤条件可以与向量检索组合使用，官方已有 `flag = true AND embedding <|2,40|> $vector` 之类示例

另外，官方文档还明确了以下边界：

1. HNSW 可选参数默认值为：`TYPE=F64`、`DIST=EUCLIDEAN`、`EFC=150`、`M=12`
2. `M0` 和 `LM` 由 Surreal 自动推导，不建议在业务实现中手工依赖或配置
3. 自 v3.0 起，HNSW 有有界内存缓存，默认缓存大小可由环境变量控制

迁移实现时仍应以当前部署实例的实际版本再次核验，重点确认以下 SurrealQL 细节：

1. 当前实例是否支持所需的 HNSW 语法分支
2. KNN 运算符是否与项目当前驱动/SDK 版本完全兼容
3. `INFO FOR TABLE` / `EXPLAIN FULL` 的输出字段是否与测试断言一致
4. 当前实例对 HNSW + filter 组合查询的执行计划是否稳定

建议在实施前先执行：

1. `INFO FOR DB;`
2. `INFO FOR TABLE chunk;`
3. 在本地 Surrealist 或测试脚本中验证最小 KNN 查询

### 4.1 已验证的版本结论

截至 2026-03-21，仓库已完成以下实测结论：

1. 本地开发用 Docker SurrealDB 已从 `2.4.1` 切换到 `3.0.4`
2. `2.4.1` 的旧 RocksDB 数据目录不能被 `3.0.4` 直接打开，实测会报磁盘格式版本不匹配，因此开发环境采用空库重部署而不是原地升级
3. 在干净的 `3.0.4` 环境中，最小复现场景下的 `repositoryId + 多个精确过滤条件 + HNSW KNN` 查询不再出现“返回空结果”的旧现象
4. 项目真实集成测试在 `3.0.4` 上通过，但需要将 schema 中 `metadata` 字段定义调整为 `TYPE object FLEXIBLE` 这一新版语法顺序

这组实测结果说明：

1. 官方文档所描述的“过滤条件可与 HNSW KNN 组合”在 `3.0.4` 干净环境中是可复现的
2. 因此仓库当前已切换为“全部精确过滤数据库下推 + KNN”的单一路径，不再把应用层二次过滤作为 `3.0.4` 基线的一部分

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
TYPE F32
DIST COSINE;
```

说明：

1. `DIMENSION` 必须与项目级 `EMBEDDING_VECTOR_DIMENSION` 一致
2. 距离度量建议与当前应用侧 `cosineSimilarity` 保持一致，即优先使用 `COSINE`
3. `TYPE` 是可选项；官方默认类型为 `F64`，若希望节省内存可明确指定 `F32`
4. `EFC`、`M` 也可显式指定，但 v1 可以先使用官方默认值，避免过早调参

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

当前实现已经收敛为单一内部路径：

1. `nativeVectorSearch(...)`

原因：

1. 干净的 SurrealDB `3.0.4` 环境已经验证“多精确过滤条件 + HNSW KNN”稳定可用
2. 保留应用侧余弦 fallback 会让实现、测试和日志语义继续分叉
3. 当前 v1 基线更需要稳定的单一路径，而不是同时维护两套召回语义

### 7.4 推荐查询结构

推荐把“原生 HNSW 查询”和“brute-force 距离查询”明确分开，不要混写。

原生 HNSW 查询的推荐形态如下，具体语法需按 Surreal 实际版本微调：

```sql
SELECT
  *,
  vector::distance::knn() AS distance
FROM chunk
WHERE repositoryId = $repositoryId
  AND ...filters...
  AND embedding <|$topK,$efSearch|> $embedding
ORDER BY distance;
```

或在使用索引默认距离度量时写成：

```sql
SELECT
  *,
  vector::distance::knn() AS distance
FROM chunk
WHERE repositoryId = $repositoryId
  AND ...filters...
  AND embedding <|$topK|> $embedding
ORDER BY distance;
```

如果需要保留 brute-force 对照或回退路径，则查询应写成另一种明确形态：

```sql
SELECT
  *,
  vector::distance::knn() AS distance
FROM chunk
WHERE repositoryId = $repositoryId
  AND ...filters...
  AND embedding <|$topK,COSINE|> $embedding
ORDER BY distance;
```

这里的关键点是：

1. `<|K|>` 和 `<|K,EF|>` 才是 HNSW 索引路径
2. `<|K,COSINE|>` 是 brute-force 路径，不应写成“原生 HNSW 查询示例”
3. 迁移后的默认实现应优先走 HNSW，而不是继续把 `COSINE` 写死在运算符里

结果映射建议：

1. 保持返回 `SearchResult[]`
2. 明确把数据库返回值视为“距离”，不要在文档中把它表述成“数据库近邻分值”
3. 若 `SearchResult.score` 语义要求“数值越大越相似”，则需要在仓储层做单调映射
4. `score = 1 - distance` 只适用于距离范围可控且已验证的场景，不能默认当作通用公式

更稳妥的 v1 方案：

1. 优先保证排序语义正确，而不是追求与旧 cosine 分值绝对一致
2. `reason` 从 `cosine similarity` 改为 `surreal vector search`
3. 在实现层明确区分 “distance” 与 “score” 的含义，避免后续混淆

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

补充说明：

1. 当前仓库实现已经把支持的精确过滤条件全部直接下推到 KNN 查询
2. 之所以曾经保守处理，是因为旧版本真实环境里观察到过多精确过滤与 KNN 组合异常
3. 在 `3.0.4` 基线上，该异常已不再复现，因此当前正式基线就是单一路径 native 查询

### 7.6 日志建议

迁移后新增以下日志字段：

1. `searchStrategy: "surreal-native-vector"`
2. `vectorDistanceMetric`
3. `nativeVectorIndexUsed`

如果 Surreal 版本支持 `EXPLAIN` 并能观察索引命中，可在 debug 日志中记录。

另外，建议在原生路径落地后补充一条运行手册说明：

1. 索引创建后可用 `INFO FOR TABLE chunk;` 检查索引定义
2. 查询验证可用 `EXPLAIN FULL` 检查是否命中预期索引路径
3. 若 HNSW 表现劣化或升级后状态异常，可评估 `REBUILD INDEX` 作为运维手段

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

1. 原生路径查询语句中包含 `<|k|>` 或 `<|k,ef|>` 这类 HNSW KNN 片段
2. `repositoryId` 和 filters 仍被正确绑定
3. `tags` 过滤仍然可用
4. 返回结果映射正确
5. `reason` 变为更中性的数据库检索描述
6. candidate window 与 `efSearch` 参数会按仓储配置注入 native 查询

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

另外，建议至少保留一条真实数据库回归测试，明确覆盖：

1. `repositoryId`
2. `filePath`
3. `language`
4. `metadata.symbolName`
5. `metadata.parentSymbol`
6. `tags`
7. 与 HNSW KNN 同时使用时仍返回非空且正确的结果

### 8.4 当前测试结论

当前迁移完成后，测试重点已经变为：

1. 查询语句是否包含 `<|K,EF|>` 形式的 native HNSW 片段
2. `repositoryId` 与全部支持的精确过滤条件是否被正确下推
3. `EXPLAIN FULL` 是否能观察到预期的 KnnScan 计划
4. 真实 SurrealDB + 真实 embedding provider 的整链路是否继续通过

## 9. 当前后续工作

当前不再以“是否保留 fallback”为重点，后续工作主要是：

1. 继续验证更复杂过滤组合与更大候选窗口下的表现
2. 基于真实数据分布调优 `SEARCH_NATIVE_CANDIDATE_MULTIPLIER` 与 `SEARCH_NATIVE_EF_SEARCH_MIN`
3. 通过 `EXPLAIN FULL` 持续校验查询计划没有因版本变化或 schema 偏差而退化

## 10. 已完成实施结果

截至当前，以下步骤已经完成：

1. [packages/infra/src/storage/surreal/surreal-chunk-schema.ts](../../packages/infra/src/storage/surreal/surreal-chunk-schema.ts) 已落地 HNSW 向量索引定义
2. schema 与 search repository 的轻量集成测试已经更新
3. [packages/infra/src/storage/surreal/surreal-search-repository.ts](../../packages/infra/src/storage/surreal/surreal-search-repository.ts) 已切换到单一路径 native KNN 查询
4. [packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts](../../packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts) 与 [packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts](../../packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts) 已验证真实链路

## 11. 实施完成标准

满足以下条件，可视为迁移完成：

1. `chunk` 表已存在原生向量索引
2. `SurrealSearchRepository` 默认使用数据库原生 KNN 检索
3. `SearchRepository` 与 `SearchCodeContextService` 对外接口未变化
4. 轻量测试与真实整链路测试全部通过
5. 真实 SiliconFlow + SurrealDB 环境下，查询结果相关性不劣于当前实现
6. `EXPLAIN FULL` 能验证预期的 KnnScan 执行计划

## 12. 一句话迁移结论

本仓库最合理的迁移方式不是修改 `core`，而是：

1. 保持 `SearchRepository` 与 `SearchCodeContextService` 不变
2. 在 `SurrealChunkSchema` 中补向量索引
3. 在 `SurrealSearchRepository` 内部切换到原生 KNN 查询
4. 用真实整链路测试和 `EXPLAIN FULL` 计划断言保障迁移安全
