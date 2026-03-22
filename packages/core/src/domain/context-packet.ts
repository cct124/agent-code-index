/**
 * 面向 Agent 消费的最小上下文包。
 */
export interface ContextPacket {
  /** 当前上下文包的来源类型。 */
  kind: "file";
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 文件级上下文条目。 */
  items: ContextPacketItem[];
  /** 文件维度摘要。 */
  files: ContextPacketFile[];
  /** 给上层 Agent 的消费提示。 */
  instructions: string[];
  /** 截断状态。 */
  truncation: ContextPacketTruncation;
}

/**
 * 上下文包中的单条上下文内容。
 */
export interface ContextPacketItem {
  /** 条目类型。 */
  type: "file_chunk";
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
 * 上下文包的截断描述。
 */
export interface ContextPacketTruncation {
  /** 是否发生截断。 */
  truncated: boolean;
  /** 原始条目总数。 */
  totalItems: number;
  /** 实际返回条目总数。 */
  returnedItems: number;
}
