import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * 扫描仓库时默认忽略的目录名称。
 */
export const DEFAULT_SCAN_IGNORE_PATTERNS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".yarn",
  "*.tsbuildinfo",
];

/**
 * 统一封装扫描阶段的路径放行/排除判定，供全仓扫描与显式文件索引复用。
 */
export class ScanPathPolicy {
  private readonly ignorePatterns: string[];
  private readonly includePatterns: string[];
  private readonly gitignoreRules: GitignoreRule[];

  private constructor(
    ignorePatterns: string[],
    includePatterns: string[],
    gitignoreRules: GitignoreRule[],
  ) {
    this.ignorePatterns = ignorePatterns;
    this.includePatterns = includePatterns;
    this.gitignoreRules = gitignoreRules;
  }

  public static async create(
    ignorePatterns = DEFAULT_SCAN_IGNORE_PATTERNS,
    gitignorePath?: string,
    includePatterns: string[] = [],
  ): Promise<ScanPathPolicy> {
    const gitignoreRules = await loadGitignoreRules(gitignorePath);

    return new ScanPathPolicy(ignorePatterns, includePatterns, gitignoreRules);
  }

  public isIgnored(relativePath: string): boolean {
    const normalizedPath = normalizeRelativePath(relativePath);
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

    for (const rule of this.gitignoreRules) {
      if (!rule.regex.test(normalizedPath)) {
        continue;
      }

      ignored = !rule.negated;
    }

    return ignored;
  }

  public hasIncludedDescendant(relativePath: string): boolean {
    const normalizedPath = normalizeRelativePath(relativePath);

    return this.includePatterns.some(
      (pattern) =>
        pattern === normalizedPath || pattern.startsWith(`${normalizedPath}/`),
    );
  }

  private matchesIncludePattern(
    normalizedPath: string,
    segments: string[],
  ): boolean {
    return this.includePatterns.some((pattern) =>
      matchesSimplePattern(pattern, normalizedPath, segments),
    );
  }
}

interface GitignoreRule {
  negated: boolean;
  regex: RegExp;
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
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
    const current = pattern[index];
    const next = pattern[index + 1];

    if (current === "*") {
      if (next === "*") {
        regex += ".*";
        index += 1;
        continue;
      }

      regex += "[^/]*";
      continue;
    }

    if (current === "?") {
      regex += "[^/]";
      continue;
    }

    regex += escapeRegexChar(current);
  }

  return regex;
}

function escapeRegexChar(char: string): string {
  return /[\\^$.*+?()[\]{}|]/u.test(char) ? `\\${char}` : char;
}
