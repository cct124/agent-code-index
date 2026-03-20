import type { Chunk } from "./chunk.js";

/**
 * 语义检索返回的单条结果。
 */
export interface SearchResult {
  /** 命中的 chunk。 */
  chunk: Chunk;
  /** 相似度或排序分数。 */
  score: number;
  /** 结果附加说明。 */
  reason?: string;
}
