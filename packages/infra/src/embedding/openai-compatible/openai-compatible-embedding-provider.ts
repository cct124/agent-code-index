import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
  Logger,
} from "@agent-code-index/core";
import { NOOP_LOGGER } from "@agent-code-index/core";

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
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化 OpenAI-compatible embedding provider。
   */
  public constructor(
    config: OpenAICompatibleEmbeddingProviderConfig,
    logger: Logger = NOOP_LOGGER,
  ) {
    if (!config.apiKey?.trim()) {
      throw new Error("OpenAI-compatible embedding provider requires apiKey");
    }

    this.model = config.model;
    this.vectorDimension = config.vectorDimension;
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.logger = logger;
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

    const startedAt = Date.now();
    const inputStats = summarizeInputValues(input.values);
    const requestBody = JSON.stringify({
      input: input.values,
      model: this.model,
      dimensions: this.vectorDimension,
    });
    const requestBodyLength = requestBody.length;

    this.logger.info("OpenAI-compatible embedding request started", {
      valueCount: input.values.length,
      purpose: input.purpose,
      embeddingModel: this.model,
      baseUrl: this.baseUrl,
      requestBodyLength,
      ...inputStats,
    });

    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
    } catch (error) {
      this.logger.error("OpenAI-compatible embedding request failed", {
        valueCount: input.values.length,
        purpose: input.purpose,
        embeddingModel: this.model,
        baseUrl: this.baseUrl,
        requestBodyLength,
        durationMs: Date.now() - startedAt,
        failureStage: "network",
        ...inputStats,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }

    if (!response.ok) {
      const responseBodyPreview = await readResponseBodyPreview(response);

      this.logger.error("OpenAI-compatible embedding request failed", {
        status: response.status,
        statusText: response.statusText,
        valueCount: input.values.length,
        purpose: input.purpose,
        embeddingModel: this.model,
        baseUrl: this.baseUrl,
        requestBodyLength,
        durationMs: Date.now() - startedAt,
        failureStage: "http",
        ...inputStats,
        responseBodyPreview,
      });
      throw new Error(
        `OpenAI-compatible embedding request failed with status ${response.status}`,
      );
    }

    let embeddings: number[][];

    try {
      const payload =
        (await response.json()) as OpenAICompatibleEmbeddingResponse;
      embeddings = toEmbeddings(payload, input.values.length);
      assertEmbeddingDimensions(embeddings, this.vectorDimension);
    } catch (error) {
      this.logger.error("OpenAI-compatible embedding request failed", {
        valueCount: input.values.length,
        purpose: input.purpose,
        embeddingModel: this.model,
        baseUrl: this.baseUrl,
        requestBodyLength,
        durationMs: Date.now() - startedAt,
        failureStage: "response-parse",
        ...inputStats,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      throw error;
    }

    this.logger.info("OpenAI-compatible embeddings generated", {
      valueCount: input.values.length,
      purpose: input.purpose,
      embeddingModel: this.model,
      baseUrl: this.baseUrl,
      requestBodyLength,
      durationMs: Date.now() - startedAt,
      vectorDimension: this.vectorDimension,
    });

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

/**
 * 汇总本次请求输入的字符长度信息，便于定位 provider 限制问题。
 */
function summarizeInputValues(values: string[]): {
  totalInputLength: number;
  minInputLength: number;
  maxInputLength: number;
  averageInputLength: number;
  sampleInputLengths: number[];
} {
  const lengths = values.map((value) => value.length);
  const totalInputLength = lengths.reduce((sum, length) => sum + length, 0);

  return {
    totalInputLength,
    minInputLength: Math.min(...lengths),
    maxInputLength: Math.max(...lengths),
    averageInputLength: Math.round(totalInputLength / lengths.length),
    sampleInputLengths: lengths.slice(0, 5),
  };
}

/**
 * 读取失败响应体的预览内容，避免日志过大。
 */
async function readResponseBodyPreview(
  response: Pick<Response, "text">,
): Promise<string | undefined> {
  try {
    const body = await response.text();

    if (!body) {
      return undefined;
    }

    return body.length > 1000 ? `${body.slice(0, 1000)}...` : body;
  } catch (error) {
    return `failed to read response body: ${String(error)}`;
  }
}
