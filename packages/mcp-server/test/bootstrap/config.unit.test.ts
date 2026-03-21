/**
 * config.ts 的单元测试。
 */
import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/bootstrap/config.js";

function createBaseEnv(): Record<string, string> {
  return {
    PROJECT_SPACE: "demo-project",
    SURREAL_URL: "ws://127.0.0.1:8000/rpc",
    SURREAL_DATABASE: "default",
    SURREAL_USERNAME: "root",
    SURREAL_PASSWORD: "root",
    SURREAL_USE_TLS: "false",
    SURREAL_DEPLOYMENT_MODE: "local",
    EMBEDDING_PROVIDER: "voyage",
    EMBEDDING_MODEL: "voyage-code-3",
    EMBEDDING_VECTOR_DIMENSION: "1024",
    EMBEDDING_API_KEY: "test-key",
    DEFAULT_TOP_K: "10",
    DEFAULT_SCAN_IGNORE_PATTERNS: "node_modules,.git,dist",
  };
}

describe("loadConfig", () => {
  it("loads valid openai-compatible embedding config", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      EMBEDDING_PROVIDER: "openai-compatible",
      EMBEDDING_MODEL: "Qwen/Qwen3-Embedding-8B",
      EMBEDDING_BASE_URL: "https://api.siliconflow.cn/v1",
      EMBEDDING_VECTOR_DIMENSION: "4096",
    });

    expect(config.embedding.provider).toBe("openai-compatible");
    expect(config.embedding.model).toBe("Qwen/Qwen3-Embedding-8B");
    expect(config.embedding.baseUrl).toBe("https://api.siliconflow.cn/v1");
    expect(config.embedding.vectorDimension).toBe(4096);
  });

  it("loads valid config and derives namespace from project space", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      PROJECT_SPACE: "Demo-Project",
    });

    expect(config.projectSpace).toBe("demo-project");
    expect(config.surreal.namespace).toBe("demo_project");
    expect(config.embedding.model).toBe("voyage-code-3");
    expect(config.indexing.ignorePatterns).toEqual([
      "node_modules",
      ".git",
      "dist",
    ]);
  });

  it("fails when project space format is invalid", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        PROJECT_SPACE: "bad.project",
      }),
    ).toThrow(/PROJECT_SPACE/);
  });

  it("fails when embedding api key is missing", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        EMBEDDING_API_KEY: "",
      }),
    ).toThrow("Voyage embedding requires EMBEDDING_API_KEY");
  });

  it("fails when openai-compatible embedding api key is missing", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        EMBEDDING_PROVIDER: "openai-compatible",
        EMBEDDING_API_KEY: "",
      }),
    ).toThrow("OpenAI-compatible embedding requires EMBEDDING_API_KEY");
  });

  it("fails when vector dimension is not a positive integer", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        EMBEDDING_VECTOR_DIMENSION: "0",
      }),
    ).toThrow(/EMBEDDING_VECTOR_DIMENSION/);
  });

  it("accepts surreal token auth without username and password", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      SURREAL_USERNAME: "",
      SURREAL_PASSWORD: "",
      SURREAL_TOKEN: "token-value",
    });

    expect(config.surreal.token).toBe("token-value");
    expect(config.surreal.username).toBeUndefined();
    expect(config.surreal.password).toBeUndefined();
  });
});
