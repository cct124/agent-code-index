/**
 * 应用依赖容器的最小骨架定义。
 */
import type { AppConfig } from "./config.js";

/**
 * 运行时依赖容器。
 */
export interface AppContainer {
  /** 经过校验后的应用配置。 */
  config: AppConfig;
}

/**
 * 基于当前配置创建应用依赖容器。
 */
export function createContainer(config: AppConfig): AppContainer {
  return { config };
}
