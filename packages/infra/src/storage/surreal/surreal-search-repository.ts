/**
 * 基于 SurrealDB 的 SearchRepository 骨架实现。
 */
import type {
  SearchRepository,
  SearchResult,
  SemanticSearchInput,
} from "@agent-code-index/core";

import type { SurrealClient } from "./surreal-client.js";

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
    await this.client.connect();

    throw new Error(
      `Surreal semantic search is not implemented yet for repository ${input.repositoryId}.`,
    );
  }
}
