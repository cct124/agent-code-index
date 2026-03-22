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
2. 评测脚本会自动把整个 `test/quality` 目录加入本次索引忽略列表，避免查询文本、结果文件和评测脚本本身污染召回结果。
3. `--label` 决定默认输出文件名，首次会写到 `test/quality/results/<label>.json`；如果同名文件已存在，脚本会自动追加 UTC 时间戳，避免覆盖旧结果。
4. `quality:compare` 现在也默认保留历史报告；当目标 Markdown 已存在时，会自动生成带时间戳的新文件。
5. 只有显式传入 `--allow-overwrite` 时，脚本才会覆盖已有结果文件或报告。
6. 对比报告顶部会额外输出聚合指标，例如平均 chunk overlap、平均 file overlap、Top-3 文件重合度，以及 implementation/test/documentation 命中占比，便于多轮结果做纵向分析。
7. Qwen 与 Voyage 必须使用不同的 `PROJECT_SPACE`，否则会触发项目元数据锁定校验。
8. 如果希望扩大评测范围，优先追加 `queries.json`，不要临时改查询文本。
