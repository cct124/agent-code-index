/**
 * core 包的公共导出入口。
 */
export type { Chunk, ChunkMetadata } from "./domain/chunk.js";
export type { SearchResult } from "./domain/search-result.js";
export type {
  ChunkRepository,
  FindChunksByFilePathInput,
} from "./contracts/chunk-repository.js";
export type {
  SearchRepository,
  SemanticSearchInput,
} from "./contracts/search-repository.js";

/**
 * 代码仓库在系统内部使用的逻辑标识。
 */
export type RepositoryId = string;
