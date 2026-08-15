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
