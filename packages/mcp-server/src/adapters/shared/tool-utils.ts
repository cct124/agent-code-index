/**
 * MCP tool adapter 的通用输入清洗与输出辅助。
 */

const SEARCH_FILTER_WHITELIST = new Set([
  "filePath",
  "language",
  "hash",
  "startLine",
  "endLine",
  "symbolName",
  "symbolKind",
  "parentSymbol",
  "heading",
  "docType",
  "sectionLevel",
  "tags",
]);

/**
 * 将 tool 结果包装为标准文本内容数组。
 */
export function createTextContent(
  text: string,
): Array<{ type: "text"; text: string }> {
  return [{ type: "text", text }];
}

/**
 * 去重并清洗文件路径列表。
 */
export function normalizeFilePaths(filePaths: string[]): string[] {
  const normalized = Array.from(
    new Set(filePaths.map((filePath) => filePath.trim())),
  ).filter((filePath) => filePath.length > 0);

  if (normalized.length === 0) {
    throw new Error("filePaths must contain at least one non-empty path");
  }

  return normalized;
}

/**
 * 将可选正整数参数归一化。
 */
export function normalizeOptionalPositiveInteger(
  fieldName: string,
  value: number | undefined,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }

  return value;
}

/**
 * 将必填文本字段裁剪并校验非空。
 */
export function normalizeRequiredString(
  fieldName: string,
  value: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} must not be empty`);
  }

  return normalized;
}

/**
 * 校验 search filters 的字段白名单，并移除空字符串值。
 */
export function normalizeSearchFilters(
  filters?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!filters) {
    return undefined;
  }

  const unknownKeys = Object.keys(filters).filter(
    (key) => !SEARCH_FILTER_WHITELIST.has(key),
  );

  if (unknownKeys.length > 0) {
    throw new Error(`Unsupported search filters: ${unknownKeys.join(", ")}`);
  }

  const normalizedEntries = Object.entries(filters)
    .map(
      ([key, value]) =>
        [key, typeof value === "string" ? value.trim() : value] as const,
    )
    .filter(([, value]) => value !== "");

  return normalizedEntries.length > 0
    ? Object.fromEntries(normalizedEntries)
    : undefined;
}
