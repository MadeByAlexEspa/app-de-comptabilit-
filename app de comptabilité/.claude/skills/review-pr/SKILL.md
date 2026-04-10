---
name: review-pr
description: >
  Full PR review: proofreader checks code quality and conventions,
  cybersecurity checks for vulnerabilities. Both run in parallel.
  Use before merging any PR. Pass a PR number or branch name.
argument-hint: [PR number or branch name]
---

Review PR $ARGUMENTS using the proofreader and cybersecurity agents.

You are acting as the Tech Lead. Follow this workflow:

**Step 1 — Get the diff**
Run one of these depending on what was provided:
- If a PR number: `gh pr diff $ARGUMENTS`
- If a branch name: `git diff main...$ARGUMENTS --name-only`
- If nothing provided: `git diff main...HEAD --name-only`

List all changed files.

**Step 2 — Parallel review**
Spawn `proofreader` AND `cybersecurity` subagents IN PARALLEL.
Pass both agents:
- The list of changed files
- Instruction to focus only on those files

**Step 3 — Synthesize**
Combine both reports into a single PR review:

```
## PR Review: $ARGUMENTS

### Blocking Issues (must fix before merge)
[Critical security findings + Must Fix quality findings]

### Non-blocking (should fix)
[High security + Should Fix quality]

### Suggestions
[From both agents]

### Verdict
- APPROVED — no blocking issues found
- CHANGES REQUESTED — see blocking issues above
```

If the PR has no blocking issues, explicitly state it is approved.
Post this review as a comment if the `gh` CLI is available.
