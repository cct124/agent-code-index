import type { Chunk, Logger, ParseInput } from "@agent-code-index/core";
import { type SyntaxNode } from "tree-sitter";
import JavaScriptLanguage from "tree-sitter-javascript";

import {
  TreeSitterParser,
  type TreeSitterParserOptions,
} from "../tree-sitter-parser.js";

/**
 * JavaScript/JSX 语义解析器。
 */
export class JavaScriptTreeSitterParser extends TreeSitterParser {
  /**
   * 初始化 JavaScript parser。
   */
  public constructor(
    fileExtension: ".js" | ".jsx" = ".js",
    options: TreeSitterParserOptions = {},
    logger?: Logger,
  ) {
    super(JavaScriptLanguage, options, logger);
  }

  /**
   * 提取 JavaScript 中的类、函数和方法语义块。
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
    const exportState = extractExportState(node);
    const targetNode = exportState.node;

    switch (targetNode.type) {
      case "class_declaration": {
        chunks.push(...this.collectClassChunks(input, targetNode, exportState));
        return;
      }
      case "function_declaration": {
        const name =
          targetNode.childForFieldName("name")?.text ??
          (exportState.isDefault ? "default" : undefined);

        if (name) {
          chunks.push(
            ...this.createChunksForNode(input, targetNode, {
              symbolName: name,
              symbolKind: "function",
              tags: exportTags(exportState),
            }),
          );
        }
        return;
      }
      case "arrow_function":
      case "function_expression": {
        if (exportState.isDefault) {
          chunks.push(
            ...this.createChunksForNode(input, targetNode, {
              symbolName: "default",
              symbolKind: "function",
              tags: exportTags(exportState),
            }),
          );
        }
        return;
      }
      case "lexical_declaration":
      case "variable_declaration": {
        chunks.push(
          ...this.collectVariableFunctionChunks(input, targetNode, exportState),
        );
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
    exportState: ExportState,
  ): Chunk[] {
    const className =
      classNode.childForFieldName("name")?.text ??
      (exportState.isDefault ? "default" : undefined);

    if (!className) {
      return [];
    }

    const chunks = this.createChunksForNode(input, classNode, {
      symbolName: className,
      symbolKind: "class",
      tags: exportTags(exportState),
    });
    const bodyNode = classNode.childForFieldName("body");

    if (!bodyNode) {
      return chunks;
    }

    for (const member of bodyNode.namedChildren) {
      if (member.type === "method_definition") {
        const methodName = member.childForFieldName("name")?.text;
        const methodKind = methodKindForMember(member);

        if (methodName) {
          chunks.push(
            ...this.createChunksForNode(input, member, {
              symbolName: methodName,
              symbolKind: methodKind,
              parentSymbol: className,
              tags: methodTags(methodKind),
            }),
          );
        }
        continue;
      }

      if (
        member.type === "field_definition" ||
        member.type === "public_field_definition"
      ) {
        const fieldName = fieldNameForMember(member);
        const valueNode = member.childForFieldName("value");

        if (fieldName && isPrivateField(fieldName)) {
          chunks.push(
            ...this.createChunksForNode(input, member, {
              symbolName: fieldName,
              symbolKind: "field",
              parentSymbol: className,
              tags: ["private"],
            }),
          );
          continue;
        }

        if (fieldName && valueNode && !isFunctionValue(valueNode)) {
          chunks.push(
            ...this.createChunksForNode(input, member, {
              symbolName: fieldName,
              symbolKind: "field",
              parentSymbol: className,
            }),
          );
          continue;
        }

        if (fieldName && valueNode && isFunctionValue(valueNode)) {
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
    exportState: ExportState,
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (const child of node.namedChildren) {
      if (child.type !== "variable_declarator") {
        continue;
      }

      const name = child.childForFieldName("name")?.text;
      const valueNode = child.childForFieldName("value");

      if (!name || !valueNode || !isFunctionValue(valueNode)) {
        continue;
      }

      chunks.push(
        ...this.createChunksForNode(input, child, {
          symbolName: name,
          symbolKind: "function",
          tags: exportTags(exportState),
        }),
      );
    }

    return chunks;
  }
}

/**
 * 导出状态。
 */
interface ExportState {
  node: SyntaxNode;
  isDefault: boolean;
}

/**
 * 展开 export_statement，并提取是否为 default export。
 */
function extractExportState(node: SyntaxNode): ExportState {
  if (node.type !== "export_statement") {
    return {
      node,
      isDefault: false,
    };
  }

  return {
    node: node.namedChildren[0] ?? node,
    isDefault: node.text.startsWith("export default"),
  };
}

function isFunctionValue(node: SyntaxNode): boolean {
  return node.type === "arrow_function" || node.type === "function_expression";
}

function isPrivateField(fieldName: string): boolean {
  return fieldName.startsWith("#");
}

function fieldNameForMember(member: SyntaxNode): string | undefined {
  return (
    member.childForFieldName("name")?.text ??
    member.namedChildren.find(
      (child) =>
        child.type === "property_identifier" ||
        child.type === "private_property_identifier",
    )?.text
  );
}

function methodKindForMember(member: SyntaxNode): string {
  if (member.children.some((child) => child.type === "get")) {
    return "getter";
  }

  if (member.children.some((child) => child.type === "set")) {
    return "setter";
  }

  return "method";
}

function methodTags(kind: string): string[] | undefined {
  if (kind === "getter" || kind === "setter") {
    return [kind];
  }

  return undefined;
}

function exportTags(exportState: ExportState): string[] | undefined {
  if (exportState.isDefault) {
    return ["export", "default"];
  }

  return undefined;
}
