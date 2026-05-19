# SKILL.md

Skills, conventions, and patterns for working on the MindMappr codebase.

---

## Tech Stack Quick Reference

| Layer      | Tech                                                              |
|------------|-------------------------------------------------------------------|
| Backend    | Python 3.9+, FastAPI, Pydantic v2, SQLAlchemy                    |
| Database   | Supabase PostgreSQL (session pooler), Alembic migrations          |
| Auth       | Supabase Auth + PyJWT verification (HS256)                       |
| AI         | Anthropic SDK (`anthropic`), Claude (prompt caching enabled)      |
| Frontend   | Next.js 16.2.4, React 19, TypeScript (App Router)                |
| Auth (FE)  | `@supabase/ssr` + `@supabase/supabase-js`                        |
| Server     | Uvicorn (ASGI)                                                    |
| Deploy     | Vercel (frontend) + AWS Elastic Beanstalk (backend)              |
| Container  | Docker (backend, non-root user)                                   |

---

## Common Mistakes to Avoid

### Supabase Connection
- **NEVER use Direct Connection** (`db.[ref].supabase.co`) — it's IPv6-only and fails on most networks
- **NEVER use Transaction Pooler** without the paid IPv4 add-on
- **ALWAYS use Session Pooler** (`aws-X-region.pooler.supabase.com:5432`) — IPv4-compatible, free
- URL must start with `postgresql+psycopg://` for SQLAlchemy + psycopg3 (`database.py` auto-converts)
- Install `psycopg[binary]` not `psycopg` — avoids arm64/x86_64 libpq architecture mismatch on macOS

### Authentication
- Use `PyJWT` — **not** `python-jose` (has unfixed CVEs, effectively unmaintained)
- Always pass `audience="authenticated"` to `jwt.decode()` — Supabase sets this claim on all tokens
- Missing `SUPABASE_JWT_SECRET` must raise `RuntimeError` at startup — never default to `""`
- Wrap `uuid.UUID(sub)` in try/except — a non-UUID `sub` claim causes unhandled 500 otherwise
- Never interpolate exception objects into HTTP response `detail` — use static strings

### Next.js 16
- Route guard file is **`proxy.ts`**, NOT `middleware.ts` — this is a breaking rename in Next.js 16
- Exported function must be named `proxy` (or default export), not `middleware`
- Use `@supabase/ssr` — `@supabase/auth-helpers-nextjs` is deprecated
- In `proxy.ts`: call `supabase.auth.getUser()` (validates with Supabase server)
- In client components: call `getSession()` (reads already-validated cookie — faster)
- Supabase now calls the anon key "publishable key" in the dashboard — env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

### Alembic / Migrations
- Adding `NOT NULL` column to a table with existing rows requires `server_default` — otherwise migration crashes
- Two-step safe approach: add nullable → backfill → `ALTER COLUMN ... SET NOT NULL`
- Never call `Base.metadata.create_all()` in `main.py` — Alembic owns the schema
- `alembic/env.py` must call `load_dotenv()` before importing from `backends.database`
- `get_db()` lives only in `database.py` — do not duplicate in `dependencies.py`

### Supabase Dashboard
- **Custom SMTP must be fully configured or fully OFF** — enabling it with empty fields breaks all signups
- Disable email confirmation in dev (Authentication → Settings → "Enable email confirmations" OFF)
- Create test users directly in Authentication → Users → Add user (bypasses email validation)
- `SUPABASE_JWT_SECRET` is in Settings → API → JWT Settings → JWT Secret

---

## Backend Patterns

### Architecture: Router → Service → Schema

- **Routers** handle HTTP: status codes, auth dependencies, exception mapping. No business logic.
- **Services** contain business logic and external API calls (Claude, etc.).
- **Schemas** are Pydantic v2 models for request/response validation and serialization.
- **Auth** is enforced via `Depends(get_current_user_id)` on every protected endpoint.

### Adding a New Endpoint

1. Define request/response schemas in `backends/schemas/`.
2. Write business logic in `backends/services/`.
3. Create or extend a router in `backends/routers/` with `Depends(get_current_user_id)`.
4. Mount the router in `backends/main.py` with `app.include_router(...)`.
5. Generate and apply a migration if models changed.

### Auth Dependency Pattern

```python
from backends.auth import get_current_user_id

@router.get("/")
def my_endpoint(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    # user_id is the Supabase UUID string from JWT sub claim
    return db.query(MyModel).filter(MyModel.user_id == user_id).all()
```

Always scope DB queries to `user_id` — never return rows belonging to other users.

### UUID Handling in Routers

```python
try:
    parsed_user_id = uuid.UUID(user_id)
except ValueError:
    raise HTTPException(status_code=401, detail="Invalid user identity in token")
```

### Claude API Integration

- SDK: `from anthropic import Anthropic` — **not** OpenAI
- Prompt caching is enabled (`cache_control: {"type": "ephemeral"}` on system prompt)
- System prompt enforces JSON-only output with a strict schema
- Response: extract `TextBlock.text`, parse as JSON
- Fallback: on `JSONDecodeError` / `ValueError`, return a generic `StudyRecommendation`
- Model: `claude-sonnet-4-6` (configurable in `services/study.py`)

### Environment Variable Startup Check Pattern

```python
# Fail fast at startup — never silently use a wrong/empty default
VALUE = os.getenv("MY_VAR")
if not VALUE:
    raise RuntimeError("MY_VAR environment variable is not set")
```

Both `DATABASE_URL` and `SUPABASE_JWT_SECRET` follow this pattern.

---

## Frontend Patterns

### Supabase Client Usage

```typescript
// In "use client" components — browser session
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();

// In Server Components / Route Handlers
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
```

### Sending Auth to Backend

```typescript
const { data: { session } } = await createClient().auth.getSession();
const res = await fetch(`${API_BASE}/study/`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
  },
  body: JSON.stringify(payload),
});
```

### Auth State in Client Components

Use `onAuthStateChange` to keep the token fresh (Supabase auto-refreshes):

```typescript
useEffect(() => {
  const supabase = createClient();
  supabase.auth.getSession().then(({ data: { session } }) => {
    setAccessToken(session?.access_token ?? null);
  });
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setAccessToken(session?.access_token ?? null);
  });
  return () => subscription.unsubscribe();
}, []);
```

---

## Security Audit Workflow

1. **Scope** — Identify exposed surfaces: routes, env vars, DB access, external APIs.
2. **Secrets** — No hardcoded secrets. `.env` gitignored. `.env.example` placeholders only. Rotate immediately if exposed.
3. **Endpoints** — All non-public routes have auth dependency. No raw exception strings in responses. Pydantic validation on all mutable endpoints.
4. **Database** — `DATABASE_URL` from env. ORM only. Schema changes via Alembic only.
5. **Dependencies** — Minimal and current. No known CVE packages. `psycopg[binary]`, `PyJWT`.
6. **Runtime** — Docker runs as non-root. Sensitive values never logged.

### Security Review Output Format

1. Findings ordered by severity (`critical` → `low`)
2. File + line references and exact risky behavior
3. Clear remediation per finding
4. Open questions / residual risk

---

## Mandatory Pre-Merge Checks

- `git grep` confirms no real secrets in tracked files
- `.env` and `.env.local` are gitignored
- All new routes have `Depends(get_current_user_id)` or are explicitly public
- No raw exception interpolation in HTTP response `detail` fields
- DB queries are scoped to `user_id` — no cross-user data leakage
- Alembic migration generated and applied for any model changes
- Frontend sends `Authorization: Bearer` header on all protected API calls
