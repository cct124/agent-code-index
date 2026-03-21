import { extname } from "node:path";

import type { Chunk, Logger, ParseInput } from "@agent-code-index/core";
import { type SyntaxNode } from "tree-sitter";
import TypeScriptLanguage from "tree-sitter-typescript";

import {
  TreeSitterParser,
  type TreeSitterParserOptions,
} from "../tree-sitter-parser.js";

/**
 * TypeScript/TSX 语义解析器。
 */
export class TypeScriptTreeSitterParser extends TreeSitterParser {
  /**
   * 初始化 TypeScript parser。
   */
  public constructor(
    fileExtension: ".ts" | ".tsx" = ".ts",
    options: TreeSitterParserOptions = {},
    logger?: Logger,
  ) {
    super(
      fileExtension === ".tsx"
        ? TypeScriptLanguage.tsx
        : TypeScriptLanguage.typescript,
      options,
      logger,
    );
  }

  /**
   * 提取 TypeScript 中的类、函数和方法语义块。
   */
  protected collectChunks(input: ParseInput, rootNode: SyntaxNode): Chunk[] {
    const chunks: Chunk[] = [];

    for (const node of rootNode.namedChildren) {
      this.collectTopLevelNode(input, node, chunks);
    }

    return chunks;
  }

  /**
   * 处理顶层语义节点。
   */
  private collectTopLevelNode(
    input: ParseInput,
    node: SyntaxNode,
    chunks: Chunk[],
  ): void {
    const targetNode = unwrapExport(node);

    switch (targetNode.type) {
      case "class_declaration": {
        chunks.push(...this.collectClassChunks(input, targetNode));
        return;
      }
      case "function_declaration": {
        const name = targetNode.childForFieldName("name")?.text;

        if (name) {
          chunks.push(
            ...this.createChunksForNode(input, targetNode, {
              symbolName: name,
              symbolKind: "function",
            }),
          );
        }
        return;
      }
      case "lexical_declaration":
      case "variable_statement": {
        chunks.push(...this.collectVariableFunctionChunks(input, targetNode));
        return;
      }
      default:
        return;
    }
  }

  /**
   * 提取类与类成员语义块。
   */
  private collectClassChunks(
    input: ParseInput,
    classNode: SyntaxNode,
  ): Chunk[] {
    const className = classNode.childForFieldName("name")?.text;

    if (!className) {
      return [];
    }

    const chunks = this.createChunksForNode(input, classNode, {
      symbolName: className,
      symbolKind: "class",
    });
    const bodyNode = classNode.childForFieldName("body");

    if (!bodyNode) {
      return chunks;
    }

    for (const member of bodyNode.namedChildren) {
      if (member.type === "method_definition") {
        const methodName = member.childForFieldName("name")?.text;

        if (methodName) {
          chunks.push(
            ...this.createChunksForNode(input, member, {
              symbolName: methodName,
              symbolKind: "method",
              parentSymbol: className,
            }),
          );
        }
        continue;
      }

      if (member.type === "public_field_definition") {
        const fieldName = member.childForFieldName("name")?.text;
        const valueNode = member.childForFieldName("value");

        if (
          fieldName &&
          valueNode &&
          (valueNode.type === "arrow_function" ||
            valueNode.type === "function_expression")
        ) {
          chunks.push(
            ...this.createChunksForNode(input, member, {
              symbolName: fieldName,
              symbolKind: "method",
              parentSymbol: className,
            }),
          );
        }
      }
    }

    return chunks;
  }

  /**
   * 提取顶层变量中承载函数值的语义块。
   */
  private collectVariableFunctionChunks(
    input: ParseInput,
    node: SyntaxNode,
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const child of node.namedChildren) {
      if (child.type !== "variable_declarator") {
        continue;
      }

      const name = child.childForFieldName("name")?.text;
      const valueNode = child.childForFieldName("value");

      if (
        !name ||
        !valueNode ||
        (valueNode.type !== "arrow_function" &&
          valueNode.type !== "function_expression")
      ) {
        continue;
      }

      chunks.push(
        ...this.createChunksForNode(input, child, {
          symbolName: name,
          symbolKind: "function",
        }),
      );
    }

    return chunks;
  }
}

/**
 * 展开 export_statement，返回真实语义节点。
 */
function unwrapExport(node: SyntaxNode): SyntaxNode {
  if (node.type === "export_statement") {
    return (
      node.namedChildren.find((child) => child.type !== "decorator") ?? node
    );
  }

  return node;
}
