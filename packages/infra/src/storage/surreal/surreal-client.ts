/**
 * SurrealDB 客户端封装，统一处理连接、鉴权和健康检查。
 */
import { NOOP_LOGGER, type Logger } from "@agent-code-index/core";
import { Surreal } from "surrealdb";

import {
  classifySurrealError,
  createSurrealErrorLogFields,
  sanitizeSurrealConnectionConfig,
} from "./surreal-log-utils.js";

/**
 * SurrealDB 的部署模式。
 */
export type SurrealDeploymentMode = "local" | "cloud";

/**
 * SurrealDB 连接配置。
 */
export interface SurrealConnectionConfig {
  /** SurrealDB 服务地址。 */
  url: string;
  /** SurrealDB namespace。 */
  namespace: string;
  /** SurrealDB database。 */
  database: string;
  /** 用户名密码认证方式下的用户名。 */
  username?: string;
  /** 用户名密码认证方式下的密码。 */
  password?: string;
  /** Token 认证方式下的访问令牌。 */
  token?: string;
  /** 是否通过 TLS 连接。 */
  useTls: boolean;
  /** 当前部署模式。 */
  deploymentMode: SurrealDeploymentMode;
}

/**
 * SurrealDB 健康检查结果。
 */
export interface SurrealClientHealthStatus {
  /** 是否健康。 */
  ok: boolean;
  /** 当前连接的服务地址。 */
  url: string;
  /** 当前 namespace。 */
  namespace: string;
  /** 当前 database。 */
  database: string;
  /** 当前部署模式。 */
  deploymentMode: SurrealDeploymentMode;
}

/**
 * SurrealDB 客户端抽象接口。
 */
export interface SurrealClient {
  /** 当前使用的连接配置。 */
  readonly config: SurrealConnectionConfig;
  /** 底层官方客户端实例。 */
  readonly driver: Surreal;

  /** 建立连接、认证并切换到指定 namespace/database。 */
  connect(): Promise<void>;
  /** 关闭当前连接。 */
  disconnect(): Promise<void>;
  /** 在需要时自动重连，并执行一次数据库操作。 */
  execute<T>(
    operationName: string,
    operation: (driver: Surreal) => Promise<T>,
  ): Promise<T>;
  /** 执行最小健康检查。 */
  healthCheck(): Promise<SurrealClientHealthStatus>;
}

/**
 * SurrealDB 客户端默认实现。
 */
export class DefaultSurrealClient implements SurrealClient {
  /** 当前使用的连接配置。 */
  public readonly config: SurrealConnectionConfig;

  /** 底层官方客户端实例。 */
  public readonly driver: Surreal;

  /** 结构化日志接口。 */
  private readonly logger: Logger;

  private isConnected = false;

  /**
   * 初始化一个默认的 SurrealDB 客户端实例。
   */
  public constructor(
    config: SurrealConnectionConfig,
    driver = new Surreal(),
    logger: Logger = NOOP_LOGGER,
  ) {
    this.config = config;
    this.driver = driver;
    this.logger = logger.child({
      package: "infra",
      module: "surreal-client",
      component: "DefaultSurrealClient",
    });
  }

  /**
   * 建立连接、完成认证并切换到目标库。
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      this.logger.debug("Surreal client already connected");
      return;
    }

    this.logger.info(
      "Connecting to SurrealDB",
      sanitizeSurrealConnectionConfig(this.config),
    );

    try {
      await this.driver.connect(this.config.url);
      await this.authenticate();
      await this.driver.use({
        namespace: this.config.namespace,
        database: this.config.database,
      });

      this.isConnected = true;
      this.logger.info(
        "SurrealDB connection established",
        sanitizeSurrealConnectionConfig(this.config),
      );
    } catch (error) {
      this.logger.error(
        "SurrealDB connection failed",
        createSurrealErrorLogFields(
          error,
          sanitizeSurrealConnectionConfig(this.config),
        ),
      );
      throw error;
    }
  }

  /**
   * 关闭当前连接。
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      this.logger.debug(
        "Surreal client disconnect skipped because connection is not active",
      );
      return;
    }

    try {
      await this.driver.close();
      this.isConnected = false;
      this.logger.info("SurrealDB connection closed");
    } catch (error) {
      this.logger.error(
        "SurrealDB disconnect failed",
        createSurrealErrorLogFields(error),
      );
      throw error;
    }
  }

  /**
   * 在连接可用的前提下执行数据库操作，并在检测到会话失效时自动重连后重试一次。
   */
  public async execute<T>(
    operationName: string,
    operation: (driver: Surreal) => Promise<T>,
  ): Promise<T> {
    await this.connect();

    try {
      return await operation(this.driver);
    } catch (error) {
      if (!this.shouldReconnectAfterOperationError(error)) {
        throw error;
      }

      this.logger.warn(
        "SurrealDB operation lost authenticated session, reconnecting and retrying once",
        createSurrealErrorLogFields(error, {
          operationName,
          ...sanitizeSurrealConnectionConfig(this.config),
        }),
      );

      await this.resetConnection();
      await this.connect();

      return operation(this.driver);
    }
  }

  /**
   * 检查当前连接是否可用。
   */
  public async healthCheck(): Promise<SurrealClientHealthStatus> {
    this.logger.debug("Running SurrealDB health check");

    try {
      await this.execute("health-check", (driver) =>
        driver.query("RETURN true;"),
      );

      const status = {
        ok: true,
        url: this.config.url,
        namespace: this.config.namespace,
        database: this.config.database,
        deploymentMode: this.config.deploymentMode,
      };

      this.logger.info("SurrealDB health check succeeded", status);

      return status;
    } catch (error) {
      this.logger.error(
        "SurrealDB health check failed",
        createSurrealErrorLogFields(
          error,
          sanitizeSurrealConnectionConfig(this.config),
        ),
      );
      throw error;
    }
  }

  /**
   * 根据配置选择 Token 或用户名密码认证。
   */
  private async authenticate(): Promise<void> {
    if (this.config.token) {
      this.logger.debug("Authenticating SurrealDB connection with token");
      await this.driver.authenticate(this.config.token);
      return;
    }

    if (this.config.username && this.config.password) {
      this.logger.debug(
        "Authenticating SurrealDB connection with username/password",
      );
      await this.driver.signin({
        username: this.config.username,
        password: this.config.password,
      });
      return;
    }

    throw new Error(
      "SurrealDB authentication requires either a token or username/password credentials.",
    );
  }

  /**
   * 在本地已认为连接可用时，仅对明显的会话失效错误执行一次恢复。
   */
  private shouldReconnectAfterOperationError(error: unknown): boolean {
    if (!this.isConnected) {
      return false;
    }

    const classified = classifySurrealError(error);
    const hasAnonymousAuthDetails = this.hasAnonymousAuthDetails(error);

    if (hasAnonymousAuthDetails) {
      return true;
    }

    if (classified.errCode !== "surreal_auth_error") {
      return false;
    }

    const message = classified.error.message.toLowerCase();

    if (
      /anonymous access not allowed|session expired|token expired|not signed in/.test(
        message,
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * 从 Surreal RPC 错误对象中识别“匿名 actor 执行 query”这一类会话丢失信号。
   */
  private hasAnonymousAuthDetails(error: unknown): boolean {
    if (!isRecord(error)) {
      return false;
    }

    const details = error.details;

    if (!isRecord(details) || !isRecord(details.details)) {
      return false;
    }

    const authDetails = details.details;

    if (authDetails.kind !== "NotAllowed" || !isRecord(authDetails.details)) {
      return false;
    }

    const permissionDetails = authDetails.details;

    return (
      permissionDetails.actor === "anonymous" &&
      permissionDetails.resource === "query"
    );
  }

  /**
   * 清理本地连接状态，并尽量关闭已有连接，避免后续继续复用失效会话。
   */
  private async resetConnection(): Promise<void> {
    this.isConnected = false;

    try {
      await this.driver.close();
    } catch (error) {
      this.logger.warn(
        "SurrealDB connection reset close failed",
        createSurrealErrorLogFields(error, {
          ...sanitizeSurrealConnectionConfig(this.config),
        }),
      );
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * 创建默认的 SurrealDB 客户端实例。
 */
export function createSurrealClient(
  config: SurrealConnectionConfig,
  logger: Logger = NOOP_LOGGER,
): SurrealClient {
  return new DefaultSurrealClient(config, new Surreal(), logger);
}
