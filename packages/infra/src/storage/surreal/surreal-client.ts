/**
 * SurrealDB 客户端封装，统一处理连接、鉴权和健康检查。
 */
import { Surreal } from "surrealdb";

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

  private isConnected = false;

  /**
   * 初始化一个默认的 SurrealDB 客户端实例。
   */
  public constructor(config: SurrealConnectionConfig, driver = new Surreal()) {
    this.config = config;
    this.driver = driver;
  }

  /**
   * 建立连接、完成认证并切换到目标库。
   */
  public async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    await this.driver.connect(this.config.url);
    await this.authenticate();
    await this.driver.use({
      namespace: this.config.namespace,
      database: this.config.database,
    });

    this.isConnected = true;
  }

  /**
   * 关闭当前连接。
   */
  public async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.driver.close();
    this.isConnected = false;
  }

  /**
   * 检查当前连接是否可用。
   */
  public async healthCheck(): Promise<SurrealClientHealthStatus> {
    await this.connect();
    await this.driver.health();

    return {
      ok: true,
      url: this.config.url,
      namespace: this.config.namespace,
      database: this.config.database,
      deploymentMode: this.config.deploymentMode,
    };
  }

  /**
   * 根据配置选择 Token 或用户名密码认证。
   */
  private async authenticate(): Promise<void> {
    if (this.config.token) {
      await this.driver.authenticate(this.config.token);
      return;
    }

    if (this.config.username && this.config.password) {
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
}

/**
 * 创建默认的 SurrealDB 客户端实例。
 */
export function createSurrealClient(
  config: SurrealConnectionConfig,
): SurrealClient {
  return new DefaultSurrealClient(config);
}
