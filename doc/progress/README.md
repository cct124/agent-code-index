# agent-code-index 进度文档

本文档目录已拆分为两部分：

1. [里程碑](./milestones.md)：记录阶段性完成事项，适合回顾“已经完成了什么”
2. [当前进度](./current-progress.md)：记录当前可运行能力、剩余缺口、风险和下一步建议

截至 2026-03-21，仓库的最新状态是：

1. v1 架构设计、三包 workspace 骨架、配置模型和项目元数据锁定已经完成
2. `project_metadata` 启动链路、真实 SurrealDB 验证、chunk/search 存储与检索已经完成
3. `DefaultIndexRepositoryService` 与应用容器装配已经完成，索引写入主流程已闭环
4. `voyage` 与 `openai-compatible` 两条 embedding provider 路径已经完成
5. TypeScript、JavaScript、Python 的 tree-sitter 语义切块与 Markdown 结构化章节切块已经完成
6. Surreal 原生 HNSW 检索、`3.0.4` 开发基线验证、候选窗口参数配置化与 `EXPLAIN FULL` 真实验证已经完成
7. 当前最大的缺口已转为 MCP tool 层与上下文服务，而不是底层解析和索引能力

建议阅读顺序：

1. 先看 [里程碑](./milestones.md) 了解阶段成果
2. 再看 [当前进度](./current-progress.md) 判断下一步开发优先级
