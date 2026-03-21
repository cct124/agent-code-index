import { describe, expect, it } from "vitest";

import {
  createEmbeddingProvider,
  VoyageEmbeddingProvider,
} from "../../src/index.js";

describe("createEmbeddingProvider", () => {
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
