import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger } from "../../src/bootstrap/logger.js";
import type { LoggingConfig } from "../../src/bootstrap/config.js";

const temporaryDirectories: string[] = [];

describe("createLogger", () => {
  afterEach(() => {
    vi.useRealTimers();

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

  it("rotates file logs daily and prunes expired archives", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T23:59:58"));

    const directory = mkdtempSync(join(tmpdir(), "agent-code-index-logger-"));
    temporaryDirectories.push(directory);

    const logsDirectory = join(directory, "logs");
    const filePath = join(logsDirectory, "agent-code-index.log");
    const expiredArchivePath = join(
      logsDirectory,
      "agent-code-index.2026-04-10.log",
    );
    const retainedArchivePath = join(
      logsDirectory,
      "agent-code-index.2026-04-13.log",
    );

    mkdirSync(logsDirectory, { recursive: true });
    writeFileSync(expiredArchivePath, "expired\n", "utf8");
    writeFileSync(retainedArchivePath, "retained\n", "utf8");

    const logger = createLogger(createLoggingConfig(filePath, false));

    logger.info("day one", {
      module: "logger-test",
    });

    expect(readFileSync(filePath, "utf8")).toContain('"msg":"day one"');

    vi.setSystemTime(new Date("2026-04-19T00:00:01"));

    logger.info("day two", {
      module: "logger-test",
    });

    expect(readFileSync(filePath, "utf8")).toContain('"msg":"day two"');
    expect(
      readFileSync(
        join(logsDirectory, "agent-code-index.2026-04-18.log"),
        "utf8",
      ),
    ).toContain('"msg":"day one"');
    expect(existsSync(expiredArchivePath)).toBe(false);
    expect(existsSync(retainedArchivePath)).toBe(true);
  });

  it("archives a stale active file on startup before writing new logs", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T09:00:00"));

    const directory = mkdtempSync(join(tmpdir(), "agent-code-index-logger-"));
    temporaryDirectories.push(directory);

    const filePath = join(directory, "logs", "agent-code-index.log");

    mkdirSync(join(directory, "logs"), { recursive: true });
    writeFileSync(filePath, '{"msg":"yesterday"}\n', "utf8");
    utimesSync(
      filePath,
      new Date("2026-04-18T20:00:00"),
      new Date("2026-04-18T20:00:00"),
    );

    const logger = createLogger(createLoggingConfig(filePath, false));

    logger.info("today", {
      module: "logger-test",
    });

    expect(
      readFileSync(
        join(directory, "logs", "agent-code-index.2026-04-18.log"),
        "utf8",
      ),
    ).toContain('"msg":"yesterday"');
    expect(readFileSync(filePath, "utf8")).toContain('"msg":"today"');
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
    fileRotateDaily: true,
    fileRetentionDays: 7,
  };
}
