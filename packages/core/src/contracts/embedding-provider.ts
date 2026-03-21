/**
 * embedding 生成的用途类型。
 */
export type EmbeddingPurpose = "document" | "query";

/**
 * embedding 生成请求。
 */
export interface GenerateEmbeddingsInput {
  /** 需要转换为向量的文本列表。 */
  values: string[];
  /** 当前向量用于文档索引还是查询。 */
  purpose: EmbeddingPurpose;
}

/**
 * embedding provider 抽象。
 *
 * 该接口隔离第三方向量服务差异，供上层索引和检索链路统一调用。
 */
export interface EmbeddingProvider {
  /** 当前 provider 名称。 */
  readonly provider: string;
  /** 当前绑定的模型名称。 */
  readonly model: string;
  /** 当前返回向量维度。 */
  readonly vectorDimension: number;

  /**
   * 为一组文本生成 embedding。
   */
  generateEmbeddings(input: GenerateEmbeddingsInput): Promise<number[][]>;
}
