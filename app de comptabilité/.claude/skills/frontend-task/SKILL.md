---
name: frontend-task
description: >
  Scoped frontend-only work: React components, pages, hooks, styling,
  and routing. Bypasses Tech Lead and routes directly to frontend-dev.
  Use when no backend changes are needed.
argument-hint: <frontend task description>
---

Route this task directly to the `frontend-dev` subagent. Do not involve the Tech Lead.

Pass the following to frontend-dev:
- Task: $ARGUMENTS
- Instructions:
  1. Read `CLAUDE.md` for conventions first
  2. Browse existing related components before building new ones
  3. Run `npm run lint && npm run typecheck` upon completion

Return:
- Files created or modified
- Any lint or type-check errors
- Notable implementation decisions
