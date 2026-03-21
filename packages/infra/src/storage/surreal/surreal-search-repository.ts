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
  createSurrealErrorLogFields,
  normalizeUnknownLogFields,
} from "./surreal-log-utils.js";

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
} as const;

/**
 * SurrealDB 的 SearchRepository 默认实现。
 *
 * 当前第一版实现采用“两阶段检索”策略：
 * 1. 先通过 repositoryId 和精确过滤条件查询候选 chunk
 * 2. 再在应用层计算 embedding 余弦相似度并排序
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

      const results = (records ?? [])
        .flatMap((record) => {
          const score = cosineSimilarity(record.embedding, input.embedding);

          if (score === null) {
            return [];
          }

          return [
            {
              chunk: toChunk(record),
              score,
              reason: "cosine similarity",
            },
          ];
        })
        .sort(
          (left, right) =>
            right.score - left.score ||
            left.chunk.filePath.localeCompare(right.chunk.filePath) ||
            left.chunk.startLine - right.chunk.startLine ||
            left.chunk.endLine - right.chunk.endLine,
        )
        .slice(0, input.topK);

      logger.info("Semantic search completed", {
        candidateCount: records?.length ?? 0,
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
