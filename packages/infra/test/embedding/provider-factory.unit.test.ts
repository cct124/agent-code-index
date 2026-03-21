import { describe, expect, it } from "vitest";

import {
  createEmbeddingProvider,
  OpenAICompatibleEmbeddingProvider,
  VoyageEmbeddingProvider,
} from "../../src/index.js";

describe("createEmbeddingProvider", () => {
  it("creates an OpenAICompatibleEmbeddingProvider for openai-compatible config", () => {
    const provider = createEmbeddingProvider({
      provider: "openai-compatible",
      model: "text-embedding-3-large",
      vectorDimension: 3,
      apiKey: "test-key",
      baseUrl: "https://example.com/v1",
    });

    expect(provider).toBeInstanceOf(OpenAICompatibleEmbeddingProvider);
    expect(provider.provider).toBe("openai-compatible");
    expect(provider.model).toBe("text-embedding-3-large");
    expect(provider.vectorDimension).toBe(3);
  });

  it("creates a VoyageEmbeddingProvider for voyage config", () => {
    const provider = createEmbeddingProvider({
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 3,
      apiKey: "test-key",
    });

    expect(provider).toBeInstanceOf(VoyageEmbeddingProvider);
    expect(provider.provider).toBe("voyage");
    expect(provider.model).toBe("voyage-code-3");
    expect(provider.vectorDimension).toBe(3);
  });
});
