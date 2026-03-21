import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
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
        purpose: "query",
      }),
    ).rejects.toThrow(
      "OpenAI-compatible embedding request failed with status 401",
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
});
