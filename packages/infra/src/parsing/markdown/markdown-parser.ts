import { unified } from "unified";
import remarkFrontmatter from "remark-frontmatter";
import remarkParse from "remark-parse";

import {
  NOOP_LOGGER,
  type Chunk,
  type Logger,
  type ParseInput,
  type Parser,
} from "@agent-code-index/core";

import {
  FallbackParser,
  type FallbackParserOptions,
} from "../fallback-parser.js";
import { createMarkdownSectionChunks } from "./markdown-section-chunker.js";

/**
 * Markdown parser 配置。
 */
export interface MarkdownParserOptions extends FallbackParserOptions {}

/**
 * Markdown 专用解析器，按标题章节产出结构化 chunk。
 */
export class MarkdownParser implements Parser {
  /** Markdown AST 处理器。 */
  private readonly processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml", "toml"]);

  /** AST 解析失败时的 fallback parser。 */
  private readonly fallbackParser: FallbackParser;
  /** 结构化日志接口。 */
  private readonly logger: Logger;

  /**
   * 初始化 Markdown parser。
   */
  public constructor(
    options: MarkdownParserOptions = {},
    logger: Logger = NOOP_LOGGER,
  ) {
    this.fallbackParser = new FallbackParser(options);
    this.logger = logger;
  }

  /**
   * 解析 Markdown 文档，优先按章节边界切块。
   */
  public async parse(input: ParseInput): Promise<Chunk[]> {
    if (!input.content.trim()) {
      this.logger.debug("Markdown file is empty, skipping parse", {
        filePath: input.filePath,
      });
      return [];
    }

    try {
      const root = this.processor.parse(input.content) as {
        children?: Array<{ type: string }>;
      };
      const chunks = createMarkdownSectionChunks(input, {
        children: root.children ?? [],
      });

      if (chunks.length > 0) {
        this.logger.debug("Markdown structural parsing completed", {
          filePath: input.filePath,
          chunkCount: chunks.length,
        });
        return chunks;
      }

      this.logger.warn(
        "Markdown structural parser produced no chunks, falling back to line parser",
        {
          filePath: input.filePath,
        },
      );
    } catch {
      this.logger.warn("Markdown parsing failed, falling back to line parser", {
        filePath: input.filePath,
      });
      return this.fallbackParser.parse(input);
    }

    return this.fallbackParser.parse(input);
  }
}
