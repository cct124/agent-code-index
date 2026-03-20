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
  /** SurrealDB namespace。 */
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
 * Voyage embedding 服务配置。
 */
export interface VoyageConfig {
  /** Voyage API Key。 */
  apiKey: string;
  /** Voyage 模型名称。 */
  model: string;
}

/**
 * 索引链路默认参数配置。
 */
export interface IndexingConfig {
  /** 默认检索返回数量。 */
  defaultTopK: number;
  /** 扫描仓库时默认忽略的路径模式。 */
  ignorePatterns: string[];
}

/**
 * 应用完整运行时配置对象。
 */
export interface AppConfig {
  /** SurrealDB 相关配置。 */
  surreal: SurrealConfig;
  /** Voyage 相关配置。 */
  voyage: VoyageConfig;
  /** 索引过程默认参数。 */
  indexing: IndexingConfig;
}

/**
 * 环境变量键值集合。
 */
type EnvMap = Record<string, string | undefined>;

/**
 * 从环境变量中加载并校验应用运行时配置。
 */
export function loadConfig(env: EnvMap = process.env): AppConfig {
  const surreal: SurrealConfig = {
    url: requireEnv(env, "SURREAL_URL"),
    namespace: requireEnv(env, "SURREAL_NAMESPACE"),
    database: requireEnv(env, "SURREAL_DATABASE"),
    username: optionalEnv(env, "SURREAL_USERNAME"),
    password: optionalEnv(env, "SURREAL_PASSWORD"),
    token: optionalEnv(env, "SURREAL_TOKEN"),
    useTls: booleanEnv(env, "SURREAL_USE_TLS", false),
    deploymentMode: deploymentModeEnv(env, "SURREAL_DEPLOYMENT_MODE", "local"),
  };

  validateSurrealAuth(surreal);

  return {
    surreal,
    voyage: {
      apiKey: requireEnv(env, "VOYAGE_API_KEY"),
      model: optionalEnv(env, "VOYAGE_MODEL") ?? "voyage-code-3",
    },
    indexing: {
      defaultTopK: integerEnv(env, "DEFAULT_TOP_K", 10),
      ignorePatterns: csvEnv(env, "DEFAULT_SCAN_IGNORE_PATTERNS", [
        "node_modules",
        ".git",
        "dist",
        "build",
        ".next",
      ]),
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
function integerEnv(env: EnvMap, key: string, fallback: number): number {
  const value = optionalEnv(env, key);

  if (value === undefined) {
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
