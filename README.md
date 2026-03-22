# agent-code-index

面向 Agent 的代码与工程文档索引工具。

当前项目的目标，是把“仓库扫描 -> 语义切块 -> embedding -> 向量检索 -> 通过 MCP 暴露能力”这条链路稳定落地，并保持核心能力与协议层解耦。

## 当前状态

截至 2026-03-22，仓库已经进入“索引与检索主链路可运行、真实存储与真实 embedding provider 端到端可验证，并可通过 MCP stdio 暴露核心工具”的阶段。

已经落地并验证的能力包括：

1. `core / infra / mcp-server` 三包 workspace 架构
2. `PROJECT_SPACE` 驱动的项目级配置模型与 embedding 锁定
3. `project_metadata` 启动链路与真实 SurrealDB 校验
4. `DefaultIndexRepositoryService` 索引主流程
5. `DefaultSearchCodeContextService` 的 `query text -> query embedding -> search` 正式用例
6. TypeScript、JavaScript、Python 的 tree-sitter 语义切块
7. Markdown 标题章节切块与 metadata 提取
8. SurrealDB `3.0.4` 基线下的原生 HNSW 检索
9. `voyage` 与 `openai-compatible` 两条 provider 路径
10. OpenAI-compatible / Voyage + Surreal 的真实端到端索引与检索验证
11. 基于官方 MCP SDK 的 `index_repository` / `search_code_context` / `index_files` / `delete_files` / `get_file_context` tools

当前仍未落地的主要能力包括：

1. provider 级重试、超时、限流与统一错误码
2. richer `ContextBuilder` 的下一阶段能力，例如跨文件重排与 query-aware summarization

也就是说，当前最大的缺口已经不是底层索引、检索或 MCP 对外暴露能力，而是运行稳定性收口和检索质量继续增强。

## 仓库结构

```text
packages/
	core/
	infra/
	mcp-server/

design/
	v1/

doc/
	progress/
```

各目录职责：

1. `packages/core`：领域模型、contracts、核心 use case
2. `packages/infra`：Surreal、embedding、scanner、parser 等基础设施实现
3. `packages/mcp-server`：配置加载、容器装配、启动校验与 MCP tool 暴露
4. `design/v1`：架构设计与专项实施文档
5. `doc/progress`：当前进度、阶段里程碑与开发优先级

## 文档入口

建议阅读顺序：

1. [design/v1/README.md](design/v1/README.md)：看整体架构、边界和当前哪些设计已落地
2. [design/v1/surreal-native-vector-search-migration.md](design/v1/surreal-native-vector-search-migration.md)：看 Surreal 原生向量检索迁移结果与后续调优方向
3. [doc/progress/README.md](doc/progress/README.md)：看当前状态摘要
4. [doc/progress/milestones.md](doc/progress/milestones.md)：看已经完成的阶段成果
5. [doc/progress/current-progress.md](doc/progress/current-progress.md)：看剩余缺口、风险与下一步优先级

如果你关心“如何按项目通过 MCP 配置 env”，优先看 [packages/mcp-server/README.md](packages/mcp-server/README.md) 中的 `MCP JSON 配置约定` 一节。

## 当前设计边界

当前代码与文档统一约束为：

1. `core` 不感知 Surreal 与 MCP 细节
2. `infra` 负责 parser、embedding、storage 与 scanner 实现
3. `mcp-server` 当前已负责可用 tools 的真实 MCP 注册与 stdio 暴露
4. 当前正式检索基线为 Surreal 原生 HNSW 单一路径，不再维护应用侧 cosine fallback
5. 同一 `PROJECT_SPACE` 下只允许一个 provider / model / vector dimension 组合

## 常用命令

根目录可直接执行：

```bash
yarn build
yarn typecheck
yarn test
yarn test:unit
yarn test:integration
yarn format
```

## 说明

当前根 README 只保留项目总览，不重复展开详细进度清单。

如果你关心“现在已经做到了什么、还差什么”，优先看 [doc/progress/current-progress.md](doc/progress/current-progress.md)。

如果你关心“系统应该怎么分层、为什么这样设计”，优先看 [design/v1/README.md](design/v1/README.md)。
