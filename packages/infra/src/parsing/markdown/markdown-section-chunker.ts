import path from "node:path";

import { toString } from "mdast-util-to-string";

import type { Chunk, ParseInput } from "@agent-code-index/core";

import { createChunk } from "../chunk-utils.js";

interface MarkdownPosition {
  start?: { line?: number };
  end?: { line?: number };
}

interface MarkdownNode {
  type: string;
  depth?: number;
  value?: string;
  position?: MarkdownPosition;
  children?: MarkdownNode[];
}

interface MarkdownRoot {
  children: MarkdownNode[];
}

interface MarkdownSectionState {
  heading?: string;
  headingPath: string[];
  sectionLevel?: number;
  startLine: number;
  endLine: number;
}

/**
 * 基于 Markdown AST 产出章节级 chunk。
 */
export function createMarkdownSectionChunks(
  input: ParseInput,
  root: MarkdownRoot,
): Chunk[] {
  const sections: MarkdownSectionState[] = [];
  const lines = input.content.split(/\r?\n/);
  const headingStack: Array<{ depth: number; title: string }> = [];
  const frontmatter = extractFrontmatter(root.children);
  const docType = deriveDocType(input.filePath, frontmatter);
  let currentSection: MarkdownSectionState | undefined;

  for (const node of root.children) {
    if (node.type === "yaml" || node.type === "toml") {
      continue;
    }

    const startLine = node.position?.start?.line;
    const endLine = node.position?.end?.line;

    if (!startLine || !endLine) {
      continue;
    }

    if (node.type === "heading") {
      if (currentSection) {
        sections.push(currentSection);
      }

      const headingText = toString(node as never).trim();
      const depth = node.depth ?? 1;

      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1]?.depth >= depth
      ) {
        headingStack.pop();
      }

      headingStack.push({ depth, title: headingText });
      currentSection = {
        heading: headingText,
        headingPath: headingStack.map((item) => item.title),
        sectionLevel: depth,
        startLine,
        endLine,
      };
      continue;
    }

    if (!currentSection) {
      currentSection = {
        headingPath: [],
        startLine,
        endLine,
      };
      continue;
    }

    currentSection.endLine = endLine;
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections
    .map((section) => {
      const content = lines
        .slice(section.startLine - 1, section.endLine)
        .join("\n")
        .trimEnd();

      if (!content.trim()) {
        return null;
      }

      return createChunk({
        repositoryId: input.repositoryId,
        filePath: input.filePath,
        content,
        startLine: section.startLine,
        endLine: section.endLine,
        metadata: {
          heading: section.heading,
          headingPath:
            section.headingPath.length > 0
              ? [...section.headingPath]
              : undefined,
          sectionLevel: section.sectionLevel,
          docType,
          frontmatter:
            Object.keys(frontmatter).length > 0
              ? { ...frontmatter }
              : undefined,
        },
      });
    })
    .filter((chunk): chunk is Chunk => chunk !== null);
}

/**
 * 提取简单 frontmatter 字段。
 */
function extractFrontmatter(nodes: MarkdownNode[]): Record<string, string> {
  const result: Record<string, string> = {};

  for (const node of nodes) {
    if ((node.type !== "yaml" && node.type !== "toml") || !node.value) {
      continue;
    }

    for (const line of node.value.split(/\r?\n/)) {
      const yamlMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
      const tomlMatch = line.match(/^([A-Za-z0-9_-]+)\s*=\s*(.+)$/);
      const match = yamlMatch ?? tomlMatch;

      if (!match) {
        continue;
      }

      result[match[1]] = stripQuotes(match[2].trim());
    }
  }

  return result;
}

/**
 * 根据文件路径与 frontmatter 推断 Markdown 文档类型。
 */
function deriveDocType(
  filePath: string,
  frontmatter: Record<string, string>,
): string {
  const fromFrontmatter =
    frontmatter.docType ?? frontmatter.type ?? frontmatter.category;

  if (fromFrontmatter) {
    return fromFrontmatter;
  }

  const normalizedPath = filePath.toLowerCase().split(path.sep).join("/");
  const basename = path.basename(normalizedPath);

  if (basename === "readme.md") {
    return "readme";
  }

  if (normalizedPath.includes("/design/")) {
    return "design";
  }

  if (normalizedPath.includes("/adr/")) {
    return "adr";
  }

  if (normalizedPath.includes("/docs/") || normalizedPath.includes("/doc/")) {
    return "docs";
  }

  if (normalizedPath.includes("runbook")) {
    return "runbook";
  }

  return "markdown";
}

/**
 * 去除 frontmatter 值两侧引号。
 */
function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
