import type {
  EmbeddingProvider,
  GenerateEmbeddingsInput,
  Logger,
} from "@agent-code-index/core";
import { NOOP_LOGGER } from "@agent-code-index/core";

const DEFAULT_VOYAGE_BASE_URL = "https://api.voyageai.com/v1";
const MAX_RETRY_ATTEMPTS = 4;
const INITIAL_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 8_000;
const DEFAULT_QUERY_TIMEOUT_MS = 5_000;
const DEFAULT_DOCUMENT_TIMEOUT_MS = 30_000;
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "EPIPE",
  "ETIMEDOUT",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
]);
const RETRYABLE_NETWORK_ERROR_NAMES = new Set(["AbortError", "TimeoutError"]);

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
  /** query embedding 请求超时。 */
  queryTimeoutMs?: number;
  /** document embedding 请求超时。 */
  documentTimeoutMs?: number;
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
  /** query embedding 请求超时。 */
  private readonly queryTimeoutMs: number;
  /** document embedding 请求超时。 */
  private readonly documentTimeoutMs: number;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化 Voyage embedding provider。
   */
  public constructor(
    config: VoyageEmbeddingProviderConfig,
    logger: Logger = NOOP_LOGGER,
  ) {
    if (!config.apiKey?.trim()) {
      throw new Error("Voyage embedding provider requires apiKey");
    }

    this.model = config.model;
    this.vectorDimension = config.vectorDimension;
    this.apiKey = config.apiKey;
    this.baseUrl = normalizeBaseUrl(config.baseUrl);
    this.queryTimeoutMs = normalizeTimeoutMs(
      config.queryTimeoutMs,
      DEFAULT_QUERY_TIMEOUT_MS,
      "queryTimeoutMs",
    );
    this.documentTimeoutMs = normalizeTimeoutMs(
      config.documentTimeoutMs,
      DEFAULT_DOCUMENT_TIMEOUT_MS,
      "documentTimeoutMs",
    );
    this.logger = logger;
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

    const startedAt = Date.now();

    this.logger.debug("Requesting voyage embeddings", {
      valueCount: input.values.length,
      purpose: input.purpose,
      embeddingModel: this.model,
    });

    const response = await this.executeWithRetry(input);

    const payload = (await response.json()) as VoyageEmbeddingResponse;
    const embeddings = toEmbeddings(payload, input.values.length);

    assertEmbeddingDimensions(embeddings, this.vectorDimension);

    this.logger.info("Voyage embeddings generated", {
      valueCount: input.values.length,
      durationMs: Date.now() - startedAt,
      vectorDimension: this.vectorDimension,
    });

    return embeddings;
  }

  private async executeWithRetry(
    input: GenerateEmbeddingsInput,
  ): Promise<Response> {
    let attempt = 1;
    let delayMs = INITIAL_RETRY_DELAY_MS;
    const requestTimeoutMs = this.getRequestTimeoutMs(input.purpose);

    while (true) {
      let response: Response;
      let timeoutHandle: NodeJS.Timeout | undefined;
      const controller = new AbortController();

      try {
        timeoutHandle = setTimeout(() => {
          controller.abort();
        }, requestTimeoutMs);

        response = await fetch(`${this.baseUrl}/embeddings`, {
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
          signal: controller.signal,
        });
      } catch (error) {
        const retryable = isRetryableNetworkError(error);

        if (!retryable || attempt >= MAX_RETRY_ATTEMPTS) {
          this.logger.error("Voyage embedding request failed", {
            valueCount: input.values.length,
            purpose: input.purpose,
            attempt,
            retryable,
            failureStage: "network",
            requestTimeoutMs,
            error: error instanceof Error ? error : new Error(String(error)),
          });
          throw error;
        }

        this.logger.warn(
          "Voyage embedding request hit retryable network error",
          {
            valueCount: input.values.length,
            purpose: input.purpose,
            attempt,
            nextDelayMs: delayMs,
            failureStage: "network",
            requestTimeoutMs,
            error: error instanceof Error ? error : new Error(String(error)),
          },
        );
        await sleep(delayMs);
        delayMs = Math.min(delayMs * 2, MAX_RETRY_DELAY_MS);
        attempt += 1;
        continue;
      } finally {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
      }

      if (response.ok) {
        return response;
      }

      const retryable = isRetryableStatus(response.status);

      if (!retryable || attempt >= MAX_RETRY_ATTEMPTS) {
        this.logger.error("Voyage embedding request failed", {
          status: response.status,
          valueCount: input.values.length,
          purpose: input.purpose,
          attempt,
          retryable,
        });
        throw new Error(
          `Voyage embedding request failed with status ${response.status}`,
        );
      }

      this.logger.warn("Voyage embedding request hit retryable status", {
        status: response.status,
        valueCount: input.values.length,
        purpose: input.purpose,
        attempt,
        nextDelayMs: delayMs,
      });
      await sleep(delayMs);
      delayMs = Math.min(delayMs * 2, MAX_RETRY_DELAY_MS);
      attempt += 1;
    }
  }

  private getRequestTimeoutMs(
    purpose: GenerateEmbeddingsInput["purpose"],
  ): number {
    return purpose === "document"
      ? this.documentTimeoutMs
      : this.queryTimeoutMs;
  }
}

/**
 * 归一化基础地址，避免重复斜杠。
 */
function normalizeBaseUrl(baseUrl?: string): string {
  const value = baseUrl?.trim() || DEFAULT_VOYAGE_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeTimeoutMs(
  value: number | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Voyage embedding provider config field ${fieldName} must be a positive integer`,
    );
  }

  return value;
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

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  if (RETRYABLE_NETWORK_ERROR_NAMES.has(error.name)) {
    return true;
  }

  const errorCode = getErrorCode(error);

  if (errorCode && RETRYABLE_NETWORK_ERROR_CODES.has(errorCode)) {
    return true;
  }

  return false;
}

function getErrorCode(error: Error): string | undefined {
  const errorWithCode = error as Error & { code?: unknown; cause?: unknown };

  if (typeof errorWithCode.code === "string") {
    return errorWithCode.code;
  }

  if (errorWithCode.cause instanceof Error) {
    const causeWithCode = errorWithCode.cause as Error & { code?: unknown };

    if (typeof causeWithCode.code === "string") {
      return causeWithCode.code;
    }
  }

  return undefined;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}
