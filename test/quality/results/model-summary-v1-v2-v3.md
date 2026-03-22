# Retrieval Benchmark Summary: v1 / v2 / v3

## Scope

This summary combines three benchmark styles:

1. `v1`: keyword-heavy technical retrieval
2. `v2`: long Chinese agent-style task descriptions
3. `v3`: shorter mixed Chinese/English engineering prompts

Input artifacts:

- `qwen` vs `voyage`: [test/quality/results/qwen-v1-vs-voyage-v1.md](test/quality/results/qwen-v1-vs-voyage-v1.md)
- `qwen-v2` vs `voyage-v2`: [test/quality/results/qwen-v2-vs-voyage-v2.md](test/quality/results/qwen-v2-vs-voyage-v2.md)
- `qwen-v3` vs `voyage-v3`: [test/quality/results/qwen-v3-vs-voyage-v3.md](test/quality/results/qwen-v3-vs-voyage-v3.md)

All six runs used the same corpus size:

- scannedFileCount: 127
- preparedChunkCount: 975
- storedChunkCount: 975
- failedFileCount: 0

## Scoring Method

This is a practical software-engineering retrieval score, not a human relevance-judged IR benchmark.

Weighted score:

- 45% availability: non-zero-result queries / total queries
- 40% code ratio: implementation hits + test hits / total hits
- 15% coverage: distinct hit files / max distinct files seen in these six runs

Reasoning:

- Availability matters most for engineering workflows. A model that returns nothing is operationally unusable.
- Code ratio matters next because software engineering tasks usually need editable code or tests, not only docs.
- Coverage matters, but less than the first two. More distinct files can help exploration, but can also include noise.

## Score Table

| Run       | Availability | Code Ratio | Coverage | Score / 10 |
| --------- | ------------ | ---------- | -------- | ---------- |
| qwen      | 1.000        | 0.613      | 0.893    | 8.29       |
| voyage    | 1.000        | 0.575      | 1.000    | 8.30       |
| qwen-v2   | 0.125        | 0.000      | 0.214    | 0.88       |
| voyage-v2 | 1.000        | 0.375      | 0.643    | 6.96       |
| qwen-v3   | 1.000        | 0.500      | 0.929    | 7.89       |
| voyage-v3 | 1.000        | 0.412      | 0.750    | 7.28       |

Average by model across v1/v2/v3:

- Qwen: 5.69 / 10
- Voyage: 7.51 / 10

Average by model on the more engineering-controlled benchmarks only (`v1` + `v3`):

- Qwen: 8.09 / 10
- Voyage: 7.79 / 10

## Interpretation by Benchmark Version

### v1: keyword-heavy technical retrieval

Result:

- Qwen and Voyage are very close.
- Voyage is marginally ahead on the weighted score: 8.30 vs 8.29.
- Qwen has a slightly better code ratio: 61.3% vs 57.5%.
- Voyage has slightly broader file coverage: 28 vs 25 distinct files.

Takeaway:

- Under classic keyword retrieval, the two models are effectively tied.
- Qwen is slightly more code-oriented.
- Voyage is slightly broader and a little more recall-oriented.

### v2: long Chinese agent-style prompts

Result:

- Voyage wins decisively: 6.96 vs 0.88.
- Voyage returns non-zero results for all 8 queries.
- Qwen collapses to only 1 non-zero query out of 8.
- Qwen becomes overwhelmingly documentation-heavy on the single surviving query.

Takeaway:

- Qwen is highly sensitive to this long natural-language Chinese prompt style.
- Voyage is much more robust to prompt variation, even though many returned files are noisy.
- For raw end-user language with long task framing, Voyage is operationally safer.

### v3: shorter mixed Chinese/English engineering prompts

Result:

- Qwen wins: 7.89 vs 7.28.
- Both models recover to full availability: 8/8 non-zero queries.
- Qwen has better code ratio: 50.0% vs 41.2%.
- Qwen also covers more distinct files: 26 vs 21.
- Voyage remains more documentation-heavy: 57.5% documentation hits vs Qwen's 47.5%.

Takeaway:

- Once prompts are shortened and made more engineering-like, Qwen recovers strongly.
- For agent-authored prompts that are concise and tool-oriented, Qwen gives better software-engineering retrieval.

## Query-Level Behavior Patterns

Observed patterns across reports:

1. Entry-point and wiring queries are still doc-heavy for both models.
2. `includePatterns` / `LocalFileScanner` style implementation queries are handled better by Voyage in v1 and by both models in v3, with Voyage usually cleaner at the top ranks.
3. `tokenBudget` / `ContextPacket` style internal service queries are better served by Qwen in v3 because it returns more core code files in the top 10.
4. Provider wiring queries improve noticeably in v3, where Voyage finds `provider-factory.ts` more directly, but Qwen remains competitive through config and provider implementation hits.
5. The biggest failure mode in the entire experiment is Qwen under v2, not Voyage under any version.

## Final Recommendation

### Overall winner across v1 + v2 + v3

`voyage-code-3`

Why:

1. It is much more robust to query style variation.
2. It never collapsed to near-zero availability.
3. If production prompts are not tightly controlled, robustness is more valuable than peak code-focus.

### Winner for controlled software-engineering agent prompts

`Qwen/Qwen3-Embedding-8B`

Why:

1. On `v1` and `v3`, Qwen is slightly stronger or clearly stronger on code-oriented retrieval.
2. It returns a higher proportion of implementation and test files.
3. It covers more useful files than Voyage in `v3` once prompts are engineered into a concise form.

## Practical Recommendation for This Repository

If your production workflow is:

- user asks in free-form natural language
- agent forwards long, verbose task descriptions into retrieval

Choose `voyage-code-3`.

If your production workflow is:

- prompts are agent-generated
- prompts are short, structured, and engineering-oriented
- you care more about editable code/test hits than broad doc recall

Choose `Qwen/Qwen3-Embedding-8B`.

For this repository, and for software-engineering agents specifically, the best path is:

1. Treat `v3` as the most representative benchmark style going forward.
2. Prefer Qwen if you can keep the retrieval query style concise and tool-oriented.
3. Prefer Voyage if you cannot guarantee prompt discipline and need stronger robustness.

## Decision

Single-model recommendation for general use: `voyage-code-3`

Single-model recommendation for disciplined engineering-agent use: `Qwen/Qwen3-Embedding-8B`

If forced to choose only one model today without additional prompt control work, `voyage-code-3` is the safer software-engineering default.
