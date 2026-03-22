import type { AppConfig } from "../../bootstrap/config.js";

export function resolveRepositoryId(
  config: AppConfig,
  repositoryId?: string,
): string {
  const resolved = repositoryId?.trim() || config.mcp.defaultRepositoryId?.trim();

  if (!resolved) {
    throw new Error(
      "Missing required repositoryId: provide tool input repositoryId or configure MCP_DEFAULT_REPOSITORY_ID",
    );
  }

  return resolved;
}

export function resolveRootPath(config: AppConfig, rootPath?: string): string {
  const resolved = rootPath?.trim() || config.mcp.repositoryRoot?.trim();

  if (!resolved) {
    throw new Error(
      "Missing required rootPath: provide tool input rootPath or configure MCP_REPOSITORY_ROOT",
    );
  }

  return resolved;
}