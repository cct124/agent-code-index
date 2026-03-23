import { readdir } from "node:fs/promises";
import path from "node:path";

import type { FileScanner } from "@agent-code-index/core";

import {
  DEFAULT_SCAN_IGNORE_PATTERNS,
  ScanPathPolicy,
} from "./scan-path-policy.js";

export { DEFAULT_SCAN_IGNORE_PATTERNS } from "./scan-path-policy.js";

/**
 * 本地文件系统扫描器。
 *
 * 该实现会递归遍历目录树，返回所有未命中忽略规则的普通文件绝对路径。
 */
export class LocalFileScanner implements FileScanner {
  /** 需要在扫描过程中跳过的目录或路径模式。 */
  private readonly ignorePatterns: string[];
  /** 需要强制纳入扫描结果的文件或路径模式。 */
  private readonly includePatterns: string[];
  /** 可选的根 .gitignore 绝对路径。 */
  private readonly gitignorePath?: string;

  /**
   * 初始化本地文件扫描器。
   *
   * @param ignorePatterns 扫描过程中需要跳过的目录名称或路径前缀。
   */
  public constructor(
    ignorePatterns = DEFAULT_SCAN_IGNORE_PATTERNS,
    gitignorePath?: string,
    includePatterns: string[] = [],
  ) {
    this.ignorePatterns = ignorePatterns;
    this.gitignorePath = gitignorePath;
    this.includePatterns = includePatterns;
  }

  /**
   * 从仓库根目录开始递归扫描，并返回排序后的候选文件绝对路径列表。
   */
  public async scan(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const pathPolicy = await ScanPathPolicy.create(
      this.ignorePatterns,
      this.gitignorePath,
      this.includePatterns,
    );

    await this.walk(rootPath, rootPath, files, pathPolicy);

    return files.sort((left, right) => left.localeCompare(right));
  }

  /**
   * 深度优先遍历目录树，将符合条件的普通文件加入结果列表。
   */
  private async walk(
    rootPath: string,
    currentPath: string,
    files: string[],
    pathPolicy: ScanPathPolicy,
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath);

      if (
        pathPolicy.isIgnored(relativePath) &&
        !(entry.isDirectory() && pathPolicy.hasIncludedDescendant(relativePath))
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walk(rootPath, absolutePath, files, pathPolicy);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }
}
