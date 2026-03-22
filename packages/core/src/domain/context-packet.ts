/**
 * 面向 Agent 消费的最小上下文包。
 */
export interface ContextPacket {
  /** 当前上下文包的来源类型。 */
  kind: "file" | "search";
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 当上下文来自检索时，对应的原始查询。 */
  query?: string;
  /** 文件级上下文条目。 */
  items: ContextPacketItem[];
  /** 文件维度摘要。 */
  files: ContextPacketFile[];
  /** 给上层 Agent 的消费提示。 */
  instructions: string[];
  /** 去重策略与统计。 */
  deduplication: ContextPacketDeduplication;
  /** 截断状态。 */
  truncation: ContextPacketTruncation;
}

/**
 * 上下文包中的单条上下文内容。
 */
export interface ContextPacketItem {
  /** 条目类型。 */
  type: "file_chunk" | "search_match";
  /** chunk 标识。 */
  id?: string;
  /** 所属文件路径。 */
  filePath: string;
  /** 代码语言。 */
  language: string;
  /** 起始行号。 */
  startLine: number;
  /** 结束行号。 */
  endLine: number;
  /** 原始内容。 */
  content: string;
  /** 检索排序分数。 */
  score?: number;
  /** 检索命中原因。 */
  reason?: string;
  /** 结构化元数据。 */
  metadata: Record<string, unknown>;
}

/**
 * 上下文包中的文件摘要信息。
 */
export interface ContextPacketFile {
  /** 文件路径。 */
  filePath: string;
  /** 文件语言。 */
  language: string;
  /** 当前文件包含的 chunk 数。 */
  chunkCount: number;
  /** 当前文件命中的最小起始行。 */
  startLine: number;
  /** 当前文件命中的最大结束行。 */
  endLine: number;
}

/**
 * 上下文包的去重描述。
 */
export interface ContextPacketDeduplication {
  /** 去重策略。 */
  strategy: "none" | "chunk_id" | "file_path_line_range";
  /** 去重前条目总数。 */
  inputItems: number;
  /** 被去掉的重复条目数。 */
  removedItems: number;
}

/**
 * 上下文包的截断描述。
 */
export interface ContextPacketTruncation {
  /** 是否发生截断。 */
  truncated: boolean;
  /** 截断策略。 */
  strategy: "none" | "top_k" | "max_items";
  /** 原始条目总数。 */
  totalItems: number;
  /** 实际返回条目总数。 */
  returnedItems: number;
  /** 被截断掉的条目数。 */
  omittedItems: number;
  /** 当前截断上限。 */
  limit?: number;
}
