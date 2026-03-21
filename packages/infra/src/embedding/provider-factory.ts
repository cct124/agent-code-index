import {
  NOOP_LOGGER,
  type EmbeddingProvider,
  type Logger,
} from "@agent-code-index/core";

import {
  OpenAICompatibleEmbeddingProvider,
  type OpenAICompatibleEmbeddingProviderConfig,
} from "./openai-compatible/openai-compatible-embedding-provider.js";
import {
  VoyageEmbeddingProvider,
  type VoyageEmbeddingProviderConfig,
} from "./voyage-embedding-provider.js";

/**
 * 当前支持的 embedding provider 名称。
 */
export type EmbeddingProviderName = "voyage" | "openai-compatible";

/**
 * 创建 embedding provider 所需的配置。
 */
export type EmbeddingProviderConfig =
  | OpenAICompatibleEmbeddingProviderConfig
  | VoyageEmbeddingProviderConfig;

/**
 * 根据配置创建 embedding provider。
 */
export function createEmbeddingProvider(
  config: EmbeddingProviderConfig,
  logger: Logger = NOOP_LOGGER,
): EmbeddingProvider {
  const factoryLogger = logger.child({
    package: "infra",
    module: "embedding-provider-factory",
  });

  factoryLogger.info("Creating embedding provider", {
    provider: config.provider,
    embeddingModel: config.model,
  });

  switch (config.provider) {
    case "openai-compatible":
      return new OpenAICompatibleEmbeddingProvider(
        config,
        logger.child({
          package: "infra",
          module: "embedding-provider",
          component: "OpenAICompatibleEmbeddingProvider",
          provider: config.provider,
          embeddingModel: config.model,
        }),
      );
    case "voyage":
      return new VoyageEmbeddingProvider(
        config,
        logger.child({
          package: "infra",
          module: "embedding-provider",
          component: "VoyageEmbeddingProvider",
          provider: config.provider,
          embeddingModel: config.model,
        }),
      );
  }
}

/**
 * 导出具体 provider 配置类型。
 */
export type {
  OpenAICompatibleEmbeddingProviderConfig,
  VoyageEmbeddingProviderConfig,
};
