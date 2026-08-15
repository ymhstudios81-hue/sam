# ShortsForge AI 🎬⚡
> **Local-First Windows AI Video Shorts Generator** powered by **Anthropic Claude** and **FFmpeg**.

ShortsForge AI converts long-form videos (podcasts, tech talks, interviews, lectures) into high-retention 9:16 vertical shorts (1080×1920) for YouTube Shorts, TikTok, and Instagram Reels.

---

## 🌟 Key Features

- 🔒 **100% Local-First Video Processing**: Your videos **never** leave your PC. All video analysis, cutting, aspect ratio conversion, and rendering occur locally using FFmpeg and FFprobe.
- 🧠 **Anthropic Claude AI Brain**: Claude analyzes the full timestamped transcript using professional viral video editor criteria to select standalone hooks with high retention.
- 📐 **3 Smart 9:16 Crop Modes**:
  - **Center Crop**: High-precision 9:16 center cutout with Lanczos scaling.
  - **Fit with Blurred Background**: Full original frame floating on top of a dynamic blurred, zoomed backdrop.
  - **Custom Crop**: Interactive horizontal pan slider (0% to 100%) to position speakers perfectly.
- ⏱️ **Timestamp Fine-Tuning**: Real-time video preview scrubber to adjust in/out points before rendering.
- ⚡ **Local Render Queue**: Concurrent rendering with real FFmpeg progress parsing.
- 📁 **Organized Project Management**: Automatically categorizes generated MP4 files in `ShortsForge_Output/` and supports 1-click ZIP export.
- 🚫 **No Captions / No Fake AI**: The transcript is strictly used for AI editorial clip discovery. No burnt-in captions.

---

## 🏗️ Architecture Workflow

```
LONG VIDEO (MP4/MOV/MKV/WEBM)
            +
TIMESTAMPED TRANSCRIPT (SRT/VTT/JSON)
            ↓
CLAUDE ANALYZES FULL TRANSCRIPT
            ↓
CLAUDE SELECTS BEST STANDALONE CLIPS (Decimal Seconds)
            ↓
APPLICATION VALIDATES JSON & CHECKS OVERLAPS
            ↓
USER PREVIEWS & FINE-TUNES TIMESTAMPS
            ↓
LOCAL FFMPEG CUTS & CONVERTS TO 1080x1920 (9:16)
            ↓
FINAL VIRAL MP4 SHORTS (Saved locally to ShortsForge_Output/)
```

---

## 💻 Windows Requirements

1. **Windows 10 / Windows 11 (64-bit)**
2. **Python 3.11+**: Download from [python.org](https://www.python.org/downloads/) (Ensure *"Add Python to PATH"* is checked during installation).
3. **FFmpeg & FFprobe**:
   - Quick install with Windows Package Manager:
     ```cmd
     winget install Gyan.FFmpeg
     ```
   - Or download from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/), extract to `C:\ffmpeg`, and add `C:\ffmpeg\bin` to your System Environment `PATH`.
4. **Anthropic Claude API Key**: Get your key from [console.anthropic.com](https://console.anthropic.com/).

---

## 🚀 Quick Start on Windows

### 1-Click Launch:
Simply double-click:
```cmd
start.bat
```
This batch script will:
1. Validate Python and FFmpeg availability.
2. Initialize the Python virtual environment (`.venv`).
3. Install required packages from `requirements.txt`.
4. Launch the local FastAPI backend.
5. Automatically open `http://127.0.0.1:8000` in your default browser.

To stop the application at any time, run:
```cmd
stop.bat
```

---

## ⚙️ Configuration (`.env`)

Copy `.env.example` to `.env` and configure your API key:

```env
# Anthropic API Key for Claude transcript intelligence
ANTHROPIC_API_KEY=sk-ant-api03-...

# Claude model to use for clip selection
CLAUDE_MODEL=claude-3-7-sonnet-20250219

# Application defaults
WORKSPACE_DIR=ShortsForge_Output
DEFAULT_CLIP_COUNT=5
MIN_CLIP_DURATION=20
MAX_CLIP_DURATION=90
```

---

## 📂 Output Folder Structure

All generated video shorts are organized by project inside your configured workspace folder:

```
ShortsForge_Output/
├── Project_4a8b1c09/
│   ├── clip_01_Bankruptcy_Story.mp4
│   ├── clip_02_Whiteboard_Interview_Scam.mp4
│   └── clip_03_Solo_Developer_AI.mp4
└── ShortsForge_Project_4a8b1c09_Shorts.zip
```

---

## 📋 Supported Formats

- **Video**: `.mp4`, `.mov`, `.mkv`, `.webm`
- **Transcripts**:
  - `.srt` (SubRip Subtitle format, e.g. `00:01:12,300 --> 00:01:20,400`)
  - `.vtt` (WebVTT format)
  - `.json` (Standard timestamped arrays `[{ "start": 12.3, "end": 45.6, "text": "..." }]`)
  - `.txt` (Plain text viewable, but timestamped format is required for automated video cutting)

---

## 🛠️ Development & Manual Startup

### Backend (FastAPI):
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend (React + Vite):
```bash
npm install
npm run dev
```

---

## 🔍 Troubleshooting

- **"FFmpeg is required"**: Ensure `ffmpeg.exe` and `ffprobe.exe` are in your PATH. Verify in CMD by typing `ffmpeg -version`.
- **"Claude authentication failure"**: Check that `ANTHROPIC_API_KEY` is set in `.env` or in the Settings modal without extra spaces or quotes.
- **"Timestamped transcript required"**: If you uploaded a `.txt` file without timestamp codes, upload an `.srt` or `.vtt` file instead.
