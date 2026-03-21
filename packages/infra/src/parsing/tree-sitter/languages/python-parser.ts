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

      switch (targetNode.type) {
        case "class_definition": {
          chunks.push(...this.collectClassChunks(input, targetNode));
          break;
        }
        case "function_definition": {
          const name = targetNode.childForFieldName("name")?.text;

          if (name) {
            chunks.push(
              ...this.createChunksForNode(input, targetNode, {
                symbolName: name,
                symbolKind: "function",
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

    for (const child of bodyNode.namedChildren) {
      const member = unwrapDecoratedDefinition(child);

      if (member.type !== "function_definition") {
        continue;
      }

      const methodName = member.childForFieldName("name")?.text;

      if (!methodName) {
        continue;
      }

      chunks.push(
        ...this.createChunksForNode(input, member, {
          symbolName: methodName,
          symbolKind: "method",
          parentSymbol: className,
        }),
      );
    }

    return chunks;
  }
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
