import type { ChunkRepository } from "../contracts/chunk-repository.js";
import { NOOP_LOGGER, type Logger } from "../contracts/logger.js";
import type { ContextPacket } from "../domain/context-packet.js";

/**
 * 文件上下文读取输入。
 */
export interface GetFileContextInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 目标文件路径。 */
  filePath: string;
}

/**
 * 对外暴露的文件级 chunk 视图。
 *
 * 这里刻意去掉 embedding 与 searchText，只保留 Agent 连续阅读所需字段。
 */
export interface FileContextChunk {
  /** Chunk 唯一标识。 */
  id: string;
  /** 所属文件路径。 */
  filePath: string;
  /** 代码语言。 */
  language: string;
  /** 原始代码内容。 */
  content: string;
  /** 起始行号。 */
  startLine: number;
  /** 结束行号。 */
  endLine: number;
  /** 解析元数据。 */
  metadata: Record<string, unknown>;
}

/**
 * 文件上下文组装结果。
 */
export interface GetFileContextResult {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 目标文件路径。 */
  filePath: string;
  /** 当前文件命中的 chunk 数。 */
  chunkCount: number;
  /** 结构化 chunk 列表。 */
  chunks: FileContextChunk[];
  /** 面向 Agent 的连续文本上下文。 */
  assembledContext: {
    /** 组装后的连续文本。 */
    content: string;
    /** 当前实现暂不截断，因此固定为 false。 */
    truncated: boolean;
  };
  /** 标准化后的最小上下文包。 */
  contextPacket: ContextPacket;
}

/**
 * 文件上下文读取服务抽象。
 */
export interface GetFileContextService {
  /**
   * 按仓库与文件路径读取当前已索引的文件上下文。
   */
  execute(input: GetFileContextInput): Promise<GetFileContextResult>;
}

/**
 * 默认的文件上下文读取服务实现。
 */
export class DefaultGetFileContextService implements GetFileContextService {
  private readonly chunkRepository: ChunkRepository;
  private readonly logger: Logger;

  public constructor(
    chunkRepository: ChunkRepository,
    logger: Logger = NOOP_LOGGER,
  ) {
    this.chunkRepository = chunkRepository;
    this.logger = logger.child({
      package: "core",
      module: "get-file-context-service",
      component: "DefaultGetFileContextService",
    });
  }

  public async execute(
    input: GetFileContextInput,
  ): Promise<GetFileContextResult> {
    const filePath = normalizeFilePath(input.filePath);
    const logger = this.logger.child({
      operation: "get-file-context",
      repositoryId: input.repositoryId,
      filePath,
    });

    logger.info("Get file context started");

    const chunks = await this.chunkRepository.findByFilePath({
      repositoryId: input.repositoryId,
      filePath,
    });
    const contextChunks = chunks.map((chunk) => ({
      id: chunk.id,
      filePath: chunk.filePath,
      language: chunk.language,
      content: chunk.content,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      metadata: { ...chunk.metadata },
    }));
    const result = {
      repositoryId: input.repositoryId,
      filePath,
      chunkCount: contextChunks.length,
      chunks: contextChunks,
      assembledContext: {
        content: assembleContext(contextChunks),
        truncated: false,
      },
      contextPacket: buildContextPacket(input.repositoryId, contextChunks),
    };

    logger.info("Get file context completed", {
      chunkCount: result.chunkCount,
    });

    return result;
  }
}

function buildContextPacket(
  repositoryId: string,
  chunks: FileContextChunk[],
): ContextPacket {
  const fileSummary = summarizeFile(chunks);

  return {
    kind: "file",
    repositoryId,
    items: chunks.map((chunk) => ({
      type: "file_chunk",
      filePath: chunk.filePath,
      language: chunk.language,
      startLine: chunk.startLine,
      endLine: chunk.endLine,
      content: chunk.content,
      metadata: { ...chunk.metadata },
    })),
    files: fileSummary ? [fileSummary] : [],
    instructions: [
      "Treat this packet as indexed repository context, not a live filesystem read.",
      "Prefer assembledContext for continuous reading and items for structured inspection.",
    ],
    truncation: {
      truncated: false,
      totalItems: chunks.length,
      returnedItems: chunks.length,
    },
  };
}

function summarizeFile(
  chunks: FileContextChunk[],
): ContextPacket["files"][number] | null {
  if (chunks.length === 0) {
    return null;
  }

  return {
    filePath: chunks[0].filePath,
    language: chunks[0].language,
    chunkCount: chunks.length,
    startLine: Math.min(...chunks.map((chunk) => chunk.startLine)),
    endLine: Math.max(...chunks.map((chunk) => chunk.endLine)),
  };
}

function normalizeFilePath(filePath: string): string {
  const normalized = filePath.trim();

  if (normalized.length === 0) {
    throw new Error("filePath must not be empty");
  }

  return normalized;
}

/**
 * 组装一个最小连续文本，方便 Agent 直接阅读已索引的文件内容。
 */
function assembleContext(chunks: FileContextChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const metadataSummary = summarizeMetadata(chunk.metadata);
      const headerParts = [
        `chunk ${index + 1}`,
        `lines ${chunk.startLine}-${chunk.endLine}`,
      ];

      if (metadataSummary) {
        headerParts.push(metadataSummary);
      }

      return [`[${headerParts.join(" | ")}]`, chunk.content].join("\n");
    })
    .join("\n\n");
}

function summarizeMetadata(metadata: Record<string, unknown>): string | null {
  const symbolName =
    typeof metadata.symbolName === "string" ? metadata.symbolName : null;
  const symbolKind =
    typeof metadata.symbolKind === "string" ? metadata.symbolKind : null;
  const heading =
    typeof metadata.heading === "string" ? metadata.heading : null;

  if (symbolName && symbolKind) {
    return `${symbolKind} ${symbolName}`;
  }

  if (symbolName) {
    return `symbol ${symbolName}`;
  }

  if (heading) {
    return `heading ${heading}`;
  }

  return null;
}
