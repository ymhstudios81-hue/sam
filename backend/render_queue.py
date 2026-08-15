import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

from .models import RenderJob
from .services.ffmpeg_service import render_short_clip
from .database import get_db_connection

logger = logging.getLogger("shortsforge.queue")

class RenderQueueManager:
    def __init__(self, max_concurrent_jobs: int = 2):
        self.max_concurrent_jobs = max_concurrent_jobs
        self.semaphore = asyncio.Semaphore(max_concurrent_jobs)
        self.jobs: Dict[str, RenderJob] = {}
        self.active_tasks: Dict[str, asyncio.Task] = {}

    def get_all_jobs(self) -> List[RenderJob]:
        return list(self.jobs.values())

    def get_job(self, job_id: str) -> Optional[RenderJob]:
        return self.jobs.get(job_id)

    def add_job(self, job: RenderJob, source_video_path: str, output_path: str, src_width: int = 1920, src_height: int = 1080):
        self.jobs[job.id] = job
        task = asyncio.create_task(self._process_job(job, source_video_path, output_path, src_width, src_height))
        self.active_tasks[job.id] = task

    async def _process_job(self, job: RenderJob, source_video_path: str, output_path: str, src_width: int, src_height: int):
        async with self.semaphore:
            job.status = "processing"
            job.started_at = datetime.utcnow().isoformat()
            job.progress = 5.0
            self._update_db_job(job)

            def progress_cb(prog: float):
                job.progress = prog

            try:
                loop = asyncio.get_event_loop()
                # Run CPU-bound FFmpeg rendering in executor thread
                out_path = await loop.run_in_executor(
                    None,
                    lambda: render_short_clip(
                        source_video_path=source_video_path,
                        output_video_path=output_path,
                        start_time=job.start,
                        end_time=job.end,
                        crop_mode=job.crop_mode,
                        custom_pan_percent=job.custom_pan_percent or 50.0,
                        source_width=src_width,
                        source_height=src_height,
                        progress_callback=progress_cb
                    )
                )

                job.status = "completed"
                job.progress = 100.0
                job.completed_at = datetime.utcnow().isoformat()
                job.output_file_path = out_path
                job.output_file_url = f"/api/files/download?path={out_path}"
                self._update_db_job(job)
                logger.info(f"Render job {job.id} completed successfully.")
            except asyncio.CancelledError:
                job.status = "cancelled"
                job.error = "Cancelled by user"
                self._update_db_job(job)
                logger.warning(f"Render job {job.id} was cancelled.")
            except Exception as e:
                job.status = "failed"
                job.error = str(e)
                self._update_db_job(job)
                logger.error(f"Render job {job.id} failed: {e}")

    def cancel_job(self, job_id: str):
        if job_id in self.active_tasks and not self.active_tasks[job_id].done():
            self.active_tasks[job_id].cancel()
        if job_id in self.jobs:
            self.jobs[job_id].status = "cancelled"
            self._update_db_job(self.jobs[job_id])

    def _update_db_job(self, job: RenderJob):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
        INSERT INTO render_jobs (
            id, project_id, clip_id, clip_title, clip_rank, start, end,
            duration, crop_mode, custom_pan_percent, status, progress,
            error, output_file_path, output_file_url, created_at, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            status = excluded.status,
            progress = excluded.progress,
            error = excluded.error,
            output_file_path = excluded.output_file_path,
            output_file_url = excluded.output_file_url,
            started_at = excluded.started_at,
            completed_at = excluded.completed_at
        """, (
            job.id, job.project_id, job.clip_id, job.clip_title, job.clip_rank,
            job.start, job.end, job.duration, job.crop_mode, job.custom_pan_percent,
            job.status, job.progress, job.error, job.output_file_path,
            job.output_file_url, job.created_at, job.started_at, job.completed_at
        ))
        conn.commit()
        conn.close()

render_queue_manager = RenderQueueManager(max_concurrent_jobs=2)
