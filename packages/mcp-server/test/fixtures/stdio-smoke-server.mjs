import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createMcpServer } from "../../dist/server.js";

const app = {
  config: {
    projectSpace: "smoke-project",
    surreal: {
      url: "ws://127.0.0.1:8000/rpc",
      namespace: "smoke_project",
      database: "default",
      username: "root",
      password: "root",
      useTls: false,
      deploymentMode: "local",
    },
    embedding: {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 1024,
      apiKey: "test-key",
    },
    indexing: {
      defaultTopK: 10,
      ignorePatterns: [],
      nativeCandidateMultiplier: 20,
      nativeEfSearchMin: 100,
    },
    mcp: {
      defaultRepositoryId: "repo-a",
      repositoryRoot: "/workspace/repo-a",
    },
    logging: {
      level: "info",
      pretty: false,
    },
  },
  container: {
    logger: createLogger(),
    indexRepositoryService: {
      execute: async () => ({
        scannedFileCount: 1,
        parsedFileCount: 1,
        skippedFileCount: 0,
        preparedChunkCount: 1,
        embeddedChunkCount: 1,
        storedChunkCount: 1,
        failedFileCount: 0,
        failedFiles: [],
      }),
    },
    searchCodeContextService: {
      execute: async () => ({
        repositoryId: "repo-a",
        query: "find value",
        topK: 10,
        resultCount: 1,
        results: [
          {
            score: 0.95,
            reason: "semantic_match",
            chunk: {
              id: "chunk-a",
              repositoryId: "repo-a",
              filePath: "src/index.ts",
              language: "typescript",
              content: "export const value = 1;",
              searchText: "value",
              startLine: 1,
              endLine: 1,
              hash: "hash-a",
              embedding: [1, 0, 0],
              metadata: {
                symbolName: "value",
              },
            },
          },
        ],
        contextPacket: {
          kind: "search",
          repositoryId: "repo-a",
          query: "find value",
          items: [
            {
              type: "search_match",
              id: "chunk-a",
              filePath: "src/index.ts",
              language: "typescript",
              content: "export const value = 1;",
              startLine: 1,
              endLine: 1,
              score: 0.95,
              reason: "semantic_match",
              estimatedTokens: 18,
              metadata: {
                symbolName: "value",
              },
            },
          ],
          files: [
            {
              filePath: "src/index.ts",
              language: "typescript",
              chunkCount: 1,
              startLine: 1,
              endLine: 1,
            },
          ],
          instructions: [
            "Treat this packet as semantic retrieval output ranked by relevance.",
            "Use items for exact excerpts and files for a de-duplicated coverage summary.",
          ],
          deduplication: {
            strategy: "none",
            inputItems: 1,
            removedItems: 0,
          },
          truncation: {
            truncated: false,
            strategy: "none",
            totalItems: 1,
            returnedItems: 1,
            omittedItems: 0,
            limit: 10,
            budgetTokens: undefined,
            estimatedTotalTokens: 18,
            estimatedReturnedTokens: 18,
          },
        },
      }),
    },
    indexFilesService: {
      execute: async () => ({
        requestedFileCount: 1,
        indexedFileCount: 1,
        deletedChunkCount: 0,
        preparedChunkCount: 1,
        embeddedChunkCount: 1,
        storedChunkCount: 1,
        failedFileCount: 0,
        failedFiles: [],
      }),
    },
    deleteFilesService: {
      execute: async () => ({
        requestedFileCount: 1,
        deletedFileCount: 1,
        deletedChunkCount: 0,
      }),
    },
    getFileContextService: {
      execute: async () => ({
        repositoryId: "repo-a",
        filePath: "src/index.ts",
        chunkCount: 1,
        chunks: [
          {
            id: "chunk-a",
            filePath: "src/index.ts",
            language: "typescript",
            content: "export const value = 1;",
            startLine: 1,
            endLine: 1,
            metadata: {
              symbolName: "value",
            },
          },
        ],
        assembledContext: {
          content:
            "[chunk 1 | lines 1-1 | symbol value]\nexport const value = 1;",
          truncated: false,
        },
        contextPacket: {
          kind: "file",
          repositoryId: "repo-a",
          items: [
            {
              type: "file_chunk",
              id: "chunk-a",
              filePath: "src/index.ts",
              language: "typescript",
              content: "export const value = 1;",
              startLine: 1,
              endLine: 1,
              estimatedTokens: 18,
              metadata: {
                symbolName: "value",
              },
            },
          ],
          files: [
            {
              filePath: "src/index.ts",
              language: "typescript",
              chunkCount: 1,
              startLine: 1,
              endLine: 1,
            },
          ],
          instructions: [
            "Treat this packet as indexed repository context, not a live filesystem read.",
            "Prefer assembledContext for continuous reading and items for structured inspection.",
          ],
          deduplication: {
            strategy: "none",
            inputItems: 1,
            removedItems: 0,
          },
          truncation: {
            truncated: false,
            strategy: "none",
            totalItems: 1,
            returnedItems: 1,
            omittedItems: 0,
            budgetTokens: undefined,
            estimatedTotalTokens: 18,
            estimatedReturnedTokens: 18,
          },
        },
      }),
    },
  },
};

const server = createMcpServer(app);
const transport = new StdioServerTransport();

await server.connect(transport);

function createLogger() {
  return {
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() {
      return this;
    },
  };
}
