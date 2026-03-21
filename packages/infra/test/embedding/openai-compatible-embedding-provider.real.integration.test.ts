import { describe, expect, it } from "vitest";

import { OpenAICompatibleEmbeddingProvider } from "../../src/embedding/openai-compatible/openai-compatible-embedding-provider.js";
import {
  isRealEmbeddingIntegrationEnabled,
  optionalEmbeddingEnv,
  requireEmbeddingEnv,
} from "./real-embedding-test-env.js";

if (!isRealEmbeddingIntegrationEnabled()) {
  describe.skip("OpenAICompatibleEmbeddingProvider real integration", () => {
    it("requires RUN_REAL_EMBEDDING_INTEGRATION_TESTS=true", () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe("OpenAICompatibleEmbeddingProvider real integration", () => {
    it("generates document and query embeddings against a real OpenAI-compatible provider", async () => {
      const provider = new OpenAICompatibleEmbeddingProvider({
        provider: "openai-compatible",
        model: requireEmbeddingEnv("EMBEDDING_MODEL"),
        vectorDimension: Number.parseInt(
          requireEmbeddingEnv("EMBEDDING_VECTOR_DIMENSION"),
          10,
        ),
        apiKey: requireEmbeddingEnv("EMBEDDING_API_KEY"),
        baseUrl: optionalEmbeddingEnv("EMBEDDING_BASE_URL"),
      });

      const documentEmbeddings = await provider.generateEmbeddings({
        values: [
          "typescript static method create of Greeter returns a new greeter instance",
          "python property getter name of Memory returns the current name",
        ],
        purpose: "document",
      });
      const queryEmbeddings = await provider.generateEmbeddings({
        values: [
          "greeter factory create method",
          "memory name getter property",
        ],
        purpose: "query",
      });

      expect(documentEmbeddings).toHaveLength(2);
      expect(queryEmbeddings).toHaveLength(2);
      expect(documentEmbeddings[0]).toHaveLength(provider.vectorDimension);
      expect(documentEmbeddings[1]).toHaveLength(provider.vectorDimension);
      expect(queryEmbeddings[0]).toHaveLength(provider.vectorDimension);
      expect(queryEmbeddings[1]).toHaveLength(provider.vectorDimension);
      expect(documentEmbeddings[0]).not.toEqual(documentEmbeddings[1]);
      expect(queryEmbeddings[0]).not.toEqual(queryEmbeddings[1]);
    }, 30000);
  });
}
