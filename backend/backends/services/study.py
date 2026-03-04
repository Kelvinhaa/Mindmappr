import os
from dotenv import load_dotenv
from anthropic import Anthropic
from anthropic.types import TextBlock
from typing import Optional

load_dotenv()

client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

def generate_recommendation(subject:str, level:str, time:int) -> Optional[str]:
    try:
        response = client.messages.create(
            model="claude-opus-4-6",
            messages=[{
                "role": "user",
                "content": f"""You are a study coach. Suggest effective study techniques for:
                    - Subject: {subject}
                    - Level: {level}
                    - Duration: {time} minutes
                    
                    Provide 2-3 specific, actionable techniques tailored to this subject and time available."""
            }],
            max_tokens=1024
        )
        
        content_block = response.content[0]
        if isinstance(content_block, TextBlock):
            return content_block.text
        return "No recommendation available."
    except Exception as e:
        return f"Error generating recommendation: {str(e)}"