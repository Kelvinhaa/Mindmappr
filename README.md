# MindMappr

> An AI-powered study retention system — generate personalised study plans with Claude AI, then reinforce learning through SM-2 spaced repetition scheduling and review tracking.

**Live demo:** [mindmappr-omega.vercel.app](https://mindmappr-omega.vercel.app)

---

## What it does

Most AI study tools stop at generating a plan. MindMappr closes the loop:

1. **Generate** — Claude AI produces a structured study plan (techniques, durations, tips) tailored to your subject, level, and goal
2. **Track** — every session is persisted to a PostgreSQL database, tied to your account
3. **Review** — sessions enter an SM-2 spaced repetition queue; the algorithm schedules the next review date based on how well you recalled the material
4. **Repeat** — ease factor and interval adjust over time, so hard subjects get reviewed more frequently

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────────────┐
│   Next.js 16        │  HTTPS │   FastAPI (AWS Elastic Beanstalk) │
│   (Vercel)          │───────▶│                                  │
│                     │        │  ┌──────────┐  ┌──────────────┐  │
│  React 19           │        │  │  Auth    │  │  Rate Limit  │  │
│  TypeScript         │        │  │ (PyJWT)  │  │  (slowapi)   │  │
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
| Auth | Supabase Auth — JWT verified server-side with PyJWT |
| Backend | FastAPI, Python 3.11, Uvicorn (ASGI) |
| AI | Anthropic Claude Haiku 4.5 via `AsyncAnthropic`, prompt caching on system prompt |
| Database | Supabase PostgreSQL, SQLAlchemy ORM, Alembic migrations |
| Deployment | Vercel (frontend) + AWS Elastic Beanstalk Docker (backend) |
| CI/CD | GitHub Actions — CI on PRs, deploy to EB on push to `main` |
| Rate limiting | slowapi — 5 req/min on session creation, 3 req/hour on preview |

---

## Key implementation details

### SM-2 spaced repetition

Sessions enter a review queue after creation. When reviewed, the SM-2 algorithm recalculates the next review date:

```python
def apply_sm2(ease_factor, interval_days, review_count, quality):
    # quality: 0=Again, 2=Hard, 4=Good, 5=Easy
    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)
    if quality < 3:
        return 1, new_ef, review_count + 1       # reset on failure
    interval = [1, 6, round(interval_days * ease_factor)][min(review_count, 2)]
    return interval, new_ef, review_count + 1
```

This means a subject rated "Hard" gets reviewed the next day; one rated "Easy" scales out to weeks.

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

### JWT authentication

All `/study/` routes verify Supabase-issued JWTs server-side using PyJWT (not python-jose, which has unfixed CVEs):

```python
payload = jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")
```

A missing or invalid `SUPABASE_JWT_SECRET` raises `RuntimeError` at startup — no silent auth bypass possible.

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
│   │   ├── auth.py              # Supabase JWT verification
│   │   ├── database.py          # SQLAlchemy engine + session
│   │   ├── models.py            # ORM models (StudySession)
│   │   ├── routers/study.py     # HTTP route handlers
│   │   ├── services/study.py    # Claude API + SM-2 algorithm
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

All `/study/` routes require `Authorization: Bearer <supabase-jwt>`.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/` | — | Health check |
| `POST` | `/study` | Required | Create session + generate plan |
| `GET` | `/study` | Required | List user's sessions |
| `GET` | `/study/{id}` | Required | Get specific session |
| `POST` | `/study/preview` | — | Generate plan without saving (guest) |
| `POST` | `/study/{id}/review` | Required | Submit SM-2 review quality score |

---

## CI/CD pipeline

```
PR opened          →  CI: install deps, syntax check, Docker build
Push to main       →  CI + deploy to AWS Elastic Beanstalk (Docker)
```

Backend environment variables (`DATABASE_URL`, `SUPABASE_JWT_SECRET`, `ANTHROPIC_API_KEY`) are configured in Elastic Beanstalk settings — never committed.

---

## What I'd build next

- **Review queue dashboard** — show sessions due today, retention curve visualisation, study streak heatmap
- **Flashcard generation** — `POST /study/{id}/flashcards` uses the study plan to auto-generate Q&A pairs that feed the SM-2 queue
- **FSRS algorithm** — implement the newer Free Spaced Repetition Scheduler alongside SM-2 and let users compare recall rates
- **Study analytics** — retention rate per subject, average ease factor over time, subjects most often rated "Again"

---

## Author

Kelvin Ha — [github.com/Kelvinhaa](https://github.com/Kelvinhaa)
