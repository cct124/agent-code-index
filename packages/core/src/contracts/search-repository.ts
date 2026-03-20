import type { SearchResult } from "../domain/search-result.js";

/**
 * 语义检索请求参数。
 */
export interface SemanticSearchInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 查询向量。 */
  embedding: number[];
  /** 返回结果数量。 */
  topK: number;
  /** 附加过滤条件。 */
  filters?: Record<string, unknown>;
}

/**
 * 语义检索存储接口。
 */
export interface SearchRepository {
  /** 执行语义检索。 */
  semanticSearch(input: SemanticSearchInput): Promise<SearchResult[]>;
}
