/**
 * 基于 SurrealDB 的 SearchRepository 骨架实现。
 */
import { NOOP_LOGGER, type Logger } from "@agent-code-index/core";
import type {
  Chunk,
  ChunkMetadata,
  SearchRepository,
  SearchResult,
  SemanticSearchInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";
import {
  classifySurrealError,
  createSurrealErrorLogFields,
  normalizeUnknownLogFields,
} from "./surreal-log-utils.js";

const DEFAULT_HNSW_EF_SEARCH = 100;
const DEFAULT_NATIVE_CANDIDATE_MULTIPLIER = 20;
const NATIVE_SEARCH_REASON = "surreal vector search";
const FALLBACK_SEARCH_REASON = "application cosine fallback";

/**
 * chunk 表中用于检索的存储记录结构。
 *
 * 该结构基本对应持久化后的 chunk 记录，并允许携带 embedding 供语义检索使用。
 */
interface StoredSearchChunk extends Record<string, unknown> {
  /** SurrealDB 内部记录 id。 */
  id?: string;
  /** 领域层 chunk id。 */
  chunkId: string;
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 所属文件路径。 */
  filePath: string;
  /** 代码语言。 */
  language: string;
  /** 原始代码内容。 */
  content: string;
  /** 用于检索的归一化文本。 */
  searchText: string;
  /** 起始行号。 */
  startLine: number;
  /** 结束行号。 */
  endLine: number;
  /** 内容哈希。 */
  hash: string;
  /** 附加元数据。 */
  metadata: ChunkMetadata;
  /** 语义检索使用的 embedding 向量。 */
  embedding?: number[];
  /** KNN 查询返回的距离值。 */
  distance?: number;
}

/**
 * 允许从查询层透传到存储过滤条件的字段映射。
 *
 * key 为外部过滤参数名，value 为 Surreal 查询中对应的字段路径。
 */
const FILTER_FIELD_MAP = {
  filePath: "filePath",
  language: "language",
  hash: "hash",
  startLine: "startLine",
  endLine: "endLine",
  symbolName: "metadata.symbolName",
  symbolKind: "metadata.symbolKind",
  parentSymbol: "metadata.parentSymbol",
  heading: "metadata.heading",
  docType: "metadata.docType",
  sectionLevel: "metadata.sectionLevel",
  tags: "metadata.tags",
} as const;

/**
 * SurrealDB 的 SearchRepository 默认实现。
 *
 * 当前实现默认优先走 Surreal 原生 HNSW KNN 查询；若原生向量查询不可用，
 * 则回退到应用层余弦相似度排序路径。
 */
export class SurrealSearchRepository implements SearchRepository {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化 SurrealSearchRepository。
   */
  public constructor(client: SurrealClient, logger: Logger = NOOP_LOGGER) {
    this.client = client;
    this.logger = logger.child({
      package: "infra",
      module: "surreal-search-repository",
      component: "SurrealSearchRepository",
    });
  }

  /**
   * 基于向量和过滤条件执行语义检索。
   *
   * 当 `topK` 非正数或查询向量为空时，直接返回空结果，避免无意义查询。
   */
  public async semanticSearch(
    input: SemanticSearchInput,
  ): Promise<SearchResult[]> {
    if (input.topK <= 0 || input.embedding.length === 0) {
      this.logger.debug(
        "Semantic search skipped because topK or embedding is empty",
        {
          repositoryId: input.repositoryId,
          topK: input.topK,
        },
      );
      return [];
    }

    const logger = this.logger.child({
      operation: "semantic-search",
      repositoryId: input.repositoryId,
      topK: input.topK,
    });

    logger.info("Semantic search started", {
      filterCount: Object.keys(input.filters ?? {}).length,
      filters: normalizeUnknownLogFields(input.filters),
    });

    try {
      await this.client.connect();

      const filterState = buildFilterState(input.filters);
      const results = await this.executeWithNativeFallback(
        input,
        filterState,
        logger,
      );

      logger.info("Semantic search completed", {
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      logger.error(
        "Semantic search failed",
        createSurrealErrorLogFields(error, {
          repositoryId: input.repositoryId,
          topK: input.topK,
          filters: normalizeUnknownLogFields(input.filters),
        }),
      );
      throw error;
    }
  }

  private async executeWithNativeFallback(
    input: SemanticSearchInput,
    filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    try {
      return await this.nativeVectorSearch(input, filterState, logger);
    } catch (error) {
      if (!shouldFallbackToApplicationCosine(error)) {
        throw error;
      }

      logger.warn(
        "Native vector search failed, falling back to application cosine search",
        {
          searchStrategy: "application-cosine-fallback",
          repositoryId: input.repositoryId,
          topK: input.topK,
          filters: normalizeUnknownLogFields(input.filters),
          ...createSurrealErrorLogFields(error),
        },
      );

      return this.fallbackApplicationCosineSearch(input, filterState, logger);
    }
  }

  private async nativeVectorSearch(
    input: SemanticSearchInput,
    _filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    const topK = normalizeTopK(input.topK);
    const candidateK = Math.max(
      topK,
      topK * DEFAULT_NATIVE_CANDIDATE_MULTIPLIER,
    );
    const efSearch = Math.max(DEFAULT_HNSW_EF_SEARCH, candidateK);
    const queryText = [
      "SELECT *, vector::distance::knn() AS distance FROM chunk",
      "WHERE repositoryId = $repositoryId",
      `AND embedding <|${candidateK},${efSearch}|> $embedding`,
      "ORDER BY distance;",
    ].join(" ");

    const [records] = await this.client.driver.query<[StoredSearchChunk[]]>(
      queryText,
      {
        repositoryId: input.repositoryId,
        embedding: input.embedding,
      },
    );

    logger.debug("Semantic search executed with native vector path", {
      searchStrategy: "surreal-native-vector",
      nativeVectorIndexUsed: true,
      vectorDistanceMetric: "COSINE",
      candidateCount: records?.length ?? 0,
      candidateK,
      efSearch,
    });

    return sortResults(
      (records ?? []).flatMap((record) => {
        if (
          typeof record.distance !== "number" ||
          Number.isNaN(record.distance)
        ) {
          return [];
        }

        if (!matchesSearchFilters(record, input.repositoryId, input.filters)) {
          return [];
        }

        return [
          {
            chunk: toChunk(record),
            score: distanceToScore(record.distance),
            reason: NATIVE_SEARCH_REASON,
          },
        ];
      }),
    ).slice(0, topK);
  }

  private async fallbackApplicationCosineSearch(
    input: SemanticSearchInput,
    filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    const [records] = await this.client.driver.query<[StoredSearchChunk[]]>(
      [
        "SELECT * FROM chunk",
        "WHERE repositoryId = $repositoryId",
        ...filterState.clauses,
        ";",
      ].join(" "),
      {
        repositoryId: input.repositoryId,
        ...filterState.bindings,
      },
    );

    logger.debug("Semantic search executed with application cosine fallback", {
      searchStrategy: "application-cosine-fallback",
      nativeVectorIndexUsed: false,
      vectorDistanceMetric: "COSINE",
      candidateCount: records?.length ?? 0,
    });

    return sortResults(
      (records ?? []).flatMap((record) => {
        const score = cosineSimilarity(record.embedding, input.embedding);

        if (score === null) {
          return [];
        }

        return [
          {
            chunk: toChunk(record),
            score,
            reason: FALLBACK_SEARCH_REASON,
          },
        ];
      }),
    ).slice(0, normalizeTopK(input.topK));
  }
}

function matchesSearchFilters(
  record: StoredSearchChunk,
  repositoryId: string,
  filters?: Record<string, unknown>,
): boolean {
  if (record.repositoryId !== repositoryId) {
    return false;
  }

  if (!filters) {
    return true;
  }

  for (const [key, value] of Object.entries(filters)) {
    if (key === "tags") {
      const requiredTags = Array.isArray(value) ? value : [value];
      const recordTags = Array.isArray(record.metadata?.tags)
        ? record.metadata.tags
        : [];

      if (
        requiredTags.some(
          (tag) => typeof tag !== "string" || !recordTags.includes(tag),
        )
      ) {
        return false;
      }

      continue;
    }

    if (readFilterValue(record, key) !== value) {
      return false;
    }
  }

  return true;
}

function readFilterValue(
  record: StoredSearchChunk,
  key: keyof typeof FILTER_FIELD_MAP | string,
): unknown {
  switch (key) {
    case "filePath":
      return record.filePath;
    case "language":
      return record.language;
    case "hash":
      return record.hash;
    case "startLine":
      return record.startLine;
    case "endLine":
      return record.endLine;
    case "symbolName":
      return record.metadata?.symbolName;
    case "symbolKind":
      return record.metadata?.symbolKind;
    case "parentSymbol":
      return record.metadata?.parentSymbol;
    case "heading":
      return record.metadata?.heading;
    case "docType":
      return record.metadata?.docType;
    case "sectionLevel":
      return record.metadata?.sectionLevel;
    default:
      return undefined;
  }
}

/**
 * 将外部过滤条件转换为 Surreal 查询片段与绑定参数。
 *
 * 当前仅支持字符串、数字和布尔值的精确匹配过滤。
 */
function buildFilterState(filters?: Record<string, unknown>): {
  clauses: string[];
  bindings: Record<string, string | number | boolean>;
} {
  if (!filters) {
    return {
      clauses: [],
      bindings: {},
    };
  }

  const clauses: string[] = [];
  const bindings: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(filters)) {
    const field = FILTER_FIELD_MAP[key as keyof typeof FILTER_FIELD_MAP];

    if (!field) {
      throw new Error(`Unsupported search filter: ${key}`);
    }

    if (key === "tags") {
      appendTagFilter(clauses, bindings, value);
      continue;
    }

    if (
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new Error(
        `Search filter ${key} must be a string, number, or boolean`,
      );
    }

    const bindingKey = `filter_${key}`;
    clauses.push(`AND ${field} = $${bindingKey}`);
    bindings[bindingKey] = value;
  }

  return {
    clauses,
    bindings,
  };
}

function appendTagFilter(
  clauses: string[],
  bindings: Record<string, string | number | boolean>,
  value: unknown,
): void {
  const tags = Array.isArray(value) ? value : [value];

  if (
    tags.length === 0 ||
    tags.some((tag) => typeof tag !== "string" || tag.trim().length === 0)
  ) {
    throw new Error("Search filter tags must be a string or string[]");
  }

  for (const [index, tag] of tags.entries()) {
    const bindingKey = `filter_tags_${index}`;
    clauses.push(`AND metadata.tags CONTAINS $${bindingKey}`);
    bindings[bindingKey] = tag as string;
  }
}

/**
 * 计算候选向量与查询向量的余弦相似度。
 *
 * 若候选向量不存在、维度不一致或为空，则返回 `null` 表示该记录不可参与排序。
 */
function cosineSimilarity(
  candidate: number[] | undefined,
  query: number[],
): number | null {
  if (
    !candidate ||
    candidate.length !== query.length ||
    candidate.length === 0
  ) {
    return null;
  }

  let dotProduct = 0;
  let candidateMagnitude = 0;
  let queryMagnitude = 0;

  for (let index = 0; index < candidate.length; index += 1) {
    const candidateValue = candidate[index] ?? 0;
    const queryValue = query[index] ?? 0;

    dotProduct += candidateValue * queryValue;
    candidateMagnitude += candidateValue * candidateValue;
    queryMagnitude += queryValue * queryValue;
  }

  if (candidateMagnitude === 0 || queryMagnitude === 0) {
    return 0;
  }

  return dotProduct / Math.sqrt(candidateMagnitude * queryMagnitude);
}

function distanceToScore(distance: number): number {
  const normalizedDistance = Math.max(distance, 0);
  return 1 / (1 + normalizedDistance);
}

function sortResults(results: SearchResult[]): SearchResult[] {
  return results.sort(
    (left, right) =>
      right.score - left.score ||
      left.chunk.filePath.localeCompare(right.chunk.filePath) ||
      left.chunk.startLine - right.chunk.startLine ||
      left.chunk.endLine - right.chunk.endLine,
  );
}

function normalizeTopK(topK: number): number {
  return Math.max(1, Math.trunc(topK));
}

function shouldFallbackToApplicationCosine(error: unknown): boolean {
  const classified = classifySurrealError(error);

  if (classified.errCode !== "surreal_query_error") {
    return false;
  }

  return /hnsw|knn|vector|distance|parse|syntax|index|unexpected/.test(
    classified.error.message.toLowerCase(),
  );
}

/**
 * 将存储层记录映射为领域层 Chunk 对象。
 */
function toChunk(record: StoredSearchChunk): Chunk {
  return {
    id: record.chunkId,
    repositoryId: record.repositoryId,
    filePath: record.filePath,
    language: record.language,
    content: record.content,
    searchText: record.searchText,
    startLine: record.startLine,
    endLine: record.endLine,
    hash: record.hash,
    embedding: Array.isArray(record.embedding)
      ? (record.embedding as number[])
      : undefined,
    metadata: {
      ...record.metadata,
    },
  };
}
