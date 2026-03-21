const REAL_EMBEDDING_TEST_FLAG = "RUN_REAL_EMBEDDING_INTEGRATION_TESTS";

export function isRealEmbeddingIntegrationEnabled(): boolean {
  return process.env[REAL_EMBEDDING_TEST_FLAG] === "true";
}

export function requireEmbeddingEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(
      `Missing required environment variable for real embedding integration test: ${key}`,
    );
  }

  return value;
}

export function optionalEmbeddingEnv(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}
