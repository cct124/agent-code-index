import type { EmbeddingProvider } from "../contracts/embedding-provider.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";
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
 * 查询代码上下文服务抽象。
 */
export interface SearchCodeContextService {
  /**
   * 将 query 文本转换为 query embedding，并执行语义检索。
   */
  execute(input: SearchCodeContextInput): Promise<SearchResult[]>;
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
  public async execute(input: SearchCodeContextInput): Promise<SearchResult[]> {
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
      return [];
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

      logger.info("Search code context completed", {
        durationMs: Date.now() - startedAt,
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error("Search code context failed", {
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }
  }
}
