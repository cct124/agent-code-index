# agent-code-index 进度文档

本文档目录已拆分为两部分：

1. [里程碑]( /home/janex/project/ai-agent/agent-code-index/doc/progress/milestones.md )：记录阶段性完成事项，适合回顾“已经完成了什么”
2. [当前进度]( /home/janex/project/ai-agent/agent-code-index/doc/progress/current-progress.md )：记录当前可运行能力、剩余缺口、风险和下一步建议

截至 2026-03-20，仓库的最新状态是：

1. v1 架构设计、三包 workspace 骨架、配置模型和项目元数据锁定已经完成
2. `project_metadata` 启动链路和真实 SurrealDB 集成测试已经完成
3. `SurrealChunkRepository` 与 `SurrealSearchRepository` 已完成第一版真实实现
4. chunk/search 的轻量集成测试与真实 SurrealDB 集成测试已经补齐
5. 核心闭环仍缺 parser、embedding provider、索引主流程和 MCP tool 层

建议阅读顺序：

1. 先看 [里程碑]( /home/janex/project/ai-agent/agent-code-index/doc/progress/milestones.md ) 了解阶段成果
2. 再看 [当前进度]( /home/janex/project/ai-agent/agent-code-index/doc/progress/current-progress.md ) 判断下一步开发优先级
