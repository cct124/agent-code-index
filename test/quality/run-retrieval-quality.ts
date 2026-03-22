import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { createApp } from "../../packages/mcp-server/src/index.ts";

interface QuerySpec {
  id: string;
  query: string;
  topK?: number;
  tokenBudget?: number;
}

interface ParsedArgs {
  envFile: string;
  queriesFile: string;
  outputFile?: string;
  label?: string;
  repositoryId?: string;
  rootPath: string;
  embeddingBatchSize?: number;
  embeddingConcurrency?: number;
  allowOverwrite: boolean;
}

interface QualityRunReport {
  generatedAt: string;
  label: string;
  environment: {
    envFile: string;
    projectSpace: string;
    repositoryId: string;
    rootPath: string;
    provider: string;
    model: string;
    vectorDimension: number;
  };
  indexing: {
    embeddingBatchSize?: number;
    embeddingConcurrency?: number;
    scannedFileCount: number;
    parsedFileCount: number;
    skippedFileCount: number;
    preparedChunkCount: number;
    embeddedChunkCount: number;
    storedChunkCount: number;
    failedFileCount: number;
  };
  queries: Array<{
    id: string;
    query: string;
    topK: number;
    tokenBudget?: number;
    resultCount: number;
    files: string[];
    results: Array<{
      rank: number;
      score: number;
      reason?: string;
      filePath: string;
      chunkId: string;
      language: string;
      startLine: number;
      endLine: number;
      metadata: Record<string, unknown>;
      preview: string;
    }>;
  }>;
}

const DEFAULT_TOP_K = 10;
const QUALITY_INTERNAL_IGNORE_PATTERNS = ["test/quality"];

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const envFile = path.resolve(args.envFile);
  const queriesFile = path.resolve(args.queriesFile);
  const rootPath = path.resolve(args.rootPath);
  const envValues = parseEnvFile(await readFile(envFile, "utf8"));

  for (const [key, value] of Object.entries(envValues)) {
    process.env[key] = value;
  }

  process.env.DEFAULT_SCAN_IGNORE_PATTERNS = mergeCsvPatterns(
    process.env.DEFAULT_SCAN_IGNORE_PATTERNS,
    QUALITY_INTERNAL_IGNORE_PATTERNS,
  );

  const repositoryId =
    args.repositoryId ??
    process.env.MCP_DEFAULT_REPOSITORY_ID ??
    path.basename(rootPath);
  const label =
    args.label ??
    `${envValues.EMBEDDING_PROVIDER ?? "unknown"}-${slugify(envValues.EMBEDDING_MODEL ?? "unknown")}`;
  const requestedOutputFile = path.resolve(
    args.outputFile ??
      path.join(rootPath, "test/quality/results", `${label}.json`),
  );
  const outputFile = await resolveOutputFile(
    requestedOutputFile,
    args.allowOverwrite,
  );
  const querySpecs = JSON.parse(
    await readFile(queriesFile, "utf8"),
  ) as QuerySpec[];

  let app: Awaited<ReturnType<typeof createApp>> | undefined;

  try {
    app = await createApp();
    const indexResult = await app.container.indexRepositoryService.execute({
      repositoryId,
      rootPath,
      embeddingBatchSize: args.embeddingBatchSize,
      embeddingConcurrency: args.embeddingConcurrency,
    });

    const queries = [] as QualityRunReport["queries"];

    for (const spec of querySpecs) {
      const topK = spec.topK ?? DEFAULT_TOP_K;
      const searchResult = await app.container.searchCodeContextService.execute(
        {
          repositoryId,
          query: spec.query,
          topK,
          tokenBudget: spec.tokenBudget,
        },
      );

      queries.push({
        id: spec.id,
        query: spec.query,
        topK,
        tokenBudget: spec.tokenBudget,
        resultCount: searchResult.resultCount,
        files: unique(searchResult.results.map((item) => item.chunk.filePath)),
        results: searchResult.results.map((item, index) => ({
          rank: index + 1,
          score: item.score,
          reason: item.reason,
          filePath: item.chunk.filePath,
          chunkId: item.chunk.id,
          language: item.chunk.language,
          startLine: item.chunk.startLine,
          endLine: item.chunk.endLine,
          metadata: item.chunk.metadata ?? {},
          preview: compactPreview(item.chunk.content),
        })),
      });
    }

    const report: QualityRunReport = {
      generatedAt: new Date().toISOString(),
      label,
      environment: {
        envFile,
        projectSpace: app.config.projectSpace,
        repositoryId,
        rootPath,
        provider: app.config.embedding.provider,
        model: app.config.embedding.model,
        vectorDimension: app.config.embedding.vectorDimension,
      },
      indexing: {
        embeddingBatchSize: args.embeddingBatchSize,
        embeddingConcurrency: args.embeddingConcurrency,
        scannedFileCount: indexResult.scannedFileCount,
        parsedFileCount: indexResult.parsedFileCount,
        skippedFileCount: indexResult.skippedFileCount,
        preparedChunkCount: indexResult.preparedChunkCount,
        embeddedChunkCount: indexResult.embeddedChunkCount,
        storedChunkCount: indexResult.storedChunkCount,
        failedFileCount: indexResult.failedFileCount,
      },
      queries,
    };

    await mkdir(path.dirname(outputFile), { recursive: true });
    await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

    console.log(
      JSON.stringify(
        {
          requestedOutputFile,
          outputFile,
          outputWasRenamed: outputFile !== requestedOutputFile,
          label,
          provider: report.environment.provider,
          model: report.environment.model,
          repositoryId,
          queryCount: report.queries.length,
          scannedFileCount: report.indexing.scannedFileCount,
          storedChunkCount: report.indexing.storedChunkCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await app?.container.surrealClient.disconnect();
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    envFile: ".env.development",
    queriesFile: "test/quality/queries.json",
    rootPath: process.cwd(),
    allowOverwrite: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const nextValue = argv[index + 1];

    switch (token) {
      case "--env-file":
        args.envFile = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--queries-file":
        args.queriesFile = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--output-file":
        args.outputFile = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--label":
        args.label = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--repository-id":
        args.repositoryId = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--root-path":
        args.rootPath = requireNextValue(token, nextValue);
        index += 1;
        break;
      case "--embedding-batch-size":
        args.embeddingBatchSize = parsePositiveInteger(
          token,
          requireNextValue(token, nextValue),
        );
        index += 1;
        break;
      case "--embedding-concurrency":
        args.embeddingConcurrency = parsePositiveInteger(
          token,
          requireNextValue(token, nextValue),
        );
        index += 1;
        break;
      case "--allow-overwrite":
        args.allowOverwrite = true;
        break;
      default:
        throw new Error(`Unknown argument: ${token}`);
    }
  }

  return args;
}

function requireNextValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parsePositiveInteger(flag: string, value: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer`);
  }

  return parsed;
}

function parseEnvFile(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split(/\r?\n/u)) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(rawValue);
  }

  return env;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function compactPreview(content: string): string {
  return content.replace(/\s+/gu, " ").trim().slice(0, 220);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function mergeCsvPatterns(
  existingValue: string | undefined,
  extraPatterns: string[],
): string {
  const values = [
    ...(existingValue
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []),
    ...extraPatterns,
  ];

  return [...new Set(values)].join(",");
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

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : String(error),
  );
  process.exitCode = 1;
});
