/**
 * 运行时配置模型与环境变量加载逻辑。
 */
/**
 * SurrealDB 的部署模式。
 */
export type SurrealDeploymentMode = "local" | "cloud";

/**
 * SurrealDB 连接所需的运行时配置。
 */
export interface SurrealConfig {
  /** SurrealDB 服务地址。 */
  url: string;
  /** 逻辑项目空间派生出的 SurrealDB namespace。 */
  namespace: string;
  /** SurrealDB database。 */
  database: string;
  /** 用户名认证方式下的用户名。 */
  username?: string;
  /** 用户名认证方式下的密码。 */
  password?: string;
  /** Token 认证方式下的访问令牌。 */
  token?: string;
  /** 是否通过 TLS 连接 SurrealDB。 */
  useTls: boolean;
  /** 当前使用的是本地部署还是云端部署。 */
  deploymentMode: SurrealDeploymentMode;
}

/**
 * Embedding 服务提供方。
 */
export type EmbeddingProvider = "voyage" | "openai-compatible";

/**
 * Embedding 服务配置。
 */
export interface EmbeddingConfig {
  /** 当前项目使用的 embedding provider。 */
  provider: EmbeddingProvider;
  /** 当前项目绑定的 embedding 模型名称。 */
  model: string;
  /** 向量维度，用于与存储层索引结构保持一致。 */
  vectorDimension: number;
  /** 调用 embedding 服务的访问密钥。 */
  apiKey?: string;
  /** 第三方 embedding 服务的可选基础地址。 */
  baseUrl?: string;
}

/**
 * 索引链路默认参数配置。
 */
export interface IndexingConfig {
  /** 默认检索返回数量。 */
  defaultTopK: number;
  /** 扫描仓库时默认忽略的路径模式。 */
  ignorePatterns: string[];
  /** native HNSW 路径的候选窗口倍数。 */
  nativeCandidateMultiplier: number;
  /** native HNSW 路径的最小 efSearch。 */
  nativeEfSearchMin: number;
}

/**
 * MCP adapter 层默认行为配置。
 */
export interface McpConfig {
  /**
   * 单仓库部署时可使用的默认逻辑仓库标识。
   *
   * 该字段仅用于 adapter 回填 tool 输入，不改变 core 层 repositoryId 必填约束。
   */
  defaultRepositoryId?: string;
}

/**
 * 日志输出配置。
 */
export interface LoggingConfig {
  /** 当前最小日志级别。 */
  level: "debug" | "info" | "warn" | "error";
  /** 是否启用开发态 pretty 输出。 */
  pretty: boolean;
}

/**
 * 应用完整运行时配置对象。
 */
export interface AppConfig {
  /** MCP 当前绑定的逻辑项目空间。 */
  projectSpace: string;
  /** SurrealDB 相关配置。 */
  surreal: SurrealConfig;
  /** Embedding 相关配置。 */
  embedding: EmbeddingConfig;
  /** 索引过程默认参数。 */
  indexing: IndexingConfig;
  /** MCP adapter 默认行为配置。 */
  mcp: McpConfig;
  /** 日志配置。 */
  logging: LoggingConfig;
}

/**
 * 环境变量键值集合。
 */
type EnvMap = Record<string, string | undefined>;

/**
 * 从环境变量中加载并校验应用运行时配置。
 */
export function loadConfig(env: EnvMap = process.env): AppConfig {
  const projectSpace = projectSpaceEnv(env, "PROJECT_SPACE");
  const namespace = namespaceFromProjectSpace(projectSpace);

  const surreal: SurrealConfig = {
    url: requireEnv(env, "SURREAL_URL"),
    namespace,
    database: requireEnv(env, "SURREAL_DATABASE"),
    username: optionalEnv(env, "SURREAL_USERNAME"),
    password: optionalEnv(env, "SURREAL_PASSWORD"),
    token: optionalEnv(env, "SURREAL_TOKEN"),
    useTls: booleanEnv(env, "SURREAL_USE_TLS", false),
    deploymentMode: deploymentModeEnv(env, "SURREAL_DEPLOYMENT_MODE", "local"),
  };

  validateSurrealAuth(surreal);

  const embeddingProvider = embeddingProviderEnv(
    env,
    "EMBEDDING_PROVIDER",
    "voyage",
  );

  const embedding: EmbeddingConfig = {
    provider: embeddingProvider,
    model:
      optionalEnv(env, "EMBEDDING_MODEL") ??
      defaultEmbeddingModelForProvider(embeddingProvider),
    vectorDimension: integerEnv(env, "EMBEDDING_VECTOR_DIMENSION"),
    apiKey: optionalEnv(env, "EMBEDDING_API_KEY"),
    baseUrl: optionalEnv(env, "EMBEDDING_BASE_URL"),
  };

  validateEmbeddingConfig(embedding);

  return {
    projectSpace,
    surreal,
    embedding,
    indexing: {
      defaultTopK: integerEnv(env, "DEFAULT_TOP_K", 10),
      ignorePatterns: csvEnv(env, "DEFAULT_SCAN_IGNORE_PATTERNS", [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
      ]),
      nativeCandidateMultiplier: integerEnv(
        env,
        "SEARCH_NATIVE_CANDIDATE_MULTIPLIER",
        20,
      ),
      nativeEfSearchMin: integerEnv(env, "SEARCH_NATIVE_EF_SEARCH_MIN", 100),
    },
    mcp: {
      defaultRepositoryId: optionalEnv(env, "MCP_DEFAULT_REPOSITORY_ID"),
    },
    logging: {
      level: logLevelEnv(env, "LOG_LEVEL", "info"),
      pretty: booleanEnv(env, "LOG_PRETTY", true),
    },
  };
}

/**
 * 读取必填环境变量，不存在时抛出异常。
 */
function requireEnv(env: EnvMap, key: string): string {
  const value = env[key]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

/**
 * 读取可选环境变量，空字符串视为未提供。
 */
function optionalEnv(env: EnvMap, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/**
 * 读取逻辑项目空间并校验格式。
 */
function projectSpaceEnv(env: EnvMap, key: string): string {
  const value = requireEnv(env, key).toLowerCase();

  if (!/^[a-z0-9][a-z0-9_-]*$/.test(value)) {
    throw new Error(
      `Environment variable ${key} must match /^[a-z0-9][a-z0-9_-]*$/`,
    );
  }

  return value;
}

/**
 * 将环境变量解析为布尔值。
 */
function booleanEnv(env: EnvMap, key: string, fallback: boolean): boolean {
  const value = optionalEnv(env, key);

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

/**
 * 将环境变量解析为正整数。
 */
function integerEnv(env: EnvMap, key: string, fallback?: number): number {
  const value = optionalEnv(env, key);

  if (value === undefined) {
    if (fallback === undefined) {
      throw new Error(`Missing required environment variable: ${key}`);
    }

    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new Error(`Environment variable ${key} must be a positive integer`);
  }

  return parsed;
}

/**
 * 将逗号分隔的环境变量解析为字符串数组。
 */
function csvEnv(env: EnvMap, key: string, fallback: string[]): string[] {
  const value = optionalEnv(env, key);

  if (value === undefined) {
    return fallback;
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * 解析 SurrealDB 部署模式配置。
 */
function deploymentModeEnv(
  env: EnvMap,
  key: string,
  fallback: SurrealDeploymentMode,
): SurrealDeploymentMode {
  const value = optionalEnv(env, key);

  if (value === undefined) {
    return fallback;
  }

  if (value === "local" || value === "cloud") {
    return value;
  }

  throw new Error(`Environment variable ${key} must be 'local' or 'cloud'`);
}

/**
 * 解析 embedding provider 配置。
 */
function embeddingProviderEnv(
  env: EnvMap,
  key: string,
  fallback: EmbeddingProvider,
): EmbeddingProvider {
  const value = optionalEnv(env, key);

  if (value === undefined) {
    return fallback;
  }

  if (value === "voyage") {
    return value;
  }

  if (value === "openai-compatible") {
    return value;
  }

  throw new Error(
    `Environment variable ${key} must be 'voyage' or 'openai-compatible'`,
  );
}

/**
 * 解析日志级别配置。
 */
function logLevelEnv(
  env: EnvMap,
  key: string,
  fallback: LoggingConfig["level"],
): LoggingConfig["level"] {
  const value = optionalEnv(env, key);

  if (value === undefined) {
    return fallback;
  }

  if (
    value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
  ) {
    return value;
  }

  throw new Error(
    `Environment variable ${key} must be 'debug', 'info', 'warn' or 'error'`,
  );
}

/**
 * 根据 provider 返回默认模型名。
 */
function defaultEmbeddingModelForProvider(provider: EmbeddingProvider): string {
  switch (provider) {
    case "openai-compatible":
      return "text-embedding-3-large";
    case "voyage":
      return "voyage-code-3";
  }
}

/**
 * 基于 PROJECT_SPACE 生成稳定的 namespace。
 */
function namespaceFromProjectSpace(projectSpace: string): string {
  return projectSpace.replace(/-/g, "_");
}

/**
 * 校验 SurrealDB 至少提供一种可用的认证方式。
 */
function validateSurrealAuth(config: SurrealConfig): void {
  const hasUserPassword = Boolean(config.username && config.password);
  const hasToken = Boolean(config.token);

  if (!hasUserPassword && !hasToken) {
    throw new Error(
      "SurrealDB authentication requires either SURREAL_USERNAME and SURREAL_PASSWORD, or SURREAL_TOKEN",
    );
  }
}

/**
 * 校验 embedding 配置是否满足当前 provider 的要求。
 */
function validateEmbeddingConfig(config: EmbeddingConfig): void {
  if (!config.apiKey) {
    switch (config.provider) {
      case "openai-compatible":
        throw new Error(
          "OpenAI-compatible embedding requires EMBEDDING_API_KEY",
        );
      case "voyage":
        throw new Error("Voyage embedding requires EMBEDDING_API_KEY");
    }
  }
}
