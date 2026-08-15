import os
import shutil
import uuid
import zipfile
import sys
from pathlib import Path
from typing import List, Optional, Dict, Any
from dotenv import load_dotenv

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .models import (
    Project, VideoMetadata, Clip, RenderJob, AppSettings,
    TranscriptSegment
)
from .database import init_db, save_project, get_all_projects, get_project_by_id, delete_project
from .services.transcript_parser import parse_and_validate_transcript
from .services.claude_service import analyze_transcript_with_claude
from .services.ffmpeg_service import check_ffmpeg_installation, extract_video_metadata
from .render_queue import render_queue_manager

load_dotenv()

app = FastAPI(title="ShortsForge AI Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Workspace output folder setup
WORKSPACE_DIR = Path(os.getenv("WORKSPACE_DIR", "ShortsForge_Output"))
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)
UPLOADS_DIR = WORKSPACE_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

@app.on_event("startup")
def startup_event():
    init_db()

@app.get("/api/system/status")
def get_system_status():
    ffmpeg_ok, ffprobe_ok, version = check_ffmpeg_installation()
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    claude_model = os.getenv("CLAUDE_MODEL", "claude-3-7-sonnet-20250219")
    
    return {
        "ffmpeg_detected": ffmpeg_ok,
        "ffprobe_detected": ffprobe_ok,
        "ffmpeg_version": version,
        "anthropic_api_key_configured": bool(api_key),
        "claude_model": claude_model,
        "python_detected": True,
        "python_version": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        "workspace_dir": str(WORKSPACE_DIR.resolve())
    }

@app.get("/api/projects", response_model=List[Dict[str, Any]])
def list_projects():
    return get_all_projects()

@app.post("/api/projects")
def create_new_project(name: str = Form(...)):
    new_proj = Project(name=name.strip() or "Untitled Project")
    save_project(new_proj.dict())
    return new_proj.dict()

@app.get("/api/projects/{project_id}")
def get_project(project_id: str):
    proj = get_project_by_id(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return proj

@app.delete("/api/projects/{project_id}")
def remove_project(project_id: str):
    delete_project(project_id)
    return {"success": True}

@app.post("/api/projects/{project_id}/video")
async def upload_video(project_id: str, file: UploadFile = File(...)):
    proj = get_project_by_id(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Safe filename
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in [".mp4", ".mov", ".mkv", ".webm"]:
        raise HTTPException(status_code=400, detail=f"Unsupported format {file_ext}. Supported: MP4, MOV, MKV, WEBM.")

    safe_name = f"{project_id}_{uuid.uuid4().hex[:8]}{file_ext}"
    dest_path = UPLOADS_DIR / safe_name

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Extract metadata via ffprobe
    try:
        meta = extract_video_metadata(str(dest_path))
        meta["original_name"] = file.filename
        meta["preview_url"] = f"/api/files/download?path={dest_path}"
    except Exception as e:
        if dest_path.exists():
            dest_path.unlink()
        raise HTTPException(status_code=400, detail=f"Video analysis failed: {str(e)}")

    proj["video"] = meta
    save_project(proj)
    return meta

@app.post("/api/projects/{project_id}/transcript")
def upload_transcript(
    project_id: str,
    raw_text: str = Form(...),
    file_name: Optional[str] = Form(None)
):
    proj = get_project_by_id(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    video_dur = proj.get("video", {}).get("duration") if proj.get("video") else None
    fmt, is_timestamped, segments, error = parse_and_validate_transcript(raw_text, video_dur)

    if error and not is_timestamped:
        # User uploaded plain text
        proj["transcript_raw"] = raw_text
        proj["transcript_format"] = fmt
        proj["transcript_is_timestamped"] = False
        proj["transcript_segments"] = []
        save_project(proj)
        return {
            "format": fmt,
            "is_timestamped": False,
            "segments_count": 0,
            "warning": error
        }

    if error:
        raise HTTPException(status_code=400, detail=error)

    proj["transcript_raw"] = raw_text
    proj["transcript_format"] = fmt
    proj["transcript_is_timestamped"] = True
    proj["transcript_segments"] = segments
    save_project(proj)

    return {
        "format": fmt,
        "is_timestamped": True,
        "segments_count": len(segments),
        "segments": segments
    }

@app.post("/api/projects/{project_id}/analyze")
def analyze_with_claude(
    project_id: str,
    clip_count: int = Form(5),
    api_key_override: Optional[str] = Form(None),
    model_override: Optional[str] = Form(None)
):
    proj = get_project_by_id(project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if not proj.get("transcript_is_timestamped") or not proj.get("transcript_segments"):
        raise HTTPException(
            status_code=400,
            detail="Timestamped transcript required for automatic clip generation. Upload SRT, VTT, or timestamped JSON first."
        )

    video_dur = proj.get("video", {}).get("duration") if proj.get("video") else None

    try:
        raw_clips = analyze_transcript_with_claude(
            segments=proj["transcript_segments"],
            requested_clip_count=clip_count,
            video_duration=video_dur,
            api_key=api_key_override,
            model_override=model_override
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude analysis failed: {str(e)}")

    # Convert to Clip models
    clips = []
    for c in raw_clips:
        clip_id = str(uuid.uuid4())
        clips.append({
            "id": clip_id,
            "rank": c["rank"],
            "start": c["start"],
            "end": c["end"],
            "duration": c["duration"],
            "title": c["title"],
            "hook": c["hook"],
            "reason": c["reason"],
            "viral_score": c["viral_score"],
            "topics": c["topics"],
            "selected": True,
            "crop_mode": "center",
            "custom_pan_percent": 50.0,
            "status": "idle"
        })

    proj["clips"] = clips
    proj["claude_model_used"] = model_override or os.getenv("CLAUDE_MODEL", "claude-3-7-sonnet-20250219")
    save_project(proj)

    return {"clips": clips}

@app.post("/api/projects/{project_id}/render")
def trigger_render(
    project_id: str,
    clip_ids: List[str] = Form(...),
    crop_mode: str = Form("center"),
    custom_pan_percent: float = Form(50.0)
):
    proj = get_project_by_id(project_id)
    if not proj or not proj.get("video"):
        raise HTTPException(status_code=400, detail="Project does not have an uploaded video.")

    video_path = proj["video"]["local_path"]
    src_w = proj["video"].get("width", 1920)
    src_h = proj["video"].get("height", 1080)
    
    project_output_dir = WORKSPACE_DIR / f"Project_{project_id[:8]}"
    project_output_dir.mkdir(parents=True, exist_ok=True)

    job_ids = []
    for clip in proj.get("clips", []):
        if clip["id"] in clip_ids:
            clean_title = "".join(c for c in clip["title"] if c.isalnum() or c in (' ', '_', '-')).rstrip()
            clean_title = clean_title.replace(' ', '_')[:30]
            out_filename = f"clip_{clip['rank']:02d}_{clean_title}.mp4"
            out_path = project_output_dir / out_filename

            job = RenderJob(
                project_id=project_id,
                clip_id=clip["id"],
                clip_title=clip["title"],
                clip_rank=clip["rank"],
                start=clip["start"],
                end=clip["end"],
                duration=clip["duration"],
                crop_mode=crop_mode,
                custom_pan_percent=custom_pan_percent
            )

            render_queue_manager.add_job(
                job=job,
                source_video_path=video_path,
                output_path=str(out_path),
                src_width=src_w,
                src_height=src_h
            )
            job_ids.append(job.id)

    return {"queued_jobs": job_ids}

@app.get("/api/render-queue")
def get_render_queue():
    jobs = render_queue_manager.get_all_jobs()
    return [j.dict() for j in jobs]

@app.post("/api/render-queue/{job_id}/cancel")
def cancel_job(job_id: str):
    render_queue_manager.cancel_job(job_id)
    return {"success": True}

@app.get("/api/export-zip/{project_id}")
def export_project_zip(project_id: str):
    project_output_dir = WORKSPACE_DIR / f"Project_{project_id[:8]}"
    if not project_output_dir.exists():
        raise HTTPException(status_code=404, detail="No output directory for this project.")

    zip_path = WORKSPACE_DIR / f"ShortsForge_Project_{project_id[:8]}.zip"
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in project_output_dir.glob("*.mp4"):
            zipf.write(file, arcname=file.name)

    return FileResponse(
        path=str(zip_path),
        media_type="application/zip",
        filename=f"ShortsForge_{project_id[:8]}_Shorts.zip"
    )

@app.get("/api/files/download")
def download_file(path: str):
    file_path = Path(path).resolve()
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path=str(file_path), filename=file_path.name)
