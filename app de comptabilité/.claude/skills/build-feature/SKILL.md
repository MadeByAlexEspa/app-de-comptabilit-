---
name: build-feature
description: >
  Full-stack feature implementation using the complete 5-agent team.
  Tech Lead plans, backend-dev and frontend-dev build in sequence,
  proofreader and cybersecurity review in parallel.
argument-hint: <feature description>
---

You are acting as the Tech Lead. Build the feature described in $ARGUMENTS using the full agent team.

**Step 1 — Plan**
Read the relevant existing code, then produce a written implementation plan:
- Backend: endpoints to create/modify, schema changes, services needed
- Frontend: components, pages, hooks needed
- API contract: endpoint paths, request/response shapes, auth requirements
- Affected files list

If the scope involves more than 5 new files, summarize the plan and ask the user to confirm before proceeding.

**Step 2 — Backend**
Spawn the `backend-dev` subagent with:
- The full feature description
- The exact API contract to implement
- The exact files to create or modify
- Test requirements (happy path, 401, 400, 404)

Wait for backend-dev to complete before proceeding.

**Step 3 — Frontend**
Spawn the `frontend-dev` subagent with:
- The full feature description
- The confirmed API contract from Step 2
- The component/page specifications
- Instructions to follow existing component patterns

Wait for frontend-dev to complete before proceeding.

**Step 4 — Review (parallel)**
Spawn `proofreader` AND `cybersecurity` subagents IN PARALLEL.
Pass both agents the complete list of files created or modified in Steps 2 and 3.

Wait for both to complete.

**Step 5 — Final Report**
Synthesize all outputs:

```
## Build Complete: $ARGUMENTS

### Files Created
- list

### Files Modified
- list

### Quality Findings (proofreader)
- [blocking/non-blocking] description

### Security Findings (cybersecurity)
- [severity] description

### Merge Readiness
- [ ] All tests pass
- [ ] No blocking quality issues
- [ ] No critical/high security issues
```

If there are blocking issues, halt and ask the user how to proceed.
