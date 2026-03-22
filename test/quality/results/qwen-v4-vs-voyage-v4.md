# Retrieval Quality Comparison

Left: qwen-v4 (openai-compatible / Qwen/Qwen3-Embedding-8B)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/qwen-v4.json
Right: voyage-v4 (voyage / voyage-code-3)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/voyage-v4.json

## Aggregate Summary

Compared queries: 6
Missing in right report: 0
Missing in left report: 0
Average chunk overlap per query: 0.00
Average file overlap per query: 0.50
Average top-3 file overlap per query: 0.33
Distinct files seen by left: 4
Distinct files seen by right: 29
Distinct files shared by both: 1
Left retrieval mix: implementation 3.3%, test 0.0%, documentation 0.0%, other 96.7%
Right retrieval mix: implementation 41.7%, test 36.7%, documentation 8.3%, other 13.3%

## code-mcp-index-wiring-v4

Query: locate index_repository wiring in code. find register-tools/createApp/container path, prefer .ts implementation and tests, not README/design docs.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: test/template/main.py
Right only files: packages/infra/src/storage/surreal/surreal-search-repository.ts, packages/infra/src/storage/surreal/surreal-client.ts, packages/mcp-server/src/adapters/tools/register-tools.ts, packages/infra/test/embedding/real-embedding-test-env.ts, packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts, packages/mcp-server/src/bootstrap/container.ts

Left top files:

1. test/template/main.py (score=0.7587)
2. test/template/main.py (score=0.7587)
3. test/template/main.py (score=0.7587)
4. test/template/main.py (score=0.7448)
5. test/template/main.py (score=0.7448)
6. test/template/main.py (score=0.7448)
7. test/template/main.py (score=0.7210)
8. test/template/main.py (score=0.7210)
9. test/template/main.py (score=0.7210)
10. test/template/main.py (score=0.7188)

Right top files:

1. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7056)
2. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7009)
3. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7009)
4. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7007)
5. packages/infra/test/embedding/real-embedding-test-env.ts (score=0.6907)
6. packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts (score=0.6906)
7. packages/mcp-server/src/bootstrap/container.ts (score=0.6906)
8. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6880)
9. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6878)
10. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.6878)

## code-local-file-scanner-override-v4

Query: find includePatterns override logic in LocalFileScanner. need implementation + unit test for ignore/.gitignore override.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 1

Left only files: yarn.lock, tsconfig.json
Right only files: packages/infra/test/scanning/local-file-scanner.unit.test.ts, packages/infra/src/scanning/local-file-scanner.ts, packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts, packages/mcp-server/test/bootstrap/container.unit.test.ts, packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts, packages/mcp-server/src/bootstrap/container.ts, packages/infra/src/services/repository-chunk-preparation-service.ts

Left top files:

1. yarn.lock (score=0.7518)
2. test/template/main.py (score=0.7466)
3. test/template/main.py (score=0.7466)
4. test/template/main.py (score=0.6690)
5. test/template/main.py (score=0.6690)
6. test/template/main.py (score=0.6612)
7. test/template/main.py (score=0.6612)
8. tsconfig.json (score=0.6516)
9. test/template/main.py (score=0.6442)
10. test/template/main.py (score=0.6442)

Right top files:

1. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7866)
2. packages/infra/src/scanning/local-file-scanner.ts (score=0.7805)
3. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7564)
4. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7536)
5. test/template/main.py (score=0.7230)
6. packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts (score=0.7030)
7. packages/mcp-server/test/bootstrap/container.unit.test.ts (score=0.7030)
8. packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts (score=0.6943)
9. packages/mcp-server/src/bootstrap/container.ts (score=0.6943)
10. packages/infra/src/services/repository-chunk-preparation-service.ts (score=0.6924)

## code-context-packet-budget-v4

Query: trace search_code_context tokenBudget in code. find ContextPacket, context-builder, truncation logic, and related tests.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 1

Left only files: (none)
Right only files: packages/mcp-server/test/bootstrap/app.real.integration.test.ts, packages/mcp-server/README.md, packages/mcp-server/test/bootstrap/config.unit.test.ts, packages/infra/src/storage/surreal/surreal-chunk-repository.ts, packages/infra/test/embedding/real-embedding-test-env.ts, packages/infra/test/embedding/openai-compatible-embedding-provider.unit.test.ts

Left top files:

1. test/template/main.py (score=0.7943)
2. test/template/main.py (score=0.7943)
3. test/template/main.py (score=0.7943)
4. test/template/main.py (score=0.7821)
5. test/template/main.py (score=0.7821)
6. test/template/main.py (score=0.7821)
7. test/template/main.py (score=0.7749)
8. test/template/main.py (score=0.7311)
9. test/template/main.py (score=0.7293)
10. test/template/main.py (score=0.7141)

Right top files:

1. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.7688)
2. test/template/main.py (score=0.7550)
3. packages/mcp-server/README.md (score=0.7505)
4. packages/mcp-server/test/bootstrap/config.unit.test.ts (score=0.7418)
5. packages/infra/src/storage/surreal/surreal-chunk-repository.ts (score=0.7330)
6. test/template/main.py (score=0.7299)
7. test/template/main.py (score=0.7254)
8. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.7222)
9. packages/infra/test/embedding/real-embedding-test-env.ts (score=0.7212)
10. packages/infra/test/embedding/openai-compatible-embedding-provider.unit.test.ts (score=0.7172)

## code-provider-factory-wiring-v4

Query: trace embedding provider wiring in code. find provider-factory, openai-compatible provider, voyage provider, and config path.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 1

Left only files: yarn.lock
Right only files: packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts, packages/infra/test/embedding/provider-factory.unit.test.ts, packages/infra/src/storage/surreal/surreal-project-metadata-repository.ts, packages/mcp-server/src/bootstrap/config.ts

Left top files:

1. test/template/main.py (score=0.7096)
2. test/template/main.py (score=0.7096)
3. yarn.lock (score=0.6583)
4. test/template/main.py (score=0.6577)
5. test/template/main.py (score=0.6577)
6. test/template/main.py (score=0.6577)
7. test/template/main.py (score=0.6577)
8. yarn.lock (score=0.6562)
9. yarn.lock (score=0.6550)
10. yarn.lock (score=0.6540)

Right top files:

1. test/template/main.py (score=0.7574)
2. packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts (score=0.7357)
3. packages/infra/test/embedding/provider-factory.unit.test.ts (score=0.7311)
4. test/template/main.py (score=0.7194)
5. packages/infra/src/storage/surreal/surreal-project-metadata-repository.ts (score=0.7090)
6. test/template/main.py (score=0.7082)
7. packages/mcp-server/src/bootstrap/config.ts (score=0.6989)
8. packages/mcp-server/src/bootstrap/config.ts (score=0.6989)
9. test/template/main.py (score=0.6967)
10. packages/infra/src/storage/surreal/surreal-project-metadata-repository.ts (score=0.6954)

## code-quality-run-disconnect-v4

Query: find why quality run exits late. locate run-retrieval-quality cleanup and surrealClient.disconnect call in code.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: test/template/main.py, yarn.lock
Right only files: packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts, packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts, packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts, packages/infra/test/scanning/local-file-scanner.unit.test.ts, packages/infra/test/services/repository-chunk-preparation-service.unit.test.ts, packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts, packages/mcp-server/test/bootstrap/app.real.integration.test.ts, packages/mcp-server/README.md, packages/infra/src/storage/surreal/surreal-client.ts

Left top files:

1. test/template/main.py (score=0.6663)
2. test/template/main.py (score=0.6640)
3. test/template/main.py (score=0.6559)
4. yarn.lock (score=0.6535)
5. test/template/main.py (score=0.6529)
6. yarn.lock (score=0.6487)
7. yarn.lock (score=0.6487)
8. yarn.lock (score=0.6471)
9. yarn.lock (score=0.6471)
10. yarn.lock (score=0.6471)

Right top files:

1. packages/infra/test/parsing/python-tree-sitter-parser.unit.test.ts (score=0.6687)
2. packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts (score=0.6670)
3. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.6670)
4. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.6669)
5. packages/infra/test/services/repository-chunk-preparation-service.unit.test.ts (score=0.6669)
6. packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts (score=0.6669)
7. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.6669)
8. packages/mcp-server/test/bootstrap/app.real.integration.test.ts (score=0.6667)
9. packages/mcp-server/README.md (score=0.6643)
10. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6614)

## code-indexing-concurrency-flow-v4

Query: trace embeddingBatchSize and embeddingConcurrency in code. find index-repository batching, worker concurrency, and index-files path.
Left result count: 10
Right result count: 10
Chunk overlap@10: 0
File overlap@10: 0

Left only files: vitest.unit.config.ts, yarn.lock, test/template/main.py
Right only files: test/template/audit-log.use-cases.ts, README.md, packages/infra/test/embedding/real-embedding-test-env.ts, packages/mcp-server/tsconfig.json, packages/infra/src/storage/surreal/surreal-log-utils.ts

Left top files:

1. vitest.unit.config.ts (score=0.8181)
2. yarn.lock (score=0.8044)
3. yarn.lock (score=0.7717)
4. test/template/main.py (score=0.7651)
5. test/template/main.py (score=0.7651)
6. test/template/main.py (score=0.7651)
7. test/template/main.py (score=0.7564)
8. test/template/main.py (score=0.7352)
9. test/template/main.py (score=0.7352)
10. test/template/main.py (score=0.7026)

Right top files:

1. test/template/audit-log.use-cases.ts (score=0.7860)
2. test/template/audit-log.use-cases.ts (score=0.7701)
3. test/template/audit-log.use-cases.ts (score=0.7683)
4. README.md (score=0.7620)
5. packages/infra/test/embedding/real-embedding-test-env.ts (score=0.7607)
6. README.md (score=0.7571)
7. test/template/audit-log.use-cases.ts (score=0.7557)
8. packages/mcp-server/tsconfig.json (score=0.7533)
9. README.md (score=0.7501)
10. packages/infra/src/storage/surreal/surreal-log-utils.ts (score=0.7497)
