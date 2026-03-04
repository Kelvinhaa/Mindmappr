# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MindMappr is an AI Study Assistant that provides personalized study recommendations based on subject, duration, and expertise level. The application consists of:
- **Frontend**: Vanilla JavaScript SPA with a modern dark theme
- **Backend**: FastAPI service using Claude API (Anthropic) for generating study recommendations

## Development Commands

### Backend Setup & Running
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (first time only)
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # On macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
# Create .env file with: ANTHROPIC_API_KEY=your_api_key_here

# Run the development server
python -m backends.main
# Or using uvicorn directly:
uvicorn backends.main:app --reload --port 8000
```

The backend runs on `http://localhost:8000`

### Frontend Setup & Running
```bash
# Navigate to frontend directory
cd frontend

# Open with a local server (use any of these methods):
# 1. VS Code Live Server extension (right-click index.html → Open with Live Server)
# 2. Python HTTP server:
python -m http.server 5500
# 3. Node.js http-server:
npx http-server -p 5500
```

The frontend expects to run on ports 3000, 5500, or similar (see CORS configuration).

## Architecture

### Backend Architecture (`backend/backends/`)

The backend follows a layered FastAPI architecture:

```
backends/
├── main.py              # FastAPI app entry point, CORS config
├── routers/
│   └── study.py        # API endpoints for study recommendations
├── services/
│   └── study.py        # Business logic, Claude API integration
├── schemas/
│   └── study.py        # Pydantic models for request/response validation
├── database.py         # (Placeholder for future DB integration)
└── dependencies.py     # Shared dependencies
```

**Key Design Patterns:**
- **Router → Service → Schema**: Routers handle HTTP, services contain business logic, schemas validate data
- **In-memory storage**: Currently using Python list for database (see `routers/study.py:10`)
- **Claude API Integration**: Uses `anthropic` SDK (not `openai`) - see `services/study.py`
- **Model**: Currently using `claude-opus-4-6` model

### Frontend Architecture (`frontend/`)

Simple vanilla JavaScript application with no build process:

```
frontend/
├── index.html          # Main HTML structure
├── script.js           # DOM manipulation, API calls, state management
└── style.css           # shadcn-inspired dark theme with CSS variables
```

**Key Features:**
- **API Base URL**: Hardcoded in `script.js:1` as `http://localhost:8000`
- **Status Indicator**: Real-time API connection status check on page load
- **Form Validation**: Client-side validation before API submission
- **Loading States**: Button spinner during API calls
- **Results Display**: Dynamic content injection with animation

### API Endpoints

- `GET /` - Health check endpoint
- `POST /study/` - Generate study recommendations
  - Request: `{ time: number, subject: string, level: string }`
  - Response: `{ id: number, time: number, subject: string, level: string, recommendation: string }`
- `GET /study/` - List all study sessions (in-memory database)
- `GET /study/{study_id}` - Get specific study session

### Data Flow

1. User submits form in frontend (`script.js:68-101`)
2. Frontend sends POST to `/study/` endpoint
3. Router (`routers/study.py:17`) receives request, validates with Pydantic schema
4. Service (`services/study.py:11`) calls Claude API with prompt template
5. Response includes AI-generated study recommendation
6. Router stores result in in-memory database and returns to frontend
7. Frontend displays recommendation in results card

## Important Implementation Notes

### Environment Variables
- Backend requires `ANTHROPIC_API_KEY` in `backend/.env`
- No environment variables needed for frontend

### CORS Configuration
- Backend allows origins: `localhost:3000`, `localhost:5500`, `127.0.0.1:3000`, `127.0.0.1:5500`
- When adding new frontend ports, update `main.py:8-13`

### AI Model Configuration
- Using `anthropic` Python SDK (NOT OpenAI SDK)
- Import: `from anthropic import Anthropic`
- Model: `claude-opus-4-6` (configurable in `services/study.py:14`)
- Response handling uses `TextBlock` type checking

### Styling System
- CSS variables defined in `:root` selector (`style.css:8-33`)
- Color scheme: warm dark theme with orange primary (`--primary: #f97316`)
- Uses `rem` units for responsive spacing
- Mobile breakpoint at 480px

### Current Limitations
- No persistent database (data lost on server restart)
- No user authentication
- No error recovery for failed AI API calls
- Frontend hardcodes backend URL (no environment configuration)

## Commit Message Style
- Write commit messages in a natural, human style — no AI-sounding language
- Keep messages concise and lowercase where appropriate
- Use imperative mood (e.g., "add backend API", not "Added backend API")
- Do NOT include "Co-Authored-By" lines or AI attribution in commits

## Future Considerations

If implementing database persistence:
- `database.py` is placeholder for SQLAlchemy setup
- Update `routers/study.py` to use real DB instead of in-memory list
- Add migration scripts

If adding authentication:
- Update CORS to handle credentials
- Add auth middleware to FastAPI app
- Frontend needs to store/send auth tokens
