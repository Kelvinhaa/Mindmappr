# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MindMappr is an AI Study Assistant that provides personalized study recommendations based on subject, duration, and expertise level. The application consists of:
- **Frontend**: Next.js 16.2.4 (App Router, TypeScript, React 19) — located in `frontend-next/`
- **Backend**: FastAPI + SQLAlchemy + Supabase PostgreSQL, with Supabase Auth JWT verification
- **AI**: Claude API (Anthropic) for generating study recommendations

---

## Development Commands

### Backend
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt

# Run dev server (loads .env automatically via load_dotenv())
uvicorn backends.main:app --reload --port 8000
```

Required `backend/.env`:
```
ANTHROPIC_API_KEY=...
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
SUPABASE_JWT_SECRET=...
SUPABASE_URL=https://[ref].supabase.co
```

### Database Migrations (Alembic)
```bash
cd backend
source .venv/bin/activate

# Generate migration after model changes
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head
```

**Alembic owns the schema** — `Base.metadata.create_all()` is intentionally removed from `main.py`.

### Frontend
```bash
cd frontend-next
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

Required `frontend-next/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Architecture

### Backend (`backend/backends/`)

```
backends/
├── main.py              # FastAPI app, CORS, rate limiting, load_dotenv()
├── auth.py              # Supabase JWT verification via PyJWT
├── database.py          # SQLAlchemy engine, SessionLocal, Base, get_db()
├── dependencies.py      # limiter (slowapi) — get_db() lives in database.py NOT here
├── models.py            # ORM models (StudySession with user_id UUID)
├── routers/
│   └── study.py         # /study/ endpoints — all require JWT auth
├── services/
│   └── study.py         # Claude API integration with prompt caching
└── schemas/
    └── study.py         # Pydantic request/response models
alembic/                 # Migration scripts
alembic.ini
```

**Key patterns:**
- `Router → Service → Schema` — routers handle HTTP, services handle business logic
- All `/study/` routes require `Depends(get_current_user_id)` — unauthenticated → 401
- `get_db()` is defined **only** in `database.py`; `dependencies.py` owns `limiter` only
- `load_dotenv()` is called at the **top of `main.py` before other backend imports**

### Frontend (`frontend-next/`)

```
app/
├── page.tsx             # Main study form — fetches Supabase session, sends Bearer token
├── login/page.tsx       # Email/password login
├── register/page.tsx    # User registration
├── auth/callback/       # Supabase email confirmation redirect handler
└── globals.css          # CSS variables, warm orange theme

lib/supabase/
├── client.ts            # createBrowserClient() — use in "use client" components
└── server.ts            # createServerClient() with cookies — use in Server Components

proxy.ts                 # Route guard (Next.js 16 name for middleware.ts)
```

**Next.js 16 specific:** The middleware file is named `proxy.ts`, NOT `middleware.ts`. The exported function is `proxy()`, not `middleware()`. This is a breaking change from Next.js 15.

### API Endpoints

All `/study/` routes require `Authorization: Bearer <supabase-jwt>` header.

- `GET /` — health check (public)
- `GET /health` — health check (public)
- `GET /db-test` — DB connectivity check (public)
- `POST /study/` — create study session (auth required, rate limited 5/min)
- `GET /study/` — list user's sessions (auth required, scoped to user_id)
- `GET /study/{id}` — get specific session (auth required, scoped to user_id)

### Data Flow

1. User logs in via `/login` → Supabase sets session cookie
2. `proxy.ts` validates session on every request; unauthenticated → redirect to `/login`
3. `page.tsx` reads session token via `createClient().auth.getSession()`
4. Frontend sends `POST /study/` with `Authorization: Bearer <token>`
5. FastAPI `auth.py` verifies JWT using `SUPABASE_JWT_SECRET` (audience: `"authenticated"`)
6. Router creates `StudySession` with `user_id` from JWT `sub` claim
7. `services/study.py` calls Claude API → returns JSON study plan
8. Row stored in Supabase PostgreSQL; response returned to frontend

---

## Important Implementation Notes

### Supabase Connection
- **Use Session Pooler** (port 5432): `aws-X-region.pooler.supabase.com:5432` — works on IPv4
- **Do NOT use Direct Connection**: IPv6-only, fails on most home/office networks
- **Do NOT use Transaction Pooler** without enabling the IPv4 add-on (costs extra)
- URL prefix must be `postgresql+psycopg://` for psycopg3 — `database.py` auto-converts `postgres://` and `postgresql://`
- Use `psycopg[binary]` (not `psycopg`) to avoid arm64/x86_64 libpq architecture mismatch

### Authentication
- JWT verification uses `PyJWT` — **not** `python-jose` (has unfixed CVEs, unmaintained)
- Supabase JWTs have `aud="authenticated"` — must pass `audience="authenticated"` to `jwt.decode()`
- `SUPABASE_JWT_SECRET` missing → raises `RuntimeError` at startup (same pattern as `DATABASE_URL`)
- `user_id` in models is UUID type; wrap `uuid.UUID(sub_claim)` in try/except to avoid unhandled 500
- Never return raw exception strings from JWT errors — use static messages only

### Supabase Custom SMTP
- **Leave "Enable custom SMTP" OFF for development** — turning it on with empty fields breaks all signups
- Only configure custom SMTP in production with all fields filled

### Alembic Migrations
- Adding a `NOT NULL` column to an existing table requires a `server_default` or two-step migration (add nullable → backfill → alter to NOT NULL)
- `alembic/env.py` loads `.env` via `load_dotenv()` so migrations can run standalone
- Never edit migration files after they've been applied to production

### Environment Variables
- Backend: `ANTHROPIC_API_KEY`, `DATABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_URL`
- Frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_API_URL`
- Supabase now calls the anon key "publishable key" in newer dashboard versions
- Never commit `.env` or `.env.local` — only `.env.example` with placeholders

### CORS
- Backend allows: `localhost:3000`, `localhost:5500`, `127.0.0.1:3000/5500`, Vercel URLs
- Configurable via `CORS_ORIGINS` env var (comma-separated)
- `allow_credentials=True` is required for cookie-based auth

### Frontend Auth Pattern
- Browser-side auth: `createClient()` from `lib/supabase/client.ts`
- Server-side auth: `createClient()` from `lib/supabase/server.ts` (async, reads cookies)
- In client components: use `getSession()` to read the already-validated session token
- In proxy.ts: use `getUser()` (validates against Supabase server on every request)
- Session token is passed to FastAPI as `Authorization: Bearer <access_token>`

---

## Security Audit Checklist

Apply before every commit or deployment affecting the backend.

1. **Secrets** — No real secrets in tracked files. `.env` gitignored. `.env.example` has placeholders only.
2. **Auth** — All non-public routes have `Depends(get_current_user_id)`. Missing `SUPABASE_JWT_SECRET` crashes at startup.
3. **Error responses** — No raw exception strings returned to clients. Static messages only.
4. **Input validation** — All request bodies validated by Pydantic schemas.
5. **Database** — `DATABASE_URL` from env only. ORM/parameterized queries only. Schema changes via Alembic only.
6. **Dependencies** — No unnecessary packages. `psycopg[binary]` not `psycopg`. `PyJWT` not `python-jose`.
7. **CORS** — Explicit origins list, not wildcard, in production.

---

## Commit Message Style
- Natural, human style — no AI-sounding language
- Concise, lowercase where appropriate
- Imperative mood (`add`, `fix`, `update` — not `added`, `fixed`)
- No `Co-Authored-By` lines or AI attribution
- Prefix with `feat:`, `fix:`, `chore:` etc. where helpful

---

## Backend CI/CD (GitHub Actions + Elastic Beanstalk)

Pipeline: `.github/workflows/aws-ci-cd.yml`
- CI runs on PRs: dependency install, syntax/import checks, docker build
- Deploy on push to `main`: creates EB application version, updates target environment

Required GitHub variables: `AWS_REGION`, `EB_APP_NAME`, `EB_ENV_NAME`, `EB_S3_BUCKET`
Required GitHub secret: `AWS_ROLE_TO_ASSUME` (IAM role via GitHub OIDC)

Set all backend env vars (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, etc.) in Elastic Beanstalk environment settings — never in committed files.
