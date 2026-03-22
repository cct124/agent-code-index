import type { FileContextChunk, SearchResult } from "@agent-code-index/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { App } from "../../bootstrap/app.js";
import {
  resolveRepositoryId,
  resolveRootPath,
} from "../shared/input-resolver.js";
import {
  createTextContent,
  normalizeFilePaths,
  normalizeOptionalPositiveInteger,
  normalizeRequiredString,
  normalizeSearchFilters,
} from "../shared/tool-utils.js";

const indexRepositoryInputSchema = z.object({
  repositoryId: z.string().optional(),
  rootPath: z.string().optional(),
  mode: z.literal("full").optional(),
  embeddingBatchSize: z.number().int().positive().optional(),
});

const searchCodeContextInputSchema = z.object({
  repositoryId: z.string().optional(),
  query: z.string(),
  topK: z.number().int().positive().optional(),
  tokenBudget: z.number().int().positive().optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const indexFilesInputSchema = z.object({
  repositoryId: z.string().optional(),
  rootPath: z.string().optional(),
  filePaths: z.array(z.string()).min(1),
  embeddingBatchSize: z.number().int().positive().optional(),
});

const deleteFilesInputSchema = z.object({
  repositoryId: z.string().optional(),
  filePaths: z.array(z.string()).min(1),
});

const getFileContextInputSchema = z.object({
  repositoryId: z.string().optional(),
  filePath: z.string(),
});

/**
 * 将当前可用的 core use case 注册为 MCP tools。
 */
export function registerAgentCodeIndexTools(server: McpServer, app: App): void {
  const logger = app.container.logger.child({
    module: "mcp-tools",
    component: "registerAgentCodeIndexTools",
  });

  server.registerTool(
    "index_repository",
    {
      title: "索引整个仓库",
      description: "扫描仓库根目录，切块文件、生成向量，并重建整个仓库的索引。",
      inputSchema: indexRepositoryInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const repositoryId = resolveRepositoryId(app.config, args.repositoryId);
        const rootPath = resolveRootPath(app.config, args.rootPath);
        const embeddingBatchSize = normalizeOptionalPositiveInteger(
          "embeddingBatchSize",
          args.embeddingBatchSize,
        );
        const result = await app.container.indexRepositoryService.execute({
          repositoryId,
          rootPath,
          mode: args.mode ?? "full",
          embeddingBatchSize,
        });
        const structuredContent = {
          repositoryId,
          mode: args.mode ?? "full",
          summary: {
            scannedFileCount: result.scannedFileCount,
            parsedFileCount: result.parsedFileCount,
            skippedFileCount: result.skippedFileCount,
            preparedChunkCount: result.preparedChunkCount,
            embeddedChunkCount: result.embeddedChunkCount,
            storedChunkCount: result.storedChunkCount,
            failedFileCount: result.failedFileCount,
          },
          failedFiles: result.failedFiles,
        };

        return {
          content: createTextContent(
            `Indexed repository ${repositoryId}: scanned ${result.scannedFileCount} files, stored ${result.storedChunkCount} chunks, failed ${result.failedFileCount} files.`,
          ),
          structuredContent,
        };
      } catch (error) {
        return createToolErrorResult(logger, "index_repository", error);
      }
    },
  );

  server.registerTool(
    "search_code_context",
    {
      title: "搜索代码上下文",
      description:
        "对自然语言查询执行语义代码检索，并返回按相关性排序的代码上下文结果。",
      inputSchema: searchCodeContextInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const repositoryId = resolveRepositoryId(app.config, args.repositoryId);
        const query = normalizeRequiredString("query", args.query);
        const topK =
          normalizeOptionalPositiveInteger("topK", args.topK) ??
          app.config.indexing.defaultTopK;
        const tokenBudget = normalizeOptionalPositiveInteger(
          "tokenBudget",
          args.tokenBudget,
        );
        const filters = normalizeSearchFilters(args.filters);
        const results = await app.container.searchCodeContextService.execute({
          repositoryId,
          query,
          topK,
          tokenBudget,
          filters,
        });
        const structuredContent = {
          repositoryId,
          query,
          topK,
          tokenBudget,
          resultCount: results.resultCount,
          results: results.results.map(toSearchToolResultItem),
          contextPacket: results.contextPacket,
        };

        return {
          content: createTextContent(
            `Searched repository ${repositoryId}: returned ${results.resultCount} results for query "${query}".`,
          ),
          structuredContent,
        };
      } catch (error) {
        return createToolErrorResult(logger, "search_code_context", error);
      }
    },
  );

  server.registerTool(
    "index_files",
    {
      title: "重建文件索引",
      description: "对指定文件列表执行覆盖式重建，刷新这些文件的索引数据。",
      inputSchema: indexFilesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const repositoryId = resolveRepositoryId(app.config, args.repositoryId);
        const rootPath = resolveRootPath(app.config, args.rootPath);
        const filePaths = normalizeFilePaths(args.filePaths);
        const embeddingBatchSize = normalizeOptionalPositiveInteger(
          "embeddingBatchSize",
          args.embeddingBatchSize,
        );
        const result = await app.container.indexFilesService.execute({
          repositoryId,
          rootPath,
          filePaths,
          embeddingBatchSize,
        });
        const structuredContent = {
          repositoryId,
          requestedFileCount: result.requestedFileCount,
          indexedFileCount: result.indexedFileCount,
          deletedChunkCount: result.deletedChunkCount,
          preparedChunkCount: result.preparedChunkCount,
          embeddedChunkCount: result.embeddedChunkCount,
          storedChunkCount: result.storedChunkCount,
          failedFileCount: result.failedFileCount,
          failedFiles: result.failedFiles,
        };

        return {
          content: createTextContent(
            `Indexed ${result.indexedFileCount}/${result.requestedFileCount} files for ${repositoryId}: stored ${result.storedChunkCount} chunks, failed ${result.failedFileCount} files.`,
          ),
          structuredContent,
        };
      } catch (error) {
        return createToolErrorResult(logger, "index_files", error);
      }
    },
  );

  server.registerTool(
    "delete_files",
    {
      title: "删除文件索引",
      description: "删除指定文件列表对应的全部已索引 chunk 数据。",
      inputSchema: deleteFilesInputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const repositoryId = resolveRepositoryId(app.config, args.repositoryId);
        const filePaths = normalizeFilePaths(args.filePaths);
        const result = await app.container.deleteFilesService.execute({
          repositoryId,
          filePaths,
        });
        const structuredContent = {
          repositoryId,
          requestedFileCount: result.requestedFileCount,
          deletedFileCount: result.deletedFileCount,
          deletedChunkCount: result.deletedChunkCount,
        };

        return {
          content: createTextContent(
            `Deleted indexed data for ${result.deletedFileCount} files in ${repositoryId}: removed ${result.deletedChunkCount} chunks.`,
          ),
          structuredContent,
        };
      } catch (error) {
        return createToolErrorResult(logger, "delete_files", error);
      }
    },
  );

  server.registerTool(
    "get_file_context",
    {
      title: "读取文件上下文",
      description:
        "按仓库与文件路径读取已索引的文件上下文，并返回连续文本与结构化 chunk。",
      inputSchema: getFileContextInputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        const repositoryId = resolveRepositoryId(app.config, args.repositoryId);
        const filePath = normalizeRequiredString("filePath", args.filePath);
        const result = await app.container.getFileContextService.execute({
          repositoryId,
          filePath,
        });
        const structuredContent = {
          repositoryId: result.repositoryId,
          filePath: result.filePath,
          chunkCount: result.chunkCount,
          chunks: result.chunks.map(toFileContextToolChunk),
          assembledContext: result.assembledContext,
          contextPacket: result.contextPacket,
        };

        return {
          content: createTextContent(
            `Loaded file context for ${result.filePath} in ${result.repositoryId}: assembled ${result.chunkCount} chunks.`,
          ),
          structuredContent,
        };
      } catch (error) {
        return createToolErrorResult(logger, "get_file_context", error);
      }
    },
  );
}

function toSearchToolResultItem(result: SearchResult): Record<string, unknown> {
  return {
    score: result.score,
    reason: result.reason,
    chunk: {
      id: result.chunk.id,
      repositoryId: result.chunk.repositoryId,
      filePath: result.chunk.filePath,
      language: result.chunk.language,
      content: result.chunk.content,
      searchText: result.chunk.searchText,
      startLine: result.chunk.startLine,
      endLine: result.chunk.endLine,
      hash: result.chunk.hash,
      metadata: result.chunk.metadata,
    },
  };
}

function toFileContextToolChunk(
  chunk: FileContextChunk,
): Record<string, unknown> {
  return {
    id: chunk.id,
    filePath: chunk.filePath,
    language: chunk.language,
    content: chunk.content,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
    metadata: chunk.metadata,
  };
}

function createToolErrorResult(
  logger: App["container"]["logger"],
  toolName: string,
  error: unknown,
): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
  structuredContent: { toolName: string; message: string };
} {
  const message = error instanceof Error ? error.message : String(error);

  logger.warn("MCP tool call failed", {
    toolName,
    error: error instanceof Error ? error : new Error(message),
  });

  return {
    content: createTextContent(`${toolName} failed: ${message}`),
    isError: true,
    structuredContent: {
      toolName,
      message,
    },
  };
}
