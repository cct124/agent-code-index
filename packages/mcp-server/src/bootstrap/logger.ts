import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import pino, {
  destination,
  multistream,
  type Logger as PinoLogger,
} from "pino";
import pretty from "pino-pretty";

import type { LogFields, Logger } from "@agent-code-index/core";

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

  const streams = [
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

  return multistream(streams);
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

  if (!config.filePretty) {
    return destination({
      dest: config.filePath,
      mkdir: true,
      sync: true,
    });
  }

  return pretty({
    colorize: false,
    ignore: PRETTY_IGNORE_FIELDS,
    translateTime: "SYS:standard",
    destination: config.filePath,
  });
}

function ensureParentDirectory(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
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
    return new PinoLoggerAdapter(this.logger.child(bindings));
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

  method(fields, message);
}
