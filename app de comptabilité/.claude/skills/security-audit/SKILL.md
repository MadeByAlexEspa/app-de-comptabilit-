---
name: security-audit
description: >
  Standalone OWASP security audit. Pass a path for targeted review or
  "full" for the entire codebase. Recommended when onboarding a new
  codebase, after a major refactor, or before a release.
argument-hint: [path or "full"]
---

Run a security audit scoped to: $ARGUMENTS

**Step 1 — Define scope**
- If `full` or nothing provided: audit `server/src/` and `client/src/`
- If a path is provided: audit that specific path only
- Always run `npm audit` from the project root

**Step 2 — Delegate**
Spawn the `cybersecurity` subagent with:
- The scope defined above
- Instructions to apply the full OWASP Top 10 checklist
- Instructions to include `npm audit` results in the report

**Step 3 — Report**
Return the complete security audit output without condensing.

For any Critical or High severity findings, recommend creating a GitHub issue:
```
gh issue create --title "[Security] <Severity>: <short description>" \
  --body "**Severity:** <level>\n**File:** <path:line>\n**Description:** <details>\n**Remediation:** <steps>"
```
