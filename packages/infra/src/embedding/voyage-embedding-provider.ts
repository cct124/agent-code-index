import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
} from "@agent-code-index/core";

const DEFAULT_VOYAGE_BASE_URL = "https://api.voyageai.com/v1";

interface VoyageEmbeddingResponseItem {
  embedding: number[];
}

interface VoyageEmbeddingResponse {
  data?: VoyageEmbeddingResponseItem[];
}

/**
 * Voyage embedding provider 配置。
 */
export interface VoyageEmbeddingProviderConfig {
  /** provider 名称。 */
  provider: "voyage";
  /** Voyage 模型名称。 */
  model: string;
  /** 返回向量维度。 */
  vectorDimension: number;
  /** Voyage API key。 */
  apiKey?: string;
  /** 可选的 Voyage API 基础地址。 */
  baseUrl?: string;
}

/**
 * Voyage 的最小 embedding provider 实现。
 */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  /** 当前 provider 名称。 */
  public readonly provider = "voyage";

  /** 当前绑定模型。 */
  public readonly model: string;

  /** 当前向量维度。 */
  public readonly vectorDimension: number;

  /** Voyage 访问密钥。 */
  private readonly apiKey: string;

  /** Voyage API 基础地址。 */
  private readonly baseUrl: string;

  /**
   * 初始化 Voyage embedding provider。
   */
  public constructor(config: VoyageEmbeddingProviderConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error("Voyage embedding provider requires apiKey");
    }

    this.model = config.model;
    this.vectorDimension = config.vectorDimension;
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  /**
   * 调用 Voyage embeddings 接口批量生成向量。
   */
  public async generateEmbeddings(
    input: GenerateEmbeddingsInput,
  ): Promise<number[][]> {
    if (input.values.length === 0) {
      return [];
    }

    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: input.values,
        model: this.model,
        input_type: input.purpose,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Voyage embedding request failed with status ${response.status}`,
      );
    }

    const payload = (await response.json()) as VoyageEmbeddingResponse;
    const embeddings = toEmbeddings(payload, input.values.length);

    assertEmbeddingDimensions(embeddings, this.vectorDimension);

    return embeddings;
  }
}

/**
 * 归一化基础地址，避免重复斜杠。
 */
function normalizeBaseUrl(baseUrl?: string): string {
  const value = baseUrl?.trim() || DEFAULT_VOYAGE_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * 从 Voyage 返回结果中提取 embedding 列表。
 */
function toEmbeddings(
  payload: VoyageEmbeddingResponse,
  expectedCount: number,
): number[][] {
  if (!Array.isArray(payload.data)) {
    throw new Error("Voyage embedding response is missing data array");
  }

  const embeddings = payload.data.map((item) => {
    if (
      !item ||
      !Array.isArray(item.embedding) ||
      item.embedding.some((value) => typeof value !== "number")
    ) {
      throw new Error("Voyage embedding response contains invalid embedding");
    }

    return [...item.embedding];
  });

  if (embeddings.length !== expectedCount) {
    throw new Error(
      `Voyage embedding response count mismatch: expected ${expectedCount}, received ${embeddings.length}`,
    );
  }

  return embeddings;
}

/**
 * 校验返回 embedding 的维度与当前项目配置一致。
 */
function assertEmbeddingDimensions(
  embeddings: number[][],
  expectedDimension: number,
): void {
  for (const embedding of embeddings) {
    if (embedding.length !== expectedDimension) {
      throw new Error(
        `Voyage embedding dimension mismatch: expected ${expectedDimension}, received ${embedding.length}`,
      );
    }
  }
}
