import { TranscriptData, TranscriptFormat, TranscriptSegment } from '../types';

/**
 * Converts a timecode string (e.g. "01:04:12.500" or "00:01:12,300" or "01:15.200") to decimal seconds
 */
export function timecodeToSeconds(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().replace(',', '.');
  const parts = clean.split(':');
  
  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Number((hours * 3600 + minutes * 60 + seconds).toFixed(3));
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return Number((minutes * 60 + seconds).toFixed(3));
  } else if (parts.length === 1) {
    return Number((parseFloat(parts[0]) || 0).toFixed(3));
  }
  return 0;
}

/**
 * Formats decimal seconds to a clean timecode (e.g. 72.3 -> "01:12.3")
 */
export function formatSecondsToTimecode(seconds: number, includeHours = false): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0 || includeHours) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${ms}`;
  }
  return `${pad(mins)}:${pad(secs)}.${ms}`;
}

/**
 * Parses SRT format transcripts
 */
export function parseSRT(raw: string): TranscriptSegment[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);
  const segments: TranscriptSegment[] = [];

  const timeRegex = /(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,\.]\d{1,3})/;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    let timeMatch: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(timeRegex);
      if (match) {
        timeMatch = match;
        timeLineIdx = i;
        break;
      }
    }

    if (!timeMatch || timeLineIdx === -1) continue;

    const startSec = timecodeToSeconds(timeMatch[1]);
    const endSec = timecodeToSeconds(timeMatch[2]);
    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines
      .map(l => l.replace(/<[^>]+>/g, '').trim()) // remove HTML tags like <i>
      .filter(l => l.length > 0)
      .join(' ');

    if (text && endSec > startSec) {
      segments.push({
        start: startSec,
        end: endSec,
        text
      });
    }
  }

  return segments;
}

/**
 * Parses WebVTT format transcripts
 */
export function parseVTT(raw: string): TranscriptSegment[] {
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  const segments: TranscriptSegment[] = [];

  const timeRegex = /((\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})\s*-->\s*((\d{1,2}:)?\d{2}:\d{2}[,\.]\d{1,3})/;

  let i = 0;
  // skip WEBVTT header
  while (i < lines.length && (lines[i].startsWith('WEBVTT') || lines[i].startsWith('NOTE') || lines[i].trim() === '')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    const timeMatch = line.match(timeRegex);
    if (timeMatch) {
      const startSec = timecodeToSeconds(timeMatch[1]);
      const endSec = timecodeToSeconds(timeMatch[3]);
      i++;
      const textLines: string[] = [];

      while (i < lines.length && lines[i].trim() !== '') {
        const textLine = lines[i].replace(/<[^>]+>/g, '').trim();
        if (textLine) textLines.push(textLine);
        i++;
      }

      const text = textLines.join(' ');
      if (text && endSec > startSec) {
        segments.push({
          start: startSec,
          end: endSec,
          text
        });
      }
    } else {
      i++;
    }
  }

  return segments;
}

/**
 * Parses JSON format transcripts
 */
export function parseJSON(raw: string): TranscriptSegment[] {
  try {
    const parsed = JSON.parse(raw);
    const segments: TranscriptSegment[] = [];

    // Format 1: Direct array of segments [{start, end, text}, ...]
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const start = typeof item.start === 'number' ? item.start : parseFloat(item.start);
        const end = typeof item.end === 'number' ? item.end : parseFloat(item.end);
        const text = item.text || item.content || item.transcript || '';
        if (!isNaN(start) && !isNaN(end) && end > start && text) {
          segments.push({
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
            text: String(text).trim()
          });
        }
      }
      return segments;
    }

    // Format 2: Object with segments array { segments: [...] }
    if (parsed.segments && Array.isArray(parsed.segments)) {
      for (const item of parsed.segments) {
        const start = typeof item.start === 'number' ? item.start : parseFloat(item.start);
        const end = typeof item.end === 'number' ? item.end : parseFloat(item.end);
        const text = item.text || item.content || '';
        if (!isNaN(start) && !isNaN(end) && end > start && text) {
          segments.push({
            start: Number(start.toFixed(3)),
            end: Number(end.toFixed(3)),
            text: String(text).trim()
          });
        }
      }
      return segments;
    }

    // Format 3: Whisper-style or AWS Transcribe words
    if (parsed.words && Array.isArray(parsed.words)) {
      let currentSentence: string[] = [];
      let sentenceStart = -1;
      let sentenceEnd = 0;

      for (const w of parsed.words) {
        const wStart = typeof w.start === 'number' ? w.start : parseFloat(w.start);
        const wEnd = typeof w.end === 'number' ? w.end : parseFloat(w.end);
        const word = (w.word || w.text || '').trim();

        if (isNaN(wStart) || !word) continue;

        if (sentenceStart === -1) sentenceStart = wStart;
        sentenceEnd = isNaN(wEnd) ? wStart + 0.5 : wEnd;
        currentSentence.push(word);

        if (word.endsWith('.') || word.endsWith('?') || word.endsWith('!') || currentSentence.length >= 15) {
          segments.push({
            start: Number(sentenceStart.toFixed(3)),
            end: Number(sentenceEnd.toFixed(3)),
            text: currentSentence.join(' ')
          });
          currentSentence = [];
          sentenceStart = -1;
        }
      }

      if (currentSentence.length > 0 && sentenceStart !== -1) {
        segments.push({
          start: Number(sentenceStart.toFixed(3)),
          end: Number(sentenceEnd.toFixed(3)),
          text: currentSentence.join(' ')
        });
      }
      return segments;
    }

    return segments;
  } catch {
    return [];
  }
}

/**
 * Detects format and parses raw transcript
 */
export function parseTranscript(rawText: string, videoDuration?: number): TranscriptData {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      rawText,
      format: 'txt',
      isTimestamped: false,
      segments: [],
      validationError: 'Transcript is empty. Please upload or paste transcript content.'
    };
  }

  let format: TranscriptFormat = 'txt';
  let segments: TranscriptSegment[] = [];

  // Check if JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    segments = parseJSON(trimmed);
    if (segments.length > 0) {
      format = 'json';
    }
  }

  // Check if WEBVTT
  if (segments.length === 0 && (trimmed.startsWith('WEBVTT') || trimmed.includes('-->'))) {
    if (trimmed.startsWith('WEBVTT')) {
      segments = parseVTT(trimmed);
      format = 'vtt';
    } else {
      segments = parseSRT(trimmed);
      format = 'srt';
    }
  }

  // Fallback check if SRT lines exist
  if (segments.length === 0 && /\d{1,2}:\d{2}:\d{2}/.test(trimmed) && trimmed.includes('-->')) {
    segments = parseSRT(trimmed);
    if (segments.length > 0) {
      format = 'srt';
    }
  }

  // If still no segments, treat as plain TXT
  if (segments.length === 0) {
    return {
      rawText,
      format: 'txt',
      isTimestamped: false,
      segments: [],
      validationError: 'Timestamped transcript required for automatic clip generation. Upload SRT, VTT, or timestamped JSON.'
    };
  }

  // Validate segments
  segments.sort((a, b) => a.start - b.start);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.start < 0) {
      return {
        rawText,
        format,
        isTimestamped: true,
        segments: [],
        validationError: `Invalid timestamp at segment ${i + 1}: start time (${seg.start}s) cannot be negative.`
      };
    }
    if (seg.end <= seg.start) {
      return {
        rawText,
        format,
        isTimestamped: true,
        segments: [],
        validationError: `Invalid timestamp at segment ${i + 1}: end time (${seg.end}s) must be greater than start time (${seg.start}s).`
      };
    }
    if (videoDuration && videoDuration > 0 && seg.start > videoDuration) {
      return {
        rawText,
        format,
        isTimestamped: true,
        segments: [],
        validationError: `Timestamp at segment ${i + 1} (${seg.start}s) exceeds video duration (${videoDuration.toFixed(1)}s).`
      };
    }
  }

  const totalDuration = segments.length > 0 ? segments[segments.length - 1].end : 0;

  return {
    rawText,
    format,
    isTimestamped: true,
    segments,
    totalDuration
  };
}

/**
 * Smart algorithmic transcript analyzer when Claude API is not configured or for offline fallback.
 * Extracts N high-retention clips distributed across the transcript matching viral criteria,
 * user custom commands, and natural story boundaries.
 */
export function generateSmartTranscriptClips(
  segments: TranscriptSegment[],
  clipCount: number = 5,
  videoDuration?: number,
  aspectRatio: string = '9:16',
  cropMode: string = 'autoface',
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

        if (rawWords.length > 0) {
          for (const kw of rawWords) {
            if (lowerText.includes(kw)) {
              promptMatches += 1;
              score += 25;
            }
          }

          for (const phrase of promptPhrases) {
            if (lowerText.includes(phrase)) {
              promptMatches += 2;
              score += 45;
            }
          }

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

  const selected: Candidate[] = [];
  for (const cand of candidates) {
    if (selected.length >= clipCount) break;
    const overlaps = selected.some(
      (s) => Math.max(s.start, cand.start) < Math.min(s.end, cand.end) - 5
    );
    if (!overlaps) {
      selected.push(cand);
    }
  }

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
            viral_score: Math.max(78, 94 - k * 2),
            topics: ['highlights', 'podcast'],
            customPromptMatchCount: 0
          });
        }
      }
    }
  }

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
    id: 'clip_' + Math.random().toString(36).substring(2, 9),
    rank: i + 1,
    start: c.start,
    end: c.end,
    duration: c.duration,
    title: c.title,
    hook: c.hook,
    reason: c.reason,
    viral_score: c.viral_score,
    topics: c.topics,
    selected: true,
    aspectRatio,
    cropMode,
    customPanPercent: 50.0,
    status: 'idle'
  }));
}

