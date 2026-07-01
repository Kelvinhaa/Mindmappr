# MindMappr

> An AI-powered study retention system — generate personalised study plans with Claude AI, then reinforce learning through FSRS-5 spaced repetition scheduling and review tracking.

**Live demo:** [mindmappr-omega.vercel.app](https://mindmappr-omega.vercel.app)

---

## What it does

Most AI study tools stop at generating a plan. MindMappr closes the loop:

1. **Generate** — Claude AI produces a structured study plan (techniques, durations, tips) tailored to your subject, level, and goal
2. **Track** — every session is persisted to a PostgreSQL database, tied to your account
3. **Review** — sessions enter an FSRS-5 spaced repetition queue; the algorithm schedules the next review date based on how well you recalled the material
4. **Repeat** — stability and difficulty adjust over time, so hard subjects get reviewed more frequently

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────────────┐
│   Next.js 16        │  HTTPS │   FastAPI (AWS Elastic Beanstalk) │
│   (Vercel)          │───────▶│                                  │
│                     │        │  ┌──────────┐  ┌──────────────┐  │
│  React 19           │        │  │  Auth    │  │  Rate Limit  │  │
│  TypeScript         │        │  │ (JWKS)   │  │  (slowapi)   │  │
│  Supabase Auth      │        │  └──────────┘  └──────────────┘  │
└─────────────────────┘        │                                  │
                               │  ┌──────────┐  ┌──────────────┐  │
         ┌─────────────────────│  │  Claude  │  │  SQLAlchemy  │  │
         │  Supabase           │  │  Haiku   │  │  + Alembic   │  │
         │  PostgreSQL ◀───────│  │  (async) │  │  migrations  │  │
         └─────────────────────┘  └──────────┘  └──────────────┘  │
                               └──────────────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Auth | Supabase Auth — JWT verified server-side via JWKS (`PyJWKClient`) + PyJWT |
| Backend | FastAPI, Python 3.11, Uvicorn (ASGI) |
| AI | Anthropic Claude Haiku 4.5 via `AsyncAnthropic`, prompt caching on system prompt |
| Database | Supabase PostgreSQL, SQLAlchemy ORM, Alembic migrations |
| Deployment | Vercel (frontend) + AWS Elastic Beanstalk Docker (backend) |
| CI/CD | GitHub Actions — CI on PRs, deploy to EB on push to `main` |
| Rate limiting | slowapi — 5 req/min on session creation, 3 req/hour on preview |

---

## Key implementation details

### FSRS-5 spaced repetition

Sessions enter a review queue after creation. When reviewed, the FSRS-5 algorithm (Free Spaced Repetition Scheduler) recalculates stability and difficulty from the rating, then derives the next review date:

```python
def apply_fsrs(stability, difficulty, review_count, rating, elapsed_days=None):
    # rating: 1=Again, 2=Hard, 3=Good, 4=Easy
    if stability == 0 or review_count == 0:
        s = _initial_stability(rating)
        d = _initial_difficulty(rating)
        return _fsrs_interval(s), s, d

    t = elapsed_days if elapsed_days is not None else _fsrs_interval(stability)
    r = _retrievability(t, stability)          # predicted recall probability now
    d = _next_difficulty(difficulty, rating)
    s = (_stability_forget(stability, difficulty, r) if rating == 1
         else _stability_recall(stability, difficulty, r, rating))
    return _fsrs_interval(s), s, d
```

Unlike SM-2's single "ease factor," FSRS tracks *stability* (how slowly a memory decays) and *difficulty* (how hard the item is to relearn) separately, and schedules the next review for the point where predicted recall probability drops to the desired retention target (90%). A subject rated "Again" resets stability sharply; one rated "Easy" pushes the interval out further than SM-2 would. (An SM-2 implementation is kept in `services/study.py` for reference but is no longer wired to the review endpoint.)

### Async Claude integration with prompt caching

The system prompt is identical on every request — caching it saves ~90% of input token cost after the first call:

```python
response = await client.messages.create(
    model="claude-haiku-4-5",
    system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
    messages=[{"role": "user", "content": user_message}],
    max_tokens=800,
)
```

The client is `AsyncAnthropic` and `generate_recommendation` is `async def`, so FastAPI never blocks a thread during the Claude call.

### JWT authentication via JWKS

All `/study/` routes (except `/study/preview`) verify Supabase-issued JWTs server-side using PyJWT (not python-jose, which has unfixed CVEs). Instead of a shared secret, the backend fetches Supabase's public signing keys from its JWKS endpoint and verifies the token's signature against whichever key signed it — no secret to rotate or leak:

```python
signing_key = jwks_client.get_signing_key_from_jwt(token)
payload = jwt.decode(token, signing_key.key, algorithms=["ES256", "RS256", "HS256"], audience="authenticated")
```

If `SUPABASE_URL` is unset, the JWKS client is never constructed and every request fails closed with 401 — no silent auth bypass possible.

### Database migrations

Schema is managed entirely through Alembic. `Base.metadata.create_all()` is intentionally absent — every schema change goes through a versioned migration file that can be reviewed, rolled back, and audited.

---

## Local development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Supabase project
- An Anthropic API key

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in: ANTHROPIC_API_KEY, DATABASE_URL, SUPABASE_JWT_SECRET, SUPABASE_URL

alembic upgrade head
uvicorn backends.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend-next
npm install

# Create frontend-next/.env.local:
# NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
# NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
# NEXT_PUBLIC_API_URL=http://localhost:8000

npm run dev   # http://localhost:3000
```

---

## Project structure

```
Mindmappr/
├── backend/
│   ├── backends/
│   │   ├── main.py              # FastAPI app, CORS, rate limiting
│   │   ├── auth.py              # Supabase JWT verification via JWKS
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── dependencies.py      # slowapi limiter
│   │   ├── models.py            # ORM models (StudySession)
│   │   ├── routers/study.py     # HTTP route handlers
│   │   ├── services/study.py    # Claude API + FSRS-5 algorithm
│   │   └── schemas/study.py     # Pydantic request/response models
│   ├── alembic/                 # Database migration scripts
│   └── Dockerfile
├── frontend-next/
│   ├── app/
│   │   ├── page.tsx             # Main form + results
│   │   ├── dashboard/page.tsx   # Session history
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── lib/supabase/
│   │   ├── client.ts            # Browser Supabase client
│   │   └── server.ts            # Server-side Supabase client
│   └── proxy.ts                 # Route guard middleware (Next.js 16)
└── .github/workflows/aws-ci-cd.yml
```

---

## API endpoints

All `/study/` routes except `/study/preview` require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | Health check |
| `GET` | `/health` | — | Health check |
| `GET` | `/db-test` | — | Database connectivity check |
| `POST` | `/study` | Required | Create session + generate plan (5/min rate limit) |
| `GET` | `/study` | Required | List user's sessions |
| `GET` | `/study/{id}` | Required | Get specific session |
| `POST` | `/study/preview` | — | Generate plan without saving, guest flow (3/hr rate limit) |
| `GET` | `/study/review-queue` | Required | Sessions due for review now |
| `GET` | `/study/stats` | Required | Session totals, due-today count, average stability |
| `POST` | `/study/{id}/review` | Required | Submit FSRS-5 review rating (1=Again..4=Easy) |

---

## CI/CD pipeline

```
PR opened          →  CI: install deps, syntax check, Docker build
Push to main       →  CI + deploy to AWS Elastic Beanstalk (Docker)
```

Backend environment variables (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`) are configured in Elastic Beanstalk settings — never committed.

---

## What I'd build next

- **Automated tests** — `apply_fsrs` is a pure function and the highest-leverage place to start (unit tests for stability/difficulty transitions), followed by auth dependency and route-level integration tests
- **Flashcard generation** — `POST /study/{id}/flashcards` uses the study plan to auto-generate Q&A pairs that feed the FSRS queue
- **Study analytics** — retention rate per subject, stability trend over time, subjects most often rated "Again"
- **Shared rate-limit store** — move `slowapi` off in-process memory to Redis so limits hold correctly across multiple Elastic Beanstalk instances
- **Retention curve / streak visualisation** — chart predicted recall probability over time per session, plus a study streak heatmap

---

## Author

Kelvin Ha — [github.com/Kelvinhaa](https://github.com/Kelvinhaa)
