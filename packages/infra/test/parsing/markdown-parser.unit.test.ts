import { describe, expect, it } from "vitest";

import { MarkdownParser } from "../../src/parsing/markdown/markdown-parser.js";

describe("MarkdownParser", () => {
  it("splits markdown into heading-based sections and captures metadata", async () => {
    const parser = new MarkdownParser();

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "docs/guide.md",
      content: [
        "---",
        "docType: runbook",
        "owner: platform",
        "---",
        "Intro paragraph before headings.",
        "# Overview",
        "System overview.",
        "## Details",
        "Detailed explanation.",
      ].join("\n"),
    });

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toEqual(
      expect.objectContaining({
        filePath: "docs/guide.md",
        language: "markdown",
        startLine: 5,
        endLine: 5,
        metadata: expect.objectContaining({
          docType: "runbook",
          frontmatter: {
            docType: "runbook",
            owner: "platform",
          },
        }),
      }),
    );
    expect(chunks[1]).toEqual(
      expect.objectContaining({
        startLine: 6,
        endLine: 7,
        metadata: expect.objectContaining({
          heading: "Overview",
          headingPath: ["Overview"],
          sectionLevel: 1,
          docType: "runbook",
        }),
      }),
    );
    expect(chunks[2]).toEqual(
      expect.objectContaining({
        startLine: 8,
        endLine: 9,
        metadata: expect.objectContaining({
          heading: "Details",
          headingPath: ["Overview", "Details"],
          sectionLevel: 2,
        }),
      }),
    );
  });

  it("derives docType from file path when frontmatter is absent", async () => {
    const parser = new MarkdownParser();

    const chunks = await parser.parse({
      repositoryId: "repo-a",
      filePath: "design/README.md",
      content: ["# Design", "Document body."].join("\n"),
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.metadata.docType).toBe("readme");
  });
});
