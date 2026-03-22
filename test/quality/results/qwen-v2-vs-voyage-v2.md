# Retrieval Quality Comparison

Left: qwen-v2 (openai-compatible / Qwen/Qwen3-Embedding-8B)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/qwen-v2.json
Right: voyage-v2 (voyage / voyage-code-3)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/voyage-v2.json

## Aggregate Summary

Compared queries: 8
Missing in right report: 0
Missing in left report: 0
Average chunk overlap per query: 0.00
Average file overlap per query: 0.13
Average top-3 file overlap per query: 0.00
Distinct files seen by left: 6
Distinct files seen by right: 18
Distinct files shared by both: 1
Left retrieval mix: implementation 0.0%, test 0.0%, documentation 90.0%, other 10.0%
Right retrieval mix: implementation 13.8%, test 23.8%, documentation 8.8%, other 53.8%

## agent-find-mcp-index-entrypoint-v2

Query: 我要排查仓库索引入口。请找出 MCP tool 是怎么把 index_repository 请求接到具体索引服务上的，优先返回真正执行注册和调用链的实现文件。
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 1

Left only files: design/v1/mcp-tool-interface-design.md, doc/progress/current-progress.md, doc/progress/milestones.md, .vscode/mcp.example.jsonc, design/v1/README.md
Right only files: packages/mcp-server/test/adapters/register-tools.unit.test.ts, test/template/main.py, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts, packages/infra/tsconfig.json, packages/mcp-server/src/adapters/tools/register-tools.ts, packages/mcp-server/src/bootstrap/config.ts, yarn.lock

Left top files:
1. design/v1/mcp-tool-interface-design.md (score=0.7752)
2. packages/mcp-server/README.md (score=0.7685)
3. packages/mcp-server/README.md (score=0.7612)
4. doc/progress/current-progress.md (score=0.7583)
5. doc/progress/milestones.md (score=0.7571)
6. packages/mcp-server/README.md (score=0.7474)
7. packages/mcp-server/README.md (score=0.7440)
8. .vscode/mcp.example.jsonc (score=0.7422)
9. design/v1/mcp-tool-interface-design.md (score=0.7418)
10. design/v1/README.md (score=0.7417)

Right top files:
1. packages/mcp-server/test/adapters/register-tools.unit.test.ts (score=0.7615)
2. test/template/main.py (score=0.7420)
3. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.7395)
4. packages/infra/tsconfig.json (score=0.7370)
5. packages/mcp-server/README.md (score=0.7367)
6. test/template/main.py (score=0.7356)
7. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7335)
8. packages/mcp-server/src/bootstrap/config.ts (score=0.7331)
9. packages/mcp-server/src/bootstrap/config.ts (score=0.7281)
10. yarn.lock (score=0.7212)

## agent-debug-whitelist-override-v2

Query: 用户说 .gitignore 里忽略的文件仍然需要进入索引。请定位扫描阶段里 includePatterns 覆盖 ignore 和 .gitignore 的实现，以及对应测试。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: test/template/main.py, packages/infra/test/storage/surreal/surreal-client.real.integration.test.ts, packages/mcp-server/test/bootstrap/container.unit.test.ts, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts, packages/mcp-server/test/stdio-server-smoke.integration.test.ts, packages/mcp-server/test/adapters/register-tools.unit.test.ts, packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts

Left top files:

Right top files:
1. test/template/main.py (score=0.7344)
2. packages/infra/test/storage/surreal/surreal-client.real.integration.test.ts (score=0.7332)
3. packages/mcp-server/test/bootstrap/container.unit.test.ts (score=0.7240)
4. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.7057)
5. test/template/main.py (score=0.6977)
6. packages/mcp-server/test/stdio-server-smoke.integration.test.ts (score=0.6851)
7. packages/mcp-server/test/adapters/register-tools.unit.test.ts (score=0.6813)
8. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.6772)
9. test/template/main.py (score=0.6758)
10. test/template/main.py (score=0.6757)

## agent-trace-context-budget-v2

Query: 我要调 search_code_context 返回结果的 tokenBudget 行为。请找到控制上下文截断、打包和返回结构的核心实现，而不是只看 README。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: packages/mcp-server/README.md, test/template/main.py, packages/mcp-server/test/bootstrap/app.real.integration.test.ts, packages/mcp-server/src/bootstrap/config.ts, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts

Left top files:

Right top files:
1. packages/mcp-server/README.md (score=0.7732)
2. test/template/main.py (score=0.7714)
3. test/template/main.py (score=0.7610)
4. test/template/main.py (score=0.7517)
5. packages/mcp-server/README.md (score=0.7318)
6. test/template/main.py (score=0.7316)
7. test/template/main.py (score=0.7252)
8. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.7234)
9. packages/mcp-server/src/bootstrap/config.ts (score=0.7106)
10. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.7094)

## agent-debug-surreal-search-v2

Query: 搜索召回不稳定，我想看 SurrealDB 原生向量检索参数是在哪里构造的。请找出 HNSW 或 KnnScan 相关查询实现和测试。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: test/template/main.py, test/template/audit-log.use-cases.ts

Left top files:

Right top files:
1. test/template/main.py (score=0.7992)
2. test/template/audit-log.use-cases.ts (score=0.7912)
3. test/template/main.py (score=0.7853)
4. test/template/main.py (score=0.7683)
5. test/template/main.py (score=0.7658)
6. test/template/main.py (score=0.7585)
7. test/template/audit-log.use-cases.ts (score=0.7558)
8. test/template/main.py (score=0.7478)
9. test/template/main.py (score=0.7387)
10. test/template/main.py (score=0.7372)

## agent-switch-embedding-provider-v2

Query: 我要切换 embedding provider 并确认配置是怎么落到具体 provider 实现上的。请定位 provider factory、Qwen openai-compatible provider、Voyage provider 的关键代码。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts, test/template/main.py, packages/mcp-server/src/server.ts, yarn.lock

Left top files:

Right top files:
1. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.8212)
2. test/template/main.py (score=0.7904)
3. test/template/main.py (score=0.7885)
4. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.7708)
5. test/template/main.py (score=0.7597)
6. packages/mcp-server/src/server.ts (score=0.7424)
7. test/template/main.py (score=0.7305)
8. test/template/main.py (score=0.7085)
9. yarn.lock (score=0.7038)
10. test/template/main.py (score=0.7020)

## agent-fix-quality-run-hang-v2

Query: 评测脚本执行完索引和搜索后没有退出。请找出质量评测脚本里资源清理和 Surreal client disconnect 的实现位置。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: test/template/main.py, packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts, packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts, packages/mcp-server/test/bootstrap/app.real.integration.test.ts

Left top files:

Right top files:
1. test/template/main.py (score=0.6910)
2. packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts (score=0.6893)
3. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.6892)
4. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.6855)
5. test/template/main.py (score=0.6828)
6. test/template/main.py (score=0.6821)
7. test/template/main.py (score=0.6806)
8. test/template/main.py (score=0.6806)
9. test/template/main.py (score=0.6774)
10. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.6744)

## agent-trace-incremental-file-ops-v2

Query: 我要确认 get_file_context、index_files、delete_files 这几个增量文件操作分别走到哪些服务和存储层实现。请优先返回核心代码路径。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: packages/mcp-server/README.md, packages/mcp-server/src/bootstrap/config.ts, packages/mcp-server/test/fixtures/stdio-smoke-server.mjs, test/template/main.py, packages/mcp-server/test/bootstrap/app.real.integration.test.ts, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts, README.md, packages/infra/tsconfig.json

Left top files:

Right top files:
1. packages/mcp-server/README.md (score=0.7483)
2. packages/mcp-server/src/bootstrap/config.ts (score=0.7384)
3. packages/mcp-server/README.md (score=0.7327)
4. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.7320)
5. test/template/main.py (score=0.7296)
6. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.7187)
7. packages/mcp-server/README.md (score=0.7165)
8. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.7085)
9. README.md (score=0.7077)
10. packages/infra/tsconfig.json (score=0.7052)

## agent-find-indexing-concurrency-v2

Query: 仓库索引太慢，我想调 embeddingBatchSize 和 embeddingConcurrency。请找出这些参数在索引流程里如何传递、分批和并发执行。
Left result count: 0
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: (none)
Right only files: yarn.lock, test/template/main.py, packages/mcp-server/src/bootstrap/config.ts

Left top files:

Right top files:
1. yarn.lock (score=0.7908)
2. yarn.lock (score=0.7887)
3. yarn.lock (score=0.7760)
4. yarn.lock (score=0.7680)
5. test/template/main.py (score=0.7663)
6. packages/mcp-server/src/bootstrap/config.ts (score=0.7658)
7. yarn.lock (score=0.7620)
8. test/template/main.py (score=0.7576)
9. yarn.lock (score=0.7571)
10. yarn.lock (score=0.7567)

