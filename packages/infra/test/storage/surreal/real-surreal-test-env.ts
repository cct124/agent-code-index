import type { SurrealConnectionConfig } from "../../../src/storage/surreal/surreal-client.js";

const REAL_TEST_FLAG = "RUN_REAL_SURREAL_INTEGRATION_TESTS";

export function isRealSurrealIntegrationEnabled(): boolean {
  return process.env[REAL_TEST_FLAG] === "true";
}

export function createRealSurrealConnectionConfig(
  namespace: string,
): SurrealConnectionConfig {
  return {
    url: requireEnv("SURREAL_URL"),
    namespace,
    database: process.env.SURREAL_DATABASE?.trim() || "default",
    username: optionalEnv("SURREAL_USERNAME"),
    password: optionalEnv("SURREAL_PASSWORD"),
    token: optionalEnv("SURREAL_TOKEN"),
    useTls: booleanEnv("SURREAL_USE_TLS", false),
    deploymentMode: deploymentModeEnv("SURREAL_DEPLOYMENT_MODE", "local"),
  };
}

export function createTestProjectSpace(
  prefix = "agent-code-index-test",
): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function namespaceFromProjectSpace(projectSpace: string): string {
  return projectSpace.replace(/-/g, "_");
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable for real integration test: ${key}`,
    );
  }

  return value;
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function booleanEnv(key: string, fallback: boolean): boolean {
  const value = optionalEnv(key);

  if (value === undefined) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Environment variable ${key} must be 'true' or 'false'`);
}

function deploymentModeEnv(
  key: string,
  fallback: "local" | "cloud",
): "local" | "cloud" {
  const value = optionalEnv(key);

  if (value === undefined) {
    return fallback;
  }

  if (value === "local" || value === "cloud") {
    return value;
  }

  throw new Error(`Environment variable ${key} must be 'local' or 'cloud'`);
}
