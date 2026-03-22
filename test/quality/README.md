# Retrieval Quality

这个目录用于保存不同 embedding 模型在同一查询集上的召回结果，方便横向对比。

建议流程：

1. 先用 Qwen 环境索引并导出结果。
2. 再切到 Voyage 环境索引并导出结果。
3. 最后比较两份结果文件。

推荐命令：

```bash
corepack yarn quality:run --env-file .env.development --label qwen --repository-id agent-code-index --root-path /home/janex/project/ai-agent/agent-code-index --embedding-batch-size 16 --embedding-concurrency 8
corepack yarn quality:run --env-file .env.development.voyageai --label voyage --repository-id agent-code-index --root-path /home/janex/project/ai-agent/agent-code-index --embedding-batch-size 16 --embedding-concurrency 8
corepack yarn quality:compare --left test/quality/results/qwen.json --right test/quality/results/voyage.json --output-file test/quality/results/qwen-vs-voyage.md
```

说明：

1. `queries.json` 是固定查询集，比较时两次运行必须保持不变。
2. `--label` 决定输出文件名，默认会写到 `test/quality/results/<label>.json`。
3. Qwen 与 Voyage 必须使用不同的 `PROJECT_SPACE`，否则会触发项目元数据锁定校验。
4. 如果希望扩大评测范围，优先追加 `queries.json`，不要临时改查询文本。
