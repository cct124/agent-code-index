import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, parse } from "node:path";
import { Writable } from "node:stream";

import pino, {
  destination,
  multistream,
  type Logger as PinoLogger,
} from "pino";
import pretty from "pino-pretty";

import type { LogFields, LogValue, Logger } from "@agent-code-index/core";

import type { LoggingConfig } from "./config.js";

const PRETTY_IGNORE_FIELDS = "pid,hostname";

/**
 * 基于运行时配置创建应用根 logger。
 */
export function createLogger(config: LoggingConfig): Logger {
  const streams = createStreams(config);

  return new PinoLoggerAdapter(
    pino(
      {
        level: config.level,
        base: undefined,
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
          level(label) {
            return { level: label };
          },
        },
      },
      streams,
    ),
  );
}

function createStreams(config: LoggingConfig) {
  if (!config.pretty && !config.filePath) {
    return undefined;
  }

  const streams: Array<{ stream: unknown }> = [
    {
      stream: createConsoleStream(config.pretty),
    },
  ];

  if (config.filePath) {
    ensureParentDirectory(config.filePath);
    streams.push({
      stream: createFileStream(config),
    });
  }

  return multistream(streams as Parameters<typeof multistream>[0]);
}

function createConsoleStream(usePretty: boolean) {
  if (!usePretty) {
    return destination({ dest: 1, sync: false });
  }

  return pretty({
    colorize: true,
    ignore: PRETTY_IGNORE_FIELDS,
    translateTime: "SYS:standard",
    destination: 1,
  });
}

function createFileStream(config: LoggingConfig) {
  if (!config.filePath) {
    throw new Error(
      "LOG_FILE_PATH must be provided when creating a file stream",
    );
  }

  const fileStream = config.fileRotateDaily
    ? new DailyRotatingFileStream({
        filePath: config.filePath,
        retentionDays: config.fileRetentionDays,
      })
    : destination({
        dest: config.filePath,
        mkdir: true,
        sync: true,
      });

  if (!config.filePretty) {
    return fileStream;
  }

  return pretty({
    colorize: false,
    ignore: PRETTY_IGNORE_FIELDS,
    translateTime: "SYS:standard",
    destination: fileStream,
  });
}

function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

interface DailyRotatingFileStreamOptions {
  filePath: string;
  retentionDays?: number;
}

class DailyRotatingFileStream extends Writable {
  private currentDayKey?: string;

  private readonly archivePattern: RegExp;

  public constructor(private readonly options: DailyRotatingFileStreamOptions) {
    super();
    ensureParentDirectory(options.filePath);
    this.archivePattern = createArchivePattern(options.filePath);
  }

  public override _write(
    chunk: string | Buffer,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    try {
      this.rotateIfNeeded();

      if (typeof chunk === "string") {
        appendFileSync(this.options.filePath, chunk, encoding);
      } else {
        appendFileSync(this.options.filePath, chunk);
      }

      callback();
    } catch (error) {
      callback(asError(error));
    }
  }

  private rotateIfNeeded(): void {
    const todayKey = toDayKey(new Date());

    if (this.currentDayKey === undefined) {
      this.archiveStaleActiveFile(todayKey);
      this.currentDayKey = todayKey;
      this.cleanupExpiredArchives(todayKey);
      return;
    }

    if (this.currentDayKey === todayKey) {
      return;
    }

    this.archiveActiveFile(this.currentDayKey);
    this.currentDayKey = todayKey;
    this.cleanupExpiredArchives(todayKey);
  }

  private archiveStaleActiveFile(todayKey: string): void {
    if (!existsSync(this.options.filePath)) {
      return;
    }

    const activeFileDayKey = toDayKey(statSync(this.options.filePath).mtime);

    if (activeFileDayKey === todayKey) {
      return;
    }

    this.archiveActiveFile(activeFileDayKey);
  }

  private archiveActiveFile(dayKey: string): void {
    if (!existsSync(this.options.filePath)) {
      return;
    }

    const archivePath = buildArchivePath(this.options.filePath, dayKey);

    if (existsSync(archivePath)) {
      appendFileSync(archivePath, readFileSync(this.options.filePath));
      rmSync(this.options.filePath);
      return;
    }

    renameSync(this.options.filePath, archivePath);
  }

  private cleanupExpiredArchives(todayKey: string): void {
    const { retentionDays } = this.options;

    if (retentionDays === undefined) {
      return;
    }

    const retentionCutoff = startOfDay(
      addDays(parseDayKey(todayKey), -(retentionDays - 1)),
    );
    const directoryPath = dirname(this.options.filePath);

    for (const entry of readdirSync(directoryPath)) {
      const match = entry.match(this.archivePattern);

      if (!match) {
        continue;
      }

      if (parseDayKey(match[1]) < retentionCutoff) {
        rmSync(join(directoryPath, entry), { force: true });
      }
    }
  }
}

function buildArchivePath(filePath: string, dayKey: string): string {
  const parsedPath = parse(filePath);
  return join(parsedPath.dir, `${parsedPath.name}.${dayKey}${parsedPath.ext}`);
}

function createArchivePattern(filePath: string): RegExp {
  const parsedPath = parse(filePath);
  return new RegExp(
    `^${escapeRegex(parsedPath.name)}\\.(\\d{4}-\\d{2}-\\d{2})${escapeRegex(parsedPath.ext)}$`,
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

/**
 * 将 pino logger 适配为 core 层统一的日志抽象。
 */
class PinoLoggerAdapter implements Logger {
  public constructor(private readonly logger: PinoLogger) {}

  public debug(message: string, fields?: LogFields): void {
    write(this.logger.debug.bind(this.logger), message, fields);
  }

  public info(message: string, fields?: LogFields): void {
    write(this.logger.info.bind(this.logger), message, fields);
  }

  public warn(message: string, fields?: LogFields): void {
    write(this.logger.warn.bind(this.logger), message, fields);
  }

  public error(message: string, fields?: LogFields): void {
    write(this.logger.error.bind(this.logger), message, fields);
  }

  public child(bindings: LogFields): Logger {
    return new PinoLoggerAdapter(
      this.logger.child(normalizeLogFields(bindings)),
    );
  }
}

function write(
  method: (...args: unknown[]) => void,
  message: string,
  fields?: LogFields,
): void {
  if (!fields || Object.keys(fields).length === 0) {
    method(message);
    return;
  }

  method(normalizeLogFields(fields), message);
}

function normalizeLogFields(fields: LogFields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      normalizeLogValue(value),
    ]),
  );
}

function normalizeLogValue(value: LogValue): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeLogValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        normalizeLogValue(nestedValue),
      ]),
    );
  }

  return value;
}

function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };

  const cause = (error as Error & { cause?: unknown }).cause;

  if (cause instanceof Error) {
    serialized.cause = serializeError(cause);
  } else if (cause !== undefined) {
    serialized.cause = cause;
  }

  for (const key of Object.getOwnPropertyNames(error)) {
    if (
      key === "name" ||
      key === "message" ||
      key === "stack" ||
      key === "cause"
    ) {
      continue;
    }

    serialized[key] = normalizeLogValue(
      (error as Error & Record<string, LogValue>)[key],
    );
  }

  return serialized;
}
