import { describe, expect, it } from "vitest";

import {
  classifySurrealError,
  createSurrealErrorLogFields,
  redactLogFields,
  sanitizeSurrealConnectionConfig,
} from "../../../src/storage/surreal/surreal-log-utils.js";

describe("surreal-log-utils", () => {
  it("classifies connection errors as retryable", () => {
    expect(
      classifySurrealError(new Error("ECONNREFUSED websocket closed")),
    ).toEqual(
      expect.objectContaining({
        errCode: "surreal_connection_error",
        retryable: true,
      }),
    );
  });

  it("redacts sensitive keys recursively", () => {
    expect(
      redactLogFields({
        token: "secret-token",
        password: "secret-password",
        nested: {
          apiKey: "secret-key",
          safe: "visible",
        },
      }),
    ).toEqual({
      token: "[REDACTED]",
      password: "[REDACTED]",
      nested: {
        apiKey: "[REDACTED]",
        safe: "visible",
      },
    });
  });

  it("creates sanitized connection summaries without leaking credentials", () => {
    expect(
      sanitizeSurrealConnectionConfig({
        url: "ws://127.0.0.1:8000/rpc",
        namespace: "demo_project",
        database: "default",
        username: "root",
        password: "root-password",
        token: "token-value",
        useTls: false,
        deploymentMode: "local",
      }),
    ).toEqual({
      url: "ws://127.0.0.1:8000/rpc",
      namespace: "demo_project",
      database: "default",
      useTls: false,
      deploymentMode: "local",
      authMode: "token",
    });
  });

  it("creates unified error log fields with errCode and httpStatus", () => {
    expect(
      createSurrealErrorLogFields(new Error("query failed with status 503"), {
        repositoryId: "repo-a",
      }),
    ).toEqual(
      expect.objectContaining({
        repositoryId: "repo-a",
        errCode: "surreal_server_error",
        retryable: true,
        httpStatus: 503,
      }),
    );
  });
});
