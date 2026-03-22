import type {
  ContextPacket,
  ContextPacketDeduplication,
  ContextPacketFile,
  ContextPacketItem,
  ContextPacketTruncation,
} from "../domain/context-packet.js";
import type { SearchResult } from "../domain/search-result.js";

const DEFAULT_ADJACENT_LINE_GAP = 3;
const DEFAULT_CONTEXT_ITEM_OVERHEAD_TOKENS = 12;
const DEFAULT_CHARACTERS_PER_TOKEN = 4;

/**
 * Search 上下文包构建输入。
 */
export interface BuildSearchContextPacketInput {
  /** 所属仓库标识。 */
  repositoryId: string;
  /** 原始查询文本。 */
  query: string;
  /** search tool 请求的 topK。 */
  topK: number;
  /** 可选的 token 预算。 */
  tokenBudget?: number;
  /** 原始检索结果。 */
  results: SearchResult[];
}

/**
 * ContextBuilder 抽象。
 */
export interface ContextBuilder {
  /**
   * 构建 search 场景的统一上下文包。
   */
  buildSearchContextPacket(input: BuildSearchContextPacketInput): ContextPacket;
}

/**
 * 默认的上下文构建器实现。
 */
export class DefaultContextBuilder implements ContextBuilder {
  public buildSearchContextPacket(
    input: BuildSearchContextPacketInput,
  ): ContextPacket {
    const deduplicated = dedupeSearchResults(input.results);
    const merged = mergeAdjacentSearchResults(deduplicated.items);
    const topKLimited = merged.slice(0, input.topK);
    const budgetLimited = applyTokenBudget(topKLimited, input.tokenBudget);
    const finalItems = budgetLimited.items;
    const totalItems = merged.length;
    const estimatedTotalTokens = sumEstimatedTokens(merged);
    const estimatedReturnedTokens = sumEstimatedTokens(finalItems);
    const truncation = buildTruncation({
      totalItems,
      topK: input.topK,
      topKLimitedCount: topKLimited.length,
      finalItemsCount: finalItems.length,
      tokenBudget: input.tokenBudget,
      estimatedTotalTokens,
      estimatedReturnedTokens,
      maxItemsByBudget: budgetLimited.maxItems,
    });

    return {
      kind: "search",
      repositoryId: input.repositoryId,
      query: input.query,
      items: finalItems,
      files: summarizeFiles(finalItems),
      instructions: [
        "Treat this packet as semantic retrieval output ranked by relevance.",
        "Read merged items before falling back to raw results, because adjacent chunks may have been combined.",
        "Use files for per-file coverage and truncation metadata to decide whether more context is needed.",
      ],
      deduplication: {
        strategy: deduplicated.strategy,
        inputItems: input.results.length,
        removedItems: input.results.length - deduplicated.items.length,
      },
      truncation,
    };
  }
}

function dedupeSearchResults(results: SearchResult[]): {
  items: SearchResult[];
  strategy: ContextPacketDeduplication["strategy"];
} {
  const uniqueResults: SearchResult[] = [];
  const seenChunkIds = new Set<string>();
  const seenRanges = new Set<string>();
  let fallbackUsed = false;

  for (const result of results) {
    const chunkId = result.chunk.id.trim();

    if (chunkId) {
      if (seenChunkIds.has(chunkId)) {
        continue;
      }

      seenChunkIds.add(chunkId);
      uniqueResults.push(result);
      continue;
    }

    fallbackUsed = true;
    const rangeKey = [
      result.chunk.filePath,
      result.chunk.startLine,
      result.chunk.endLine,
      result.chunk.hash,
    ].join(":");

    if (seenRanges.has(rangeKey)) {
      continue;
    }

    seenRanges.add(rangeKey);
    uniqueResults.push(result);
  }

  if (results.length === uniqueResults.length) {
    return {
      items: uniqueResults,
      strategy: "none",
    };
  }

  return {
    items: uniqueResults,
    strategy: fallbackUsed ? "file_path_line_range" : "chunk_id",
  };
}

function mergeAdjacentSearchResults(
  results: SearchResult[],
): ContextPacketItem[] {
  const resultsByFile = new Map<string, SearchResult[]>();
  const fileOrder: string[] = [];

  for (const result of results) {
    if (!resultsByFile.has(result.chunk.filePath)) {
      resultsByFile.set(result.chunk.filePath, []);
      fileOrder.push(result.chunk.filePath);
    }

    resultsByFile.get(result.chunk.filePath)?.push(result);
  }

  const mergedItems: ContextPacketItem[] = [];

  for (const filePath of fileOrder) {
    const fileResults = (resultsByFile.get(filePath) ?? []).sort(
      (left, right) => left.chunk.startLine - right.chunk.startLine,
    );
    let currentGroup: SearchResult[] = [];

    for (const result of fileResults) {
      const previous = currentGroup[currentGroup.length - 1];

      if (!previous) {
        currentGroup = [result];
        continue;
      }

      if (
        result.chunk.startLine <=
        previous.chunk.endLine + DEFAULT_ADJACENT_LINE_GAP
      ) {
        currentGroup.push(result);
        continue;
      }

      mergedItems.push(toMergedSearchItem(currentGroup));
      currentGroup = [result];
    }

    if (currentGroup.length > 0) {
      mergedItems.push(toMergedSearchItem(currentGroup));
    }
  }

  return mergedItems;
}

function toMergedSearchItem(group: SearchResult[]): ContextPacketItem {
  const [first] = group;
  const last = group[group.length - 1] as SearchResult;
  const uniqueChunkIds = group.map((result) => result.chunk.id).filter(Boolean);
  const reasons = Array.from(
    new Set(
      group
        .map((result) => result.reason)
        .filter((reason): reason is string => Boolean(reason)),
    ),
  );
  const mergedContent = group
    .map((result) => result.chunk.content)
    .join("\n\n...\n\n");
  const metadata: Record<string, unknown> = {
    ...first.chunk.metadata,
    mergedChunkIds: uniqueChunkIds,
    mergedFromCount: group.length,
  };
  const symbolNames = Array.from(
    new Set(
      group
        .map((result) => result.chunk.metadata.symbolName)
        .filter((value): value is string => typeof value === "string"),
    ),
  );

  if (symbolNames.length > 1) {
    metadata.mergedSymbolNames = symbolNames;
  }

  const estimatedTokens = estimateTextTokens(mergedContent);

  return {
    type: "search_match",
    id: uniqueChunkIds[0],
    filePath: first.chunk.filePath,
    language: first.chunk.language,
    startLine: first.chunk.startLine,
    endLine: last.chunk.endLine,
    content: mergedContent,
    score: Math.max(...group.map((result) => result.score)),
    reason: reasons.length > 0 ? reasons.join(", ") : undefined,
    estimatedTokens,
    metadata,
  };
}

function applyTokenBudget(
  items: ContextPacketItem[],
  tokenBudget?: number,
): { items: ContextPacketItem[]; maxItems?: number } {
  if (tokenBudget === undefined) {
    return { items };
  }

  const selected: ContextPacketItem[] = [];
  let usedTokens = 0;

  for (const item of items) {
    const estimatedTokens =
      item.estimatedTokens ?? estimateTextTokens(item.content);

    if (usedTokens + estimatedTokens > tokenBudget) {
      break;
    }

    selected.push(item);
    usedTokens += estimatedTokens;
  }

  return {
    items: selected,
    maxItems: selected.length,
  };
}

function summarizeFiles(items: ContextPacketItem[]): ContextPacketFile[] {
  const files = new Map<string, ContextPacketFile>();

  for (const item of items) {
    const existing = files.get(item.filePath);

    if (!existing) {
      files.set(item.filePath, {
        filePath: item.filePath,
        language: item.language,
        chunkCount: 1,
        startLine: item.startLine,
        endLine: item.endLine,
      });
      continue;
    }

    existing.chunkCount += 1;
    existing.startLine = Math.min(existing.startLine, item.startLine);
    existing.endLine = Math.max(existing.endLine, item.endLine);
  }

  return Array.from(files.values());
}

function buildTruncation(input: {
  totalItems: number;
  topK: number;
  topKLimitedCount: number;
  finalItemsCount: number;
  tokenBudget?: number;
  estimatedTotalTokens: number;
  estimatedReturnedTokens: number;
  maxItemsByBudget?: number;
}): ContextPacketTruncation {
  const omittedItems = input.totalItems - input.finalItemsCount;
  const topKWasApplied = input.totalItems > input.topKLimitedCount;
  const budgetWasApplied = input.topKLimitedCount > input.finalItemsCount;

  return {
    truncated: omittedItems > 0,
    strategy: budgetWasApplied
      ? "max_items"
      : topKWasApplied
        ? "top_k"
        : "none",
    totalItems: input.totalItems,
    returnedItems: input.finalItemsCount,
    omittedItems,
    limit: budgetWasApplied
      ? input.maxItemsByBudget
      : topKWasApplied
        ? input.topK
        : undefined,
    budgetTokens: input.tokenBudget,
    estimatedTotalTokens: input.estimatedTotalTokens,
    estimatedReturnedTokens: input.estimatedReturnedTokens,
  };
}

function sumEstimatedTokens(items: ContextPacketItem[]): number {
  return items.reduce(
    (sum, item) =>
      sum + (item.estimatedTokens ?? estimateTextTokens(item.content)),
    0,
  );
}

export function estimateTextTokens(text: string): number {
  return Math.max(
    1,
    Math.ceil(text.length / DEFAULT_CHARACTERS_PER_TOKEN) +
      DEFAULT_CONTEXT_ITEM_OVERHEAD_TOKENS,
  );
}
