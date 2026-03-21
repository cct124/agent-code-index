/**
 * 预索引阶段使用的最小代码块定义。
 *
 * 该类型只描述解析与切块产物，不包含 embedding。
 */
export interface PreparedChunk {
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
 * 已完成 embedding 生成、可直接入库与检索的 chunk。
 */
export interface Chunk extends PreparedChunk {
  /** 当前 chunk 对应的 embedding 向量。 */
  embedding: number[];
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
  /** Markdown section 标题。 */
  heading?: string;
  /** Markdown 标题路径。 */
  headingPath?: string[];
  /** Markdown section 对应的标题层级。 */
  sectionLevel?: number;
  /** Markdown 文档类型。 */
  docType?: string;
  /** 解析出的 frontmatter 字段。 */
  frontmatter?: Record<string, string>;
  /** 额外标签。 */
  tags?: string[];
  /** 允许逐步扩展更多解析元数据。 */
  [key: string]: unknown;
}
