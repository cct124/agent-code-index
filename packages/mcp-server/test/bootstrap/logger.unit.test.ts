import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createLogger } from "../../src/bootstrap/logger.js";
import type { LoggingConfig } from "../../src/bootstrap/config.js";

const temporaryDirectories: string[] = [];

describe("createLogger", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("writes structured JSON logs to a file when LOG_FILE_PATH is configured", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-code-index-logger-"));
    temporaryDirectories.push(directory);

    const filePath = join(directory, "logs", "agent-code-index.log");
    const logger = createLogger(createLoggingConfig(filePath, false));

    logger.info("File logging works", {
      module: "logger-test",
      repositoryId: "repo-a",
    });

    await expect
      .poll(() => readFileSync(filePath, "utf8"))
      .toContain('"msg":"File logging works"');
    await expect
      .poll(() => readFileSync(filePath, "utf8"))
      .toContain('"module":"logger-test"');
  });

  it("writes pretty logs to a file when LOG_FILE_PRETTY is enabled", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-code-index-logger-"));
    temporaryDirectories.push(directory);

    const filePath = join(directory, "logs", "agent-code-index.pretty.log");
    const logger = createLogger(createLoggingConfig(filePath, true));

    logger.warn("Pretty file logging works", {
      module: "logger-test",
    });

    await expect
      .poll(() => readFileSync(filePath, "utf8"))
      .toContain("Pretty file logging works");
  });

  it("serializes error fields with message and stack", async () => {
    const directory = mkdtempSync(join(tmpdir(), "agent-code-index-logger-"));
    temporaryDirectories.push(directory);

    const filePath = join(directory, "logs", "agent-code-index.error.log");
    const logger = createLogger(createLoggingConfig(filePath, false));

    logger.error("Application startup failed", {
      module: "logger-test",
      error: new Error("metadata mismatch"),
    });

    await expect
      .poll(() => readFileSync(filePath, "utf8"))
      .toContain('"message":"metadata mismatch"');
    await expect
      .poll(() => readFileSync(filePath, "utf8"))
      .toContain('"stack":"Error: metadata mismatch');
  });
});

function createLoggingConfig(
  filePath: string,
  filePretty: boolean,
): LoggingConfig {
  return {
    level: "info",
    pretty: false,
    filePath,
    filePretty,
  };
}
