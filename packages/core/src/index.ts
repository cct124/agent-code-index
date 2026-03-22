/**
 * core 包的公共导出入口。
 */
export type { Chunk, ChunkMetadata, PreparedChunk } from "./domain/chunk.js";
export type {
  ContextPacket,
  ContextPacketFile,
  ContextPacketItem,
  ContextPacketTruncation,
} from "./domain/context-packet.js";
export type { ProjectMetadata } from "./domain/project-metadata.js";
export type { SearchResult } from "./domain/search-result.js";
export { NOOP_LOGGER, STANDARD_LOG_FIELDS } from "./contracts/logger.js";
export { DefaultIndexRepositoryService } from "./services/index-repository-service.js";
export { DefaultIndexFilesService } from "./services/index-files-service.js";
export { DefaultDeleteFilesService } from "./services/delete-files-service.js";
export { DefaultGetFileContextService } from "./services/get-file-context-service.js";
export {
  DefaultContextBuilder,
  estimateTextTokens,
} from "./services/context-builder.js";
export { DefaultSearchCodeContextService } from "./services/search-code-context-service.js";
export type {
  DeleteFilesInput,
  DeleteFilesResult,
  DeleteFilesService,
} from "./services/delete-files-service.js";
export type {
  IndexRepositoryFailure,
  IndexedChunk,
  IndexRepositoryInput,
  IndexRepositoryMode,
  IndexRepositoryResult,
  IndexRepositoryService,
  PrepareRepositoryChunksInput,
  PrepareRepositoryChunksResult,
  RepositoryChunkPreparationService,
} from "./services/index-repository-service.js";
export type {
  FileChunkPreparationService,
  FilePreparationEntry,
  IndexFilesInput,
  IndexFilesResult,
  IndexFilesService,
  PrepareFilesInput,
  PrepareFilesResult,
} from "./services/index-files-service.js";
export type {
  BuildSearchContextPacketInput,
  ContextBuilder,
} from "./services/context-builder.js";
export type {
  FileContextChunk,
  GetFileContextInput,
  GetFileContextResult,
  GetFileContextService,
} from "./services/get-file-context-service.js";
export type {
  SearchCodeContextResult,
  SearchCodeContextInput,
  SearchCodeContextService,
} from "./services/search-code-context-service.js";
export type {
  ChunkRepository,
  DeleteChunksByFilePathsInput,
  FindChunksByFilePathInput,
} from "./contracts/chunk-repository.js";
export type {
  EmbeddingProvider,
  EmbeddingPurpose,
  GenerateEmbeddingsInput,
} from "./contracts/embedding-provider.js";
export type {
  LogFields,
  Logger,
  LogPrimitive,
  LogValue,
} from "./contracts/logger.js";
export type { FileScanner } from "./contracts/file-scanner.js";
export type { ParseInput, Parser } from "./contracts/parser.js";
export type {
  GetProjectMetadataInput,
  ProjectMetadataRepository,
} from "./contracts/project-metadata-repository.js";
export type {
  SearchRepository,
  SemanticSearchInput,
} from "./contracts/search-repository.js";

/**
 * 代码仓库在系统内部使用的逻辑标识。
 */
export type RepositoryId = string;
