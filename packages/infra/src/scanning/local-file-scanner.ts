import { readdir } from "node:fs/promises";
import path from "node:path";

import type { FileScanner } from "@agent-code-index/core";

/**
 * 扫描仓库时默认忽略的目录名称。
 */
const DEFAULT_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".yarn",
];

/**
 * 本地文件系统扫描器。
 *
 * 该实现会递归遍历目录树，返回所有未命中忽略规则的普通文件绝对路径。
 */
export class LocalFileScanner implements FileScanner {
  /** 需要在扫描过程中跳过的目录或路径模式。 */
  private readonly ignorePatterns: string[];

  /**
   * 初始化本地文件扫描器。
   *
   * @param ignorePatterns 扫描过程中需要跳过的目录名称或路径前缀。
   */
  public constructor(ignorePatterns = DEFAULT_IGNORE_PATTERNS) {
    this.ignorePatterns = ignorePatterns;
  }

  /**
   * 从仓库根目录开始递归扫描，并返回排序后的候选文件绝对路径列表。
   */
  public async scan(rootPath: string): Promise<string[]> {
    const files: string[] = [];

    await this.walk(rootPath, rootPath, files);

    return files.sort((left, right) => left.localeCompare(right));
  }

  /**
   * 深度优先遍历目录树，将符合条件的普通文件加入结果列表。
   */
  private async walk(
    rootPath: string,
    currentPath: string,
    files: string[],
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath);

      if (this.isIgnored(relativePath)) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walk(rootPath, absolutePath, files);
        continue;
      }

      if (entry.isFile()) {
        files.push(absolutePath);
      }
    }
  }

  /**
   * 判断相对路径是否应当被忽略。
   *
   * 规则同时覆盖以下情况：
   * 1. 路径与忽略项完全一致
   * 2. 路径以前缀目录形式命中忽略项
   * 3. 任一路径片段命中忽略项
   */
  private isIgnored(relativePath: string): boolean {
    const normalizedPath = relativePath.split(path.sep).join("/");
    const segments = normalizedPath.split("/");

    return this.ignorePatterns.some(
      (pattern) =>
        normalizedPath === pattern ||
        normalizedPath.startsWith(`${pattern}/`) ||
        segments.includes(pattern),
    );
  }
}
