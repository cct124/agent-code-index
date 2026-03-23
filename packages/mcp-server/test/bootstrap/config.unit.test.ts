/**
 * config.ts 的单元测试。
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/bootstrap/config.js";

const temporaryDirectories: string[] = [];

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
    DEFAULT_EMBEDDING_BATCH_SIZE: "16",
    DEFAULT_EMBEDDING_CONCURRENCY: "2",
    DEFAULT_SCAN_IGNORE_PATTERNS: "node_modules,.git,dist,*.tsbuildinfo",
    DEFAULT_SCAN_INCLUDE_PATTERNS: ".env.example,dist/schema.json",
    DEFAULT_SCAN_GITIGNORE_PATH: "/workspace/repo-a/.gitignore",
    LOG_LEVEL: "info",
    LOG_PRETTY: "true",
    LOG_FILE_PRETTY: "false",
  };
}

function createExistingDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), "agent-code-index-config-"));
  temporaryDirectories.push(directory);
  return directory;
}

describe("loadConfig", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

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
    const repositoryRoot = createExistingDirectory();

    const config = loadConfig({
      ...createBaseEnv(),
      PROJECT_SPACE: "Demo-Project",
      MCP_DEFAULT_REPOSITORY_ID: "repo-a",
      MCP_REPOSITORY_ROOT: repositoryRoot,
    });

    expect(config.projectSpace).toBe("demo-project");
    expect(config.surreal.namespace).toBe("demo_project");
    expect(config.embedding.model).toBe("voyage-code-3");
    expect(config.indexing.ignorePatterns).toEqual([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      ".yarn",
      "*.tsbuildinfo",
    ]);
    expect(config.indexing.defaultEmbeddingBatchSize).toBe(16);
    expect(config.indexing.defaultEmbeddingConcurrency).toBe(2);
    expect(config.indexing.includePatterns).toEqual([
      ".env.example",
      "dist/schema.json",
    ]);
    expect(config.indexing.gitignorePath).toBe("/workspace/repo-a/.gitignore");
    expect(config.indexing.nativeCandidateMultiplier).toBe(20);
    expect(config.indexing.nativeEfSearchMin).toBe(100);
    expect(config.mcp.defaultRepositoryId).toBe("repo-a");
    expect(config.mcp.repositoryRoot).toBe(repositoryRoot);
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

  it("appends custom scan ignore patterns after built-in defaults", () => {
    const config = loadConfig({
      ...createBaseEnv(),
      DEFAULT_SCAN_IGNORE_PATTERNS: ".cache,coverage",
    });

    expect(config.indexing.ignorePatterns).toEqual([
      "node_modules",
      ".git",
      "dist",
      "build",
      ".next",
      ".yarn",
      "*.tsbuildinfo",
      ".cache",
      "coverage",
    ]);
  });

  it("fails when MCP_REPOSITORY_ROOT is not absolute", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        MCP_REPOSITORY_ROOT: "workspace/repo-a",
      }),
    ).toThrow(/MCP_REPOSITORY_ROOT/);
  });

  it("fails when MCP_REPOSITORY_ROOT points to a missing path", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        MCP_REPOSITORY_ROOT: "/definitely/missing/repo-root",
      }),
    ).toThrow(/MCP_REPOSITORY_ROOT/);
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

  it("leaves indexing defaults undefined when embedding defaults are not configured", () => {
    const env = createBaseEnv();
    delete env.DEFAULT_EMBEDDING_BATCH_SIZE;
    delete env.DEFAULT_EMBEDDING_CONCURRENCY;

    const config = loadConfig(env);

    expect(config.indexing.defaultEmbeddingBatchSize).toBeUndefined();
    expect(config.indexing.defaultEmbeddingConcurrency).toBeUndefined();
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

  it("fails when scan gitignore path is not absolute", () => {
    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        DEFAULT_SCAN_GITIGNORE_PATH: ".gitignore",
      }),
    ).toThrow(/DEFAULT_SCAN_GITIGNORE_PATH/);
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

    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        DEFAULT_EMBEDDING_BATCH_SIZE: "0",
      }),
    ).toThrow(/DEFAULT_EMBEDDING_BATCH_SIZE/);

    expect(() =>
      loadConfig({
        ...createBaseEnv(),
        DEFAULT_EMBEDDING_CONCURRENCY: "-1",
      }),
    ).toThrow(/DEFAULT_EMBEDDING_CONCURRENCY/);
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
