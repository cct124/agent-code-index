# Retrieval Benchmark Summary: v4

## Scope

`v4` is a stricter code-location benchmark derived from `v3`.

Differences from earlier versions:

1. only 6 queries are kept
2. all queries are phrased as concrete code-location tasks
3. queries explicitly prefer implementation and tests over README/design docs
4. obviously doc-oriented tasks were removed

Artifacts:

- query set: [test/quality/queriesv4.json](test/quality/queriesv4.json)
- Qwen result: [test/quality/results/qwen-v4.json](test/quality/results/qwen-v4.json)
- Voyage result: [test/quality/results/voyage-v4.json](test/quality/results/voyage-v4.json)
- compare report: [test/quality/results/qwen-v4-vs-voyage-v4.md](test/quality/results/qwen-v4-vs-voyage-v4.md)

Both runs used the same corpus:

- scannedFileCount: 127
- preparedChunkCount: 975
- storedChunkCount: 975
- failedFileCount: 0

## Raw Aggregate Observation

From the compare report:

- Qwen distinct files: 4
- Voyage distinct files: 29
- Qwen retrieval mix: implementation 3.3%, test 0.0%, documentation 0.0%, other 96.7%
- Voyage retrieval mix: implementation 41.7%, test 36.7%, documentation 8.3%, other 13.3%

The most important qualitative finding is that Qwen heavily collapses onto a few repeated false-positive files, especially `test/template/main.py`, while Voyage returns many more repository-relevant TypeScript implementation and test files.

## Why Raw Scoring Needs Adjustment

If every `.py` or config-like file is treated as normal code, Qwen looks better than it actually is, because repeated hits to `test/template/main.py`, `yarn.lock`, and `tsconfig.json` inflate the code ratio.

For `v4`, that is misleading.

`v4` is specifically about useful code-location for this repository, so obvious benchmark-noise files should be penalized.

Noise files used in the adjusted score:

- `test/template/*`
- `yarn.lock`
- root `tsconfig.json`

## Score Method

### Raw score

Same method as previous summary:

- 45% availability
- 40% code ratio
- 15% coverage

### Adjusted engineering score

For `v4`, this is the more trustworthy score:

- 40% availability
- 35% useful code ratio
- 15% coverage
- 10% low-noise bonus

Where:

- useful code ratio = implementation + test hits, excluding noise files
- low-noise bonus = `1 - noiseRatio`

## v4 Score Table

| Model                   | Availability | Coverage | Raw Score / 10 | Adjusted Engineering Score / 10 |
| ----------------------- | ------------ | -------- | -------------- | ------------------------------- |
| Qwen/Qwen3-Embedding-8B | 1.000        | 0.138    | 7.84           | 4.28                            |
| voyage-code-3           | 1.000        | 1.000    | 9.67           | 8.81                            |

Adjusted details:

- Qwen usefulCodeRatio: 0.017
- Qwen noiseRatio: 0.983
- Voyage usefulCodeRatio: 0.717
- Voyage noiseRatio: 0.200

## Query-Level Interpretation

### 1. MCP index wiring

- Qwen mostly returns `test/template/main.py`
- Voyage returns `register-tools.ts`, `container.ts`, and Surreal-related implementation files

Winner: `voyage-code-3`

### 2. LocalFileScanner override

- Qwen again mixes in `yarn.lock`, `tsconfig.json`, and `test/template/main.py`
- Voyage returns `local-file-scanner.ts` and its unit tests near the top

Winner: `voyage-code-3`

### 3. ContextPacket / tokenBudget path

- Qwen is dominated by template-file false positives
- Voyage still has noise, but surfaces repository test and implementation files around the target path

Winner: `voyage-code-3`

### 4. Provider factory wiring

- Voyage surfaces `provider-factory` and related provider files more directly
- Qwen remains unstable and noisy

Winner: `voyage-code-3`

### 5. Quality run disconnect

- Qwen does not reliably recover the actual evaluation script path
- Voyage is closer to the real cleanup/storage code path

Winner: `voyage-code-3`

### 6. Indexing concurrency flow

- Voyage finds `index-repository-service.ts` and `index-files-service.ts`
- Qwen is less focused and still partially document-led or noisy

Winner: `voyage-code-3`

## Final v4 Decision

For the strict code-location benchmark, the winner is:

`voyage-code-3`

Reason:

1. It returns far more repository-relevant implementation and test files.
2. It avoids the catastrophic template-file collapse seen in Qwen v4.
3. It is materially better at locating real TypeScript code paths for engineering tasks.

## Recommendation

If `v4` becomes the main benchmark going forward, the current best model for this repository is:

`voyage-code-3`

The earlier `v3` conclusion still remains useful for prompt-design experiments, but `v4` is stricter and more aligned with real code-location work. Under that stricter standard, Voyage is currently the better engineering retrieval model.
