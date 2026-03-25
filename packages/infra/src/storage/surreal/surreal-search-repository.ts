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
 * 然后在应用层仅做分值映射、排序稳定化与截断。
 */
const DEFAULT_NATIVE_CANDIDATE_MULTIPLIER = 20;
/** 原生向量检索路径写入 SearchResult.reason 的固定文案。 */
const NATIVE_SEARCH_REASON = "surreal vector search";

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
 * 该结构基本对应持久化后的 chunk 记录，并要求 embedding 始终存在。
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
  embedding: number[];
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
 * 当前实现只保留单一的数据库原生检索路径：
 *
 * 1. Surreal 原生 HNSW KNN 查询承担全部精确过滤条件与向量召回。
 * 2. 应用层仅负责分值映射、排序稳定化与 topK 截断。
 *
 * 当前开发基线已验证 SurrealDB 3.0.4 下“多精确过滤条件 + KNN”可以稳定工作，
 * 因此 v1 不再维护应用层余弦 fallback。
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
   * 3. 执行单一的 native HNSW 路径。
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
      const filterState = buildFilterState(input.filters);
      const results = await this.nativeVectorSearch(input, filterState, logger);

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

    const records = await this.client.execute(
      "semantic-search-native-vector",
      async (driver) => {
        const [result] = await driver.query<[StoredSearchChunk[]]>(queryText, {
          repositoryId: input.repositoryId,
          embedding: input.embedding,
          ...filterState.bindings,
        });

        return result ?? [];
      },
    );

    logger.debug("Semantic search executed with native vector path", {
      searchStrategy: "surreal-native-vector",
      nativeVectorIndexUsed: true,
      vectorDistanceMetric: "COSINE",
      candidateCount: records.length,
      candidateK,
      efSearch,
    });

    return sortResults(
      records.flatMap((record) => {
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
 * 将存储层记录映射为领域层 Chunk 对象。
 */
function toChunk(record: StoredSearchChunk): Chunk {
  if (!Array.isArray(record.embedding)) {
    throw new Error(
      `Stored search chunk ${record.chunkId} is missing embedding data`,
    );
  }

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
    embedding: [...record.embedding],
    metadata: {
      ...record.metadata,
    },
  };
}
