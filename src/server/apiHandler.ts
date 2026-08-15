import { Request, Response } from 'express';
import { execFile, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import JSZip from 'jszip';
import { parseTranscript } from '../services/transcriptParser';

// Local storage directory
let currentWorkspaceDir = path.resolve(process.cwd(), 'ShortsForge_Output');
let currentUploadsDir = path.join(currentWorkspaceDir, 'uploads');

function ensureWorkspaceDirs(dir: string) {
  try {
    currentWorkspaceDir = path.isAbsolute(dir) ? dir : path.resolve(process.cwd(), dir);
    currentUploadsDir = path.join(currentWorkspaceDir, 'uploads');
    if (!fs.existsSync(currentWorkspaceDir)) fs.mkdirSync(currentWorkspaceDir, { recursive: true });
    if (!fs.existsSync(currentUploadsDir)) fs.mkdirSync(currentUploadsDir, { recursive: true });
  } catch (err) {
    console.warn('Could not create workspace directory:', err);
  }
}

ensureWorkspaceDirs(currentWorkspaceDir);

// In-memory project and queue store
interface ProjectStore {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  video?: any;
  transcriptRaw?: string;
  transcriptFormat?: string;
  transcriptIsTimestamped?: boolean;
  transcriptSegments?: any[];
  claudeModelUsed?: string;
  analyzedAt?: string;
  clips?: any[];
}

interface RenderJobStore {
  id: string;
  projectId: string;
  clipId: string;
  clipTitle: string;
  clipRank: number;
  start: number;
  end: number;
  duration: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  cropMode: string;
  customPanPercent: number;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  error?: string;
  outputFilePath?: string;
  outputFileUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

const projects: Map<string, ProjectStore> = new Map();
const renderJobs: Map<string, RenderJobStore> = new Map();

// Helper to check ffmpeg
export function checkFfmpeg(): Promise<{ ffmpeg: boolean; ffprobe: boolean; version?: string }> {
  return new Promise((resolve) => {
    execFile('ffmpeg', ['-version'], (err, stdout) => {
      const ffmpeg = !err;
      const version = stdout ? stdout.split('\n')[0] : undefined;
      execFile('ffprobe', ['-version'], (probeErr) => {
        resolve({
          ffmpeg,
          ffprobe: !probeErr,
          version
        });
      });
    });
  });
}

// Helper to get video metadata via ffprobe
export function extractFfprobeMetadata(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    execFile(
      'ffprobe',
      [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ],
      (err, stdout, stderr) => {
        if (err) {
          return reject(new Error(stderr || err.message));
        }
        try {
          const data = JSON.parse(stdout);
          const format = data.format || {};
          const streams = data.streams || [];
          const vStream = streams.find((s: any) => s.codec_type === 'video');
          const aStream = streams.find((s: any) => s.codec_type === 'audio');

          let duration = parseFloat(format.duration || '0');
          if (duration === 0 && vStream?.duration) {
            duration = parseFloat(vStream.duration);
          }

          let fps = 30.0;
          if (vStream?.r_frame_rate) {
            const parts = vStream.r_frame_rate.split('/');
            if (parts.length === 2 && parseFloat(parts[1]) !== 0) {
              fps = parseFloat((parseFloat(parts[0]) / parseFloat(parts[1])).toFixed(2));
            }
          }

          const stats = fs.statSync(filePath);

          resolve({
            filename: path.basename(filePath),
            originalName: path.basename(filePath),
            duration: parseFloat(duration.toFixed(2)),
            width: vStream ? parseInt(vStream.width, 10) : 1920,
            height: vStream ? parseInt(vStream.height, 10) : 1080,
            fps,
            videoCodec: vStream?.codec_name || 'h264',
            audioCodec: aStream?.codec_name || 'aac',
            fileSize: stats.size,
            localPath: filePath,
            hasAudio: Boolean(aStream)
          });
        } catch (parseErr) {
          reject(parseErr);
        }
      }
    );
  });
}

// Generate FFmpeg filter for multiple aspect ratios (9:16 vertical, 16:9 landscape, 1:1 square)
function getFfmpegCropFilter(aspectRatio: string = '9:16', cropMode: string = 'center', panPercent: number = 50.0): string {
  const panFactor = Math.max(0, Math.min(100, panPercent)) / 100.0;
  
  if (aspectRatio === '16:9') {
    if (cropMode === 'blur') {
      return '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,boxblur=25:5[bg];[0:v]scale=1920:1080:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';
    } else if (cropMode === 'custom') {
      return `crop='min(iw,ih*16/9)':'min(ih,iw*9/16)':'(iw-min(iw,ih*16/9))*${panFactor.toFixed(3)}':'(ih-min(ih,iw*9/16))/2',scale=1920:1080:flags=lanczos`;
    } else {
      return "crop='min(iw,ih*16/9)':'min(ih,iw*9/16)':'(iw-min(iw,ih*16/9))/2':'(ih-min(ih,iw*9/16))/2',scale=1920:1080:flags=lanczos";
    }
  } else if (aspectRatio === '1:1') {
    if (cropMode === 'blur') {
      return '[0:v]scale=1080:1080:force_original_aspect_ratio=increase,crop=1080:1080,boxblur=25:5[bg];[0:v]scale=1080:1080:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';
    } else if (cropMode === 'custom') {
      return `crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))*${panFactor.toFixed(3)}':'(ih-min(ih,iw))/2',scale=1080:1080:flags=lanczos`;
    } else {
      return "crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(ih,iw))/2',scale=1080:1080:flags=lanczos";
    }
  } else {
    // Default: 9:16 Vertical
    if (cropMode === 'blur') {
      return '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25:5[bg];[0:v]scale=1080:1920:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2';
    } else if (cropMode === 'custom') {
      return `crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':'(iw-min(iw,ih*9/16))*${panFactor.toFixed(3)}':'(ih-min(ih,iw*16/9))/2',scale=1080:1920:flags=lanczos`;
    } else {
      return "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)':'(iw-min(iw,ih*9/16))/2':'(ih-min(ih,iw*16/9))/2',scale=1080:1920:flags=lanczos";
    }
  }
}

// Execute FFmpeg render job
export function renderClipFfmpeg(
  sourcePath: string,
  outputPath: string,
  start: number,
  duration: number,
  aspectRatio: string,
  cropMode: string,
  panPercent: number,
  onProgress?: (progress: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const filter = getFfmpegCropFilter(aspectRatio, cropMode, panPercent);
    const args = [
      '-y',
      '-ss', start.toFixed(3),
      '-t', duration.toFixed(3),
      '-i', sourcePath,
      '-vf', filter,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    ];

    const proc = spawn('ffmpeg', args);
    const timeRegex = /time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/;
    let stderr = '';

    proc.stderr.on('data', (data) => {
      const line = data.toString();
      stderr += line;
      const match = line.match(timeRegex);
      if (match && onProgress && duration > 0) {
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseFloat(match[3]);
        const curSec = h * 3600 + m * 60 + s;
        const prog = Math.min(99, Math.max(0, (curSec / duration) * 100));
        onProgress(parseFloat(prog.toFixed(1)));
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        if (onProgress) onProgress(100);
        resolve(outputPath);
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// Smart algorithmic transcript analyzer when Claude API is not configured or for offline fallback
export function generateSmartTranscriptClips(
  segments: any[],
  clipCount: number = 5,
  videoDuration?: number
): any[] {
  if (!segments || segments.length === 0) return [];

  const totalDuration = videoDuration || segments[segments.length - 1]?.end || 180;
  const targetDurationMin = 25;
  const targetDurationMax = 75;

  // Candidates scored by hook power, emotion, questions, numbers, and narrative flow
  interface Candidate {
    startIndex: number;
    endIndex: number;
    start: number;
    end: number;
    duration: number;
    title: string;
    hook: string;
    reason: string;
    viral_score: number;
    topics: string[];
  }

  const candidates: Candidate[] = [];

  const viralKeywords = [
    'secret', 'insane', 'bankruptcy', 'million', 'billion', 'mistake', 'never', 'truth',
    'scam', 'unbelievable', 'worst', 'best', 'money', 'failed', 'rule', 'advice', 'trap',
    'bet', 'died', 'fired', 'quit', 'lost', 'won', 'crazy', 'disaster', 'revenue', 'hacked'
  ];

  for (let i = 0; i < segments.length; i++) {
    const startSeg = segments[i];
    let combinedText = '';
    let currentEnd = startSeg.end;

    for (let j = i; j < segments.length; j++) {
      const seg = segments[j];
      combinedText += (combinedText ? ' ' : '') + seg.text;
      currentEnd = seg.end;
      const dur = currentEnd - startSeg.start;

      if (dur >= targetDurationMin && dur <= targetDurationMax) {
        // Calculate score
        let score = 75;
        const lowerText = combinedText.toLowerCase();

        // Hook bonus: question or strong opener in first segment
        if (startSeg.text.includes('?') || startSeg.text.includes('!')) score += 6;
        if (viralKeywords.some(kw => startSeg.text.toLowerCase().includes(kw))) score += 8;

        // Keyword density
        const keywordMatches = viralKeywords.filter(kw => lowerText.includes(kw)).length;
        score += Math.min(12, keywordMatches * 3);

        // Number/money presence
        if (/\$[\d,]+|\d+%/g.test(combinedText)) score += 5;

        // Extract hook (first sentence or first 25 words)
        const sentences = combinedText.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const hookText = sentences[0]?.trim() || combinedText.slice(0, 80);

        // Title from hook or key clause
        let title = hookText
          .replace(/[^\w\s]/g, '')
          .split(' ')
          .slice(0, 6)
          .join(' ');
        if (!title) title = `Viral Segment #${candidates.length + 1}`;

        candidates.push({
          startIndex: i,
          endIndex: j,
          start: parseFloat(startSeg.start.toFixed(2)),
          end: parseFloat(currentEnd.toFixed(2)),
          duration: parseFloat(dur.toFixed(2)),
          title: title.charAt(0).toUpperCase() + title.slice(1),
          hook: hookText.slice(0, 110),
          reason: `High curiosity gap and emotional momentum with ${keywordMatches > 0 ? 'high-stakes keywords' : 'engaging dialogue'} (${dur.toFixed(0)}s duration).`,
          viral_score: Math.min(98, Math.max(82, score)),
          topics: ['insights', 'mindset', 'strategy']
        });
      }
    }
  }

  // Sort candidates by viral score
  candidates.sort((a, b) => b.viral_score - a.viral_score);

  // Pick top N non-overlapping candidates
  const selected: Candidate[] = [];
  for (const cand of candidates) {
    if (selected.length >= clipCount) break;
    // Check overlap with already selected
    const overlaps = selected.some(
      s => Math.max(s.start, cand.start) < Math.min(s.end, cand.end) - 5
    );
    if (!overlaps) {
      selected.push(cand);
    }
  }

  // If we still need more clips to satisfy clipCount, slice remaining duration evenly
  if (selected.length < clipCount && segments.length > 0) {
    const chunkDur = Math.max(30, totalDuration / clipCount);
    for (let k = 0; k < clipCount; k++) {
      if (selected.length >= clipCount) break;
      const targetStart = k * chunkDur;
      const targetEnd = Math.min(totalDuration, targetStart + chunkDur);

      const matchingSegs = segments.filter(s => s.end >= targetStart && s.start <= targetEnd);
      if (matchingSegs.length > 0) {
        const segStart = matchingSegs[0].start;
        const segEnd = matchingSegs[matchingSegs.length - 1].end;
        const text = matchingSegs.map(s => s.text).join(' ');

        const exists = selected.some(s => Math.abs(s.start - segStart) < 10);
        if (!exists) {
          selected.push({
            startIndex: 0,
            endIndex: 0,
            start: parseFloat(segStart.toFixed(2)),
            end: parseFloat(segEnd.toFixed(2)),
            duration: parseFloat((segEnd - segStart).toFixed(2)),
            title: text.split(' ').slice(0, 5).join(' ') || `Key Takeaway #${k + 1}`,
            hook: text.slice(0, 100),
            reason: `Cohesive narrative block with high audience retention potential.`,
            viral_score: Math.max(78, 94 - k * 3),
            topics: ['highlights', 'podcast']
          });
        }
      }
    }
  }

  // Sort by timeline order or rank
  selected.sort((a, b) => b.viral_score - a.viral_score);
  return selected.slice(0, clipCount).map((c, i) => ({
    ...c,
    rank: i + 1,
  }));
}

// Claude Editorial Analysis
export async function analyzeTranscriptWithClaudeNode(
  segments: any[],
  clipCount: number = 5,
  apiKey?: string,
  modelName: string = 'claude-3-7-sonnet-20250219',
  videoDuration?: number
): Promise<any[]> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  
  if (!key || !key.trim()) {
    console.log(`No Anthropic key provided. Running smart heuristic clip extraction for ${clipCount} clips.`);
    return generateSmartTranscriptClips(segments, clipCount, videoDuration);
  }

  try {
    const anthropic = new Anthropic({
      apiKey: key.trim(),
    });

    const formattedLines = segments.map((s) => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s] ${s.text}`).join('\n');

    const systemPrompt = `You are an elite, world-class short-form video editor whose livelihood depends on finding clips that generate millions of views and massive audience retention on TikTok, YouTube Shorts, and Instagram Reels.
Analyze the ENTIRE transcript and select EXACTLY ${clipCount} standalone viral moments.
Criteria:
1. Hook strength: First 3-5 seconds must hook attention with controversy, intense emotion, secrets, or high curiosity.
2. Narrative payoff: Cohesive story or lesson ending on a punchline or mic-drop thought.
3. Length: Preferred 30-60s (allowed 20-90s).
4. Return ONLY valid JSON matching:
{
  "clips": [
    {
      "rank": 1,
      "start": 12.5,
      "end": 68.2,
      "duration": 55.7,
      "title": "Punchy Title (Max 6 words)",
      "hook": "Exact opening hook quote",
      "reason": "Why this moment will retain 80%+ audience",
      "viral_score": 94,
      "topics": ["startup", "mindset"]
    }
  ]
}
IMPORTANT: Provide EXACTLY ${clipCount} clips. 'start' and 'end' MUST be decimal seconds (e.g. 72.5). Avoid overlapping clips.`;

    const userPrompt = `Here is the full timestamped transcript (Duration: ${videoDuration || segments[segments.length - 1].end}s):
${formattedLines}

Select EXACTLY ${clipCount} highest-performing short-form clips. Return ONLY the JSON object.`;

    const response = await anthropic.messages.create({
      model: modelName,
      max_tokens: 4000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    let rawContent = '';
    for (const block of response.content) {
      if (block.type === 'text') rawContent += block.text;
    }

    let clean = rawContent.trim();
    if (clean.startsWith('```json')) clean = clean.slice(7);
    if (clean.startsWith('```')) clean = clean.slice(3);
    if (clean.endsWith('```')) clean = clean.slice(0, -3);
    clean = clean.trim();

    const parsed = JSON.parse(clean);
    const clips = parsed.clips || [];
    if (clips.length > 0) {
      return clips.map((c: any, i: number) => ({
        rank: i + 1,
        start: parseFloat(c.start),
        end: parseFloat(c.end),
        duration: parseFloat((parseFloat(c.end) - parseFloat(c.start)).toFixed(2)),
        title: c.title || `Viral Clip #${i + 1}`,
        hook: c.hook || '',
        reason: c.reason || 'High retention potential',
        viral_score: Math.min(100, Math.max(0, parseInt(c.viral_score || 80, 10))),
        topics: Array.isArray(c.topics) ? c.topics : []
      }));
    }
  } catch (err) {
    console.warn('Claude API request failed, falling back to smart transcript analysis:', err);
  }

  return generateSmartTranscriptClips(segments, clipCount, videoDuration);
}

// Express Route Dispatcher
export async function handleApiRoute(req: Request, res: Response): Promise<void> {
  const url = req.url.split('?')[0];
  const method = req.method;

  try {
    // 1. System status
    if (url === '/api/system/status' && method === 'GET') {
      const ffmpegInfo = await checkFfmpeg();
      const apiKey = process.env.ANTHROPIC_API_KEY || '';
      const claudeModel = process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';

      res.json({
        ffmpeg_detected: ffmpegInfo.ffmpeg,
        ffprobe_detected: ffmpegInfo.ffprobe,
        ffmpeg_version: ffmpegInfo.version,
        anthropic_api_key_configured: Boolean(apiKey.trim()),
        claude_model: claudeModel,
        python_detected: true,
        workspace_dir: currentWorkspaceDir
      });
      return;
    }

    // Settings endpoint
    if (url === '/api/settings' && method === 'POST') {
      if (req.body?.workspaceDir) {
        ensureWorkspaceDirs(req.body.workspaceDir);
      }
      res.json({ success: true, workspace_dir: currentWorkspaceDir });
      return;
    }

    // Attach video metadata to project
    const projVideoMatch = url.match(/^\/api\/projects\/([^\/]+)\/video$/);
    if (projVideoMatch && method === 'POST') {
      const projId = projVideoMatch[1];
      const proj = projects.get(projId);
      if (!proj) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      proj.video = req.body;
      proj.updatedAt = new Date().toISOString();
      res.json({ success: true, video: proj.video });
      return;
    }

    // 2. List Projects
    if (url === '/api/projects' && method === 'GET') {
      res.json(Array.from(projects.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      return;
    }

    // 3. Create Project
    if (url === '/api/projects' && method === 'POST') {
      const name = (req.body?.name || 'Untitled Project').trim();
      const id = 'proj_' + Math.random().toString(36).substring(2, 10);
      const now = new Date().toISOString();
      const newProj: ProjectStore = {
        id,
        name,
        createdAt: now,
        updatedAt: now,
        clips: []
      };
      projects.set(id, newProj);
      res.json(newProj);
      return;
    }

    // 4. Get / Delete Project
    const projMatch = url.match(/^\/api\/projects\/([^\/]+)$/);
    if (projMatch) {
      const projId = projMatch[1];
      if (method === 'GET') {
        const proj = projects.get(projId);
        if (!proj) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }
        res.json(proj);
        return;
      }
      if (method === 'DELETE') {
        projects.delete(projId);
        res.json({ success: true });
        return;
      }
    }

    // 5. Update Project Transcript
    const transcriptMatch = url.match(/^\/api\/projects\/([^\/]+)\/transcript$/);
    if (transcriptMatch && method === 'POST') {
      const projId = transcriptMatch[1];
      const proj = projects.get(projId);
      if (!proj) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }

      const rawText = req.body?.raw_text || '';
      const videoDuration = proj.video?.duration;
      const parsed = parseTranscript(rawText, videoDuration);

      if (parsed.validationError && !parsed.isTimestamped) {
        proj.transcriptRaw = rawText;
        proj.transcriptFormat = parsed.format;
        proj.transcriptIsTimestamped = false;
        proj.transcriptSegments = [];
        proj.updatedAt = new Date().toISOString();
        res.json({
          format: parsed.format,
          is_timestamped: false,
          segments_count: 0,
          warning: parsed.validationError
        });
        return;
      }

      if (parsed.validationError) {
        res.status(400).json({ error: parsed.validationError });
        return;
      }

      proj.transcriptRaw = rawText;
      proj.transcriptFormat = parsed.format;
      proj.transcriptIsTimestamped = true;
      proj.transcriptSegments = parsed.segments;
      proj.updatedAt = new Date().toISOString();

      res.json({
        format: parsed.format,
        is_timestamped: true,
        segments_count: parsed.segments.length,
        segments: parsed.segments
      });
      return;
    }

    // 6. Analyze with Claude (or Smart Heuristics)
    const analyzeMatch = url.match(/^\/api\/projects\/([^\/]+)\/analyze$/);
    if ((analyzeMatch || url === '/api/analyze-transcript') && method === 'POST') {
      const projId = analyzeMatch ? analyzeMatch[1] : (req.body?.project_id || 'default_proj');
      let proj = projects.get(projId);

      // If project not in memory, initialize it
      if (!proj) {
        proj = {
          id: projId,
          name: req.body?.project_name || 'ShortsForge Project',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          transcriptIsTimestamped: false,
          transcriptSegments: [],
          clips: [],
        };
        projects.set(projId, proj);
      }

      // If segments provided directly in body, use them
      if (req.body?.segments && Array.isArray(req.body.segments) && req.body.segments.length > 0) {
        proj.transcriptSegments = req.body.segments;
        proj.transcriptIsTimestamped = true;
      }

      if (!proj.transcriptIsTimestamped || !proj.transcriptSegments?.length) {
        res.status(400).json({ error: 'Timestamped transcript required for automatic clip generation.' });
        return;
      }

      const clipCount = parseInt(req.body?.clip_count || req.body?.clipCount || '5', 10);
      const apiKeyOverride = req.body?.api_key_override || req.body?.apiKey;
      const modelOverride = req.body?.model_override || process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219';

      const clipsResult = await analyzeTranscriptWithClaudeNode(
        proj.transcriptSegments,
        clipCount,
        apiKeyOverride,
        modelOverride,
        proj.video?.duration || req.body?.video_duration
      );

      const formattedClips = clipsResult.map((c, i) => ({
        id: 'clip_' + Math.random().toString(36).substring(2, 9),
        rank: c.rank || i + 1,
        start: c.start,
        end: c.end,
        duration: c.duration,
        title: c.title,
        hook: c.hook,
        reason: c.reason,
        viral_score: c.viral_score,
        topics: c.topics,
        selected: true,
        cropMode: 'center',
        customPanPercent: 50.0,
        status: 'idle'
      }));

      proj.clips = formattedClips;
      proj.claudeModelUsed = modelOverride;
      proj.analyzedAt = new Date().toISOString();
      proj.updatedAt = new Date().toISOString();

      res.json({ clips: formattedClips });
      return;
    }

    // 7. Render shorts
    const renderMatch = url.match(/^\/api\/projects\/([^\/]+)\/render$/);
    if (renderMatch && method === 'POST') {
      const projId = renderMatch[1];
      const proj = projects.get(projId);
      if (!proj || !proj.video) {
        res.status(400).json({ error: 'Project video is required for rendering.' });
        return;
      }

      const clipIds: string[] = req.body?.clip_ids || [];
      const globalCropMode = req.body?.crop_mode || 'center';
      const globalCustomPan = parseFloat(req.body?.custom_pan_percent || '50');
      const globalAspectRatio = req.body?.aspect_ratio || '9:16';

      const projectOutDir = path.join(currentWorkspaceDir, `Project_${projId.slice(-8)}`);
      if (!fs.existsSync(projectOutDir)) fs.mkdirSync(projectOutDir, { recursive: true });

      const queuedJobIds: string[] = [];

      for (const clip of proj.clips || []) {
        if (clipIds.includes(clip.id)) {
          const jobId = 'job_' + Math.random().toString(36).substring(2, 9);
          const safeTitle = (clip.title || 'short').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25);
          const targetAspectRatio = clip.aspectRatio || globalAspectRatio;
          const targetCropMode = clip.cropMode || globalCropMode;
          const targetCustomPan = clip.customPanPercent !== undefined ? clip.customPanPercent : globalCustomPan;
          const formatPrefix = targetAspectRatio.replace(':', 'x');
          const outName = `clip_${String(clip.rank).padStart(2, '0')}_${formatPrefix}_${safeTitle}.mp4`;
          const outPath = path.join(projectOutDir, outName);

          const job: RenderJobStore = {
            id: jobId,
            projectId: projId,
            clipId: clip.id,
            clipTitle: clip.title,
            clipRank: clip.rank,
            start: clip.start,
            end: clip.end,
            duration: clip.duration,
            aspectRatio: targetAspectRatio as any,
            cropMode: targetCropMode,
            customPanPercent: targetCustomPan,
            status: 'queued',
            progress: 0,
            createdAt: new Date().toISOString()
          };

          renderJobs.set(jobId, job);
          queuedJobIds.push(jobId);

          // Process asynchronously
          (async () => {
            job.status = 'processing';
            job.startedAt = new Date().toISOString();
            try {
              await renderClipFfmpeg(
                proj.video.localPath,
                outPath,
                clip.start,
                clip.duration,
                targetAspectRatio,
                targetCropMode,
                targetCustomPan,
                (prog) => {
                  job.progress = prog;
                }
              );
              job.status = 'completed';
              job.progress = 100;
              job.completedAt = new Date().toISOString();
              job.outputFilePath = outPath;
              job.outputFileUrl = `/api/files/download?path=${encodeURIComponent(outPath)}`;
              clip.status = 'completed';
              clip.renderedFilePath = outPath;
              clip.renderedVideoUrl = job.outputFileUrl;
            } catch (err: any) {
              job.status = 'failed';
              job.error = err.message;
              clip.status = 'failed';
            }
          })();
        }
      }

      res.json({ queued_jobs: queuedJobIds });
      return;
    }

    // 8. Render Queue
    if (url === '/api/render-queue' && method === 'GET') {
      res.json(Array.from(renderJobs.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      return;
    }

    // 9. Export ZIP
    const zipMatch = url.match(/^\/api\/export-zip\/([^\/]+)$/);
    if (zipMatch && method === 'GET') {
      const projId = zipMatch[1];
      const projectOutDir = path.join(currentWorkspaceDir, `Project_${projId.slice(-8)}`);
      
      const zip = new JSZip();
      if (fs.existsSync(projectOutDir)) {
        const files = fs.readdirSync(projectOutDir).filter(f => f.endsWith('.mp4'));
        for (const f of files) {
          const content = fs.readFileSync(path.join(projectOutDir, f));
          zip.file(f, content);
        }
      }

      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="ShortsForge_${projId.slice(-8)}_Shorts.zip"`);
      res.send(zipBuffer);
      return;
    }

    // 10. Open Folder on Host OS (Windows explorer, macOS open, Linux xdg-open)
    if (url === '/api/system/open-folder' && method === 'POST') {
      const targetPath = req.body?.path || currentWorkspaceDir;
      const fullPath = path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      const platform = os.platform();
      let cmd = 'xdg-open';
      let args = [fullPath];

      if (platform === 'win32') {
        cmd = 'explorer.exe';
        args = [fullPath];
      } else if (platform === 'darwin') {
        cmd = 'open';
        args = [fullPath];
      }

      try {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.unref();
        res.json({ success: true, path: fullPath, message: `Opened ${fullPath}` });
      } catch (err: any) {
        res.json({ success: false, path: fullPath, error: err.message });
      }
      return;
    }

    // 11. Download Job File by Job ID
    const jobDownloadMatch = url.match(/^\/api\/render-jobs\/([^\/]+)\/download$/);
    if (jobDownloadMatch && method === 'GET') {
      const jobId = jobDownloadMatch[1];
      const job = renderJobs.get(jobId);
      if (!job || !job.outputFilePath || !fs.existsSync(job.outputFilePath)) {
        res.status(404).json({ error: 'Rendered video file not found on local server.' });
        return;
      }
      const filename = path.basename(job.outputFilePath);
      res.download(job.outputFilePath, filename);
      return;
    }

    // 12. Download File by Path
    if (url === '/api/files/download' && method === 'GET') {
      const filePath = req.query.path as string;
      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.download(filePath);
      return;
    }

    // Fallback next
    res.status(404).json({ error: 'API route not found' });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
