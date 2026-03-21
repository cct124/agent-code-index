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

/** native HNSW 查询在未显式配置时使用的最小 efSearch。 */
const DEFAULT_HNSW_EF_SEARCH = 100;
/**
 * native HNSW 查询在未显式配置时使用的候选窗口倍数。
 *
 * 例如 `topK=5` 时，默认会先向数据库请求 `5 * 20 = 100` 个候选，
 * 然后再在应用层执行剩余过滤与截断。
 */
const DEFAULT_NATIVE_CANDIDATE_MULTIPLIER = 20;
/** 原生向量检索路径写入 SearchResult.reason 的固定文案。 */
const NATIVE_SEARCH_REASON = "surreal vector search";
/** 应用层余弦回退路径写入 SearchResult.reason 的固定文案。 */
const FALLBACK_SEARCH_REASON = "application cosine fallback";

export interface SurrealSearchRepositoryOptions {
  /**
   * native HNSW 路径用于放大 topK 的候选窗口倍数。
   *
   * 最终参与 `<|K,EF|>` 中 `K` 计算的值为：
   * `max(topK, topK * nativeCandidateMultiplier)`。
   */
  nativeCandidateMultiplier?: number;
  /**
   * native HNSW 路径使用的最小 efSearch。
   *
   * 最终参与 `<|K,EF|>` 中 `EF` 计算的值为：
   * `max(nativeEfSearchMin, candidateK)`。
   */
  nativeEfSearchMin?: number;
}

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
 * 当前实现采用“数据库优先、应用层回退”的检索策略：
 *
 * 1. 默认优先走 Surreal 原生 HNSW KNN 查询，并把全部精确过滤条件一并下推到数据库。
 * 2. 数据库返回结果后，仅执行分值映射、排序与 topK 截断。
 * 3. 若 native 查询因语法、索引或能力限制失败，则自动回退到应用层余弦相似度排序路径。
 *
 * 当前开发基线已验证 SurrealDB 3.0.4 下“多精确过滤条件 + KNN”可以稳定工作，
 * 因此 native 主路径不再保留应用层二次精确过滤。
 */
export class SurrealSearchRepository implements SearchRepository {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;
  /** 结构化日志接口。 */
  private readonly logger: Logger;
  /** native HNSW 查询参数。 */
  private readonly options: Required<SurrealSearchRepositoryOptions>;

  /**
   * 初始化 SurrealSearchRepository。
   */
  public constructor(
    client: SurrealClient,
    logger: Logger = NOOP_LOGGER,
    options: SurrealSearchRepositoryOptions = {},
  ) {
    this.client = client;
    this.logger = logger.child({
      package: "infra",
      module: "surreal-search-repository",
      component: "SurrealSearchRepository",
    });
    this.options = normalizeSearchOptions(options);
  }

  /**
   * 基于向量和过滤条件执行语义检索。
   *
   * 执行流程：
   *
   * 1. 校验 `topK` 与查询向量是否有效。
   * 2. 将 filters 预先编译为可复用的查询片段与绑定参数。
   * 3. 优先尝试 native HNSW 路径。
   * 4. 若 native 路径命中可回退错误，则切换到应用层余弦排序路径。
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

  /**
   * 在 native HNSW 路径与应用层余弦 fallback 路径之间做统一调度。
   *
   * 该方法本身不负责构造查询，只负责：
   *
   * 1. 先尝试执行 native 向量检索
   * 2. 判断错误是否属于“可降级”的查询兼容性问题
   * 3. 必要时记录 warn 日志并切换到 fallback 路径
   */
  private async executeWithNativeFallback(
    input: SemanticSearchInput,
    filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    /**
     * 只有明确属于 Surreal 查询能力或语法层面的错误才回退，
     * 其余错误继续向上抛出，避免把真实故障伪装成“可用但变慢”。
     */
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

  /**
   * 执行默认的 Surreal 原生 HNSW 检索路径。
   *
   * 当前策略是：
   *
   * 1. 根据 `topK` 与仓储配置计算 `candidateK` 和 `efSearch`
   * 2. 在数据库侧执行“全部精确过滤条件 + HNSW KNN”查询
   * 3. 将 distance 映射为 score，并返回最终排序结果
   */
  private async nativeVectorSearch(
    input: SemanticSearchInput,
    filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    const topK = normalizeTopK(input.topK);
    const candidateK = Math.max(
      topK,
      topK * this.options.nativeCandidateMultiplier,
    );
    const efSearch = Math.max(this.options.nativeEfSearchMin, candidateK);
    const queryText = [
      "SELECT *, vector::distance::knn() AS distance FROM chunk",
      "WHERE repositoryId = $repositoryId",
      ...filterState.clauses,
      `AND embedding <|${candidateK},${efSearch}|> $embedding`,
      "ORDER BY distance;",
    ].join(" ");

    const [records] = await this.client.driver.query<[StoredSearchChunk[]]>(
      queryText,
      {
        repositoryId: input.repositoryId,
        embedding: input.embedding,
        ...filterState.bindings,
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

  /**
   * 执行应用层余弦相似度回退路径。
   *
   * 该路径会把全部精确过滤条件直接下推到普通 SQL 查询，
   * 然后在应用层计算余弦相似度并完成排序。
   *
   * 它的定位不是默认主路径，而是在 native HNSW 查询不可用时，
   * 提供一个语义上兼容、性能上较保守的兜底实现。
   */
  private async fallbackApplicationCosineSearch(
    input: SemanticSearchInput,
    filterState: ReturnType<typeof buildFilterState>,
    logger: Logger,
  ): Promise<SearchResult[]> {
    /**
     * fallback 路径会把全部精确过滤条件直接写进 SQL，
     * 再在应用层对返回记录计算余弦相似度。
     */
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

/**
 * 将外部过滤条件转换为 Surreal 查询片段与绑定参数。
 *
 * 当前仅支持：
 *
 * 1. 字符串、数字和布尔值的精确匹配
 * 2. `tags` 的 `CONTAINS` 多值过滤
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

/**
 * 将 tags 过滤转换为多个 `metadata.tags CONTAINS ...` 子句。
 *
 * 多个 tag 之间采用 AND 语义，即要求记录包含全部给定标签。
 */
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

/**
 * 将 Surreal 返回的距离值映射为“越大越相关”的分值。
 *
 * 这里采用 `1 / (1 + distance)` 的单调映射，
 * 主要目标是保持排序方向正确，而不是复刻余弦相似度的绝对数值语义。
 */
function distanceToScore(distance: number): number {
  const normalizedDistance = Math.max(distance, 0);
  return 1 / (1 + normalizedDistance);
}

/**
 * 统一对搜索结果做稳定排序。
 *
 * 主排序键是 score 倒序；当 score 一致时，再按文件路径和行号打破平局，
 * 让结果在测试与日志中更稳定。
 */
function sortResults(results: SearchResult[]): SearchResult[] {
  return results.sort(
    (left, right) =>
      right.score - left.score ||
      left.chunk.filePath.localeCompare(right.chunk.filePath) ||
      left.chunk.startLine - right.chunk.startLine ||
      left.chunk.endLine - right.chunk.endLine,
  );
}

/** 将用户输入的 topK 收敛为最小值为 1 的整数。 */
function normalizeTopK(topK: number): number {
  return Math.max(1, Math.trunc(topK));
}

/**
 * 将外部 options 归一化为仓储内部始终可用的完整配置。
 */
function normalizeSearchOptions(
  options: SurrealSearchRepositoryOptions,
): Required<SurrealSearchRepositoryOptions> {
  return {
    nativeCandidateMultiplier: positiveIntegerOrDefault(
      options.nativeCandidateMultiplier,
      DEFAULT_NATIVE_CANDIDATE_MULTIPLIER,
      "nativeCandidateMultiplier",
    ),
    nativeEfSearchMin: positiveIntegerOrDefault(
      options.nativeEfSearchMin,
      DEFAULT_HNSW_EF_SEARCH,
      "nativeEfSearchMin",
    ),
  };
}

/**
 * 读取一个正整数配置值；未提供时返回默认值，提供但非法时直接抛错。
 */
function positiveIntegerOrDefault(
  value: number | undefined,
  fallback: number,
  key: keyof SurrealSearchRepositoryOptions,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${key} must be a positive integer`);
  }

  return value;
}

/**
 * 判断某个查询错误是否适合自动降级到应用层余弦检索。
 *
 * 这里故意只匹配与 HNSW/KNN/向量能力相关的查询错误，
 * 避免把网络故障、权限问题等非兼容性错误错误地吞掉。
 */
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
