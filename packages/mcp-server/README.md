# @agent-code-index/mcp-server

`packages/mcp-server` 是当前项目的运行时装配与协议接入模块，负责把 `core` 与 `infra` 组合成一个可启动的应用。

这一层的目标是：

1. 读取运行时配置
2. 创建并装配依赖容器
3. 在启动阶段执行必要校验
4. 为后续 MCP tool/server 接入提供运行时入口

当前阶段，`mcp-server` 已经具备完整的启动装配能力，但还没有真正对外暴露 MCP tools。

## 模块职责

当前 `mcp-server` 主要承担三类职责：

1. 配置加载与校验
2. 应用依赖装配
3. 启动阶段健康检查与元数据校验

## 当前目录结构

```text
src/
  bootstrap/
    app.ts
    config.ts
    container.ts
  index.ts
```

### bootstrap/config.ts

负责读取和校验运行时配置。

当前能力：

1. 读取 `PROJECT_SPACE`
2. 根据 `PROJECT_SPACE` 派生 Surreal namespace
3. 读取 Surreal 连接配置
4. 读取 embedding 配置
5. 读取索引链路默认参数
6. 校验 embedding 必填配置

### bootstrap/container.ts

负责创建应用依赖容器。

当前已经装配：

1. `embeddingProvider`
2. `surrealClient`
3. `chunkSchema`
4. `projectMetadataSchema`
5. `chunkPreparationService`
6. `chunkRepository`
7. `searchRepository`
8. `indexRepositoryService`
9. `projectMetadataRepository`

也就是说，当前运行时已经能拿到完整的最小索引链依赖图。

### bootstrap/app.ts

负责创建完整应用实例。

当前启动流程包括：

1. 加载配置
2. 创建容器
3. 执行 Surreal 健康检查
4. 执行 chunk schema 初始化
5. 执行 `project_metadata` schema 初始化
6. 校验或初始化项目元数据

### index.ts

当前只导出 `createApp`，作为后续 server 启动逻辑的复用入口。

## 当前已经实现的功能

截至当前，`mcp-server` 已经具备以下能力。

### 1. 运行时配置模型

已实现：

1. Surreal 配置模型
2. Embedding 配置模型
3. 索引配置模型
4. 环境变量加载与校验逻辑

### 2. 启动期元数据锁定

已实现：

1. 首次启动写入项目元数据
2. 二次启动校验 provider/model/vectorDimension 一致性
3. 不一致时拒绝继续启动

### 3. 运行时依赖装配

已实现：

1. Embedding provider 装配
2. Surreal client 与 repository 装配
3. chunk preparation 服务装配
4. 默认索引服务装配

### 4. 启动与索引链验证

已实现：

1. `createApp()` 单元测试
2. `createApp()` 真实 SurrealDB 集成测试
3. 真实整链路测试，验证 `prepare -> embed -> upsert -> search`

## 当前边界

`mcp-server` 当前明确还不负责：

1. 真正初始化并启动 MCP server
2. 注册 MCP tools
3. 处理 MCP 请求和响应映射
4. 定义核心业务语义
5. 实现具体存储和 embedding 技术细节

这些职责分别属于未来的协议适配层，以及 `core` / `infra`。

## 当前状态总结

从当前项目进度来看，`mcp-server` 已经不再只是配置占位层，而是已经具备：

1. 可运行的配置加载与校验能力
2. 可运行的应用容器装配能力
3. 启动阶段的真实数据库健康检查与元数据锁定能力
4. 对完整最小索引链的运行时装配能力

也就是说，当前 `mcp-server` 已经承担起“把系统真正启动起来并装配完成”的职责；下一阶段再继续补协议入口和 MCP tools 即可。