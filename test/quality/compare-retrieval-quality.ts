import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

  if (args.outputFile) {
    const outputFile = path.resolve(args.outputFile);
    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${summary}\n`, "utf8");
  }

  console.log(summary);
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    left: "",
    right: "",
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

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
