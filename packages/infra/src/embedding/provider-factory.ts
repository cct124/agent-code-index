import type { EmbeddingProvider } from "@agent-code-index/core";

import {
  VoyageEmbeddingProvider,
  type VoyageEmbeddingProviderConfig,
} from "./voyage-embedding-provider.js";

/**
 * 当前支持的 embedding provider 名称。
 */
export type EmbeddingProviderName = "voyage";

/**
 * 创建 embedding provider 所需的配置。
 */
export interface EmbeddingProviderConfig {
  /** 第三方 provider 名称。 */
  provider: EmbeddingProviderName;
  /** 绑定的 embedding 模型名称。 */
  model: string;
  /** 返回向量维度。 */
  vectorDimension: number;
  /** 第三方服务访问密钥。 */
  apiKey?: string;
  /** 第三方服务基础地址。 */
  baseUrl?: string;
}

/**
 * 根据配置创建 embedding provider。
 */
export function createEmbeddingProvider(
  config: EmbeddingProviderConfig,
): EmbeddingProvider {
  switch (config.provider) {
    case "voyage":
      return new VoyageEmbeddingProvider(config);
  }
}

/**
 * 将通用配置约束为 Voyage provider 所需结构。
 */
export type { VoyageEmbeddingProviderConfig };
