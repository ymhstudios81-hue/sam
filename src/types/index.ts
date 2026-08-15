export interface VideoMetadata {
  filename: string;
  originalName: string;
  duration: number; // in seconds
  width: number;
  height: number;
  fps: number;
  videoCodec: string;
  audioCodec: string;
  fileSize: number; // in bytes
  localPath: string;
  previewUrl: string;
  hasAudio: boolean;
}

export interface TranscriptSegment {
  start: number; // decimal seconds e.g. 72.3
  end: number;   // decimal seconds e.g. 80.4
  text: string;
  speaker?: string;
}

export type TranscriptFormat = 'srt' | 'vtt' | 'json' | 'txt';

export type AspectRatioFormat = '9:16' | '16:9' | '1:1';

export interface TranscriptData {
  rawText: string;
  format: TranscriptFormat;
  isTimestamped: boolean;
  segments: TranscriptSegment[];
  validationError?: string;
  totalDuration?: number;
}

export type CropMode = 'autoface' | 'center' | 'blur' | 'custom' | 'split';

export interface Clip {
  id: string;
  rank: number;
  start: number;      // decimal seconds (e.g. 124.5)
  end: number;        // decimal seconds (e.g. 178.2)
  duration: number;   // decimal seconds
  title: string;
  hook: string;
  reason: string;
  viral_score: number; // 0 to 100
  topics: string[];
  selected: boolean;
  aspectRatio?: AspectRatioFormat; // '9:16' | '16:9' | '1:1'
  cropMode: CropMode;
  customPanPercent?: number; // 0 to 100 for custom crop pan
  includeCaptions?: boolean; // burn subtitles onto video
  captionStyle?: 'viral_yellow' | 'clean_white' | 'minimal' | 'none';
  showOverlays?: boolean; // show rank & viral score overlays
  showProgressBar?: boolean;
  enable4kFilter?: boolean; // CapCut-style 4K HD Quality & Color Grade filter (Sharpen, S-curve contrast & vibrant saturation)
  status: 'idle' | 'queued' | 'rendering' | 'completed' | 'failed';
  renderProgress?: number;
  renderedVideoUrl?: string;
  renderedFilePath?: string;
  renderError?: string;
}

export type RenderJobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface RenderJob {
  id: string;
  projectId: string;
  clipId: string;
  clipTitle: string;
  clipRank: number;
  start: number;
  end: number;
  duration: number;
  aspectRatio?: AspectRatioFormat;
  cropMode: CropMode;
  customPanPercent?: number;
  includeCaptions?: boolean;
  captionStyle?: string;
  showOverlays?: boolean;
  enable4kFilter?: boolean;
  status: RenderJobStatus;
  progress: number; // 0 to 100
  error?: string;
  outputFilePath?: string;
  outputFileUrl?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  video?: VideoMetadata;
  transcript?: TranscriptData;
  claudeModelUsed?: string;
  analyzedAt?: string;
  clips: Clip[];
}

export interface AppSettings {
  anthropicApiKeyConfigured: boolean;
  anthropicApiKey?: string;
  claudeModel: string;
  defaultClipCount: number;
  durationMode?: 'auto' | 'custom' | 'short' | 'medium' | 'long'; // 'auto' lets full story play out naturally without mid-sentence cuts
  minClipDuration: number;
  maxClipDuration: number;
  customPrompt?: string; // custom instructions provided by user to Claude
  outputResolution: string; // e.g. "1080x1920"
  aspectRatio?: AspectRatioFormat; // '9:16' | '16:9' | '1:1'
  defaultAspectRatio?: AspectRatioFormat; // '9:16' | '16:9' | '1:1'
  cropMode: CropMode;
  burnCaptions?: boolean;
  defaultIncludeCaptions?: boolean;
  defaultCaptionStyle?: 'viral_yellow' | 'clean_white' | 'minimal' | 'none';
  defaultShowOverlays?: boolean;
  default4kFilter?: boolean;
  captionStyle?: 'viral_yellow' | 'clean_white' | 'minimal' | 'none';
  includeDebugOverlays?: boolean;
  includeProgressBar?: boolean;
  videoQuality: 'medium' | 'high' | 'ultra';
  workspaceDir: string;
  ffmpegDetected: boolean;
  ffprobeDetected: boolean;
  ffmpegVersion?: string;
  pythonDetected: boolean;
  pythonVersion?: string;
}

export interface ClaudeRawClip {
  rank?: number;
  start: number | string;
  end: number | string;
  duration?: number | string;
  title?: string;
  hook?: string;
  reason?: string;
  viral_score?: number;
  topics?: string[];
}

export interface ClaudeAnalysisResponse {
  clips: ClaudeRawClip[];
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  category: 'startup' | 'ffmpeg' | 'transcript' | 'claude' | 'render' | 'project';
  message: string;
  details?: string;
}
