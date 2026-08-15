import React, { useState, useRef } from 'react';
import {
  X,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  FileText,
  FolderOpen,
  Sparkles,
  Share2,
  Check,
  CheckCircle2,
  Film
} from 'lucide-react';
import { RenderJob, TranscriptData } from '../../types';
import { generateClipSRT } from '../../services/videoRenderer';

interface RenderedClipWatchModalProps {
  job: RenderJob;
  transcript?: TranscriptData;
  onClose: () => void;
  onOpenFolder?: (job: RenderJob) => void;
}

export const RenderedClipWatchModal: React.FC<RenderedClipWatchModalProps> = ({
  job,
  transcript,
  onClose,
  onOpenFolder,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen?.();
      }
    }
  };

  const handleDownloadVideo = async () => {
    const safeTitle = (job.clipTitle || 'short').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const aspect = (job.aspectRatio || '9:16').replace(':', 'x');
    const filename = `ShortsForge_Clip_${String(job.clipRank).padStart(2, '0')}_${aspect}_${safeTitle}.mp4`;

    const url = job.outputFileUrl;
    if (!url) return;

    try {
      if (url.startsWith('blob:') || url.startsWith('data:')) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const res = await fetch(url);
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadSRT = () => {
    const fakeClip = {
      id: job.clipId,
      rank: job.clipRank,
      start: job.start,
      end: job.end,
      duration: job.duration,
      title: job.clipTitle,
      hook: job.clipTitle,
      reason: '',
      viral_score: 90,
      topics: [],
      selected: true,
      cropMode: job.cropMode,
      status: 'completed' as const,
    };
    const srtContent = generateClipSRT(fakeClip, transcript);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ShortsForge_Clip_${String(job.clipRank).padStart(2, '0')}_subtitles.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleCopyShareLink = () => {
    if (job.outputFileUrl) {
      navigator.clipboard.writeText(job.outputFileUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const aspect = job.aspectRatio || '9:16';
  const isVertical = aspect === '9:16';
  const isSquare = aspect === '1:1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div
        id="modal-watch-rendered-clip"
        className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl"
      >
        {/* Modal Header */}
        <div className="p-4 sm:px-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Clip #{job.clipRank}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700 font-semibold">
                  {aspect} Format
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/50">
                  Render Ready
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-lg mt-1">
                {job.clipTitle}
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
            title="Close viewer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col md:flex-row items-center gap-6 justify-center">
          {/* Video Player Display */}
          <div className="flex flex-col items-center justify-center w-full md:w-auto">
            <div
              className={`relative bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl group flex items-center justify-center ${
                isVertical
                  ? 'w-[270px] sm:w-[320px] aspect-[9/16]'
                  : isSquare
                  ? 'w-[320px] sm:w-[380px] aspect-square'
                  : 'w-full max-w-[500px] aspect-video'
              }`}
            >
              {job.outputFileUrl ? (
                <video
                  ref={videoRef}
                  src={job.outputFileUrl}
                  autoPlay
                  loop
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center text-neutral-400">
                  <Film className="w-12 h-12 text-neutral-600 mb-2" />
                  <p className="text-xs">No direct video source stream</p>
                </div>
              )}

              {/* Player Overlay Controls */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 pointer-events-none">
                <div className="flex items-center justify-between text-xs text-white font-mono pointer-events-auto">
                  <span className="bg-black/60 px-2 py-1 rounded backdrop-blur">
                    {aspect} • {job.duration.toFixed(1)}s
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pointer-events-auto">
                  <button
                    onClick={togglePlay}
                    className="p-2.5 rounded-full bg-amber-500 hover:bg-amber-400 text-neutral-950 transition shadow-lg"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur transition"
                    >
                      {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur transition"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Action Panel */}
          <div className="w-full md:w-80 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Duration</span>
                  <span className="font-mono text-white font-bold">{job.duration.toFixed(1)} seconds</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Aspect Ratio</span>
                  <span className="font-mono text-amber-400 font-bold">{aspect}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Crop Mode</span>
                  <span className="capitalize text-white font-medium">{job.cropMode}</span>
                </div>
                {job.outputFilePath && (
                  <div className="pt-2 border-t border-neutral-800/80">
                    <span className="text-[11px] text-neutral-500 block mb-1">Local File Path:</span>
                    <p className="font-mono text-[11px] text-neutral-300 bg-neutral-900 p-2 rounded border border-neutral-800 break-all">
                      {job.outputFilePath}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 text-xs flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Render completed with dynamic burned-in viral subtitles & audio waveform sync.</span>
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2.5 pt-2">
              {/* Primary Download Button */}
              <button
                id="btn-modal-download-clip"
                onClick={handleDownloadVideo}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 text-neutral-950 text-sm font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20"
              >
                {downloadSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Downloaded Successfully!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Final Video (MP4)</span>
                  </>
                )}
              </button>

              {/* Subtitles & Folder Actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleDownloadSRT}
                  className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700 transition"
                  title="Download .SRT Subtitle file for this clip"
                >
                  <FileText className="w-3.5 h-3.5 text-amber-400" />
                  <span>Subtitles (.SRT)</span>
                </button>

                {onOpenFolder ? (
                  <button
                    onClick={() => onOpenFolder(job)}
                    className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700 transition"
                    title="Open Output Folder in Explorer"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open Folder</span>
                  </button>
                ) : (
                  <button
                    onClick={handleCopyShareLink}
                    className="py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700 transition"
                  >
                    <Share2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
