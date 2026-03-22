import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type FileCategory = "implementation" | "test" | "documentation" | "other";

interface StoredQueryResult {
  id: string;
  query: string;
  topK: number;
  resultCount: number;
  files: string[];
  results: Array<{
    rank: number;
    score: number;
    filePath: string;
    chunkId: string;
  }>;
}

interface StoredQualityRun {
  label: string;
  environment: {
    provider: string;
    model: string;
  };
  queries: StoredQueryResult[];
}

interface ParsedArgs {
  left: string;
  right: string;
  outputFile?: string;
  allowOverwrite: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const leftFile = path.resolve(args.left);
  const rightFile = path.resolve(args.right);
  const left = JSON.parse(await readFile(leftFile, "utf8")) as StoredQualityRun;
  const right = JSON.parse(
    await readFile(rightFile, "utf8"),
  ) as StoredQualityRun;
  const summary = buildComparison(left, right, leftFile, rightFile);
  const requestedOutputFile = path.resolve(
    args.outputFile ??
      path.join(
        path.dirname(leftFile),
        `${slugify(left.label)}-vs-${slugify(right.label)}.md`,
      ),
  );
  const outputFile = await resolveOutputFile(
    requestedOutputFile,
    args.allowOverwrite,
  );

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${summary}\n`, "utf8");

  console.log(
    [
      `Output file: ${outputFile}`,
      requestedOutputFile === outputFile
        ? "Output mode: direct"
        : `Output mode: preserved existing artifact at ${requestedOutputFile}`,
      "",
      summary,
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    left: "",
    right: "",
    allowOverwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    switch (token) {
      case "--left":
        args.left = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--right":
        args.right = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--output-file":
        args.outputFile = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--allow-overwrite":
        args.allowOverwrite = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  if (!args.left || !args.right) {
    throw new Error("Both --left and --right are required");
  }

  return args;
}

function requireNextValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function buildComparison(
  left: StoredQualityRun,
  right: StoredQualityRun,
  leftFile: string,
  rightFile: string,
): string {
  const lines: string[] = [];
  const aggregateMetrics = collectAggregateMetrics(left, right);

  lines.push("# Retrieval Quality Comparison");
  lines.push("");
  lines.push(
    `Left: ${left.label} (${left.environment.provider} / ${left.environment.model})`,
  );
  lines.push(`Source: ${leftFile}`);
  lines.push(
    `Right: ${right.label} (${right.environment.provider} / ${right.environment.model})`,
  );
  lines.push(`Source: ${rightFile}`);
  lines.push("");
  lines.push("## Aggregate Summary");
  lines.push("");
  lines.push(`Compared queries: ${aggregateMetrics.comparedQueryCount}`);
  lines.push(
    `Missing in right report: ${aggregateMetrics.missingInRightCount}`,
  );
  lines.push(
    `Average chunk overlap per query: ${aggregateMetrics.averageChunkOverlap.toFixed(2)}`,
  );
  lines.push(
    `Average file overlap per query: ${aggregateMetrics.averageFileOverlap.toFixed(2)}`,
  );
  lines.push(
    `Average top-3 file overlap per query: ${aggregateMetrics.averageTop3FileOverlap.toFixed(2)}`,
  );
  lines.push(
    `Distinct files seen by left: ${aggregateMetrics.leftDistinctFileCount}`,
  );
  lines.push(
    `Distinct files seen by right: ${aggregateMetrics.rightDistinctFileCount}`,
  );
  lines.push(
    `Distinct files shared by both: ${aggregateMetrics.sharedDistinctFileCount}`,
  );
  lines.push(
    `Left retrieval mix: ${formatCategoryBreakdown(aggregateMetrics.leftCategoryCounts)}`,
  );
  lines.push(
    `Right retrieval mix: ${formatCategoryBreakdown(aggregateMetrics.rightCategoryCounts)}`,
  );
  lines.push("");

  const rightById = new Map(right.queries.map((item) => [item.id, item]));

  for (const leftQuery of left.queries) {
    const rightQuery = rightById.get(leftQuery.id);

    if (!rightQuery) {
      lines.push(`## ${leftQuery.id}`);
      lines.push("");
      lines.push(`Missing in right report: ${leftQuery.query}`);
      lines.push("");
      continue;
    }

    const leftChunkIds = new Set(leftQuery.results.map((item) => item.chunkId));
    const rightChunkIds = new Set(
      rightQuery.results.map((item) => item.chunkId),
    );
    const leftFiles = new Set(leftQuery.results.map((item) => item.filePath));
    const rightFiles = new Set(rightQuery.results.map((item) => item.filePath));
    const overlappingChunkIds = intersect(leftChunkIds, rightChunkIds);
    const overlappingFiles = intersect(leftFiles, rightFiles);

    lines.push(`## ${leftQuery.id}`);
    lines.push("");
    lines.push(`Query: ${leftQuery.query}`);
    lines.push(`Left result count: ${leftQuery.resultCount}`);
    lines.push(`Right result count: ${rightQuery.resultCount}`);
    lines.push(
      `Chunk overlap@${Math.max(leftQuery.results.length, rightQuery.results.length)}: ${overlappingChunkIds.length}`,
    );
    lines.push(
      `File overlap@${Math.max(leftQuery.results.length, rightQuery.results.length)}: ${overlappingFiles.length}`,
    );
    lines.push("");
    lines.push(
      `Left only files: ${difference(leftFiles, rightFiles).join(", ") || "(none)"}`,
    );
    lines.push(
      `Right only files: ${difference(rightFiles, leftFiles).join(", ") || "(none)"}`,
    );
    lines.push("");
    lines.push("Left top files:");
    lines.push(...formatRankedFiles(leftQuery));
    lines.push("");
    lines.push("Right top files:");
    lines.push(...formatRankedFiles(rightQuery));
    lines.push("");
  }

  return lines.join("\n");
}

function intersect(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((item) => right.has(item));
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((item) => !right.has(item));
}

function formatRankedFiles(query: StoredQueryResult): string[] {
  return query.results.map(
    (item) => `${item.rank}. ${item.filePath} (score=${item.score.toFixed(4)})`,
  );
}

function collectAggregateMetrics(
  left: StoredQualityRun,
  right: StoredQualityRun,
) {
  const rightById = new Map(right.queries.map((item) => [item.id, item]));
  const leftAllFiles = new Set<string>();
  const rightAllFiles = new Set<string>();
  const leftCategoryCounts = createEmptyCategoryCounts();
  const rightCategoryCounts = createEmptyCategoryCounts();

  let comparedQueryCount = 0;
  let missingInRightCount = 0;
  let totalChunkOverlap = 0;
  let totalFileOverlap = 0;
  let totalTop3FileOverlap = 0;

  for (const leftQuery of left.queries) {
    accumulateQueryCategories(leftQuery, leftCategoryCounts, leftAllFiles);

    const rightQuery = rightById.get(leftQuery.id);

    if (!rightQuery) {
      missingInRightCount += 1;
      continue;
    }

    accumulateQueryCategories(rightQuery, rightCategoryCounts, rightAllFiles);

    comparedQueryCount += 1;

    const leftChunkIds = new Set(leftQuery.results.map((item) => item.chunkId));
    const rightChunkIds = new Set(
      rightQuery.results.map((item) => item.chunkId),
    );
    const leftFiles = new Set(leftQuery.results.map((item) => item.filePath));
    const rightFiles = new Set(rightQuery.results.map((item) => item.filePath));
    const leftTop3Files = new Set(
      leftQuery.results.slice(0, 3).map((item) => item.filePath),
    );
    const rightTop3Files = new Set(
      rightQuery.results.slice(0, 3).map((item) => item.filePath),
    );

    totalChunkOverlap += intersect(leftChunkIds, rightChunkIds).length;
    totalFileOverlap += intersect(leftFiles, rightFiles).length;
    totalTop3FileOverlap += intersect(leftTop3Files, rightTop3Files).length;
  }

  for (const rightQuery of right.queries) {
    if (!rightById.has(rightQuery.id)) {
      continue;
    }

    if (left.queries.some((item) => item.id === rightQuery.id)) {
      continue;
    }

    accumulateQueryCategories(rightQuery, rightCategoryCounts, rightAllFiles);
  }

  return {
    comparedQueryCount,
    missingInRightCount,
    averageChunkOverlap:
      comparedQueryCount === 0 ? 0 : totalChunkOverlap / comparedQueryCount,
    averageFileOverlap:
      comparedQueryCount === 0 ? 0 : totalFileOverlap / comparedQueryCount,
    averageTop3FileOverlap:
      comparedQueryCount === 0 ? 0 : totalTop3FileOverlap / comparedQueryCount,
    leftDistinctFileCount: leftAllFiles.size,
    rightDistinctFileCount: rightAllFiles.size,
    sharedDistinctFileCount: intersect(leftAllFiles, rightAllFiles).length,
    leftCategoryCounts,
    rightCategoryCounts,
  };
}

function accumulateQueryCategories(
  query: StoredQueryResult,
  counts: Record<FileCategory, number>,
  distinctFiles: Set<string>,
): void {
  for (const result of query.results) {
    counts[categorizeFile(result.filePath)] += 1;
    distinctFiles.add(result.filePath);
  }
}

function createEmptyCategoryCounts(): Record<FileCategory, number> {
  return {
    implementation: 0,
    test: 0,
    documentation: 0,
    other: 0,
  };
}

function categorizeFile(filePath: string): FileCategory {
  const normalizedPath = filePath.toLowerCase();

  if (
    normalizedPath.endsWith(".md") ||
    normalizedPath.startsWith("doc/") ||
    normalizedPath.startsWith("design/")
  ) {
    return "documentation";
  }

  if (
    normalizedPath.includes("/test/") ||
    normalizedPath.includes("/tests/") ||
    normalizedPath.endsWith(".test.ts") ||
    normalizedPath.endsWith(".test.tsx") ||
    normalizedPath.endsWith(".spec.ts") ||
    normalizedPath.endsWith(".spec.tsx")
  ) {
    return "test";
  }

  if (
    normalizedPath.endsWith(".ts") ||
    normalizedPath.endsWith(".tsx") ||
    normalizedPath.endsWith(".js") ||
    normalizedPath.endsWith(".jsx") ||
    normalizedPath.endsWith(".mjs") ||
    normalizedPath.endsWith(".cjs") ||
    normalizedPath.endsWith(".json")
  ) {
    return "implementation";
  }

  return "other";
}

function formatCategoryBreakdown(counts: Record<FileCategory, number>): string {
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  if (total === 0) {
    return "implementation 0.0%, test 0.0%, documentation 0.0%, other 0.0%";
  }

  return [
    `implementation ${formatPercentage(counts.implementation, total)}`,
    `test ${formatPercentage(counts.test, total)}`,
    `documentation ${formatPercentage(counts.documentation, total)}`,
    `other ${formatPercentage(counts.other, total)}`,
  ].join(", ");
}

function formatPercentage(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(1)}%`;
}

async function resolveOutputFile(
  requestedPath: string,
  allowOverwrite: boolean,
): Promise<string> {
  if (allowOverwrite || !(await pathExists(requestedPath))) {
    return requestedPath;
  }

  const parsedPath = path.parse(requestedPath);
  const timestamp = createTimestampSuffix(new Date());
  let attempt = 1;

  while (true) {
    const candidate = path.join(
      parsedPath.dir,
      `${parsedPath.name}-${timestamp}${attempt === 1 ? "" : `-${attempt}`}${parsedPath.ext}`,
    );

    if (!(await pathExists(candidate))) {
      return candidate;
    }

    attempt += 1;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function createTimestampSuffix(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
