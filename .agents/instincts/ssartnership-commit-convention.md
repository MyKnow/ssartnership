---
id: ssartnership-commit-convention
trigger: "when writing a commit message"
confidence: 0.9
domain: git
source: local-repo-analysis
analyzed_commits: 200
---

# Use Ssartnership Commit Style

## Action

Use conventional commit prefixes with concise Korean, outcome-focused subjects:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
- `perf(scope):` for targeted performance work

## Evidence

Recent history uses mostly `feat`, `refactor`, `fix`, `chore`, and `docs`. Version bump commits consistently use `chore: bump version ...`.
