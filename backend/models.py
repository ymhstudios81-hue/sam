from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
import uuid

class TranscriptSegment(BaseModel):
    start: float = Field(..., description="Start timestamp in decimal seconds (e.g. 72.3)")
    end: float = Field(..., description="End timestamp in decimal seconds (e.g. 80.4)")
    text: str = Field(..., description="Transcribed spoken text")

class VideoMetadata(BaseModel):
    filename: str
    original_name: str
    duration: float  # seconds
    width: int
    height: int
    fps: float
    video_codec: str
    audio_codec: str
    file_size: int   # bytes
    local_path: str
    preview_url: Optional[str] = None
    has_audio: bool = True

class Clip(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rank: int
    start: float
    end: float
    duration: float
    title: str
    hook: str
    reason: str
    viral_score: int
    topics: List[str] = Field(default_factory=list)
    selected: bool = True
    crop_mode: Literal['center', 'blur', 'custom'] = 'center'
    custom_pan_percent: Optional[float] = 50.0
    status: Literal['idle', 'queued', 'rendering', 'completed', 'failed'] = 'idle'
    rendered_file_path: Optional[str] = None
    rendered_video_url: Optional[str] = None
    render_progress: Optional[float] = 0.0
    render_error: Optional[str] = None

class RenderJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    project_id: str
    clip_id: str
    clip_title: str
    clip_rank: int
    start: float
    end: float
    duration: float
    crop_mode: Literal['center', 'blur', 'custom']
    custom_pan_percent: Optional[float] = 50.0
    status: Literal['queued', 'processing', 'completed', 'failed', 'cancelled'] = 'queued'
    progress: float = 0.0
    error: Optional[str] = None
    output_file_path: Optional[str] = None
    output_file_url: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

class Project(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    created_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    video: Optional[VideoMetadata] = None
    transcript_raw: Optional[str] = None
    transcript_format: Optional[Literal['srt', 'vtt', 'json', 'txt']] = None
    transcript_is_timestamped: bool = False
    transcript_segments: List[TranscriptSegment] = Field(default_factory=list)
    claude_model_used: Optional[str] = None
    analyzed_at: Optional[str] = None
    clips: List[Clip] = Field(default_factory=list)

class AppSettings(BaseModel):
    anthropic_api_key_configured: bool = False
    claude_model: str = "claude-3-7-sonnet-20250219"
    default_clip_count: int = 5
    min_clip_duration: int = 20
    max_clip_duration: int = 90
    output_resolution: str = "1080x1920"
    crop_mode: Literal['center', 'blur', 'custom'] = "center"
    custom_pan_percent: float = 50.0
    video_quality: Literal['medium', 'high', 'ultra'] = "high"
    workspace_dir: str = "ShortsForge_Output"
    ffmpeg_detected: bool = False
    ffprobe_detected: bool = False
    ffmpeg_version: Optional[str] = None
    python_detected: bool = True
    python_version: Optional[str] = None

class ClaudeClipResult(BaseModel):
    rank: int
    start: float
    end: float
    duration: float
    title: str
    hook: str
    reason: str
    viral_score: int
    topics: List[str]

class ClaudeAnalysisResponse(BaseModel):
    clips: List[ClaudeClipResult]
