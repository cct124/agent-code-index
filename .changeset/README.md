# Changesets

当前仓库使用 Changesets 管理版本决策与变更记录，但仍保留现有的自定义打包发布链路。

## 当前约定

1. 日常开发完成后，先执行 `yarn changeset`
2. 在交互式提示中选择受影响的包，并填写简洁的发布说明
3. 准备发版时，执行 `yarn version:packages`
4. 该命令会先运行 `changeset version`，再同步 `packages/mcp-server/src/server.ts` 中的 `SERVER_VERSION`
5. 准备真正发布 `@agent-code-index/mcp-server` 时，执行 `yarn release:prepare`

## 常用命令

```bash
yarn changeset
yarn changeset:status
yarn version:packages
yarn release:prepare
```

## 为什么还需要自定义脚本

`packages/mcp-server` 的发布版本除了写在 `package.json` 外，还会被写入 `src/server.ts` 的 `SERVER_VERSION` 常量，并且最终是通过 `package-dist/` 发布到 npm。

因此当前仓库把职责拆成两层：

1. Changesets 负责版本决策和 changelog
2. 仓库脚本负责同步源码常量、生成 `package-dist/`、执行 dry-run 检查与真正的 npm publish
