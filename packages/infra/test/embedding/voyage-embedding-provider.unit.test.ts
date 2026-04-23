import { afterEach, describe, expect, it, vi } from "vitest";

import { VoyageEmbeddingProvider } from "../../src/embedding/voyage-embedding-provider.js";

describe("VoyageEmbeddingProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns embeddings from Voyage API", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ embedding: [1, 0, 0] }, { embedding: [0, 1, 0] }],
      }),
    }));

    vi.stubGlobal("fetch", fetchMock);

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
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
          model: "voyage-code-3",
          input_type: "document",
        }),
      }),
    );
  });

  it("returns empty result without calling API when input is empty", async () => {
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
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

  it("fails when Voyage returns a non-success status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 401,
      })),
    );

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    await expect(
      provider.generateEmbeddings({
        values: ["alpha"],
        purpose: "query",
      }),
    ).rejects.toThrow("Voyage embedding request failed with status 401");
  });

  it("retries when Voyage returns 429 and eventually succeeds", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1, 0, 0] }],
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "document",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toEqual([[1, 0, 0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries when fetch fails with a retryable network error and eventually succeeds", async () => {
    vi.useFakeTimers();

    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(
        new Error(
          "Client network socket disconnected before secure TLS connection was established",
        ),
        {
          code: "ECONNRESET",
        },
      ),
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

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "query",
    });

    await vi.advanceTimersByTimeAsync(1_000);

    await expect(promise).resolves.toEqual([[1, 0, 0]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails after retryable network errors exhaust retry attempts", async () => {
    vi.useFakeTimers();

    const networkError = Object.assign(new TypeError("fetch failed"), {
      cause: Object.assign(new Error("socket hang up"), {
        code: "ECONNRESET",
      }),
    });

    const fetchMock = vi.fn().mockRejectedValue(networkError);

    vi.stubGlobal("fetch", fetchMock);

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "query",
    });
    const expectation = expect(promise).rejects.toThrow("fetch failed");

    await vi.advanceTimersByTimeAsync(7_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("aborts slow requests and fails after timeout-bound retries are exhausted", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn(
      async (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<never>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              reject(
                Object.assign(new Error("The operation was aborted"), {
                  name: "AbortError",
                }),
              );
            },
            { once: true },
          );
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    const promise = provider.generateEmbeddings({
      values: ["alpha"],
      purpose: "query",
    });
    const expectation = expect(promise).rejects.toThrow(
      "The operation was aborted",
    );

    await vi.advanceTimersByTimeAsync(27_000);

    await expectation;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("fails when Voyage returns an embedding with unexpected dimension", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: [{ embedding: [1, 0] }],
        }),
      })),
    );

    const provider = new VoyageEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
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
        new VoyageEmbeddingProvider({
          provider: "voyage",
          model: "voyage-code-3",
          vectorDimension: 3,
        }),
    ).toThrow("Voyage embedding provider requires apiKey");
  });
});
