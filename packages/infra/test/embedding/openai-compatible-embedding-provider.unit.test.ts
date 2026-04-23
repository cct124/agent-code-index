import { afterEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@agent-code-index/core";
import { OpenAICompatibleEmbeddingProvider } from "../../src/embedding/openai-compatible/openai-compatible-embedding-provider.js";

describe("OpenAICompatibleEmbeddingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns embeddings from an OpenAI-compatible API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ embedding: [1, 0, 0] }, { embedding: [0, 1, 0] }],
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleEmbeddingProvider({
      provider: "openai-compatible",
      model: "Qwen/Qwen3-Embedding-8B",
      vectorDimension: 3,
      apiKey: "test-key",
      baseUrl: "https://example.com/v1/",
    });

    const embeddings = await provider.generateEmbeddings({
      values: ["alpha", "beta"],
      purpose: "document",
    });

    expect(embeddings).toEqual([
      [1, 0, 0],
      [0, 1, 0],
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/v1/embeddings",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: ["alpha", "beta"],
          model: "Qwen/Qwen3-Embedding-8B",
          dimensions: 3,
        }),
      }),
    );
  });

  it("returns empty result without calling API when input is empty", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleEmbeddingProvider({
      provider: "openai-compatible",
      model: "text-embedding-3-large",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    await expect(
      provider.generateEmbeddings({
        values: [],
        purpose: "query",
      }),
    ).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when OpenAI-compatible API returns a non-success status", async () => {
    const logger = createLogger();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () =>
          JSON.stringify({
            error: { message: "invalid api key" },
          }),
      })),
    );

    const provider = new OpenAICompatibleEmbeddingProvider(
      {
        provider: "openai-compatible",
        model: "text-embedding-3-large",
        vectorDimension: 3,
        apiKey: "test-key",
      },
      logger,
    );

    await expect(
      provider.generateEmbeddings({
        values: ["alpha"],
        purpose: "query",
      }),
    ).rejects.toThrow(
      "OpenAI-compatible embedding request failed with status 401",
    );
    expect(logger.error).toHaveBeenCalledWith(
      "OpenAI-compatible embedding request failed",
      expect.objectContaining({
        status: 401,
        statusText: "Unauthorized",
        valueCount: 1,
        purpose: "query",
        embeddingModel: "text-embedding-3-large",
        baseUrl: "https://api.openai.com/v1",
        requestBodyLength: expect.any(Number),
        durationMs: expect.any(Number),
        failureStage: "http",
        totalInputLength: 5,
        minInputLength: 5,
        maxInputLength: 5,
        averageInputLength: 5,
        sampleInputLengths: [5],
        responseBodyPreview: JSON.stringify({
          error: { message: "invalid api key" },
        }),
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "OpenAI-compatible embedding request started",
      expect.objectContaining({
        valueCount: 1,
        purpose: "query",
        embeddingModel: "text-embedding-3-large",
        baseUrl: "https://api.openai.com/v1",
        requestBodyLength: expect.any(Number),
      }),
    );
  });

  it("logs request completion timing for successful responses", async () => {
    const logger = createLogger();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1, 0, 0] }],
        }),
      })),
    );

    const provider = new OpenAICompatibleEmbeddingProvider(
      {
        provider: "openai-compatible",
        model: "text-embedding-3-large",
        vectorDimension: 3,
        apiKey: "test-key",
      },
      logger,
    );

    await expect(
      provider.generateEmbeddings({
        values: ["alpha"],
        purpose: "document",
      }),
    ).resolves.toEqual([[1, 0, 0]]);

    expect(logger.info).toHaveBeenCalledWith(
      "OpenAI-compatible embeddings generated",
      expect.objectContaining({
        valueCount: 1,
        purpose: "document",
        embeddingModel: "text-embedding-3-large",
        baseUrl: "https://api.openai.com/v1",
        requestBodyLength: expect.any(Number),
        durationMs: expect.any(Number),
        vectorDimension: 3,
      }),
    );
  });

  it("retries when fetch fails with a retryable network error and eventually succeeds", async () => {
    vi.useFakeTimers();

    const logger = createLogger();
    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("socket hang up"), {
        code: "ECONNRESET",
      }),
    });

    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1, 0, 0] }],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleEmbeddingProvider(
      {
        provider: "openai-compatible",
        model: "text-embedding-3-large",
        vectorDimension: 3,
        apiKey: "test-key",
      },
      logger,
    );

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "query",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toEqual([[1, 0, 0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      "OpenAI-compatible embedding request hit retryable network error",
      expect.objectContaining({
        attempt: 1,
        failureStage: "network",
        nextDelayMs: 1_000,
      }),
    );
  });

  it("fails after retryable network errors exhaust retry attempts", async () => {
    vi.useFakeTimers();

    const logger = createLogger();
    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("socket hang up"), {
        code: "ECONNRESET",
      }),
    });

    const fetchMock = vi.fn().mockRejectedValue(networkError);

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAICompatibleEmbeddingProvider(
      {
        provider: "openai-compatible",
        model: "text-embedding-3-large",
        vectorDimension: 3,
        apiKey: "test-key",
      },
      logger,
    );

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "query",
    });
    const expectation = expect(promise).rejects.toThrow("fetch failed");

    await vi.advanceTimersByTimeAsync(7_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(logger.error).toHaveBeenCalledWith(
      "OpenAI-compatible embedding request failed",
      expect.objectContaining({
        attempt: 4,
        retryable: true,
        failureStage: "network",
      }),
    );
  });

  it("fails when OpenAI-compatible API returns an embedding with unexpected dimension", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1, 0] }],
        }),
      })),
    );

    const provider = new OpenAICompatibleEmbeddingProvider({
      provider: "openai-compatible",
      model: "text-embedding-3-large",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    await expect(
      provider.generateEmbeddings({
        values: ["alpha"],
        purpose: "document",
      }),
    ).rejects.toThrow(/dimension mismatch/);
  });

  it("fails when apiKey is missing", () => {
    expect(
      () =>
        new OpenAICompatibleEmbeddingProvider({
          provider: "openai-compatible",
          model: "text-embedding-3-large",
          vectorDimension: 3,
        }),
    ).toThrow("OpenAI-compatible embedding provider requires apiKey");
  });

  function createLogger(): Logger {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(function (this: Logger) {
        return this;
      }),
    };
  }
});
