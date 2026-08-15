import React from 'react';
import { Play, Flame, Clock, Check, Scissors, Sliders, Eye, Sparkles, Smartphone, Monitor, Square, Download, CheckCircle2, MessageSquareText } from 'lucide-react';
import { Clip, CropMode, AspectRatioFormat } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';

interface ClipCardProps {
  clip: Clip;
  onToggleSelect: (clipId: string) => void;
  onOpenPreview: (clip: Clip) => void;
  onGenerateSingle: (clip: Clip) => void;
  onCropModeChange: (clipId: string, mode: CropMode) => void;
  onAspectRatioChange?: (clipId: string, format: AspectRatioFormat) => void;
  onToggleCaptions?: (clipId: string) => void;
  isRendering?: boolean;
}

export const ClipCard: React.FC<ClipCardProps> = ({
  clip,
  onToggleSelect,
  onOpenPreview,
  onGenerateSingle,
  onCropModeChange,
  onAspectRatioChange,
  onToggleCaptions,
  isRendering,
}) => {
  const currentFormat: AspectRatioFormat = clip.aspectRatio || '9:16';
  const isRendered = clip.status === 'completed' || Boolean(clip.renderedVideoUrl);
  const captionsEnabled = clip.includeCaptions !== false;

  const getViralScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/40';
    if (score >= 80) return 'text-amber-400 border-amber-500/30 bg-amber-950/40';
    if (score >= 70) return 'text-cyan-400 border-cyan-500/30 bg-cyan-950/40';
    return 'text-neutral-400 border-neutral-700 bg-neutral-900';
  };

  const handleDownloadDirect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clip.renderedVideoUrl) {
      const a = document.createElement('a');
      a.href = clip.renderedVideoUrl;
      a.download = `ShortsForge_Clip_${String(clip.rank).padStart(2, '0')}_${currentFormat.replace(':', 'x')}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      onOpenPreview(clip);
    }
  };

  return (
    <div
      id={`clip-card-${clip.id}`}
      className={`rounded-xl border transition duration-200 overflow-hidden flex flex-col justify-between ${
        clip.selected
          ? 'bg-neutral-900/90 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/5'
          : isRendered
          ? 'bg-neutral-900/90 border-emerald-800/70 shadow-md'
          : 'bg-neutral-900/40 border-neutral-800 opacity-85 hover:opacity-100'
      }`}
    >
      {/* Header & Meta */}
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            {/* Rank badge */}
            <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center font-mono font-bold text-xs text-amber-400 flex-shrink-0">
              #{clip.rank}
            </div>

            {/* Selection Checkbox */}
            <button
              onClick={() => onToggleSelect(clip.id)}
              className={`w-5 h-5 rounded border flex items-center justify-center transition flex-shrink-0 ${
                clip.selected
                  ? 'bg-amber-500 border-amber-400 text-neutral-950'
                  : 'border-neutral-700 hover:border-neutral-500 bg-neutral-800'
              }`}
              title={clip.selected ? 'Deselect clip' : 'Select clip'}
            >
              {clip.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>

            <h3 className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-1">
              {clip.title}
            </h3>
          </div>

          {/* Viral Score & Ready Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isRendered && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-700/80 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                <span>Ready</span>
              </span>
            )}
            <div
              className={`px-2.5 py-1 rounded-full border text-xs font-mono font-bold flex items-center gap-1 ${getViralScoreColor(
                clip.viral_score
              )}`}
            >
              <Flame className="w-3.5 h-3.5 fill-current" />
              <span>{clip.viral_score}</span>
              <span className="text-[10px] font-normal opacity-70">/100</span>
            </div>
          </div>
        </div>

        {/* Hook quote */}
        <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-xs">
          <span className="text-amber-400/90 font-semibold block mb-0.5 text-[10px] uppercase font-mono tracking-wider">
            Opening Hook
          </span>
          <p className="text-neutral-200 italic line-clamp-2">"{clip.hook}"</p>
        </div>

        {/* Strategic Reason */}
        <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
          <strong className="text-neutral-300 font-medium">Why it works: </strong>
          {clip.reason}
        </p>

        {/* Timecodes, Captions & Topics */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] bg-neutral-950 px-2 py-1 rounded border border-neutral-800 text-neutral-300 flex items-center gap-1">
              <Clock className="w-3 h-3 text-neutral-500" />
              {formatSecondsToTimecode(clip.start)} → {formatSecondsToTimecode(clip.end)}
            </span>
            <span className="font-mono text-[11px] bg-amber-500/10 text-amber-300 px-2 py-1 rounded border border-amber-500/20 font-semibold">
              {(typeof clip.duration === 'number' && !isNaN(clip.duration) ? clip.duration : 0).toFixed(1)}s
            </span>
            {/* Format Tag */}
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
              currentFormat === '9:16'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : currentFormat === '16:9'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
            }`}>
              {currentFormat}
            </span>

            {/* Captions Badge Button */}
            <button
              type="button"
              onClick={() => onToggleCaptions && onToggleCaptions(clip.id)}
              className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border flex items-center gap-1 transition ${
                captionsEnabled
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 line-through opacity-70'
              }`}
              title={captionsEnabled ? 'Subtitles ON (Click to disable)' : 'Subtitles OFF (Click to enable)'}
            >
              <MessageSquareText className="w-3 h-3" />
              <span>{captionsEnabled ? 'Captions: ON' : 'Captions: OFF'}</span>
            </button>
          </div>

          {/* Topics */}
          {clip.topics && clip.topics.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              {clip.topics.slice(0, 2).map((t, idx) => (
                <span
                  key={idx}
                  className="text-[10px] bg-neutral-800/80 text-neutral-400 px-2 py-0.5 rounded-full"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Format & Crop Selector Bar */}
      <div className="px-4 py-3 bg-neutral-950/60 border-t border-neutral-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Format Toggle */}
          <div className="flex items-center gap-0.5 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
            {(['9:16', '16:9', '1:1'] as AspectRatioFormat[]).map((fmt) => (
              <button
                key={fmt}
                type="button"
                onClick={() => onAspectRatioChange && onAspectRatioChange(clip.id, fmt)}
                className={`px-2 py-1 rounded font-mono font-bold transition ${
                  currentFormat === fmt
                    ? 'bg-neutral-800 text-amber-400 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
                title={`Render in ${fmt} aspect ratio`}
              >
                {fmt}
              </button>
            ))}
          </div>

          {/* Crop Strategy Picker (For 9:16 or 1:1) */}
          {currentFormat !== '16:9' && (
            <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded-lg border border-neutral-800 text-xs">
              {[
                { id: 'autoface', label: '🎯 Face Track' },
                { id: 'split', label: '👥 Split' },
                { id: 'center', label: 'Center' },
                { id: 'blur', label: 'Blur' },
                { id: 'custom', label: 'Pan' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => onCropModeChange(clip.id, id as CropMode)}
                  className={`px-2 py-1 rounded text-[10px] whitespace-nowrap transition ${
                    clip.cropMode === id
                      ? 'bg-neutral-800 text-amber-400 font-semibold shadow-sm'
                      : 'text-neutral-500 hover:text-neutral-300'
                  }`}
                  title={id === 'autoface' ? 'Auto Face & Speaker Tracking' : id === 'split' ? 'Multi-Speaker Split Screen' : `${label} crop`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenPreview(clip)}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center justify-center gap-1.5 transition"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Fine-tune</span>
          </button>

          {isRendered ? (
            <button
              onClick={handleDownloadDirect}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-sm"
              title="Download rendered clip directly"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ({currentFormat})</span>
            </button>
          ) : (
            <button
              onClick={() => onGenerateSingle(clip)}
              disabled={isRendering}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>Generate ({currentFormat})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
