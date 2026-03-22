# Retrieval Quality Comparison

Left: qwen-v3 (openai-compatible / Qwen/Qwen3-Embedding-8B)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/qwen-v3.json
Right: voyage-v3 (voyage / voyage-code-3)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/voyage-v3.json

## Aggregate Summary

Compared queries: 8
Missing in right report: 0
Missing in left report: 0
Average chunk overlap per query: 2.75
Average file overlap per query: 2.25
Average top-3 file overlap per query: 1.00
Distinct files seen by left: 26
Distinct files seen by right: 21
Distinct files shared by both: 17
Left retrieval mix: implementation 36.3%, test 13.8%, documentation 47.5%, other 2.5%
Right retrieval mix: implementation 31.3%, test 10.0%, documentation 57.5%, other 1.3%

## agent-index-entrypoint-v3

Query: 查 index_repository entrypoint。找 MCP tool registration -> service execute 的核心实现文件，prefer code over docs.
Left result count: 10
Right result count: 10
Chunk overlap@10: 1
File overlap@10: 1

Left only files: packages/mcp-server/README.md, packages/infra/test/storage/surreal/surreal-client.unit.test.ts
Right only files: design/v1/README.md, design/v1/mcp-tool-interface-design.md

Left top files:

1. packages/mcp-server/README.md (score=0.7982)
2. packages/mcp-server/README.md (score=0.7982)
3. doc/progress/current-progress.md (score=0.7950)
4. packages/mcp-server/README.md (score=0.7797)
5. packages/mcp-server/README.md (score=0.7797)
6. packages/infra/test/storage/surreal/surreal-client.unit.test.ts (score=0.7748)
7. packages/mcp-server/README.md (score=0.7740)
8. packages/mcp-server/README.md (score=0.7740)
9. packages/mcp-server/README.md (score=0.7739)
10. packages/mcp-server/README.md (score=0.7727)

Right top files:

1. design/v1/README.md (score=0.7250)
2. design/v1/mcp-tool-interface-design.md (score=0.7242)
3. design/v1/mcp-tool-interface-design.md (score=0.7193)
4. design/v1/mcp-tool-interface-design.md (score=0.7184)
5. design/v1/mcp-tool-interface-design.md (score=0.7177)
6. doc/progress/current-progress.md (score=0.7167)
7. design/v1/README.md (score=0.7166)
8. design/v1/mcp-tool-interface-design.md (score=0.7146)
9. doc/progress/current-progress.md (score=0.7091)
10. design/v1/mcp-tool-interface-design.md (score=0.7073)

## agent-includepatterns-override-v3

Query: 排查 includePatterns override ignore/.gitignore。找 LocalFileScanner implementation + unit test.
Left result count: 10
Right result count: 10
Chunk overlap@10: 2
File overlap@10: 2

Left only files: packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts, packages/infra/src/parsing/tree-sitter/languages/typescript-parser.ts, .vscode/mcp.example.jsonc
Right only files: packages/infra/README.md

Left top files:

1. packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts (score=0.8123)
2. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.8118)
3. packages/infra/src/parsing/tree-sitter/languages/typescript-parser.ts (score=0.8009)
4. packages/infra/src/scanning/local-file-scanner.ts (score=0.7734)
5. packages/infra/src/scanning/local-file-scanner.ts (score=0.7734)
6. packages/infra/src/scanning/local-file-scanner.ts (score=0.7734)
7. .vscode/mcp.example.jsonc (score=0.7713)
8. .vscode/mcp.example.jsonc (score=0.7713)
9. packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts (score=0.7704)
10. packages/infra/src/scanning/local-file-scanner.ts (score=0.7649)

Right top files:

1. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.8079)
2. packages/infra/src/scanning/local-file-scanner.ts (score=0.7968)
3. packages/infra/src/scanning/local-file-scanner.ts (score=0.7886)
4. packages/infra/src/scanning/local-file-scanner.ts (score=0.7877)
5. packages/infra/src/scanning/local-file-scanner.ts (score=0.7787)
6. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7731)
7. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7611)
8. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7611)
9. packages/infra/README.md (score=0.7570)
10. packages/infra/src/scanning/local-file-scanner.ts (score=0.7499)

## agent-tokenbudget-context-v3

Query: trace search_code_context tokenBudget path。找 context packing, truncation, ContextPacket related code.
Left result count: 10
Right result count: 10
Chunk overlap@10: 4
File overlap@10: 4

Left only files: packages/mcp-server/README.md
Right only files: design/v1/README.md

Left top files:

1. packages/mcp-server/README.md (score=0.8250)
2. packages/mcp-server/README.md (score=0.8250)
3. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7836)
4. packages/core/src/domain/context-packet.ts (score=0.7795)
5. packages/core/src/domain/context-packet.ts (score=0.7795)
6. packages/core/src/domain/context-packet.ts (score=0.7795)
7. packages/core/src/services/context-builder.ts (score=0.7749)
8. design/v1/mcp-tool-interface-design.md (score=0.7725)
9. design/v1/mcp-tool-interface-design.md (score=0.7725)
10. packages/core/src/services/context-builder.ts (score=0.7696)

Right top files:

1. design/v1/mcp-tool-interface-design.md (score=0.7501)
2. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7447)
3. packages/core/src/services/context-builder.ts (score=0.7431)
4. packages/core/src/services/context-builder.ts (score=0.7400)
5. packages/core/src/domain/context-packet.ts (score=0.7297)
6. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7264)
7. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7264)
8. packages/core/src/services/context-builder.ts (score=0.7211)
9. design/v1/README.md (score=0.7208)
10. design/v1/mcp-tool-interface-design.md (score=0.7165)

## agent-surreal-vector-search-v3

Query: debug Surreal vector search params。找 HNSW or KnnScan query builder implementation and tests.
Left result count: 10
Right result count: 10
Chunk overlap@10: 3
File overlap@10: 2

Left only files: packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts
Right only files: doc/progress/milestones.md

Left top files:

1. packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts (score=0.8156)
2. design/v1/surreal-native-vector-search-migration.md (score=0.8035)
3. design/v1/surreal-native-vector-search-migration.md (score=0.8035)
4. design/v1/surreal-native-vector-search-migration.md (score=0.8035)
5. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.8028)
6. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.8028)
7. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7791)
8. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7791)
9. design/v1/surreal-native-vector-search-migration.md (score=0.7705)
10. design/v1/surreal-native-vector-search-migration.md (score=0.7705)

Right top files:

1. design/v1/surreal-native-vector-search-migration.md (score=0.7945)
2. design/v1/surreal-native-vector-search-migration.md (score=0.7937)
3. design/v1/surreal-native-vector-search-migration.md (score=0.7834)
4. doc/progress/milestones.md (score=0.7721)
5. design/v1/surreal-native-vector-search-migration.md (score=0.7694)
6. design/v1/surreal-native-vector-search-migration.md (score=0.7649)
7. design/v1/surreal-native-vector-search-migration.md (score=0.7640)
8. design/v1/surreal-native-vector-search-migration.md (score=0.7602)
9. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7512)
10. design/v1/surreal-native-vector-search-migration.md (score=0.7495)

## agent-provider-factory-v3

Query: switch embedding provider。找 provider factory, openai-compatible provider, voyage provider wiring.
Left result count: 10
Right result count: 10
Chunk overlap@10: 5
File overlap@10: 4

Left only files: packages/mcp-server/src/bootstrap/config.ts
Right only files: packages/infra/src/embedding/provider-factory.ts, packages/infra/test/embedding/provider-factory.unit.test.ts, doc/progress/current-progress.md, packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts

Left top files:

1. design/v1/README.md (score=0.8537)
2. design/v1/README.md (score=0.8537)
3. packages/infra/README.md (score=0.8402)
4. packages/infra/README.md (score=0.8402)
5. packages/infra/README.md (score=0.8348)
6. packages/infra/README.md (score=0.8348)
7. doc/progress/milestones.md (score=0.8313)
8. packages/mcp-server/src/bootstrap/config.ts (score=0.8017)
9. packages/mcp-server/src/bootstrap/config.ts (score=0.8017)
10. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7997)

Right top files:

1. packages/infra/src/embedding/provider-factory.ts (score=0.8245)
2. design/v1/README.md (score=0.8110)
3. packages/infra/README.md (score=0.7959)
4. packages/infra/test/embedding/provider-factory.unit.test.ts (score=0.7861)
5. design/v1/README.md (score=0.7836)
6. doc/progress/milestones.md (score=0.7803)
7. packages/infra/README.md (score=0.7767)
8. doc/progress/current-progress.md (score=0.7719)
9. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7503)
10. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7477)

## agent-quality-run-cleanup-v3

Query: quality run script hangs on exit。找 cleanup path and surrealClient.disconnect call site.
Left result count: 10
Right result count: 10
Chunk overlap@10: 2
File overlap@10: 1

Left only files: packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts, packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts, packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts
Right only files: design/v1/README.md, doc/progress/milestones.md, packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts, .vscode/mcp.example.jsonc

Left top files:

1. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7152)
2. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7152)
3. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7127)
4. packages/infra/src/storage/surreal/surreal-client.ts (score=0.7127)
5. packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts (score=0.6893)
6. packages/mcp-server/test/bootstrap/index-repository.real-voyage.integration.test.ts (score=0.6893)
7. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.6893)
8. packages/mcp-server/test/bootstrap/index-repository.real.integration.test.ts (score=0.6893)
9. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.6891)
10. packages/mcp-server/test/bootstrap/index-repository.real-embedding.integration.test.ts (score=0.6891)

Right top files:

1. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6924)
2. design/v1/README.md (score=0.6835)
3. design/v1/README.md (score=0.6834)
4. design/v1/README.md (score=0.6809)
5. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6765)
6. packages/infra/src/storage/surreal/surreal-client.ts (score=0.6743)
7. doc/progress/milestones.md (score=0.6704)
8. design/v1/README.md (score=0.6694)
9. packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts (score=0.6661)
10. .vscode/mcp.example.jsonc (score=0.6636)

## agent-incremental-file-ops-v3

Query: trace get_file_context index_files delete_files。找 use case/service/storage path for incremental file ops.
Left result count: 10
Right result count: 10
Chunk overlap@10: 3
File overlap@10: 2

Left only files: packages/mcp-server/src/adapters/tools/register-tools.ts, packages/mcp-server/README.md
Right only files: (none)

Left top files:

1. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7596)
2. design/v1/README.md (score=0.7491)
3. packages/mcp-server/README.md (score=0.7400)
4. packages/mcp-server/README.md (score=0.7400)
5. design/v1/README.md (score=0.7300)
6. design/v1/README.md (score=0.7300)
7. design/v1/mcp-tool-interface-design.md (score=0.7276)
8. design/v1/mcp-tool-interface-design.md (score=0.7276)
9. design/v1/mcp-tool-interface-design.md (score=0.7212)
10. design/v1/mcp-tool-interface-design.md (score=0.7212)

Right top files:

1. design/v1/README.md (score=0.6871)
2. design/v1/mcp-tool-interface-design.md (score=0.6786)
3. design/v1/README.md (score=0.6784)
4. design/v1/README.md (score=0.6781)
5. design/v1/mcp-tool-interface-design.md (score=0.6741)
6. design/v1/mcp-tool-interface-design.md (score=0.6726)
7. design/v1/mcp-tool-interface-design.md (score=0.6722)
8. design/v1/mcp-tool-interface-design.md (score=0.6721)
9. design/v1/mcp-tool-interface-design.md (score=0.6684)
10. design/v1/mcp-tool-interface-design.md (score=0.6684)

## agent-indexing-concurrency-v3

Query: repo indexing is slow。找 embeddingBatchSize embeddingConcurrency flow, batching, worker concurrency code.
Left result count: 10
Right result count: 10
Chunk overlap@10: 2
File overlap@10: 2

Left only files: (none)
Right only files: packages/core/src/services/index-files-service.ts, design/v1/README.md

Left top files:

1. design/v1/mcp-tool-interface-design.md (score=0.8022)
2. design/v1/mcp-tool-interface-design.md (score=0.8022)
3. packages/core/src/services/index-repository-service.ts (score=0.7854)
4. packages/core/src/services/index-repository-service.ts (score=0.7685)
5. packages/core/src/services/index-repository-service.ts (score=0.7685)
6. packages/core/src/services/index-repository-service.ts (score=0.7685)
7. design/v1/mcp-tool-interface-design.md (score=0.7666)
8. design/v1/mcp-tool-interface-design.md (score=0.7666)
9. packages/core/src/services/index-repository-service.ts (score=0.7663)
10. packages/core/src/services/index-repository-service.ts (score=0.7663)

Right top files:

1. packages/core/src/services/index-repository-service.ts (score=0.8303)
2. packages/core/src/services/index-repository-service.ts (score=0.8133)
3. packages/core/src/services/index-files-service.ts (score=0.8054)
4. design/v1/README.md (score=0.8003)
5. packages/core/src/services/index-repository-service.ts (score=0.7999)
6. packages/core/src/services/index-files-service.ts (score=0.7840)
7. packages/core/src/services/index-repository-service.ts (score=0.7840)
8. packages/core/src/services/index-files-service.ts (score=0.7789)
9. design/v1/mcp-tool-interface-design.md (score=0.7775)
10. packages/core/src/services/index-files-service.ts (score=0.7768)
