import json
import os
from dotenv import load_dotenv
from anthropic import Anthropic
from anthropic.types import TextBlock
from typing import Optional
from backends.schemas.study import StudyRecommendation

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are an expert study coach who creates practical, specific study plans.
You respond ONLY with valid JSON (no markdown, no code fences, no extra text).
The JSON must have exactly this structure:
{
  "summary": "A 1-2 sentence overview of the study plan",
  "techniques": [
    {
      "title": "Technique name",
      "description": "2-3 sentences explaining how to apply this technique specifically to the given subject. Be concrete and actionable, not generic.",
      "duration_minutes": <integer minutes allocated to this technique>
    }
  ],
  "tips": [
    "A practical, specific tip relevant to the subject and level"
  ]
}

Rules:
- Provide 2-4 techniques depending on available time
- The sum of all duration_minutes MUST equal the total study duration provided
- Tips should be 2-4 concrete, actionable items specific to the subject
- Never use phrases like "Here are some techniques" or "I recommend" -- just provide the data
- Tailor everything to the specific subject matter, not generic study advice
- For the summary, write as if you're briefing a student before a session -- direct, confident, no hedging"""


def _fallback_recommendation(subject: str, time: int, level: str) -> StudyRecommendation:
    return StudyRecommendation(
        summary=f"Study plan for {subject} ({time} minutes, {level} level)",
        techniques=[
            {
                "title": "Focused Study Session",
                "description": f"Dedicate your {time} minutes to focused study of {subject}. "
                "Remove distractions and work through the material methodically.",
                "duration_minutes": time,
            }
        ],
        tips=[
            "Take short breaks every 25 minutes to maintain focus.",
            "Review your notes within 24 hours to strengthen retention.",
        ],
    )


def generate_recommendation(
    subject: str, level: str, time: int, goal: Optional[str] = None
) -> StudyRecommendation:
    goal_line = f"\n- Learning goal: {goal}" if goal else ""

    user_message = f"""Create a study plan for:
- Subject: {subject}
- Level: {level}
- Duration: {time} minutes{goal_line}

Respond with JSON only."""

    try:
        response = client.messages.create(
            model="claude-opus-4-6",
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
            max_tokens=1024,
        )

        content_block = response.content[0]
        if isinstance(content_block, TextBlock):
            raw = content_block.text.strip()
            # Strip markdown code fences if Claude adds them despite instructions
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                raw = raw.rsplit("```", 1)[0]
                raw = raw.strip()
            data = json.loads(raw)
            return StudyRecommendation(**data)

        raise ValueError("Unexpected response format from Claude")

    except (json.JSONDecodeError, ValueError, KeyError) as e:
        print(f"[study-service] Parse error, using fallback: {e}")
        return _fallback_recommendation(subject, time, level)
    except Exception as e:
        print(f"[study-service] API error, using fallback: {e}")
        return _fallback_recommendation(subject, time, level)
