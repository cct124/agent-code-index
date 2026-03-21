import type { PreparedChunk } from "../domain/chunk.js";

/**
 * 解析器输入参数。
 */
export interface ParseInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 相对仓库根目录的文件路径。 */
  filePath: string;
  /** 文件原始内容。 */
  content: string;
}

/**
 * 解析器接口，将文件内容解析为可索引 chunk 列表。
 */
export interface Parser {
  /**
   * 将文件内容解析为 chunk。
   */
  parse(input: ParseInput): Promise<PreparedChunk[]>;
}
