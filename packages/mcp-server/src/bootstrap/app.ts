/**
 * 应用装配入口，负责连接配置加载与容器初始化。
 */
import { createContainer, type AppContainer } from "./container.js";
import { loadConfig, type AppConfig } from "./config.js";

/**
 * 完整应用对象。
 */
export interface App {
  /** 运行时配置。 */
  config: AppConfig;
  /** 运行时依赖容器。 */
  container: AppContainer;
}

/**
 * 创建应用实例并完成最小装配。
 */
export function createApp(): App {
  const config = loadConfig();
  const container = createContainer(config);

  return {
    config,
    container,
  };
}
