/**
 * 基于 SurrealDB 的 SearchRepository 骨架实现。
 */
import type {
  Chunk,
  ChunkMetadata,
  SearchRepository,
  SearchResult,
  SemanticSearchInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";

interface StoredSearchChunk extends Record<string, unknown> {
  id?: string;
  chunkId: string;
  repositoryId: string;
  filePath: string;
  language: string;
  content: string;
  searchText: string;
  startLine: number;
  endLine: number;
  hash: string;
  metadata: ChunkMetadata;
  embedding?: number[];
}

const FILTER_FIELD_MAP = {
  filePath: "filePath",
  language: "language",
  hash: "hash",
  startLine: "startLine",
  endLine: "endLine",
  symbolName: "metadata.symbolName",
  symbolKind: "metadata.symbolKind",
  parentSymbol: "metadata.parentSymbol",
} as const;

/**
 * SurrealDB 的 SearchRepository 默认实现。
 */
export class SurrealSearchRepository implements SearchRepository {
  /** 当前使用的 Surreal 客户端。 */
  private readonly client: SurrealClient;

  /**
   * 初始化 SurrealSearchRepository。
   */
  public constructor(client: SurrealClient) {
    this.client = client;
  }

  /**
   * 基于向量和过滤条件执行语义检索。
   */
  public async semanticSearch(
    input: SemanticSearchInput,
  ): Promise<SearchResult[]> {
    if (input.topK <= 0 || input.embedding.length === 0) {
      return [];
    }

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

    return (records ?? [])
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
  }
}

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
    metadata: {
      ...record.metadata,
    },
  };
}
