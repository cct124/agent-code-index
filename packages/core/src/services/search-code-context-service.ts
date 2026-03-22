import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";
import type { ContextPacket } from "../domain/context-packet.js";
import type { SearchResult } from "../domain/search-result.js";
import type { SearchRepository } from "../contracts/search-repository.js";

/**
 * 查询代码上下文输入。
 */
export interface SearchCodeContextInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 原始查询文本。 */
  query: string;
  /** 返回结果数量。 */
  topK: number;
  /** 附加过滤条件。 */
  filters?: Record<string, unknown>;
}

/**
 * 查询代码上下文结果。
 *
 * `results` 保留原始检索结果用于调试；`contextPacket` 提供统一的 Agent 消费出口。
 */
export interface SearchCodeContextResult {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 原始查询文本。 */
  query: string;
  /** 请求的 topK。 */
  topK: number;
  /** 原始检索结果数量。 */
  resultCount: number;
  /** 原始检索结果。 */
  results: SearchResult[];
  /** 标准化后的统一上下文包。 */
  contextPacket: ContextPacket;
}

/**
 * 查询代码上下文服务抽象。
 */
export interface SearchCodeContextService {
  /**
   * 将 query 文本转换为 query embedding，并执行语义检索。
   */
  execute(input: SearchCodeContextInput): Promise<SearchCodeContextResult>;
}

/**
 * 默认的查询代码上下文服务实现。
 */
export class DefaultSearchCodeContextService implements SearchCodeContextService {
  /** query embedding provider。 */
  private readonly embeddingProvider: EmbeddingProvider;
  /** 语义检索仓储。 */
  private readonly searchRepository: SearchRepository;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化查询代码上下文服务。
   */
  public constructor(
    embeddingProvider: EmbeddingProvider,
    searchRepository: SearchRepository,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.embeddingProvider = embeddingProvider;
    this.searchRepository = searchRepository;
    this.logger = logger.child({
      package: "core",
      module: "search-code-context-service",
      component: "DefaultSearchCodeContextService",
    });
  }

  /**
   * 执行正式的 query-text 检索用例。
   */
  public async execute(
    input: SearchCodeContextInput,
  ): Promise<SearchCodeContextResult> {
    const query = input.query.trim();

    if (!query || input.topK <= 0) {
      this.logger.debug(
        "Search code context skipped because query or topK is empty",
        {
          repositoryId: input.repositoryId,
          topK: input.topK,
          queryLength: query.length,
        },
      );
      return {
        repositoryId: input.repositoryId,
        query,
        topK: input.topK,
        resultCount: 0,
        results: [],
        contextPacket: buildSearchContextPacket({
          repositoryId: input.repositoryId,
          query,
          topK: input.topK,
          results: [],
        }),
      };
    }

    const logger = this.logger.child({
      operation: "search-code-context",
      repositoryId: input.repositoryId,
      topK: input.topK,
    });
    const startedAt = Date.now();

    logger.info("Search code context started", {
      queryLength: query.length,
      filterCount: Object.keys(input.filters ?? {}).length,
      provider: this.embeddingProvider.provider,
      embeddingModel: this.embeddingProvider.model,
    });

    try {
      const embeddings = await this.embeddingProvider.generateEmbeddings({
        values: [query],
        purpose: "query",
      });
      const queryEmbedding = embeddings[0];

      if (!queryEmbedding || queryEmbedding.length === 0) {
        throw new Error("Query embedding provider returned an empty embedding");
      }

      const results = await this.searchRepository.semanticSearch({
        repositoryId: input.repositoryId,
        embedding: [...queryEmbedding],
        topK: input.topK,
        filters: input.filters,
      });
      const result = {
        repositoryId: input.repositoryId,
        query,
        topK: input.topK,
        resultCount: results.length,
        results,
        contextPacket: buildSearchContextPacket({
          repositoryId: input.repositoryId,
          query,
          topK: input.topK,
          results,
        }),
      };

      logger.info("Search code context completed", {
        durationMs: Date.now() - startedAt,
        resultCount: results.length,
        contextItemCount: result.contextPacket.items.length,
      });

      return result;
    } catch (error) {
      logger.error("Search code context failed", {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }
}

function buildSearchContextPacket(input: {
  repositoryId: string;
  query: string;
  topK: number;
  results: SearchResult[];
}): ContextPacket {
  const deduplicated = dedupeSearchResults(input.results);
  const limited = deduplicated.items.slice(0, input.topK);

  return {
    kind: "search",
    repositoryId: input.repositoryId,
    query: input.query,
    items: limited.map((result) => ({
      type: "search_match",
      id: result.chunk.id,
      filePath: result.chunk.filePath,
      language: result.chunk.language,
      startLine: result.chunk.startLine,
      endLine: result.chunk.endLine,
      content: result.chunk.content,
      score: result.score,
      reason: result.reason,
      metadata: { ...result.chunk.metadata },
    })),
    files: summarizeSearchFiles(limited),
    instructions: [
      "Treat this packet as semantic retrieval output ranked by relevance.",
      "Use items for exact excerpts and files for a de-duplicated coverage summary.",
    ],
    deduplication: {
      strategy: deduplicated.strategy,
      inputItems: input.results.length,
      removedItems: input.results.length - deduplicated.items.length,
    },
    truncation: {
      truncated: deduplicated.items.length > limited.length,
      strategy: deduplicated.items.length > limited.length ? "top_k" : "none",
      totalItems: deduplicated.items.length,
      returnedItems: limited.length,
      omittedItems: deduplicated.items.length - limited.length,
      limit: input.topK,
    },
  };
}

function dedupeSearchResults(results: SearchResult[]): {
  items: SearchResult[];
  strategy: "none" | "chunk_id" | "file_path_line_range";
} {
  const uniqueResults: SearchResult[] = [];
  const seenChunkIds = new Set<string>();
  const seenRanges = new Set<string>();
  let fallbackUsed = false;

  for (const result of results) {
    const chunkId = result.chunk.id.trim();

    if (chunkId) {
      if (seenChunkIds.has(chunkId)) {
        continue;
      }

      seenChunkIds.add(chunkId);
      uniqueResults.push(result);
      continue;
    }

    fallbackUsed = true;
    const rangeKey = [
      result.chunk.filePath,
      result.chunk.startLine,
      result.chunk.endLine,
      result.chunk.hash,
    ].join(":");

    if (seenRanges.has(rangeKey)) {
      continue;
    }

    seenRanges.add(rangeKey);
    uniqueResults.push(result);
  }

  if (results.length === uniqueResults.length) {
    return {
      items: uniqueResults,
      strategy: "none",
    };
  }

  return {
    items: uniqueResults,
    strategy: fallbackUsed ? "file_path_line_range" : "chunk_id",
  };
}

function summarizeSearchFiles(results: SearchResult[]): ContextPacket["files"] {
  const files = new Map<
    string,
    {
      filePath: string;
      language: string;
      chunkCount: number;
      startLine: number;
      endLine: number;
    }
  >();

  for (const result of results) {
    const existing = files.get(result.chunk.filePath);

    if (!existing) {
      files.set(result.chunk.filePath, {
        filePath: result.chunk.filePath,
        language: result.chunk.language,
        chunkCount: 1,
        startLine: result.chunk.startLine,
        endLine: result.chunk.endLine,
      });
      continue;
    }

    existing.chunkCount += 1;
    existing.startLine = Math.min(existing.startLine, result.chunk.startLine);
    existing.endLine = Math.max(existing.endLine, result.chunk.endLine);
  }

  return Array.from(files.values());
}
