# App de Comptabilité — Project Context

## What this repo is
A multi-agent AI developer stack powered by Claude Code. The Tech Lead agent orchestrates specialist agents (frontend, backend, proofreader, cybersecurity) to handle software development tasks end-to-end.

## Available slash commands
- `/build-feature <description>` — Full-stack feature with all agents
- `/review-pr [PR number or branch]` — Quality + security review of a PR
- `/security-audit [path or "full"]` — Standalone OWASP security audit
- `/frontend-task <description>` — Scoped frontend work only
- `/backend-task <description>` — Scoped backend work only

## Tech stack
- **Frontend**: React, React Router, CSS Modules
- **Backend**: Node.js, Express
- **Testing**: Jest (unit), React Testing Library (components)
- **Linting**: ESLint + Prettier
- **Build**: Vite (frontend), Node (backend)

## Project structure conventions
```
project/
├── client/          # React frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── lib/
├── server/          # Node/Express backend
│   └── src/
│       ├── routes/
│       ├── middleware/
│       ├── services/
│       └── db/
└── shared/          # Shared logic between client and server
```

## Coding standards
- All imports use path aliases: `@/components/...`, `@/lib/...`
- Commit format: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Branch naming: `feature/short-description`, `fix/issue-number`
- Functional React components only — no class components
- All endpoints require auth unless explicitly marked public
- No raw SQL string interpolation — use parameterized queries

## Build and test commands
- Install: `npm install`
- Dev (frontend): `npm run dev:client`
- Dev (backend): `npm run dev:server`
- Dev (both): `npm run dev`
- Test: `npm test`
- Lint: `npm run lint`
- Build: `npm run build`

## Agent coordination rules
- Tech Lead plans before delegating — never writes application code itself
- Backend API contracts are defined before frontend consumes them
- Proofreader and cybersecurity always run after code is written, not before
- Security agent is read-only — it reports findings, never modifies code
