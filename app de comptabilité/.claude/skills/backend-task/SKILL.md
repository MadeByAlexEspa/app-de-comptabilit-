---
name: backend-task
description: >
  Scoped backend-only work: Express endpoints, services, middleware,
  and integrations. Bypasses Tech Lead and routes directly to backend-dev.
  Use when no frontend changes are needed.
argument-hint: <backend task description>
---

Route this task directly to the `backend-dev` subagent. Do not involve the Tech Lead.

Pass the following to backend-dev:
- Task: $ARGUMENTS
- Instructions:
  1. Read `CLAUDE.md` for conventions first
  2. Read existing routes and middleware before creating new ones
  3. Check `server/src/db/` if data model changes are needed
  4. Run `npm run lint && npm test -- --run` upon completion

Return:
- Files created or modified
- API contract (endpoint, method, request/response shapes, auth required)
- Test results
- Notable implementation decisions
