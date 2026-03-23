# @agent-code-index/mcp-server

## 0.1.6

### Patch Changes

- Expose `skippedFileCount` in `index_files` responses so callers can see when explicitly requested files were skipped by ignore rules, `.gitignore`, binary detection, or empty chunk results.

## 0.1.5

### Patch Changes

- Preserve built-in scan ignore defaults such as `.git` when `DEFAULT_SCAN_IGNORE_PATTERNS` adds custom rules, so Git metadata is not indexed unless explicitly re-included.

## 0.1.4

### Patch Changes

- Improve startup diagnostics by logging the resolved root .gitignore path without coupling startup summaries to .gitignore parsing details.
