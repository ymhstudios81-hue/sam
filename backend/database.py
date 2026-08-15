import sqlite3
import json
import os
from pathlib import Path
from typing import List, Optional, Dict, Any

DB_PATH = Path("shortsforge.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Projects table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        video_data TEXT,
        transcript_raw TEXT,
        transcript_format TEXT,
        transcript_is_timestamped INTEGER DEFAULT 0,
        transcript_segments TEXT,
        claude_model_used TEXT,
        analyzed_at TEXT,
        clips_data TEXT
    )
    """)
    
    # Render jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS render_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        clip_id TEXT NOT NULL,
        clip_title TEXT NOT NULL,
        clip_rank INTEGER NOT NULL,
        start REAL NOT NULL,
        end REAL NOT NULL,
        duration REAL NOT NULL,
        crop_mode TEXT NOT NULL,
        custom_pan_percent REAL DEFAULT 50.0,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0.0,
        error TEXT,
        output_file_path TEXT,
        output_file_url TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT
    )
    """)
    
    # Settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

# Project Helpers
def save_project(project_dict: Dict[str, Any]):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
    INSERT INTO projects (
        id, name, created_at, updated_at, video_data, transcript_raw,
        transcript_format, transcript_is_timestamped, transcript_segments,
        claude_model_used, analyzed_at, clips_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        updated_at = excluded.updated_at,
        video_data = excluded.video_data,
        transcript_raw = excluded.transcript_raw,
        transcript_format = excluded.transcript_format,
        transcript_is_timestamped = excluded.transcript_is_timestamped,
        transcript_segments = excluded.transcript_segments,
        claude_model_used = excluded.claude_model_used,
        analyzed_at = excluded.analyzed_at,
        clips_data = excluded.clips_data
    """, (
        project_dict.get('id'),
        project_dict.get('name'),
        project_dict.get('created_at'),
        project_dict.get('updated_at'),
        json.dumps(project_dict.get('video')) if project_dict.get('video') else None,
        project_dict.get('transcript_raw'),
        project_dict.get('transcript_format'),
        1 if project_dict.get('transcript_is_timestamped') else 0,
        json.dumps(project_dict.get('transcript_segments', [])),
        project_dict.get('claude_model_used'),
        project_dict.get('analyzed_at'),
        json.dumps(project_dict.get('clips', []))
    ))
    
    conn.commit()
    conn.close()

def get_all_projects() -> List[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        results.append({
            "id": r["id"],
            "name": r["name"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "video": json.loads(r["video_data"]) if r["video_data"] else None,
            "transcript_raw": r["transcript_raw"],
            "transcript_format": r["transcript_format"],
            "transcript_is_timestamped": bool(r["transcript_is_timestamped"]),
            "transcript_segments": json.loads(r["transcript_segments"]) if r["transcript_segments"] else [],
            "claude_model_used": r["claude_model_used"],
            "analyzed_at": r["analyzed_at"],
            "clips": json.loads(r["clips_data"]) if r["clips_data"] else []
        })
    return results

def get_project_by_id(project_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    r = cursor.fetchone()
    conn.close()
    
    if not r:
        return None
        
    return {
        "id": r["id"],
        "name": r["name"],
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "video": json.loads(r["video_data"]) if r["video_data"] else None,
        "transcript_raw": r["transcript_raw"],
        "transcript_format": r["transcript_format"],
        "transcript_is_timestamped": bool(r["transcript_is_timestamped"]),
        "transcript_segments": json.loads(r["transcript_segments"]) if r["transcript_segments"] else [],
        "claude_model_used": r["claude_model_used"],
        "analyzed_at": r["analyzed_at"],
        "clips": json.loads(r["clips_data"]) if r["clips_data"] else []
    }

def delete_project(project_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    cursor.execute("DELETE FROM render_jobs WHERE project_id = ?", (project_id,))
    conn.commit()
    conn.close()
