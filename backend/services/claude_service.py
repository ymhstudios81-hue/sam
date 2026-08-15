import os
import json
import logging
from typing import List, Dict, Any, Optional
import anthropic

logger = logging.getLogger("shortsforge.claude")

EDITORIAL_SYSTEM_PROMPT = """You are an elite, world-class short-form video editor and content strategist whose livelihood depends entirely on finding video moments that generate millions of views and massive audience retention on TikTok, YouTube Shorts, and Instagram Reels.

Your sole task is to analyze the provided full timestamped transcript of a video and select the highest-performing, most viral standalone clips.

### Editorial & Viral Selection Criteria:
1. **The Hook (First 3-5 seconds)**: The clip MUST start with an immediate curiosity gap, shocking statement, high-stakes question, counter-intuitive insight, or raw emotional punch.
2. **High Emotional & Narrative Energy**: Prioritize shocking claims, controversial opinions, personal struggles, business/money revelations, secrets, confessions, intense conflict, unexpected humor, and life-changing lessons.
3. **Standalone Completeness**: The clip MUST tell a cohesive, self-contained story or make a complete, punchy point that a viewer can understand without having watched the rest of the video.
4. **Strong Ending / Payoff**: The clip must end on a definitive climax, philosophical punchline, or mic-drop statement—never trailing off mid-sentence or mid-thought.
5. **Strictly Avoid**: Generic greetings ("Welcome back", "How are you"), sponsor reads, housekeeping, small talk, repetitive banter, or ambiguous references requiring missing context.

### Duration Constraints:
- Preferred length: 30 to 60 seconds.
- Acceptable length: 20 to 90 seconds.
- Do NOT cut off a brilliant story or insight early just to make it shorter. If a compelling narrative takes 75 seconds, allow it.

### Critical Output Formatting Rules:
- You MUST return ONLY a valid, parseable JSON object matching the exact schema below.
- Do NOT include any markdown code blocks (such as ```json), introductory text, or concluding notes.
- 'start' and 'end' MUST BE DECIMAL SECONDS (e.g. 72.5, 124.8). NEVER return formatted strings like "01:12".
- 'viral_score' MUST BE AN INTEGER FROM 0 TO 100 based on genuine viral potential. Differentiate clip quality realistically.
- Avoid heavily overlapping clips.

### Exact JSON Schema:
{
  "clips": [
    {
      "rank": 1,
      "start": 12.5,
      "end": 68.2,
      "duration": 55.7,
      "title": "Short Punchy Title (Max 6 words)",
      "hook": "The exact verbatim opening line that hooks the viewer",
      "reason": "Clear explanation of why this moment will hook viewers and retain 80%+ watch time",
      "viral_score": 94,
      "topics": ["startup", "controversy", "money"]
    }
  ]
}
"""

def get_claude_client(api_key: Optional[str] = None) -> anthropic.Anthropic:
    key = api_key or os.getenv("ANTHROPIC_API_KEY")
    if not key or not key.strip():
        raise ValueError("ANTHROPIC_API_KEY is not configured. Please set it in Settings or in your .env file.")
    return anthropic.Anthropic(api_key=key.strip())

def format_transcript_for_claude(segments: List[Dict[str, Any]]) -> str:
    lines = []
    for s in segments:
        lines.append(f"[{s['start']:.2f}s - {s['end']:.2f}s] {s['text']}")
    return "\n".join(lines)

def validate_claude_clips(
    clips_data: Any,
    video_duration: Optional[float] = None,
    min_duration: float = 15.0,
    max_duration: float = 120.0
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    if not isinstance(clips_data, list) or len(clips_data) == 0:
        return [], "No clips returned in 'clips' array."

    validated_clips = []
    for idx, c in enumerate(clips_data):
        if not isinstance(c, dict):
            return [], f"Clip at index {idx} is not a valid JSON object."

        try:
            start = float(c.get("start", -1))
            end = float(c.get("end", -1))
        except (ValueError, TypeError):
            return [], f"Clip {idx + 1} has non-numeric start or end timestamps."

        if start < 0 or end <= start:
            return [], f"Clip {idx + 1} has invalid time window: start={start}, end={end}."

        duration = round(end - start, 2)
        if duration < min_duration or duration > max_duration:
            return [], f"Clip {idx + 1} duration ({duration}s) is out of allowable bounds ({min_duration}s - {max_duration}s)."

        if video_duration and video_duration > 0 and end > (video_duration + 5.0):
            return [], f"Clip {idx + 1} end timestamp ({end}s) exceeds video duration ({video_duration:.1f}s)."

        viral_score = c.get("viral_score", 75)
        try:
            viral_score = int(viral_score)
            viral_score = max(0, min(100, viral_score))
        except (ValueError, TypeError):
            viral_score = 75

        validated_clips.append({
            "rank": idx + 1,
            "start": round(start, 2),
            "end": round(end, 2),
            "duration": duration,
            "title": str(c.get("title", f"Viral Clip #{idx + 1}")).strip(),
            "hook": str(c.get("hook", "")).strip(),
            "reason": str(c.get("reason", "High audience retention moment")).strip(),
            "viral_score": viral_score,
            "topics": [str(t).strip() for t in c.get("topics", []) if str(t).strip()]
        })

    # Sort by rank and viral score
    validated_clips.sort(key=lambda x: (-x["viral_score"], x["rank"]))
    for i, c in enumerate(validated_clips):
        c["rank"] = i + 1

    return validated_clips, None

def analyze_transcript_with_claude(
    segments: List[Dict[str, Any]],
    requested_clip_count: int = 5,
    video_duration: Optional[float] = None,
    api_key: Optional[str] = None,
    model_override: Optional[str] = None
) -> List[Dict[str, Any]]:
    client = get_claude_client(api_key)
    model = model_override or os.getenv("CLAUDE_MODEL", "claude-3-7-sonnet-20250219")
    
    transcript_text = format_transcript_for_claude(segments)
    
    user_prompt = f"""Here is the complete timestamped transcript of the video (Total Duration: {video_duration or segments[-1]['end']:.1f} seconds):

{transcript_text}

Task:
Analyze the ENTIRE transcript from start to finish. Select the TOP {requested_clip_count} highest-converting viral short-form clips.
Remember:
- 'start' and 'end' must be raw decimal seconds (e.g. 145.2).
- Duration for each clip should ideally be between 30 and 60 seconds (20-90s allowed).
- Return ONLY the raw JSON object with key 'clips'."""

    logger.info(f"Sending transcript analysis request to Claude ({model}) with {len(segments)} segments...")

    # First attempt
    message = client.messages.create(
        model=model,
        max_tokens=4000,
        temperature=0.3,
        system=EDITORIAL_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}]
    )

    response_text = ""
    for block in message.content:
        if block.type == "text":
            response_text += block.text

    # Extract JSON
    clean_json_str = response_text.strip()
    if clean_json_str.startswith("```json"):
        clean_json_str = clean_json_str[7:]
    if clean_json_str.startswith("```"):
        clean_json_str = clean_json_str[3:]
    if clean_json_str.endswith("```"):
        clean_json_str = clean_json_str[:-3]
    clean_json_str = clean_json_str.strip()

    try:
        data = json.loads(clean_json_str)
        raw_clips = data.get("clips", [])
        validated, err = validate_claude_clips(raw_clips, video_duration)
        if not err and len(validated) > 0:
            return validated[:requested_clip_count]
        else:
            logger.warning(f"Claude output validation error on first attempt: {err}")
    except Exception as e:
        logger.warning(f"Failed to parse Claude JSON response on first attempt: {e}")

    # One controlled correction request to Claude
    logger.info("Executing controlled correction request to Claude...")
    correction_prompt = f"""Your previous response was invalid or malformed.
Error: Could not parse or validate the clip structure.
Please fix and re-output ONLY valid JSON matching this exact structure:
{{
  "clips": [
    {{
      "rank": 1,
      "start": 12.5,
      "end": 65.0,
      "duration": 52.5,
      "title": "Hook title",
      "hook": "Opening quote",
      "reason": "Editorial reason",
      "viral_score": 95,
      "topics": ["topic1"]
    }}
  ]
}}
Ensure 'start' and 'end' are numbers in decimal seconds."""

    retry_message = client.messages.create(
        model=model,
        max_tokens=4000,
        temperature=0.1,
        system=EDITORIAL_SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": response_text},
            {"role": "user", "content": correction_prompt}
        ]
    )

    retry_text = "".join(b.text for b in retry_message.content if b.type == "text").strip()
    if retry_text.startswith("```json"):
        retry_text = retry_text[7:]
    if retry_text.startswith("```"):
        retry_text = retry_text[3:]
    if retry_text.endswith("```"):
        retry_text = retry_text[:-3]
    retry_text = retry_text.strip()

    try:
        retry_data = json.loads(retry_text)
        validated, err = validate_claude_clips(retry_data.get("clips", []), video_duration)
        if not err and len(validated) > 0:
            return validated[:requested_clip_count]
        raise ValueError(f"Claude response validation failed after retry: {err}")
    except Exception as e:
        raise ValueError(f"Claude returned invalid JSON after correction attempt: {e}")
