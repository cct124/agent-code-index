import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
} from "@agent-code-index/core";

const DEFAULT_OPENAI_COMPATIBLE_BASE_URL = "https://api.openai.com/v1";

interface OpenAICompatibleEmbeddingResponseItem {
  embedding: number[];
}

interface OpenAICompatibleEmbeddingResponse {
  data?: OpenAICompatibleEmbeddingResponseItem[];
}

/**
 * OpenAI-compatible embedding provider 配置。
 */
export interface OpenAICompatibleEmbeddingProviderConfig {
  /** provider 名称。 */
  provider: "openai-compatible";
  /** 模型名称。 */
  model: string;
  /** 返回向量维度。 */
  vectorDimension: number;
  /** API key。 */
  apiKey?: string;
  /** 可选基础地址。 */
  baseUrl?: string;
}

/**
 * OpenAI-compatible embeddings 接口的最小 provider 实现。
 */
export class OpenAICompatibleEmbeddingProvider implements EmbeddingProvider {
  /** 当前 provider 名称。 */
  public readonly provider = "openai-compatible";

  /** 当前绑定模型。 */
  public readonly model: string;

  /** 当前向量维度。 */
  public readonly vectorDimension: number;

  /** 访问密钥。 */
  private readonly apiKey: string;

  /** 基础地址。 */
  private readonly baseUrl: string;

  /**
   * 初始化 OpenAI-compatible embedding provider。
   */
  public constructor(config: OpenAICompatibleEmbeddingProviderConfig) {
    if (!config.apiKey?.trim()) {
      throw new Error("OpenAI-compatible embedding provider requires apiKey");
    }

    this.model = config.model;
    this.vectorDimension = config.vectorDimension;
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
  }

  /**
   * 调用 OpenAI-compatible embeddings 接口批量生成向量。
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
        dimensions: this.vectorDimension,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI-compatible embedding request failed with status ${response.status}`,
      );
    }

    const payload =
      (await response.json()) as OpenAICompatibleEmbeddingResponse;
    const embeddings = toEmbeddings(payload, input.values.length);

    assertEmbeddingDimensions(embeddings, this.vectorDimension);

    return embeddings;
  }
}

/**
 * 归一化基础地址，避免重复斜杠。
 */
function normalizeBaseUrl(baseUrl?: string): string {
  const value = baseUrl?.trim() || DEFAULT_OPENAI_COMPATIBLE_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * 从 OpenAI-compatible 返回结果中提取 embedding 列表。
 */
function toEmbeddings(
  payload: OpenAICompatibleEmbeddingResponse,
  expectedCount: number,
): number[][] {
  if (!Array.isArray(payload.data)) {
    throw new Error(
      "OpenAI-compatible embedding response is missing data array",
    );
  }

  const embeddings = payload.data.map((item) => {
    if (
      !item ||
      !Array.isArray(item.embedding) ||
      item.embedding.some((value) => typeof value !== "number")
    ) {
      throw new Error(
        "OpenAI-compatible embedding response contains invalid embedding",
      );
    }

    return [...item.embedding];
  });

  if (embeddings.length !== expectedCount) {
    throw new Error(
      `OpenAI-compatible embedding response count mismatch: expected ${expectedCount}, received ${embeddings.length}`,
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
        `OpenAI-compatible embedding dimension mismatch: expected ${expectedDimension}, received ${embedding.length}`,
      );
    }
  }
}
