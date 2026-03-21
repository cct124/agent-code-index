import type { LogFields, LogValue } from "@agent-code-index/core";

import type { SurrealConnectionConfig } from "./surreal-client.js";

const REDACTED_VALUE = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(password|token|secret|authorization|api[_-]?key|credential)/i;

/**
 * 统一的 Surreal 错误分类结果。
 */
export interface ClassifiedSurrealError {
  /** 原始错误对象。 */
  error: Error;
  /** 统一错误码。 */
  errCode: string;
  /** 是否建议上层将其视为可重试错误。 */
  retryable: boolean;
  /** 若可提取则附带 HTTP 状态码。 */
  httpStatus?: number;
}

/**
 * 生成可安全输出到日志的 Surreal 连接摘要。
 */
export function sanitizeSurrealConnectionConfig(
  config: SurrealConnectionConfig,
): LogFields {
  return {
    url: config.url,
    namespace: config.namespace,
    database: config.database,
    useTls: config.useTls,
    deploymentMode: config.deploymentMode,
    authMode: config.token
      ? "token"
      : config.username && config.password
        ? "username-password"
        : "none",
  };
}

/**
 * 对任意结构化日志字段执行递归脱敏。
 */
export function redactLogFields(fields: LogFields): LogFields {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      redactValue(key, value),
    ]),
  );
}

/**
 * 将未知对象收敛为可记录的结构化日志字段，并执行脱敏。
 */
export function normalizeUnknownLogFields(
  fields?: Record<string, unknown>,
): LogFields {
  if (!fields) {
    return {};
  }

  return redactLogFields(
    Object.fromEntries(
      Object.entries(fields).map(([key, value]) => [
        key,
        normalizeUnknownValue(value),
      ]),
    ),
  );
}

/**
 * 将错误统一映射为可记录的 errCode / retryable / httpStatus。
 */
export function classifySurrealError(error: unknown): ClassifiedSurrealError {
  const normalized =
    error instanceof Error
      ? error
      : new Error(String(error ?? "Unknown error"));
  const message = normalized.message.toLowerCase();
  const httpStatus = extractHttpStatus(normalized.message);

  if (httpStatus === 429) {
    return {
      error: normalized,
      errCode: "surreal_rate_limited",
      retryable: true,
      httpStatus,
    };
  }

  if (httpStatus && httpStatus >= 500) {
    return {
      error: normalized,
      errCode: "surreal_server_error",
      retryable: true,
      httpStatus,
    };
  }

  if (
    httpStatus === 401 ||
    httpStatus === 403 ||
    /signin|authenticate|unauthorized|forbidden|credential|password|token|auth/.test(
      message,
    )
  ) {
    return {
      error: normalized,
      errCode: "surreal_auth_error",
      retryable: false,
      httpStatus,
    };
  }

  if (
    /econnrefused|enotfound|etimedout|socket|connection|websocket|network|broken pipe/.test(
      message,
    )
  ) {
    return {
      error: normalized,
      errCode: "surreal_connection_error",
      retryable: true,
      httpStatus,
    };
  }

  if (/query|parse|filter|record|namespace|database/.test(message)) {
    return {
      error: normalized,
      errCode: "surreal_query_error",
      retryable: false,
      httpStatus,
    };
  }

  return {
    error: normalized,
    errCode: "surreal_operation_error",
    retryable: false,
    httpStatus,
  };
}

/**
 * 生成统一的错误日志字段，并附带脱敏后的上下文。
 */
export function createSurrealErrorLogFields(
  error: unknown,
  context: LogFields = {},
): LogFields {
  const classified = classifySurrealError(error);

  return redactLogFields({
    ...context,
    error: classified.error,
    errCode: classified.errCode,
    retryable: classified.retryable,
    httpStatus: classified.httpStatus,
  });
}

function redactValue(key: string, value: LogValue): LogValue {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return REDACTED_VALUE;
  }

  if (value instanceof Error) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(key, item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactValue(childKey, childValue),
      ]),
    );
  }

  return value;
}

function normalizeUnknownValue(value: unknown): LogValue {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value instanceof Error
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnknownValue(item));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, childValue]) => [key, normalizeUnknownValue(childValue)],
      ),
    );
  }

  return String(value);
}

function extractHttpStatus(message: string): number | undefined {
  const match = message.match(/status(?: code)?[^0-9]*(\d{3})/i);

  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}
