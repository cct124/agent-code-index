import { describe, expect, it } from "vitest";

import type { AppConfig } from "../../src/bootstrap/config.js";
import {
  resolveRepositoryId,
  resolveRootPath,
} from "../../src/adapters/shared/input-resolver.js";

function createConfig(): AppConfig {
  return {
    projectSpace: "demo-project",
    surreal: {
      url: "ws://127.0.0.1:8000/rpc",
      namespace: "demo_project",
      database: "default",
      username: "root",
      password: "root",
      useTls: false,
      deploymentMode: "local",
    },
    embedding: {
      provider: "voyage",
      model: "voyage-code-3",
      vectorDimension: 1024,
      apiKey: "test-key",
    },
    indexing: {
      defaultTopK: 10,
      ignorePatterns: [],
      includePatterns: [],
      nativeCandidateMultiplier: 20,
      nativeEfSearchMin: 100,
    },
    mcp: {
      defaultRepositoryId: "repo-a",
      repositoryRoot: "/workspace/repo-a",
    },
    logging: {
      level: "info",
      pretty: true,
      filePath: undefined,
      filePretty: false,
      fileRotateDaily: false,
      fileRetentionDays: undefined,
    },
  };
}

describe("input resolver", () => {
  it("prefers tool inputs over config defaults", () => {
    const config = createConfig();

    expect(resolveRepositoryId(config, "repo-b")).toBe("repo-b");
    expect(resolveRootPath(config, "/workspace/repo-b")).toBe(
      "/workspace/repo-b",
    );
  });

  it("falls back to mcp defaults when tool inputs are absent", () => {
    const config = createConfig();

    expect(resolveRepositoryId(config)).toBe("repo-a");
    expect(resolveRootPath(config)).toBe("/workspace/repo-a");
  });

  it("throws when required defaults are missing", () => {
    const config = createConfig();
    config.mcp = {};

    expect(() => resolveRepositoryId(config)).toThrow(
      /MCP_DEFAULT_REPOSITORY_ID/,
    );
    expect(() => resolveRootPath(config)).toThrow(/MCP_REPOSITORY_ROOT/);
  });
});
