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
| Deploy   | Vercel (Python runtime via `api/`)     |
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