# SKILL.md

Skills, conventions, and patterns for working on the MindMappr codebase.

---

## Tech Stack Quick Reference

| Layer    | Tech                                   |
|----------|----------------------------------------|
| Backend  | Python 3.10+, FastAPI, Pydantic v2     |
| AI       | Anthropic SDK (`anthropic`), Claude     |
| Frontend | Vanilla JS (ES6+), HTML5, CSS3         |
| Server   | Uvicorn (ASGI)                         |
| Deploy   | Vercel (frontend) + AWS Elastic Beanstalk (backend) |
| Container| Docker (backend)                       |

---
## Backend Patterns

### Architecture: Router → Service → Schema

- **Routers** handle HTTP concerns (status codes, exceptions). No business logic.
- **Services** contain business logic and external API calls (Claude).
- **Schemas** are Pydantic v2 models for request/response validation.

### Adding a New Endpoint

1. Define request/response models in `backends/schemas/`.
2. Write the business logic function in `backends/services/`.
3. Create or extend a router in `backends/routers/`, wire up the service.
4. Mount the router in `backends/main.py` with `app.include_router(...)`.

### Claude API Integration

- SDK: `from anthropic import Anthropic` — **not** OpenAI.
- Client initialized in `services/study.py` using `ANTHROPIC_API_KEY` env var.
- System prompt enforces JSON-only output with a strict schema.
- Response parsing: extract `TextBlock.text`, strip markdown fences if present, `json.loads`.
- Fallback: on `JSONDecodeError`/`ValueError`/`KeyError`, return a generic `StudyRecommendation` instead of crashing.
- On unexpected exceptions, raise `RuntimeError` → router converts to HTTP 503.

---
## Security Audit Workflow

Use this flow for any backend change (API, database, deployment, auth, or integrations).

1. **Scope and classify risk**
- Identify exposed surfaces: routes, middleware, env vars, database access, external API calls.
- Classify findings by severity: `critical`, `high`, `medium`, `low`.

2. **Secrets and credentials checks**
- Never hardcode secrets, API keys, tokens, passwords, or connection strings in source files.
- Ensure `.env` files are gitignored and use `.env.example` placeholders only.
- If a real secret is exposed, rotate it immediately and treat as `critical`.

3. **Endpoint security checks**
- Verify auth + authorization on protected routes.
- Ensure error responses do not leak stack traces, hostnames, SQL errors, or credentials.
- Confirm request validation exists for all mutable endpoints (POST/PATCH/PUT/DELETE).
- Check CORS is explicit and not wildcard in production.

4. **Database and persistence checks**
- Use environment-driven `DATABASE_URL`; no local credentials in committed code.
- Use ORM/parameterized statements only (no string-built SQL).
- Ensure migration-safe naming and constraints (`NOT NULL`, `FK`, uniqueness where needed).

5. **Dependency and runtime checks**
- Keep dependencies minimal and current; remove unused packages.
- Run quick vulnerability checks (`pip-audit` if available).
- Confirm container runs as non-root and does not expose unnecessary services.

6. **Operational hardening checks**
- Separate `health` and `ready` behavior where practical.
- Restrict or disable docs/openapi in production.
- Avoid logging sensitive values (keys, tokens, raw credentials).

---
## Security Review Output Format

When reporting a review, provide:

1. Findings first, ordered by severity.
2. File-level references and exact risky behavior.
3. Clear remediation per finding.
4. Open questions/assumptions.
5. Residual risk if anything remains unresolved.

---
## Mandatory Pre-Merge Security Checks

- `git grep` confirms no real secrets in tracked files.
- Sensitive local files (`.env`, keys) are ignored.
- New/changed routes have appropriate access controls.
- No internal exception leakage in API responses.
- External API integrations have timeout/error handling.
- Database connections use env config and least-privilege credentials.