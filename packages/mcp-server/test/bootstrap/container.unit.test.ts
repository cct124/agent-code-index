import { describe, expect, it } from "vitest";

import { resolveScanGitignorePath } from "../../src/bootstrap/container.js";

describe("resolveScanGitignorePath", () => {
  it("prefers explicit gitignore path from config", () => {
    expect(
      resolveScanGitignorePath({
        indexing: {
          ignorePatterns: [],
          gitignorePath: "/workspace/repo/custom.gitignore",
          defaultTopK: 10,
          nativeCandidateMultiplier: 20,
          nativeEfSearchMin: 100,
        },
        mcp: {
          repositoryRoot: "/workspace/repo",
        },
      }),
    ).toBe("/workspace/repo/custom.gitignore");
  });

  it("falls back to repositoryRoot/.gitignore when explicit path is absent", () => {
    expect(
      resolveScanGitignorePath({
        indexing: {
          ignorePatterns: [],
          gitignorePath: undefined,
          defaultTopK: 10,
          nativeCandidateMultiplier: 20,
          nativeEfSearchMin: 100,
        },
        mcp: {
          repositoryRoot: "/workspace/repo",
        },
      }),
    ).toBe("/workspace/repo/.gitignore");
  });

  it("falls back to process.cwd()/.gitignore when explicit path and repository root are absent", () => {
    expect(
      resolveScanGitignorePath({
        indexing: {
          ignorePatterns: [],
          gitignorePath: undefined,
          defaultTopK: 10,
          nativeCandidateMultiplier: 20,
          nativeEfSearchMin: 100,
        },
        mcp: {},
      }),
    ).toBe(`${process.cwd()}/.gitignore`);
  });
});
