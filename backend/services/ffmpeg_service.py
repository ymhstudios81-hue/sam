import subprocess
import shutil
import json
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, Callable
import logging

from .crop_strategies import get_crop_strategy

logger = logging.getLogger("shortsforge.ffmpeg")

def check_ffmpeg_installation() -> Tuple[bool, bool, Optional[str]]:
    """
    Checks if ffmpeg and ffprobe are available in the system PATH.
    Returns: (ffmpeg_found, ffprobe_found, version_string)
    """
    ffmpeg_path = shutil.which("ffmpeg")
    ffprobe_path = shutil.which("ffprobe")
    
    ffmpeg_found = ffmpeg_path is not None
    ffprobe_found = ffprobe_path is not None
    version_str = None
    
    if ffmpeg_found:
        try:
            res = subprocess.run(["ffmpeg", "-version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=5)
            first_line = res.stdout.splitlines()[0] if res.stdout else "FFmpeg installed"
            version_str = first_line
        except Exception as e:
            version_str = f"Installed (Error reading version: {e})"

    return ffmpeg_found, ffprobe_found, version_str

def extract_video_metadata(video_path: str) -> Dict[str, Any]:
    """
    Uses ffprobe to extract rich technical metadata from video file.
    """
    path_obj = Path(video_path)
    if not path_obj.exists():
        raise FileNotFoundError(f"Video file not found at: {video_path}")

    file_size = path_obj.stat().st_size

    ffprobe_cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(path_obj.resolve())
    ]

    try:
        res = subprocess.run(ffprobe_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=30)
        if res.returncode != 0:
            raise RuntimeError(f"FFprobe failed: {res.stderr}")

        data = json.loads(res.stdout)
    except Exception as e:
        logger.error(f"Error running FFprobe on {video_path}: {e}")
        raise RuntimeError(f"Failed to inspect video metadata with FFprobe: {e}")

    format_info = data.get("format", {})
    streams = data.get("streams", [])

    duration = float(format_info.get("duration", 0))
    video_stream = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio_stream = next((s for s in streams if s.get("codec_type") == "audio"), None)

    width = 1920
    height = 1080
    fps = 30.0
    vcodec = "unknown"
    acodec = "none"

    if video_stream:
        width = int(video_stream.get("width", 1920))
        height = int(video_stream.get("height", 1080))
        vcodec = video_stream.get("codec_name", "h264")

        # Parse FPS
        r_fps = video_stream.get("r_frame_rate", "30/1")
        try:
            if "/" in r_fps:
                num, den = map(float, r_fps.split("/"))
                fps = round(num / den, 2) if den != 0 else 30.0
            else:
                fps = round(float(r_fps), 2)
        except Exception:
            fps = 30.0

        if duration == 0 and "duration" in video_stream:
            try:
                duration = float(video_stream["duration"])
            except Exception:
                pass

    if audio_stream:
        acodec = audio_stream.get("codec_name", "aac")
        if duration == 0 and "duration" in audio_stream:
            try:
                duration = float(audio_stream["duration"])
            except Exception:
                pass

    return {
        "filename": path_obj.name,
        "original_name": path_obj.name,
        "duration": round(duration, 2),
        "width": width,
        "height": height,
        "fps": fps,
        "video_codec": vcodec,
        "audio_codec": acodec,
        "file_size": file_size,
        "local_path": str(path_obj.resolve()),
        "has_audio": audio_stream is not None
    }

def render_short_clip(
    source_video_path: str,
    output_video_path: str,
    start_time: float,
    end_time: float,
    crop_mode: str = "center",
    custom_pan_percent: float = 50.0,
    source_width: int = 1920,
    source_height: int = 1080,
    progress_callback: Optional[Callable[[float], None]] = None
) -> str:
    """
    Cuts the specified segment from source video and converts to 9:16 vertical 1080x1920 MP4 using FFmpeg.
    """
    src = Path(source_video_path).resolve()
    out = Path(output_video_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    clip_duration = max(0.1, end_time - start_time)
    crop_strategy = get_crop_strategy(crop_mode, custom_pan_percent)
    video_filter = crop_strategy.get_ffmpeg_filter(source_width, source_height)

    # High quality settings
    # Accurate seeking with -ss before -i and -t
    cmd = [
        "ffmpeg",
        "-y", # overwrite
        "-ss", f"{start_time:.3f}",
        "-t", f"{clip_duration:.3f}",
        "-i", str(src),
        "-vf", video_filter,
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-movflags", "+faststart",
        str(out)
    ]

    logger.info(f"Executing FFmpeg render: {' '.join(cmd)}")

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        universal_newlines=True
    )

    time_regex = re.compile(r'time=(\d{2}):(\d{2}):(\d{2}\.\d{2})')

    stderr_logs = []
    while True:
        line = process.stderr.readline()
        if not line and process.poll() is not None:
            break
        if line:
            stderr_logs.append(line)
            match = time_regex.search(line)
            if match and progress_callback and clip_duration > 0:
                h, m, s = match.groups()
                current_sec = int(h) * 3600 + int(m) * 60 + float(s)
                prog = min(99.0, max(0.0, (current_sec / clip_duration) * 100.0))
                progress_callback(round(prog, 1))

    rc = process.poll()
    if rc != 0:
        err_msg = "".join(stderr_logs[-20:])
        logger.error(f"FFmpeg failed with return code {rc}: {err_msg}")
        raise RuntimeError(f"FFmpeg rendering error (code {rc}): {err_msg}")

    if progress_callback:
        progress_callback(100.0)

    return str(out)
