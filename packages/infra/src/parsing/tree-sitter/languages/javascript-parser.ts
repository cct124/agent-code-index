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
    const pendingDefaultExports = new Set<string>();

    for (const node of rootNode.namedChildren) {
      this.collectTopLevelNode(input, node, chunks, pendingDefaultExports);
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
    pendingDefaultExports: Set<string>,
  ): void {
    const exportState = extractExportState(node);
    const targetNode = exportState.node;

    switch (targetNode.type) {
      case "class_declaration": {
        chunks.push(
          ...this.collectClassChunks(
            input,
            targetNode,
            exportState,
            pendingDefaultExports,
          ),
        );
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
              tags: mergeTags(
                exportTags(exportState),
                resolvePendingDefaultExportTags(name, pendingDefaultExports),
                asyncTags(targetNode),
              ),
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
              tags: mergeTags(exportTags(exportState), asyncTags(targetNode)),
            }),
          );
        }
        return;
      }
      case "lexical_declaration":
      case "variable_declaration": {
        chunks.push(
          ...this.collectVariableFunctionChunks(
            input,
            targetNode,
            exportState,
            pendingDefaultExports,
          ),
        );
        return;
      }
      case "identifier": {
        if (exportState.isDefault) {
          applyDefaultExportToExistingChunks(
            chunks,
            targetNode.text,
            pendingDefaultExports,
          );
        }
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
    pendingDefaultExports: Set<string>,
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
      tags: mergeTags(
        exportTags(exportState),
        resolvePendingDefaultExportTags(className, pendingDefaultExports),
      ),
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
              tags: methodTags(member, methodKind),
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
              tags: fieldTags(member, fieldName),
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
              tags: fieldTags(member, fieldName),
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
              tags: mergeTags(
                fieldTags(member, fieldName),
                asyncTags(valueNode),
              ),
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
    pendingDefaultExports: Set<string>,
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
          tags: mergeTags(
            exportTags(exportState),
            resolvePendingDefaultExportTags(name, pendingDefaultExports),
            asyncTags(valueNode),
          ),
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
  const name = member.childForFieldName("name")?.text;

  if (name === "constructor") {
    return "constructor";
  }

  if (member.children.some((child) => child.type === "get")) {
    return "getter";
  }

  if (member.children.some((child) => child.type === "set")) {
    return "setter";
  }

  return "method";
}

function methodTags(member: SyntaxNode, kind: string): string[] | undefined {
  return mergeTags(kindTags(kind), memberModifierTags(member));
}

function fieldTags(
  member: SyntaxNode,
  fieldName: string,
): string[] | undefined {
  const tags: string[] = [];

  if (fieldName.startsWith("#")) {
    tags.push("private");
  }

  if (member.children.some((child) => child.type === "static")) {
    tags.push("static");
  }

  return tags.length > 0 ? tags : undefined;
}

function exportTags(exportState: ExportState): string[] | undefined {
  if (exportState.isDefault) {
    return ["export", "default"];
  }

  return undefined;
}

function kindTags(kind: string): string[] | undefined {
  if (kind === "getter" || kind === "setter" || kind === "constructor") {
    return [kind];
  }

  return undefined;
}

function memberModifierTags(member: SyntaxNode): string[] | undefined {
  const tags: string[] = [];

  if (member.children.some((child) => child.type === "static")) {
    tags.push("static");
  }

  if (member.children.some((child) => child.type === "async")) {
    tags.push("async");
  }

  return tags.length > 0 ? tags : undefined;
}

function asyncTags(node: SyntaxNode): string[] | undefined {
  if (node.children.some((child) => child.type === "async")) {
    return ["async"];
  }

  return undefined;
}

function mergeTags(
  ...tagLists: Array<string[] | undefined>
): string[] | undefined {
  const merged = [...new Set(tagLists.flatMap((tags) => tags ?? []))];

  return merged.length > 0 ? merged : undefined;
}

function resolvePendingDefaultExportTags(
  symbolName: string,
  pendingDefaultExports: Set<string>,
): string[] | undefined {
  if (!pendingDefaultExports.has(symbolName)) {
    return undefined;
  }

  pendingDefaultExports.delete(symbolName);

  return ["export", "default"];
}

function applyDefaultExportToExistingChunks(
  chunks: Chunk[],
  symbolName: string,
  pendingDefaultExports: Set<string>,
): void {
  const matchingChunks = chunks.filter(
    (chunk) =>
      chunk.metadata.parentSymbol === undefined &&
      chunk.metadata.symbolName === symbolName,
  );

  if (matchingChunks.length === 0) {
    pendingDefaultExports.add(symbolName);
    return;
  }

  for (const chunk of matchingChunks) {
    chunk.metadata.tags = mergeTags(chunk.metadata.tags, ["export", "default"]);
  }
}
