import type { AppConfig } from "../../bootstrap/config.js";

/**
 * 解析 repositoryId，遵循 `工具入参 > MCP_DEFAULT_REPOSITORY_ID > 报错`。
 */
export function resolveRepositoryId(
  config: AppConfig,
  repositoryId?: string,
): string {
  const resolved =
    repositoryId?.trim() || config.mcp.defaultRepositoryId?.trim();

  if (!resolved) {
    throw new Error(
      "Missing required repositoryId: provide tool input repositoryId or configure MCP_DEFAULT_REPOSITORY_ID",
    );
  }

  return resolved;
}

/**
 * 解析 rootPath，遵循 `工具入参 > MCP_REPOSITORY_ROOT > 报错`。
 *
 * 该 resolver 仅适用于需要直接访问仓库文件系统的工具。
 */
export function resolveRootPath(config: AppConfig, rootPath?: string): string {
  const resolved = rootPath?.trim() || config.mcp.repositoryRoot?.trim();

  if (!resolved) {
    throw new Error(
      "Missing required rootPath: provide tool input rootPath or configure MCP_REPOSITORY_ROOT",
    );
  }

  return resolved;
}
