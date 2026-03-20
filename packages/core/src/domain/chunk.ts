/**
 * 可被索引和检索的最小代码块定义。
 */
export interface Chunk {
  /** Chunk 的唯一标识。 */
  id: string;
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 所属文件路径。 */
  filePath: string;
  /** 代码语言。 */
  language: string;
  /** 原始代码内容。 */
  content: string;
  /** 用于检索的摘要或归一化文本。 */
  searchText: string;
  /** 起始行号。 */
  startLine: number;
  /** 结束行号。 */
  endLine: number;
  /** 当前 chunk 内容哈希。 */
  hash: string;
  /** 附加元数据。 */
  metadata: ChunkMetadata;
}

/**
 * Chunk 的扩展元数据。
 */
export interface ChunkMetadata {
  /** 符号名称。 */
  symbolName?: string;
  /** 符号类型，例如 class、function、method。 */
  symbolKind?: string;
  /** 父级符号名称。 */
  parentSymbol?: string;
  /** 额外标签。 */
  tags?: string[];
}
