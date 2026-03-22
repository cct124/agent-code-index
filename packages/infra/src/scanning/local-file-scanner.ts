import { readFile, readdir } from "node:fs/promises";
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
  "*.tsbuildinfo",
];

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
    ignorePatterns = DEFAULT_IGNORE_PATTERNS,
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
    const gitignoreRules = await loadGitignoreRules(this.gitignorePath);

    await this.walk(rootPath, rootPath, files, gitignoreRules);

    return files.sort((left, right) => left.localeCompare(right));
  }

  /**
   * 深度优先遍历目录树，将符合条件的普通文件加入结果列表。
   */
  private async walk(
    rootPath: string,
    currentPath: string,
    files: string[],
    gitignoreRules: GitignoreRule[],
  ): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentPath, entry.name);
      const relativePath = path.relative(rootPath, absolutePath);

      if (
        this.isIgnored(relativePath, gitignoreRules) &&
        !(entry.isDirectory() && this.hasIncludedDescendant(relativePath))
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        await this.walk(rootPath, absolutePath, files, gitignoreRules);
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
  private isIgnored(
    relativePath: string,
    gitignoreRules: GitignoreRule[],
  ): boolean {
    const normalizedPath = relativePath.split(path.sep).join("/");
    const segments = normalizedPath.split("/");

    if (this.matchesIncludePattern(normalizedPath, segments)) {
      return false;
    }

    if (
      this.ignorePatterns.some((pattern) =>
        matchesSimplePattern(pattern, normalizedPath, segments),
      )
    ) {
      return true;
    }

    let ignored = false;

    for (const rule of gitignoreRules) {
      if (!rule.regex.test(normalizedPath)) {
        continue;
      }

      ignored = !rule.negated;
    }

    return ignored;
  }

  private matchesIncludePattern(
    normalizedPath: string,
    segments: string[],
  ): boolean {
    return this.includePatterns.some((pattern) =>
      matchesSimplePattern(pattern, normalizedPath, segments),
    );
  }

  private hasIncludedDescendant(relativePath: string): boolean {
    const normalizedPath = relativePath.split(path.sep).join("/");

    return this.includePatterns.some(
      (pattern) =>
        pattern === normalizedPath || pattern.startsWith(`${normalizedPath}/`),
    );
  }
}

interface GitignoreRule {
  negated: boolean;
  regex: RegExp;
}

function matchesSimplePattern(
  pattern: string,
  normalizedPath: string,
  segments: string[],
): boolean {
  if (pattern.startsWith("*.")) {
    return normalizedPath.endsWith(pattern.slice(1));
  }

  return (
    normalizedPath === pattern ||
    normalizedPath.startsWith(`${pattern}/`) ||
    segments.includes(pattern)
  );
}

async function loadGitignoreRules(
  gitignorePath?: string,
): Promise<GitignoreRule[]> {
  if (gitignorePath === undefined) {
    return [];
  }

  let content: string;

  try {
    content = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (isFileNotFoundError(error)) {
      return [];
    }

    throw error;
  }

  return content
    .split(/\r?\n/u)
    .map(parseGitignoreRule)
    .filter((rule): rule is GitignoreRule => rule !== undefined);
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

function parseGitignoreRule(line: string): GitignoreRule | undefined {
  const trimmed = line.trim();

  if (trimmed.length === 0 || trimmed.startsWith("#")) {
    return undefined;
  }

  const negated = trimmed.startsWith("!");
  const candidate = negated ? trimmed.slice(1) : trimmed;

  if (candidate.length === 0) {
    return undefined;
  }

  const directoryOnly = candidate.endsWith("/");
  const withoutDirectorySuffix = directoryOnly
    ? candidate.slice(0, -1)
    : candidate;
  const anchored = withoutDirectorySuffix.startsWith("/");
  const pattern = anchored
    ? withoutDirectorySuffix.slice(1)
    : withoutDirectorySuffix;

  if (pattern.length === 0) {
    return undefined;
  }

  return {
    negated,
    regex: buildGitignoreRegex(pattern, anchored, directoryOnly),
  };
}

function buildGitignoreRegex(
  pattern: string,
  anchored: boolean,
  directoryOnly: boolean,
): RegExp {
  const hasSlash = pattern.includes("/");
  const body = globToRegex(pattern);

  if (!hasSlash) {
    const suffix = directoryOnly ? "(?:/.*)?$" : "$";
    return new RegExp(`(^|.*/)${body}${suffix}`);
  }

  const prefix = anchored ? "^" : "(^|.*/)";
  const suffix = directoryOnly ? "(?:/.*)?$" : "$";

  return new RegExp(`${prefix}${body}${suffix}`);
}

function globToRegex(pattern: string): string {
  let regex = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    const nextChar = pattern[index + 1];

    if (char === "*" && nextChar === "*") {
      regex += ".*";
      index += 1;
      continue;
    }

    if (char === "*") {
      regex += "[^/]*";
      continue;
    }

    if (char === "?") {
      regex += "[^/]";
      continue;
    }

    regex += escapeRegexChar(char);
  }

  return regex;
}

function escapeRegexChar(char: string): string {
  return /[\\^$+?.()|[\]{}]/u.test(char) ? `\\${char}` : char;
}
