# @agent-code-index/mcp-server

## 0.1.5

### Patch Changes

- Preserve built-in scan ignore defaults such as `.git` when `DEFAULT_SCAN_IGNORE_PATTERNS` adds custom rules, so Git metadata is not indexed unless explicitly re-included.

## 0.1.4

### Patch Changes

- Improve startup diagnostics by logging the resolved root .gitignore path without coupling startup summaries to .gitignore parsing details.
