import React, { useState, useEffect } from 'react';
import { X, Play, Pause, Clock, Sliders, Scissors, AlertCircle, Check, Smartphone, Monitor, Square, MessageSquareText, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { Clip, CropMode, AspectRatioFormat, VideoMetadata, TranscriptData } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';
import { VideoPlayerWithFraming } from '../VideoPlayer/VideoPlayerWithFraming';

interface ClipPreviewModalProps {
  clip: Clip | null;
  video?: VideoMetadata;
  transcript?: TranscriptData;
  isOpen: boolean;
  onClose: () => void;
  onSaveClip: (updatedClip: Clip) => void;
  onRenderClip: (clip: Clip) => void;
}

export const ClipPreviewModal: React.FC<ClipPreviewModalProps> = ({
  clip,
  video,
  transcript,
  isOpen,
  onClose,
  onSaveClip,
  onRenderClip,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(
    typeof clip?.start === 'number' && !isNaN(clip.start) ? clip.start : 0
  );
  const [startSec, setStartSec] = useState<number | string>(
    typeof clip?.start === 'number' && !isNaN(clip.start) ? clip.start : 0
  );
  const [endSec, setEndSec] = useState<number | string>(
    typeof clip?.end === 'number' && !isNaN(clip.end) ? clip.end : 60
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatioFormat>(clip?.aspectRatio || '9:16');
  const [cropMode, setCropMode] = useState<CropMode>(clip?.cropMode || 'center');
  const [panPercent, setPanPercent] = useState<number>(
    typeof clip?.customPanPercent === 'number' && !isNaN(clip.customPanPercent)
      ? clip.customPanPercent
      : 50
  );
  const [includeCaptions, setIncludeCaptions] = useState<boolean>(clip?.includeCaptions ?? true);
  const [captionStyle, setCaptionStyle] = useState<'viral_yellow' | 'clean_white' | 'minimal' | 'none'>(
    clip?.captionStyle || 'viral_yellow'
  );
  const [showOverlays, setShowOverlays] = useState<boolean>(clip?.showOverlays ?? false);
  const [showProgressBar, setShowProgressBar] = useState<boolean>(clip?.showProgressBar ?? false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!clip) return;
    const safeStart = typeof clip.start === 'number' && !isNaN(clip.start) ? clip.start : 0;
    const safeEnd = typeof clip.end === 'number' && !isNaN(clip.end) ? clip.end : 60;
    const safePan = typeof clip.customPanPercent === 'number' && !isNaN(clip.customPanPercent) ? clip.customPanPercent : 50;
    
    setStartSec(safeStart);
    setEndSec(safeEnd);
    setAspectRatio(clip.aspectRatio || '9:16');
    setCropMode(clip.cropMode || 'center');
    setPanPercent(safePan);
    setIncludeCaptions(clip.includeCaptions ?? true);
    setCaptionStyle(clip.captionStyle || 'viral_yellow');
    setShowOverlays(clip.showOverlays ?? false);
    setShowProgressBar(clip.showProgressBar ?? false);
    setCurrentTime(safeStart);
    setIsPlaying(false);
    setErrorMsg(null);
  }, [clip]);

  const numStart = typeof startSec === 'number' ? startSec : (parseFloat(startSec) || 0);
  const numEnd = typeof endSec === 'number' ? endSec : (parseFloat(endSec) || 0);
  const duration = Math.max(0, numEnd - numStart);

  const togglePlay = () => {
    if (!isPlaying) {
      if (currentTime < numStart || currentTime >= numEnd) {
        setCurrentTime(numStart);
      }
    }
    setIsPlaying((prev) => !prev);
  };

  const seekTo = (time: number) => {
    if (!isNaN(time)) {
      setCurrentTime(time);
    }
  };

  const validateTimes = (newStart: number, newEnd: number): boolean => {
    if (isNaN(newStart) || newStart < 0) {
      setErrorMsg('Start time cannot be negative.');
      return false;
    }
    if (isNaN(newEnd) || newEnd <= newStart) {
      setErrorMsg('End time must be greater than start time.');
      return false;
    }
    if (video && video.duration > 0 && newEnd > video.duration + 2) {
      setErrorMsg(`End time exceeds video duration (${video.duration}s).`);
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleStartChange = (val: string) => {
    setStartSec(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      validateTimes(num, numEnd);
      seekTo(num);
    }
  };

  const handleEndChange = (val: string) => {
    setEndSec(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      validateTimes(numStart, num);
    }
  };

  const handleClose = () => {
    setIsPlaying(false);
    onClose();
  };

  const handleSave = () => {
    if (!validateTimes(numStart, numEnd)) return;
    setIsPlaying(false);
    const updated: Clip = {
      ...(clip as Clip),
      start: parseFloat(numStart.toFixed(2)),
      end: parseFloat(numEnd.toFixed(2)),
      duration: parseFloat(duration.toFixed(2)),
      aspectRatio,
      cropMode,
      customPanPercent: isNaN(panPercent) ? 50 : panPercent,
      includeCaptions,
      captionStyle,
      showOverlays,
      showProgressBar,
    };
    onSaveClip(updated);
    onClose();
  };

  const handleRenderNow = () => {
    if (!validateTimes(numStart, numEnd)) return;
    setIsPlaying(false);
    const updated: Clip = {
      ...(clip as Clip),
      start: parseFloat(numStart.toFixed(2)),
      end: parseFloat(numEnd.toFixed(2)),
      duration: parseFloat(duration.toFixed(2)),
      aspectRatio,
      cropMode,
      customPanPercent: isNaN(panPercent) ? 50 : panPercent,
      includeCaptions,
      captionStyle,
      showOverlays,
      showProgressBar,
    };
    onSaveClip(updated);
    onRenderClip(updated);
    onClose();
  };

  if (!isOpen || !clip) return null;

  return (
    <div
      id="modal-clip-preview"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                Clip #{clip.rank}
              </span>
              <h2 className="text-base font-bold text-white truncate max-w-md">{clip.title}</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              Select format ratio (9:16, 16:9, 1:1), adjust boundaries, captions, and overlays
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Video Preview with Format & Crop Guide Overlay */}
          <div className="relative max-h-[360px] mx-auto overflow-hidden flex items-center justify-center rounded-xl bg-black border border-neutral-800">
            <VideoPlayerWithFraming
              video={video}
              transcript={transcript}
              currentTime={isNaN(currentTime) ? 0 : currentTime}
              startSec={numStart}
              endSec={numEnd}
              aspectRatio={aspectRatio}
              cropMode={cropMode}
              panPercent={isNaN(panPercent) ? 50 : panPercent}
              isPlaying={isPlaying}
              onTimeUpdate={(t) => setCurrentTime(isNaN(t) ? 0 : t)}
              onTogglePlay={togglePlay}
              showFramingOverlay={true}
              className="w-full max-h-[360px]"
            />

            {/* Play Button Overlay */}
            <button
              onClick={togglePlay}
              className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg hover:scale-105 transition"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <span className="absolute bottom-4 right-4 text-xs font-mono bg-black/80 px-2.5 py-1 rounded text-neutral-300 backdrop-blur">
              {formatSecondsToTimecode(currentTime)}
            </span>
          </div>

          {/* Aspect Ratio Format Picker */}
          <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>Aspect Ratio Format</span>
              </div>
              <span className="font-mono text-xs text-neutral-400">
                Target Resolution:{' '}
                {aspectRatio === '9:16'
                  ? '1080×1920 (Vertical)'
                  : aspectRatio === '16:9'
                  ? '1920×1080 (Landscape)'
                  : '1080×1080 (Square)'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {/* 9:16 Vertical */}
              <button
                id="btn-modal-format-9-16"
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  aspectRatio === '9:16'
                    ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                    9:16 Vertical
                  </span>
                  {aspectRatio === '9:16' && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                </div>
                <span className="text-[10px] text-neutral-500 mt-1">Shorts, Reels, TikTok (1080×1920)</span>
              </button>

              {/* 16:9 Landscape */}
              <button
                id="btn-modal-format-16-9"
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  aspectRatio === '16:9'
                    ? 'bg-emerald-500/10 border-emerald-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                    16:9 Landscape
                  </span>
                  {aspectRatio === '16:9' && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                </div>
                <span className="text-[10px] text-neutral-500 mt-1">YouTube, Desktop, TV (1920×1080)</span>
              </button>

              {/* 1:1 Square */}
              <button
                id="btn-modal-format-1-1"
                type="button"
                onClick={() => setAspectRatio('1:1')}
                className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                  aspectRatio === '1:1'
                    ? 'bg-purple-500/10 border-purple-500 text-white shadow-sm'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Square className="w-3.5 h-3.5 text-purple-400" />
                    1:1 Square
                  </span>
                  {aspectRatio === '1:1' && <span className="w-2 h-2 rounded-full bg-purple-400" />}
                </div>
                <span className="text-[10px] text-neutral-500 mt-1">Instagram, LinkedIn Feed (1080×1080)</span>
              </button>
            </div>
          </div>

          {/* Subtitles & Captions Configuration */}
          <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
              <div className="flex items-center gap-1.5">
                <MessageSquareText className="w-4 h-4 text-amber-400" />
                <span>Captions & Subtitles</span>
              </div>
              <button
                type="button"
                onClick={() => setIncludeCaptions(!includeCaptions)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold font-mono transition flex items-center gap-1.5 ${
                  includeCaptions
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                }`}
              >
                {includeCaptions ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                <span>{includeCaptions ? 'Burn Subtitles: ON' : 'Burn Subtitles: OFF'}</span>
              </button>
            </div>

            {includeCaptions && (
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                {[
                  { id: 'viral_yellow', name: 'Viral Yellow', desc: 'Punchy yellow highlight on dark pill' },
                  { id: 'clean_white', name: 'Clean White', desc: 'Crisp bold white text with dark outline' },
                  { id: 'minimal', name: 'Minimal Box', desc: 'Subtle translucent subtitle plate' },
                ].map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCaptionStyle(s.id as any)}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                      captionStyle === s.id
                        ? 'bg-amber-500/10 border-amber-500 text-white'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-xs font-bold text-neutral-200">{s.name}</span>
                    <span className="text-[10px] text-neutral-500 mt-0.5">{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[11px] text-neutral-500">
              {includeCaptions
                ? 'Subtitles will be rendered directly onto the video frames.'
                : 'Clean video will be exported without any text baked into the pixels. You can still download the standalone .SRT subtitle file.'}
            </p>
          </div>

          {/* Overlays & Watermark Settings (Clean Output by Default) */}
          <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Export Overlays (Clean Video Control)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  !showOverlays
                    ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block text-neutral-200">Clean Production Export</span>
                  <span className="text-[10px] text-neutral-400">No clip # or viral score badge</span>
                </div>
                <input
                  type="checkbox"
                  checked={!showOverlays}
                  onChange={(e) => setShowOverlays(!e.target.checked)}
                  className="accent-emerald-500"
                />
              </label>

              <label
                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                  showProgressBar
                    ? 'bg-amber-500/10 border-amber-500 text-amber-300'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <span className="text-xs font-bold block text-neutral-200">Bottom Progress Bar</span>
                  <span className="text-[10px] text-neutral-400">Animated retention time bar</span>
                </div>
                <input
                  type="checkbox"
                  checked={showProgressBar}
                  onChange={(e) => setShowProgressBar(e.target.checked)}
                  className="accent-amber-500"
                />
              </label>
            </div>
          </div>

          {/* Fine-tune Timestamps Scrubbing */}
          <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Clip Boundaries & Duration</span>
              </div>
              <span className="font-mono text-amber-400 font-bold text-xs">
                Total Duration: {duration.toFixed(1)}s
              </span>
            </div>

            {/* Range Scrubber Bar */}
            <div className="pt-2">
              <div className="relative h-6 bg-neutral-800 rounded-lg overflow-hidden flex items-center">
                {/* Active Clip Region */}
                <div
                  className="absolute h-full bg-amber-500/30 border-x-2 border-amber-400"
                  style={{
                    left: `${Math.min(100, Math.max(0, (numStart / (video?.duration || 180)) * 100))}%`,
                    width: `${Math.min(
                      100,
                      Math.max(0, (duration / (video?.duration || 180)) * 100)
                    )}%`,
                  }}
                />

                {/* Current Playhead */}
                <div
                  className="absolute h-full w-0.5 bg-white shadow-[0_0_8px_white] z-10"
                  style={{
                    left: `${Math.min(100, Math.max(0, (currentTime / (video?.duration || 180)) * 100))}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-neutral-500 mt-1">
                <span>00:00.000</span>
                <span>{formatSecondsToTimecode(video?.duration || 180)}</span>
              </div>
            </div>

            {/* Precision Inputs */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                  Start Time (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={startSec === '' || isNaN(Number(startSec)) ? '' : startSec}
                    onChange={(e) => handleStartChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-mono text-neutral-400 whitespace-nowrap">
                    {formatSecondsToTimecode(numStart)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-mono text-neutral-400 block mb-1">
                  End Time (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={endSec === '' || isNaN(Number(endSec)) ? '' : endSec}
                    onChange={(e) => handleEndChange(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-neutral-900 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-xs font-mono text-neutral-400 whitespace-nowrap">
                    {formatSecondsToTimecode(numEnd)}
                  </span>
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          {/* Framing / Crop Mode Selector (for 9:16 and 1:1) */}
          {aspectRatio !== '16:9' && (
            <div className="space-y-3 bg-neutral-950/70 p-4 rounded-xl border border-neutral-800">
              <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-amber-400" />
                  <span>Framing & Crop Strategy</span>
                </div>
                <span className="capitalize text-neutral-400 text-xs font-mono">
                  Current: {cropMode}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(['center', 'blur', 'custom'] as CropMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCropMode(mode)}
                    className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between ${
                      cropMode === mode
                        ? 'bg-amber-500/10 border-amber-500 text-white shadow-sm'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <span className="text-xs font-semibold capitalize">
                      {mode === 'center'
                        ? 'Center Crop'
                        : mode === 'blur'
                        ? 'Blurred Backdrop'
                        : 'Custom Pan'}
                    </span>
                    <span className="text-[10px] text-neutral-500 mt-1">
                      {mode === 'center'
                        ? `Direct ${aspectRatio === '9:16' ? '1080×1920' : '1080×1080'} center cut`
                        : mode === 'blur'
                        ? 'Fit frame with smooth blurred edges'
                        : 'Adjust horizontal focus position'}
                    </span>
                  </button>
                ))}
              </div>

              {cropMode === 'custom' && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex justify-between text-xs text-neutral-400 font-mono">
                    <span>Pan Left (0%)</span>
                    <span className="text-amber-400 font-bold">
                      {isNaN(panPercent) ? 50 : panPercent}% (Center: 50%)
                    </span>
                    <span>Pan Right (100%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={isNaN(panPercent) ? 50 : panPercent}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setPanPercent(isNaN(v) ? 50 : v);
                    }}
                    className="w-full accent-amber-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between gap-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-bold border border-amber-500/30 flex items-center gap-1.5 transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>

            <button
              onClick={handleRenderNow}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-500/20"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Render {aspectRatio} Video</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
