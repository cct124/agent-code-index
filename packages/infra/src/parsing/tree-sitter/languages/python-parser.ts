import type { Chunk, Logger, ParseInput } from "@agent-code-index/core";
import { type SyntaxNode } from "tree-sitter";
import PythonLanguage from "tree-sitter-python";

import {
  TreeSitterParser,
  type TreeSitterParserOptions,
} from "../tree-sitter-parser.js";

/**
 * Python 语义解析器。
 */
export class PythonTreeSitterParser extends TreeSitterParser {
  /**
   * 初始化 Python parser。
   */
  public constructor(options: TreeSitterParserOptions = {}, logger?: Logger) {
    super(PythonLanguage, options, logger);
  }

  /**
   * 提取 Python 中的类、函数和方法语义块。
   */
  protected collectChunks(input: ParseInput, rootNode: SyntaxNode): Chunk[] {
    const chunks: Chunk[] = [];

    for (const node of rootNode.namedChildren) {
      const targetNode = unwrapDecoratedDefinition(node);
      const definitionMetadata = extractDefinitionMetadata(node, targetNode);

      switch (targetNode.type) {
        case "class_definition": {
          chunks.push(
            ...this.collectClassChunks(input, targetNode, definitionMetadata),
          );
          break;
        }
        case "function_definition": {
          const name = targetNode.childForFieldName("name")?.text;

          if (name) {
            chunks.push(
              ...this.createChunksForNode(input, targetNode, {
                symbolName: name,
                symbolKind: "function",
                ...metadataFieldsForDefinition(definitionMetadata, "function"),
              }),
            );
          }
          break;
        }
        default:
          break;
      }
    }

    return chunks;
  }

  /**
   * 提取类与类方法语义块。
   */
  private collectClassChunks(
    input: ParseInput,
    classNode: SyntaxNode,
    definitionMetadata: DefinitionMetadata,
  ): Chunk[] {
    const className = classNode.childForFieldName("name")?.text;

    if (!className) {
      return [];
    }

    const chunks = this.createChunksForNode(input, classNode, {
      symbolName: className,
      symbolKind: "class",
      ...metadataFieldsForDefinition(definitionMetadata, "class"),
    });
    const bodyNode = classNode.childForFieldName("body");

    if (!bodyNode) {
      return chunks;
    }

    const seenFieldNames = new Set<string>();

    for (const child of bodyNode.namedChildren) {
      const member = unwrapDecoratedDefinition(child);
      const memberMetadata = extractDefinitionMetadata(child, member);

      if (member.type !== "function_definition") {
        continue;
      }

      const methodName = member.childForFieldName("name")?.text;
      const symbolKind = symbolKindForFunction(memberMetadata.decorators, true);

      if (!methodName) {
        continue;
      }

      chunks.push(
        ...this.createChunksForNode(input, member, {
          symbolName: methodName,
          symbolKind,
          parentSymbol: className,
          ...metadataFieldsForDefinition(memberMetadata, symbolKind),
        }),
      );

      for (const assignment of collectSelfFieldAssignments(member)) {
        const fieldName = selfFieldNameFromAssignment(assignment);

        if (!fieldName || seenFieldNames.has(fieldName)) {
          continue;
        }

        seenFieldNames.add(fieldName);
        chunks.push(
          ...this.createChunksForNode(input, assignment, {
            symbolName: fieldName,
            symbolKind: "field",
            parentSymbol: className,
            definedBy: methodName,
            tags: fieldTags(fieldName),
          }),
        );
      }
    }

    return chunks;
  }
}

interface DefinitionMetadata {
  decorators: string[];
  isAsync: boolean;
}

/**
 * 展开 Python decorator 包裹节点。
 */
function unwrapDecoratedDefinition(node: SyntaxNode): SyntaxNode {
  if (node.type !== "decorated_definition") {
    return node;
  }

  return (
    node.namedChildren.find(
      (child) =>
        child.type === "class_definition" ||
        child.type === "function_definition",
    ) ?? node
  );
}

function extractDefinitionMetadata(
  originalNode: SyntaxNode,
  definitionNode: SyntaxNode,
): DefinitionMetadata {
  const decorators =
    originalNode.type === "decorated_definition"
      ? originalNode.namedChildren
          .filter((child) => child.type === "decorator")
          .map((decorator) => decorator.text.replace(/^@/, ""))
      : [];

  return {
    decorators,
    isAsync: definitionNode.children.some((child) => child.type === "async"),
  };
}

function metadataFieldsForDefinition(
  definitionMetadata: DefinitionMetadata,
  symbolKind: string,
): Record<string, unknown> {
  const tags = definitionTags(definitionMetadata, symbolKind);

  return {
    decorators:
      definitionMetadata.decorators.length > 0
        ? definitionMetadata.decorators
        : undefined,
    isAsync: definitionMetadata.isAsync || undefined,
    tags: tags.length > 0 ? tags : undefined,
  };
}

function definitionTags(
  definitionMetadata: DefinitionMetadata,
  symbolKind: string,
): string[] {
  const tags = new Set<string>();

  if (definitionMetadata.isAsync) {
    tags.add("async");
  }

  if (symbolKind === "getter" || symbolKind === "setter") {
    tags.add("property");
    tags.add(symbolKind);
  }

  if (definitionMetadata.decorators.includes("classmethod")) {
    tags.add("classmethod");
  }

  if (definitionMetadata.decorators.includes("staticmethod")) {
    tags.add("staticmethod");
  }

  return [...tags];
}

function symbolKindForFunction(
  decorators: string[],
  isMethod: boolean,
): string {
  if (isMethod && decorators.includes("property")) {
    return "getter";
  }

  if (
    isMethod &&
    decorators.some((decorator) => decorator.endsWith(".setter"))
  ) {
    return "setter";
  }

  return isMethod ? "method" : "function";
}

function collectSelfFieldAssignments(functionNode: SyntaxNode): SyntaxNode[] {
  const bodyNode = functionNode.childForFieldName("body");

  if (!bodyNode) {
    return [];
  }

  const assignments: SyntaxNode[] = [];
  const visit = (node: SyntaxNode): void => {
    for (const child of node.namedChildren) {
      if (
        child.type === "function_definition" ||
        child.type === "class_definition" ||
        child.type === "lambda"
      ) {
        continue;
      }

      if (child.type === "assignment" && selfFieldNameFromAssignment(child)) {
        assignments.push(child);
      }

      visit(child);
    }
  };

  visit(bodyNode);

  return assignments;
}

function selfFieldNameFromAssignment(node: SyntaxNode): string | undefined {
  const leftNode = node.childForFieldName("left");

  if (leftNode?.type !== "attribute") {
    return undefined;
  }

  const [ownerNode, fieldNode] = leftNode.namedChildren;

  if (ownerNode?.type !== "identifier" || ownerNode.text !== "self") {
    return undefined;
  }

  return fieldNode?.text;
}

function fieldTags(fieldName: string): string[] {
  const tags = ["instance-field"];

  if (fieldName.startsWith("_")) {
    tags.push("private");
  }

  return tags;
}
