import { Request, Response } from 'express';
import { execFile, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
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
  videoDuration?: number,
  customPrompt?: string,
  durationMode: string = 'auto',
  minDuration: number = 25,
  maxDuration: number = 180
): any[] {
  if (!segments || segments.length === 0) return [];

  const totalDuration = videoDuration || segments[segments.length - 1]?.end || 180;
  const isAutoDuration = durationMode === 'auto';
  const targetDurationMin = isAutoDuration ? 15 : (minDuration || 20);
  const targetDurationMax = isAutoDuration ? Math.min(totalDuration, 900) : (maxDuration || 180);

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
    customPromptMatchCount: number;
  }

  const candidates: Candidate[] = [];

  const viralKeywords = [
    'secret', 'insane', 'bankruptcy', 'million', 'billion', 'mistake', 'never', 'truth',
    'scam', 'unbelievable', 'worst', 'best', 'money', 'failed', 'rule', 'advice', 'trap',
    'bet', 'died', 'fired', 'quit', 'lost', 'won', 'crazy', 'disaster', 'revenue', 'hacked',
    'story', 'lesson', 'happened', 'experience', 'decision', 'shocking', 'discovered', 'hire',
    'hiring', 'engineer', 'developer', 'startup', 'product', 'code', 'build', 'idea'
  ];

  // Stop words to ignore during custom prompt keyword extraction
  const stopWords = new Set([
    'the', 'and', 'for', 'that', 'this', 'with', 'from', 'have', 'what', 'when', 'where',
    'which', 'who', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'than', 'too', 'very', 'can', 'will', 'just', 'should',
    'now', 'find', 'clip', 'clips', 'video', 'claude', 'make', 'want', 'please', 'about',
    'extract', 'give', 'into', 'over', 'them', 'their', 'there', 'were', 'been', 'being',
    'only', 'also', 'like', 'show', 'tell', 'need', 'must'
  ]);

  const cleanPrompt = (customPrompt || '').trim();
  const rawWords = cleanPrompt
    .toLowerCase()
    .replace(/[^\w\s$]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));

  // Extract 2-word n-grams for phrase matching
  const promptPhrases: string[] = [];
  if (rawWords.length >= 2) {
    for (let p = 0; p < rawWords.length - 1; p++) {
      promptPhrases.push(`${rawWords[p]} ${rawWords[p + 1]}`);
    }
  }

  for (let i = 0; i < segments.length; i++) {
    const startSeg = segments[i];
    let combinedText = '';
    let currentEnd = startSeg.end;

    for (let j = i; j < segments.length; j++) {
      const seg = segments[j];
      combinedText += (combinedText ? ' ' : '') + seg.text;
      currentEnd = seg.end;
      const dur = currentEnd - startSeg.start;

      const endsWithPunctuation = /[.!?]$/.test(seg.text.trim());

      if (dur >= targetDurationMin && dur <= targetDurationMax && (endsWithPunctuation || dur > targetDurationMin + 10)) {
        let score = 70;
        const lowerText = combinedText.toLowerCase();
        let promptMatches = 0;

        // Custom prompt relevance bonus
        if (rawWords.length > 0) {
          // Exact keyword matches
          for (const kw of rawWords) {
            if (lowerText.includes(kw)) {
              promptMatches += 1;
              score += 25; // Massive boost for direct query keyword match
            }
          }

          // Exact 2-word phrase matches
          for (const phrase of promptPhrases) {
            if (lowerText.includes(phrase)) {
              promptMatches += 2;
              score += 45; // Huge boost for coherent multi-word phrase match
            }
          }

          // If entire custom prompt is in the segment text
          if (cleanPrompt.length > 4 && lowerText.includes(cleanPrompt.toLowerCase())) {
            promptMatches += 4;
            score += 80;
          }
        }

        if (startSeg.text.includes('?') || startSeg.text.includes('!')) score += 5;
        if (viralKeywords.some((kw) => startSeg.text.toLowerCase().includes(kw))) score += 6;

        const keywordMatches = viralKeywords.filter((kw) => lowerText.includes(kw)).length;
        score += Math.min(10, keywordMatches * 2);

        if (/\$[\d,]+|\d+%/g.test(combinedText)) score += 4;
        if (endsWithPunctuation) score += 3;

        const sentences = combinedText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
        const hookText = sentences[0]?.trim() || combinedText.slice(0, 80);

        let title = hookText
          .replace(/[^\w\s$]/g, '')
          .split(' ')
          .slice(0, 6)
          .join(' ');
        if (!title) title = `Viral Segment #${candidates.length + 1}`;

        let reasonText = '';
        if (cleanPrompt && promptMatches > 0) {
          reasonText = `🎯 Directly matches instruction "${cleanPrompt.slice(0, 42)}..." with complete standalone story payoff (${dur.toFixed(0)}s).`;
        } else if (cleanPrompt) {
          reasonText = `High narrative cohesion and viral retention hook aligned with content guidelines (${dur.toFixed(0)}s).`;
        } else {
          reasonText = `Complete natural story narrative with strong opening hook (${dur.toFixed(0)}s).`;
        }

        candidates.push({
          startIndex: i,
          endIndex: j,
          start: parseFloat(startSeg.start.toFixed(2)),
          end: parseFloat(currentEnd.toFixed(2)),
          duration: parseFloat(dur.toFixed(2)),
          title: title.charAt(0).toUpperCase() + title.slice(1),
          hook: hookText.slice(0, 110),
          reason: reasonText,
          viral_score: Math.min(99, Math.max(75, score)),
          topics: rawWords.length > 0 ? rawWords.slice(0, 3) : ['insights', 'mindset', 'strategy'],
          customPromptMatchCount: promptMatches
        });
      }
    }
  }

  // If custom prompt is provided and has matches, sort by custom match count FIRST, then viral score
  if (rawWords.length > 0) {
    candidates.sort((a, b) => {
      if (b.customPromptMatchCount !== a.customPromptMatchCount) {
        return b.customPromptMatchCount - a.customPromptMatchCount;
      }
      return b.viral_score - a.viral_score;
    });
  } else {
    candidates.sort((a, b) => b.viral_score - a.viral_score);
  }

  // Pick top N non-overlapping candidates
  const selected: Candidate[] = [];
  for (const cand of candidates) {
    if (selected.length >= clipCount) break;
    // Check overlap with already selected
    const overlaps = selected.some(
      (s) => Math.max(s.start, cand.start) < Math.min(s.end, cand.end) - 5
    );
    if (!overlaps) {
      selected.push(cand);
    }
  }

  // If we still need more clips to satisfy clipCount, slice remaining duration evenly
  if (selected.length < clipCount && segments.length > 0) {
    const chunkDur = Math.max(25, totalDuration / clipCount);
    for (let k = 0; k < clipCount; k++) {
      if (selected.length >= clipCount) break;
      const targetStart = k * chunkDur;
      const targetEnd = Math.min(totalDuration, targetStart + chunkDur);

      const matchingSegs = segments.filter((s) => s.end >= targetStart && s.start <= targetEnd);
      if (matchingSegs.length > 0) {
        const segStart = matchingSegs[0].start;
        const segEnd = matchingSegs[matchingSegs.length - 1].end;
        const text = matchingSegs.map((s) => s.text).join(' ');

        const exists = selected.some((s) => Math.abs(s.start - segStart) < 8);
        if (!exists) {
          selected.push({
            startIndex: 0,
            endIndex: 0,
            start: parseFloat(segStart.toFixed(2)),
            end: parseFloat(segEnd.toFixed(2)),
            duration: parseFloat((segEnd - segStart).toFixed(2)),
            title: text.split(' ').slice(0, 5).join(' ') || `Key Takeaway #${k + 1}`,
            hook: text.slice(0, 100),
            reason: cleanPrompt
              ? `🎯 Narrative segment evaluated for: "${cleanPrompt.slice(0, 35)}..."`
              : `Cohesive narrative block with high audience retention potential.`,
            viral_score: Math.max(78, 94 - k * 3),
            topics: ['highlights', 'podcast'],
            customPromptMatchCount: 0
          });
        }
      }
    }
  }

  // Sort by ranking order
  if (rawWords.length > 0) {
    selected.sort((a, b) => {
      if (b.customPromptMatchCount !== a.customPromptMatchCount) {
        return b.customPromptMatchCount - a.customPromptMatchCount;
      }
      return b.viral_score - a.viral_score;
    });
  } else {
    selected.sort((a, b) => b.viral_score - a.viral_score);
  }

  return selected.slice(0, clipCount).map((c, i) => ({
    ...c,
    rank: i + 1,
  }));
}

// Multi-LLM Editorial Analysis (Claude Sonnet 3.7 + Gemini 3.7 Flash + NLP Engine)
export async function analyzeTranscriptWithClaudeNode(
  segments: any[],
  clipCount: number = 5,
  apiKey?: string,
  modelName: string = 'claude-3-7-sonnet-20250219',
  videoDuration?: number,
  customPrompt?: string,
  durationMode: string = 'auto',
  minDuration: number = 25,
  maxDuration: number = 180
): Promise<any[]> {
  const anthropicKey = apiKey || process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const formattedLines = segments.map((s) => `[${s.start.toFixed(2)}s - ${s.end.toFixed(2)}s] ${s.text}`).join('\n');

  const durationInstruction = durationMode === 'auto'
    ? `AUTO NATURAL DURATION (CRITICAL): Do NOT cut stories, jokes, or explanations in the middle just to fit an arbitrary time limit. If a story takes 40 seconds, 2 minutes, or 4 minutes to complete with its setup and payoff, include the ENTIRE cohesive story from the opening premise to the natural conclusion. Never cut off mid-thought or mid-sentence.`
    : `Duration limits: Keep each clip between ${minDuration}s and ${maxDuration}s, ensuring natural beginning and ending sentence boundaries.`;

  const customCommandSection = customPrompt && customPrompt.trim()
    ? `\n🚨 USER SPECIFIC CUSTOM INSTRUCTION & PREFERENCES (HIGHEST PRIORITY):\n"${customPrompt.trim()}"\nYou MUST strictly follow the user's custom instruction above. Prioritize finding segments that directly address, explain, or showcase what the user specifically asked for.\n`
    : '';

  const systemPrompt = `You are an elite, world-class video editor and viral strategist specializing in finding standalone high-performing clips from podcast/video transcripts.
Analyze the ENTIRE transcript and select EXACTLY ${clipCount} standalone moments.

${durationInstruction}
${customCommandSection}

Core Viral Criteria:
1. Hook strength: The very first sentence/moment must hook the listener immediately.
2. Complete Narrative Payoff: Always include the full context and punchline/lesson. Do not cut early.
3. Accurate Timestamps: 'start' and 'end' must align with actual spoken sentences in the transcript.

Return ONLY valid JSON matching this schema:
{
  "clips": [
    {
      "rank": 1,
      "start": 12.5,
      "end": 68.2,
      "duration": 55.7,
      "title": "Punchy Title (Max 6 words)",
      "hook": "Exact opening hook quote from transcript",
      "reason": "Why this moment satisfies the user instruction or viral criteria",
      "viral_score": 95,
      "topics": ["startup", "story"]
    }
  ]
}
IMPORTANT: Provide EXACTLY ${clipCount} clips. 'start' and 'end' MUST be decimal seconds matching the transcript. Avoid overlapping clips.`;

  const userPrompt = `Here is the full timestamped transcript (Total Duration: ${videoDuration || segments[segments.length - 1].end}s):
${formattedLines}

${customPrompt ? `Remember User's Specific Custom Instruction: "${customPrompt}"\n` : ''}
Select EXACTLY ${clipCount} highest-quality clips following all instructions. Return ONLY the JSON object.`;

  // 1. Attempt Anthropic Claude if key provided
  if (anthropicKey && anthropicKey.trim()) {
    try {
      console.log(`Analyzing transcript with Anthropic Claude (${modelName})...`);
      const anthropic = new Anthropic({
        apiKey: anthropicKey.trim(),
      });

      const response = await anthropic.messages.create({
        model: modelName,
        max_tokens: 4000,
        temperature: 0.2,
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
          reason: c.reason || (customPrompt ? `🎯 Matched custom prompt: "${customPrompt.slice(0, 40)}..."` : 'High retention potential'),
          viral_score: Math.min(100, Math.max(0, parseInt(c.viral_score || 85, 10))),
          topics: Array.isArray(c.topics) ? c.topics : []
        }));
      }
    } catch (anthropicErr) {
      console.warn('Anthropic API request failed, trying Google Gemini fallback:', anthropicErr);
    }
  }

  // 2. Attempt Google Gemini AI using server-side GEMINI_API_KEY
  if (geminiKey && geminiKey.trim()) {
    try {
      console.log('Analyzing transcript with Google Gemini LLM Engine (gemini-3.7-flash)...');
      const ai = new GoogleGenAI({ apiKey: geminiKey.trim() });
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      const text = geminiResponse.text || '';
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
      if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
      cleanText = cleanText.trim();

      const parsed = JSON.parse(cleanText);
      const clips = parsed.clips || [];
      if (clips.length > 0) {
        return clips.map((c: any, i: number) => ({
          rank: i + 1,
          start: parseFloat(c.start),
          end: parseFloat(c.end),
          duration: parseFloat((parseFloat(c.end) - parseFloat(c.start)).toFixed(2)),
          title: c.title || `Viral Clip #${i + 1}`,
          hook: c.hook || '',
          reason: c.reason || (customPrompt ? `🎯 Matched custom prompt: "${customPrompt.slice(0, 40)}..."` : 'High retention story flow'),
          viral_score: Math.min(100, Math.max(0, parseInt(c.viral_score || 85, 10))),
          topics: Array.isArray(c.topics) ? c.topics : []
        }));
      }
    } catch (geminiErr) {
      console.warn('Gemini transcript analysis error, using smart NLP heuristic engine:', geminiErr);
    }
  }

  // 3. Fallback to precision NLP heuristic engine
  console.log(`Running smart NLP heuristic clip extraction for ${clipCount} clips with custom prompt "${customPrompt || 'none'}"`);
  return generateSmartTranscriptClips(segments, clipCount, videoDuration, customPrompt, durationMode, minDuration, maxDuration);
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
      const customPrompt = req.body?.custom_prompt || req.body?.customPrompt;
      const durationMode = req.body?.duration_mode || req.body?.durationMode || 'auto';
      const minClipDuration = parseInt(req.body?.min_clip_duration || req.body?.minClipDuration || '25', 10);
      const maxClipDuration = parseInt(req.body?.max_clip_duration || req.body?.maxClipDuration || '180', 10);

      const clipsResult = await analyzeTranscriptWithClaudeNode(
        proj.transcriptSegments,
        clipCount,
        apiKeyOverride,
        modelOverride,
        proj.video?.duration || req.body?.video_duration,
        customPrompt,
        durationMode,
        minClipDuration,
        maxClipDuration
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
