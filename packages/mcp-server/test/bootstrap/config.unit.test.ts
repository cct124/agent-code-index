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
    LOG_LEVEL: "info",
    LOG_PRETTY: "true",
    LOG_FILE_PRETTY: "false",
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
      MCP_DEFAULT_REPOSITORY_ID: "repo-a",
      MCP_REPOSITORY_ROOT: "/workspace/repo-a",
    });

    expect(config.projectSpace).toBe("demo-project");
    expect(config.surreal.namespace).toBe("demo_project");
    expect(config.embedding.model).toBe("voyage-code-3");
    expect(config.indexing.ignorePatterns).toEqual([
      "node_modules",
      ".git",
      "dist",
    ]);
    expect(config.indexing.nativeCandidateMultiplier).toBe(20);
    expect(config.indexing.nativeEfSearchMin).toBe(100);
    expect(config.mcp.defaultRepositoryId).toBe("repo-a");
    expect(config.mcp.repositoryRoot).toBe("/workspace/repo-a");
    expect(config.logging).toEqual({
      level: "info",
      pretty: true,
      filePath: undefined,
      filePretty: false,
    });
  });

  it("leaves mcp defaults undefined when not configured", () => {
    const config = loadConfig(createBaseEnv());

    expect(config.mcp.defaultRepositoryId).toBeUndefined();
    expect(config.mcp.repositoryRoot).toBeUndefined();
  });

  it("loads native search tuning configuration", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      SEARCH_NATIVE_CANDIDATE_MULTIPLIER: "12",
      SEARCH_NATIVE_EF_SEARCH_MIN: "180",
    });

    expect(config.indexing.nativeCandidateMultiplier).toBe(12);
    expect(config.indexing.nativeEfSearchMin).toBe(180);
  });

  it("loads logging configuration", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      LOG_LEVEL: "debug",
      LOG_PRETTY: "false",
      LOG_FILE_PATH: "/tmp/agent-code-index.log",
      LOG_FILE_PRETTY: "true",
    });

    expect(config.logging).toEqual({
      level: "debug",
      pretty: false,
      filePath: "/tmp/agent-code-index.log",
      filePretty: true,
    });
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

  it("fails when native search tuning values are not positive integers", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        SEARCH_NATIVE_CANDIDATE_MULTIPLIER: "0",
      }),
    ).toThrow(/SEARCH_NATIVE_CANDIDATE_MULTIPLIER/);

    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        SEARCH_NATIVE_EF_SEARCH_MIN: "-1",
      }),
    ).toThrow(/SEARCH_NATIVE_EF_SEARCH_MIN/);
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
