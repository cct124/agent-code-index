# Retrieval Quality Comparison

Left: qwen (openai-compatible / Qwen/Qwen3-Embedding-8B)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/qwen.json
Right: voyage (voyage / voyage-code-3)
Source: /home/janex/project/ai-agent/agent-code-index/test/quality/results/voyage.json

## mcp-tools-index-search

Query: index_repository search_code_context index_files delete_files get_file_context MCP tools
Left result count: 10
Right result count: 10
Chunk overlap@10: 1
File overlap@10: 2

Left only files: packages/mcp-server/test/fixtures/stdio-smoke-server.mjs, design/v1/README.md, packages/mcp-server/test/adapters/register-tools.unit.test.ts
Right only files: doc/progress/current-progress.md, packages/mcp-server/README.md, doc/progress/milestones.md

Left top files:
1. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.8971)
2. design/v1/README.md (score=0.8480)
3. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.8466)
4. design/v1/mcp-tool-interface-design.md (score=0.8397)
5. design/v1/mcp-tool-interface-design.md (score=0.8397)
6. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.8277)
7. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.8172)
8. design/v1/mcp-tool-interface-design.md (score=0.8060)
9. design/v1/mcp-tool-interface-design.md (score=0.8060)
10. packages/mcp-server/test/adapters/register-tools.unit.test.ts (score=0.8005)

Right top files:
1. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7764)
2. design/v1/mcp-tool-interface-design.md (score=0.7696)
3. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7662)
4. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7585)
5. design/v1/mcp-tool-interface-design.md (score=0.7531)
6. doc/progress/current-progress.md (score=0.7499)
7. packages/mcp-server/README.md (score=0.7482)
8. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7442)
9. doc/progress/milestones.md (score=0.7441)
10. design/v1/mcp-tool-interface-design.md (score=0.7440)

## gitignore-include-patterns

Query: gitignore dynamic injection includePatterns DEFAULT_SCAN_INCLUDE_PATTERNS LocalFileScanner
Left result count: 10
Right result count: 10
Chunk overlap@10: 2
File overlap@10: 1

Left only files: packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts, packages/infra/src/parsing/tree-sitter/languages/typescript-parser.ts, packages/infra/src/parsing/tree-sitter/tree-sitter-parser.ts, .vscode/mcp.example.jsonc
Right only files: packages/infra/test/scanning/local-file-scanner.unit.test.ts, packages/infra/README.md

Left top files:
1. packages/infra/test/parsing/typescript-tree-sitter-parser.unit.test.ts (score=0.8471)
2. packages/infra/src/scanning/local-file-scanner.ts (score=0.8330)
3. packages/infra/src/scanning/local-file-scanner.ts (score=0.8330)
4. packages/infra/src/parsing/tree-sitter/languages/typescript-parser.ts (score=0.8329)
5. packages/infra/src/parsing/tree-sitter/tree-sitter-parser.ts (score=0.8317)
6. .vscode/mcp.example.jsonc (score=0.8114)
7. .vscode/mcp.example.jsonc (score=0.8114)
8. packages/infra/src/parsing/tree-sitter/languages/typescript-parser.ts (score=0.8057)
9. packages/infra/src/scanning/local-file-scanner.ts (score=0.8050)
10. packages/infra/src/scanning/local-file-scanner.ts (score=0.8050)

Right top files:
1. packages/infra/src/scanning/local-file-scanner.ts (score=0.8372)
2. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.8017)
3. packages/infra/src/scanning/local-file-scanner.ts (score=0.7856)
4. packages/infra/src/scanning/local-file-scanner.ts (score=0.7847)
5. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7721)
6. packages/infra/src/scanning/local-file-scanner.ts (score=0.7713)
7. packages/infra/test/scanning/local-file-scanner.unit.test.ts (score=0.7666)
8. packages/infra/src/scanning/local-file-scanner.ts (score=0.7630)
9. packages/infra/README.md (score=0.7561)
10. packages/infra/src/scanning/local-file-scanner.ts (score=0.7559)

## context-packet-budget

Query: ContextPacket tokenBudget max_items truncation search_code_context richer context
Left result count: 10
Right result count: 10
Chunk overlap@10: 1
File overlap@10: 2

Left only files: packages/mcp-server/test/fixtures/stdio-smoke-server.mjs, design/v1/README.md, packages/mcp-server/src/adapters/tools/register-tools.ts
Right only files: packages/mcp-server/README.md, packages/core/src/services/context-builder.ts, packages/core/test/services/search-code-context-service.unit.test.ts, packages/core/src/services/get-file-context-service.ts, packages/core/src/domain/context-packet.ts

Left top files:
1. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.8639)
2. design/v1/mcp-tool-interface-design.md (score=0.8261)
3. design/v1/mcp-tool-interface-design.md (score=0.8261)
4. design/v1/README.md (score=0.8174)
5. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.8139)
6. design/v1/mcp-tool-interface-design.md (score=0.8058)
7. design/v1/mcp-tool-interface-design.md (score=0.8058)
8. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.8007)
9. packages/mcp-server/test/adapters/register-tools.unit.test.ts (score=0.7935)
10. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.7834)

Right top files:
1. packages/mcp-server/README.md (score=0.8035)
2. packages/core/src/services/context-builder.ts (score=0.7967)
3. packages/core/src/services/context-builder.ts (score=0.7849)
4. design/v1/mcp-tool-interface-design.md (score=0.7629)
5. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7597)
6. packages/core/src/services/get-file-context-service.ts (score=0.7585)
7. packages/mcp-server/test/adapters/register-tools.unit.test.ts (score=0.7568)
8. packages/core/src/domain/context-packet.ts (score=0.7507)
9. packages/core/src/services/context-builder.ts (score=0.7491)
10. packages/core/test/services/search-code-context-service.unit.test.ts (score=0.7444)

## surreal-native-search

Query: Surreal native HNSW candidate multiplier efSearch explain full KnnScan
Left result count: 10
Right result count: 10
Chunk overlap@10: 4
File overlap@10: 2

Left only files: packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts, design/v1/mcp-tool-interface-design.md, packages/mcp-server/test/bootstrap/app.unit.test.ts, test/template/main.py
Right only files: doc/progress/milestones.md, doc/progress/current-progress.md

Left top files:
1. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7767)
2. packages/infra/src/storage/surreal/surreal-project-metadata-schema.ts (score=0.7643)
3. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7561)
4. design/v1/surreal-native-vector-search-migration.md (score=0.7466)
5. design/v1/surreal-native-vector-search-migration.md (score=0.7466)
6. design/v1/mcp-tool-interface-design.md (score=0.7424)
7. design/v1/surreal-native-vector-search-migration.md (score=0.7380)
8. design/v1/surreal-native-vector-search-migration.md (score=0.7380)
9. packages/mcp-server/test/bootstrap/app.unit.test.ts (score=0.7373)
10. test/template/main.py (score=0.7363)

Right top files:
1. design/v1/surreal-native-vector-search-migration.md (score=0.7850)
2. design/v1/surreal-native-vector-search-migration.md (score=0.7838)
3. design/v1/surreal-native-vector-search-migration.md (score=0.7745)
4. doc/progress/milestones.md (score=0.7579)
5. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7565)
6. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7527)
7. design/v1/surreal-native-vector-search-migration.md (score=0.7425)
8. doc/progress/current-progress.md (score=0.7316)
9. design/v1/surreal-native-vector-search-migration.md (score=0.7308)
10. packages/infra/src/storage/surreal/surreal-search-repository.ts (score=0.7293)

## openai-compatible-provider

Query: OpenAI-compatible embedding provider SiliconFlow Qwen3-Embedding-8B
Left result count: 10
Right result count: 10
Chunk overlap@10: 3
File overlap@10: 3

Left only files: packages/infra/src/embedding/voyage-embedding-provider.ts, packages/mcp-server/src/bootstrap/config.ts
Right only files: doc/progress/current-progress.md, design/v1/README.md, doc/progress/milestones.md, packages/infra/test/embedding/openai-compatible-embedding-provider.unit.test.ts, packages/infra/test/embedding/openai-compatible-embedding-provider.real.integration.test.ts

Left top files:
1. packages/core/src/contracts/embedding-provider.ts (score=0.7804)
2. packages/core/src/contracts/embedding-provider.ts (score=0.7804)
3. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7733)
4. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7733)
5. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7722)
6. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7722)
7. packages/mcp-server/src/bootstrap/config.ts (score=0.7707)
8. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7664)
9. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7664)
10. packages/infra/README.md (score=0.7605)

Right top files:
1. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7707)
2. doc/progress/current-progress.md (score=0.7653)
3. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7608)
4. packages/infra/README.md (score=0.7570)
5. design/v1/README.md (score=0.7561)
6. doc/progress/milestones.md (score=0.7527)
7. packages/infra/test/embedding/openai-compatible-embedding-provider.unit.test.ts (score=0.7519)
8. packages/infra/src/embedding/openai-compatible/openai-compatible-embedding-provider.ts (score=0.7485)
9. packages/infra/test/embedding/openai-compatible-embedding-provider.real.integration.test.ts (score=0.7480)
10. packages/core/src/contracts/embedding-provider.ts (score=0.7415)

## voyage-provider

Query: Voyage embedding provider voyage-code-3 provider factory real integration
Left result count: 10
Right result count: 10
Chunk overlap@10: 3
File overlap@10: 3

Left only files: packages/infra/test/embedding/real-embedding-test-env.ts
Right only files: packages/infra/README.md, packages/infra/test/embedding/provider-factory.unit.test.ts, packages/infra/test/embedding/voyage-embedding-provider.real.integration.test.ts, doc/progress/current-progress.md, packages/infra/src/embedding/provider-factory.ts, design/v1/README.md

Left top files:
1. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.8207)
2. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.8207)
3. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7750)
4. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7750)
5. packages/infra/test/embedding/voyage-embedding-provider.unit.test.ts (score=0.7526)
6. packages/infra/test/embedding/real-embedding-test-env.ts (score=0.7521)
7. doc/progress/milestones.md (score=0.7495)
8. doc/progress/milestones.md (score=0.7495)
9. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7487)
10. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7487)

Right top files:
1. packages/infra/README.md (score=0.7639)
2. packages/infra/src/embedding/voyage-embedding-provider.ts (score=0.7552)
3. packages/infra/README.md (score=0.7367)
4. packages/infra/test/embedding/provider-factory.unit.test.ts (score=0.7319)
5. packages/infra/test/embedding/voyage-embedding-provider.real.integration.test.ts (score=0.7312)
6. doc/progress/current-progress.md (score=0.7277)
7. doc/progress/milestones.md (score=0.7246)
8. packages/infra/test/embedding/voyage-embedding-provider.unit.test.ts (score=0.7216)
9. packages/infra/src/embedding/provider-factory.ts (score=0.7215)
10. design/v1/README.md (score=0.7099)

## repository-indexing-concurrency

Query: embeddingConcurrency worker pool repository indexing batches concurrency
Left result count: 10
Right result count: 10
Chunk overlap@10: 6
File overlap@10: 2

Left only files: design/v1/mcp-tool-interface-design.md
Right only files: doc/progress/milestones.md

Left top files:
1. packages/core/src/services/index-repository-service.ts (score=0.8031)
2. packages/core/src/services/index-repository-service.ts (score=0.7949)
3. packages/core/src/services/index-repository-service.ts (score=0.7907)
4. design/v1/mcp-tool-interface-design.md (score=0.7904)
5. packages/core/src/services/index-repository-service.ts (score=0.7722)
6. packages/core/src/services/index-repository-service.ts (score=0.7722)
7. packages/core/src/services/index-repository-service.ts (score=0.7680)
8. packages/core/src/services/index-files-service.ts (score=0.7652)
9. packages/core/src/services/index-files-service.ts (score=0.7643)
10. packages/core/src/services/index-repository-service.ts (score=0.7610)

Right top files:
1. packages/core/src/services/index-repository-service.ts (score=0.7880)
2. packages/core/src/services/index-repository-service.ts (score=0.7829)
3. packages/core/src/services/index-repository-service.ts (score=0.7599)
4. packages/core/src/services/index-repository-service.ts (score=0.7513)
5. packages/core/src/services/index-files-service.ts (score=0.7487)
6. doc/progress/milestones.md (score=0.7419)
7. packages/core/src/services/index-files-service.ts (score=0.7387)
8. packages/core/src/services/index-repository-service.ts (score=0.7386)
9. doc/progress/milestones.md (score=0.7326)
10. packages/core/src/services/index-repository-service.ts (score=0.7311)

## file-context-delete-flows

Query: get_file_context delete_files file-level incremental indexing
Left result count: 10
Right result count: 10
Chunk overlap@10: 1
File overlap@10: 2

Left only files: test/template/main.py
Right only files: packages/mcp-server/test/fixtures/stdio-smoke-server.mjs, packages/mcp-server/README.md, doc/progress/milestones.md, design/v1/README.md

Left top files:
1. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.8284)
2. design/v1/mcp-tool-interface-design.md (score=0.7944)
3. design/v1/mcp-tool-interface-design.md (score=0.7944)
4. design/v1/mcp-tool-interface-design.md (score=0.7849)
5. design/v1/mcp-tool-interface-design.md (score=0.7849)
6. design/v1/mcp-tool-interface-design.md (score=0.7799)
7. design/v1/mcp-tool-interface-design.md (score=0.7799)
8. design/v1/mcp-tool-interface-design.md (score=0.7763)
9. design/v1/mcp-tool-interface-design.md (score=0.7763)
10. test/template/main.py (score=0.7745)

Right top files:
1. design/v1/mcp-tool-interface-design.md (score=0.7158)
2. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.7154)
3. design/v1/mcp-tool-interface-design.md (score=0.7073)
4. packages/mcp-server/test/fixtures/stdio-smoke-server.mjs (score=0.7073)
5. packages/mcp-server/README.md (score=0.6991)
6. doc/progress/milestones.md (score=0.6937)
7. design/v1/mcp-tool-interface-design.md (score=0.6884)
8. packages/mcp-server/src/adapters/tools/register-tools.ts (score=0.6795)
9. design/v1/README.md (score=0.6785)
10. design/v1/mcp-tool-interface-design.md (score=0.6777)

