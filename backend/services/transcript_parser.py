import re
import json
from typing import List, Dict, Any, Tuple, Optional

def timecode_to_seconds(time_str: str) -> float:
    """
    Converts timecodes like '01:04:12.500' or '00:01:12,300' or '01:15.200' to decimal seconds.
    """
    if not time_str:
        return 0.0
    clean = time_str.strip().replace(',', '.')
    parts = clean.split(':')
    try:
        if len(parts) == 3:
            h = float(parts[0])
            m = float(parts[1])
            s = float(parts[2])
            return round(h * 3600 + m * 60 + s, 3)
        elif len(parts) == 2:
            m = float(parts[0])
            s = float(parts[1])
            return round(m * 60 + s, 3)
        elif len(parts) == 1:
            return round(float(parts[0]), 3)
    except ValueError:
        return 0.0
    return 0.0

def parse_srt(raw: str) -> List[Dict[str, Any]]:
    normalized = raw.replace('\r\n', '\n').replace('\r', '\n')
    blocks = re.split(r'\n\s*\n', normalized)
    segments = []
    time_regex = re.compile(r'(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})')

    for block in blocks:
        lines = [l.strip() for l in block.split('\n') if l.strip()]
        if len(lines) < 2:
            continue

        time_match = None
        time_line_idx = -1
        for idx, line in enumerate(lines):
            match = time_regex.search(line)
            if match:
                time_match = match
                time_line_idx = idx
                break

        if not time_match or time_line_idx == -1:
            continue

        start_sec = timecode_to_seconds(time_match.group(1))
        end_sec = timecode_to_seconds(time_match.group(2))
        text_lines = lines[time_line_idx + 1:]
        clean_text = ' '.join(re.sub(r'<[^>]+>', '', l).strip() for l in text_lines if l.strip())

        if clean_text and end_sec > start_sec:
            segments.append({
                "start": start_sec,
                "end": end_sec,
                "text": clean_text
            })

    return segments

def parse_vtt(raw: str) -> List[Dict[str, Any]]:
    normalized = raw.replace('\r\n', '\n').replace('\r', '\n')
    lines = normalized.split('\n')
    segments = []
    time_regex = re.compile(r'((\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*((\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})')

    i = 0
    # Skip WEBVTT header
    while i < len(lines) and (lines[i].startswith('WEBVTT') or lines[i].startswith('NOTE') or not lines[i].strip()):
        i += 1

    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        match = time_regex.search(line)
        if match:
            start_sec = timecode_to_seconds(match.group(1))
            end_sec = timecode_to_seconds(match.group(3))
            i += 1
            text_lines = []
            while i < len(lines) and lines[i].strip():
                clean_line = re.sub(r'<[^>]+>', '', lines[i]).strip()
                if clean_line:
                    text_lines.append(clean_line)
                i += 1
            
            text = ' '.join(text_lines)
            if text and end_sec > start_sec:
                segments.append({
                    "start": start_sec,
                    "end": end_sec,
                    "text": text
                })
        else:
            i += 1

    return segments

def parse_json_transcript(raw: str) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(raw)
        segments = []
        
        # Direct list
        if isinstance(parsed, list):
            for item in parsed:
                try:
                    start = float(item.get("start", 0))
                    end = float(item.get("end", 0))
                    text = str(item.get("text", "") or item.get("content", "")).strip()
                    if end > start and text:
                        segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
                except (ValueError, TypeError):
                    continue
            return segments

        # Object with segments
        if isinstance(parsed, dict) and "segments" in parsed and isinstance(parsed["segments"], list):
            for item in parsed["segments"]:
                try:
                    start = float(item.get("start", 0))
                    end = float(item.get("end", 0))
                    text = str(item.get("text", "") or item.get("content", "")).strip()
                    if end > start and text:
                        segments.append({"start": round(start, 3), "end": round(end, 3), "text": text})
                except (ValueError, TypeError):
                    continue
            return segments

        return segments
    except Exception:
        return []

def parse_and_validate_transcript(raw_text: str, video_duration: Optional[float] = None) -> Tuple[str, bool, List[Dict[str, Any]], Optional[str]]:
    """
    Returns: (format, is_timestamped, segments, error_message)
    """
    trimmed = raw_text.strip()
    if not trimmed:
        return ("txt", False, [], "Transcript is empty. Please upload or paste a timestamped transcript.")

    format_detected = "txt"
    segments = []

    # Check JSON
    if trimmed.startswith('{') or trimmed.startswith('['):
        segments = parse_json_transcript(trimmed)
        if segments:
            format_detected = "json"

    # Check WEBVTT
    if not segments and (trimmed.startswith('WEBVTT') or '-->' in trimmed):
        if trimmed.startswith('WEBVTT'):
            segments = parse_vtt(trimmed)
            format_detected = "vtt"
        else:
            segments = parse_srt(trimmed)
            format_detected = "srt"

    # Fallback SRT check
    if not segments and re.search(r'\d{1,2}:\d{2}:\d{2}', trimmed) and '-->' in trimmed:
        segments = parse_srt(trimmed)
        if segments:
            format_detected = "srt"

    # If plain text without timestamps
    if not segments:
        return ("txt", False, [], "Timestamped transcript required for automatic clip generation. Upload SRT, VTT, or timestamped JSON.")

    # Validation
    segments.sort(key=lambda s: s["start"])

    for idx, seg in enumerate(segments):
        if seg["start"] < 0:
            return (format_detected, True, [], f"Invalid timestamp at segment {idx + 1}: start time ({seg['start']}s) cannot be negative.")
        if seg["end"] <= seg["start"]:
            return (format_detected, True, [], f"Invalid timestamp at segment {idx + 1}: end time ({seg['end']}s) must be greater than start time ({seg['start']}s).")
        if video_duration and video_duration > 0 and seg["start"] > video_duration:
            return (format_detected, True, [], f"Timestamp at segment {idx + 1} ({seg['start']}s) exceeds video duration ({video_duration:.1f}s).")

    return (format_detected, True, segments, None)
