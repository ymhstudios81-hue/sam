import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Play, Pause, AlertCircle, Volume2, Sparkles, User, Crosshair, Users } from 'lucide-react';
import { VideoMetadata, CropMode, AspectRatioFormat, TranscriptData } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';
import { globalSpeakerTracker, SpeakerTrackingState } from '../../services/faceTracker';

interface VideoPlayerWithFramingProps {
  video?: VideoMetadata | null;
  transcript?: TranscriptData | null;
  currentTime: number;
  startSec?: number;
  endSec?: number;
  aspectRatio?: AspectRatioFormat;
  cropMode?: CropMode;
  panPercent?: number;
  isPlaying: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  showFramingOverlay?: boolean;
  enable4kFilter?: boolean;
  onToggle4kFilter?: (enabled: boolean) => void;
  className?: string;
  autoLoopClip?: boolean;
}

export const VideoPlayerWithFraming: React.FC<VideoPlayerWithFramingProps> = ({
  video,
  transcript,
  currentTime,
  startSec = 0,
  endSec,
  aspectRatio = '9:16',
  cropMode = 'center',
  panPercent = 50,
  isPlaying,
  onTimeUpdate,
  onTogglePlay,
  showFramingOverlay = true,
  enable4kFilter,
  onToggle4kFilter,
  className = '',
  autoLoopClip = true,
}) => {
  const [internal4k, setInternal4k] = useState<boolean>(enable4kFilter ?? false);

  useEffect(() => {
    if (enable4kFilter !== undefined) {
      setInternal4k(enable4kFilter);
    }
  }, [enable4kFilter]);

  const is4kActive = enable4kFilter !== undefined ? enable4kFilter : internal4k;

  const handleToggle4k = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextVal = !is4kActive;
    setInternal4k(nextVal);
    onToggle4kFilter?.(nextVal);
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [nativeVideoPlayable, setNativeVideoPlayable] = useState<boolean>(false);
  const [hasVideoError, setHasVideoError] = useState<boolean>(false);
  const lastTimeRef = useRef<number>(currentTime);
  const animFrameIdRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(0);

  const effectiveEndSec = endSec ?? (video?.duration || 170);

  // Keep lastTimeRef in sync
  useEffect(() => {
    lastTimeRef.current = currentTime;
  }, [currentTime]);

  // Check if native video URL is valid and test playback capability
  useEffect(() => {
    if (!video?.previewUrl || video.previewUrl.trim() === '') {
      setNativeVideoPlayable(false);
      setHasVideoError(false);
      return;
    }

    // Attempt to load metadata on native video
    setHasVideoError(false);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [video?.previewUrl]);

  // Handle native video time syncing
  useEffect(() => {
    if (nativeVideoPlayable && videoRef.current && !hasVideoError) {
      if (Math.abs(videoRef.current.currentTime - currentTime) > 0.3) {
        try {
          videoRef.current.currentTime = currentTime;
        } catch {
          // Ignore sync errors
        }
      }
    }
  }, [currentTime, nativeVideoPlayable, hasVideoError]);

  // Handle native video play/pause
  useEffect(() => {
    if (nativeVideoPlayable && videoRef.current && !hasVideoError) {
      if (isPlaying) {
        const promise = videoRef.current.play();
        if (promise !== undefined) {
          promise.catch(() => {
            // Silently fall back to canvas clock if browser interrupts or source fails
            setNativeVideoPlayable(false);
          });
        }
      } else {
        try {
          videoRef.current.pause();
        } catch {
          // Ignore pause error
        }
      }
    }
  }, [isPlaying, nativeVideoPlayable, hasVideoError]);

  // Live Speaker & Face Tracking state
  const [trackingState, setTrackingState] = useState<SpeakerTrackingState>(() =>
    globalSpeakerTracker.update(null as any, currentTime, transcript)
  );

  // Update tracking on each time step
  useEffect(() => {
    if (cropMode === 'autoface' || cropMode === 'split') {
      const source = (nativeVideoPlayable && !hasVideoError && videoRef.current) 
        ? videoRef.current 
        : (canvasRef.current || (null as any));
      const nextTrack = globalSpeakerTracker.update(source, currentTime, transcript);
      setTrackingState(nextTrack);
    }
  }, [currentTime, cropMode, transcript, nativeVideoPlayable, hasVideoError]);

  // Find active subtitle dialogue segment at currentTime
  const currentSubtitle = React.useMemo(() => {
    if (!transcript?.segments || transcript.segments.length === 0) return null;
    return transcript.segments.find(
      (seg) => currentTime >= seg.start && currentTime <= seg.end
    );
  }, [transcript, currentTime]);

  // Canvas Studio Renderer for Demo / Fallback Playback
  const drawCanvasFrame = useCallback(
    (time: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;

      // Dark studio gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, w, h);
      bgGrad.addColorStop(0, '#0c0f17');
      bgGrad.addColorStop(0.5, '#141a29');
      bgGrad.addColorStop(1, '#090b10');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Studio grid pattern
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const step = 40;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Studio Header Banner
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.fillRect(0, 0, w, 52);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, 52);
      ctx.lineTo(w, 52);
      ctx.stroke();

      // Studio Title & Badges
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('DEEP FOCUS PODCAST • EPISODE 48', 24, 32);

      ctx.fillStyle = isPlaying ? '#ef4444' : '#64748b';
      ctx.beginPath();
      ctx.arc(w - 180, 26, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(isPlaying ? 'LIVE PREVIEW' : 'PAUSED', w - 165, 30);

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`TC: ${formatSecondsToTimecode(time, true)}`, w - 90, 30);

      // Two Speaker Boxes: Host (Left) and Guest (Right)
      const boxW = (w - 72) / 2;
      const boxH = h - 170;
      const boxY = 72;

      // Determine who is speaking (Guest speaks during middle/answer parts)
      const isGuestSpeaking = (Math.floor(time) % 10) >= 3;

      // Left Box: HOST (Jordan Bell)
      const hostX = 24;
      const hostActive = !isGuestSpeaking;
      ctx.fillStyle = hostActive ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = hostActive ? '#38bdf8' : 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = hostActive ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(hostX, boxY, boxW, boxH, 12) : ctx.rect(hostX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      // Host Avatar / Cam Box
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(hostX + 16, boxY + 16, boxW - 32, boxH - 100, 8) : ctx.rect(hostX + 16, boxY + 16, boxW - 32, boxH - 100);
      ctx.fill();

      // Host Graphic Avatar Icon
      ctx.fillStyle = hostActive ? '#38bdf8' : '#64748b';
      ctx.beginPath();
      ctx.arc(hostX + boxW / 2, boxY + (boxH - 100) / 2 + 10, 36, 0, Math.PI * 2);
      ctx.fill();

      // Host Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Jordan Bell', hostX + 20, boxY + boxH - 55);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('Host • Deep Focus', hostX + 20, boxY + boxH - 35);

      // Host Waveform meter
      if (hostActive && isPlaying) {
        for (let i = 0; i < 14; i++) {
          const barH = 6 + Math.abs(Math.sin(time * 8 + i * 0.7)) * 20;
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(hostX + boxW - 130 + i * 8, boxY + boxH - 35 - barH, 5, barH);
        }
      }

      // Right Box: GUEST (Alex Vance)
      const guestX = hostX + boxW + 24;
      const guestActive = isGuestSpeaking;
      ctx.fillStyle = guestActive ? 'rgba(30, 41, 59, 0.85)' : 'rgba(15, 23, 42, 0.7)';
      ctx.strokeStyle = guestActive ? '#f59e0b' : 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = guestActive ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(guestX, boxY, boxW, boxH, 12) : ctx.rect(guestX, boxY, boxW, boxH);
      ctx.fill();
      ctx.stroke();

      // Guest Avatar / Cam Box
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(guestX + 16, boxY + 16, boxW - 32, boxH - 100, 8) : ctx.rect(guestX + 16, boxY + 16, boxW - 32, boxH - 100);
      ctx.fill();

      // Guest Graphic Avatar Icon
      ctx.fillStyle = guestActive ? '#f59e0b' : '#64748b';
      ctx.beginPath();
      ctx.arc(guestX + boxW / 2, boxY + (boxH - 100) / 2 + 10, 36, 0, Math.PI * 2);
      ctx.fill();

      // Guest Name Tag
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('Alex Vance', guestX + 20, boxY + boxH - 55);
      ctx.fillStyle = '#f59e0b';
      ctx.font = '12px sans-serif';
      ctx.fillText('Founder • NeuralFlow ($100M)', guestX + 20, boxY + boxH - 35);

      // Guest Waveform meter
      if (guestActive && isPlaying) {
        for (let i = 0; i < 14; i++) {
          const barH = 6 + Math.abs(Math.sin(time * 9 + i * 0.6)) * 22;
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(guestX + boxW - 130 + i * 8, boxY + boxH - 35 - barH, 5, barH);
        }
      }

      // Bottom Subtitle Overlay Bar
      const subBarH = 75;
      const subBarY = h - subBarH;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.fillRect(0, subBarY, w, subBarH);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, subBarY);
      ctx.lineTo(w, subBarY);
      ctx.stroke();

      // Render Active Transcript Subtitle Text
      const subText = currentSubtitle?.text || (isGuestSpeaking
        ? "We had $4,200 left in the bank account, and payroll for 18 engineers was due..."
        : "Alex, let's talk about the day you were 24 hours away from complete bankruptcy.");

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(subText, w / 2, subBarY + 42);
      ctx.textAlign = 'left';
    },
    [isPlaying, currentSubtitle]
  );

  // Animation Loop for Clock / Playback advancement
  useEffect(() => {
    let active = true;

    const tick = (now: number) => {
      if (!active) return;

      if (isPlaying) {
        if (lastTimestampRef.current === 0) {
          lastTimestampRef.current = now;
        }
        const delta = (now - lastTimestampRef.current) / 1000;
        lastTimestampRef.current = now;

        let nextTime = lastTimeRef.current + delta;

        // Clip boundary loop handling
        if (nextTime >= effectiveEndSec) {
          if (autoLoopClip) {
            nextTime = startSec;
          } else {
            onTogglePlay();
            nextTime = effectiveEndSec;
          }
        }

        lastTimeRef.current = nextTime;
        onTimeUpdate(nextTime);
      } else {
        lastTimestampRef.current = 0;
      }

      // Always draw canvas if native video is not playing
      if (!nativeVideoPlayable || hasVideoError) {
        drawCanvasFrame(lastTimeRef.current);
      }

      animFrameIdRef.current = requestAnimationFrame(tick);
    };

    animFrameIdRef.current = requestAnimationFrame(tick);

    return () => {
      active = false;
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [
    isPlaying,
    nativeVideoPlayable,
    hasVideoError,
    startSec,
    effectiveEndSec,
    autoLoopClip,
    onTimeUpdate,
    onTogglePlay,
    drawCanvasFrame,
  ]);

  // Force a redraw whenever currentTime or formatting changes
  useEffect(() => {
    if (!nativeVideoPlayable || hasVideoError) {
      drawCanvasFrame(currentTime);
    }
  }, [currentTime, nativeVideoPlayable, hasVideoError, drawCanvasFrame]);

  return (
    <div
      id="video-player-framing-container"
      className={`relative aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center select-none ${className}`}
    >
      {/* 1. Native Video Element (if playable media exists) */}
      {video?.previewUrl && !hasVideoError && (
        <video
          ref={videoRef}
          src={video.previewUrl}
          playsInline
          muted
          onCanPlay={() => setNativeVideoPlayable(true)}
          onError={() => {
            setNativeVideoPlayable(false);
            setHasVideoError(true);
          }}
          style={{
            filter: is4kActive
              ? 'contrast(1.18) saturate(1.24) brightness(1.03) drop-shadow(0 0 1px rgba(0,0,0,0.5))'
              : 'none',
            transition: 'filter 0.25s ease',
          }}
          className={`w-full h-full object-contain ${
            nativeVideoPlayable ? 'block' : 'hidden'
          }`}
        />
      )}

      {/* 2. Dynamic 60FPS Canvas Studio Visualizer (Fallback / Demo Player) */}
      <canvas
        ref={canvasRef}
        width={960}
        height={540}
        style={{
          filter: is4kActive
            ? 'contrast(1.18) saturate(1.24) brightness(1.03) drop-shadow(0 0 1px rgba(0,0,0,0.5))'
            : 'none',
          transition: 'filter 0.25s ease',
        }}
        className={`w-full h-full object-contain ${
          !nativeVideoPlayable || hasVideoError ? 'block' : 'hidden'
        }`}
      />

      {/* CapCut 4K Quality Quick Toggle Button in top-right corner of player */}
      <div className="absolute top-2.5 right-2.5 z-20 pointer-events-auto">
        <button
          type="button"
          onClick={handleToggle4k}
          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold flex items-center gap-1.5 transition shadow-lg backdrop-blur-md border ${
            is4kActive
              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-neutral-950 border-amber-300 ring-2 ring-amber-500/30'
              : 'bg-neutral-950/80 text-neutral-400 border-neutral-700 hover:text-white hover:border-neutral-500'
          }`}
          title={is4kActive ? 'CapCut 4K Quality Filter: ACTIVE (Click to toggle)' : 'CapCut 4K Quality Filter: OFF (Click to activate)'}
        >
          <Sparkles className={`w-3.5 h-3.5 ${is4kActive ? 'text-neutral-950 fill-neutral-950' : 'text-amber-400'}`} />
          <span>{is4kActive ? '✨ 4K CC: ON' : '4K CC: OFF'}</span>
        </button>
      </div>

      {/* 3. Aspect Ratio Framing Overlays */}
      {showFramingOverlay && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* 9:16 Vertical Overlay */}
          {aspectRatio === '9:16' && (
            <>
              {cropMode === 'autoface' && (
                <div
                  className="h-full aspect-[9/16] border-2 border-amber-400 bg-amber-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out"
                  style={{
                    transform: `translateX(${(trackingState.smoothedPanX - 0.5) * 120}%)`,
                  }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow-lg">
                    <Crosshair className="w-3 h-3 animate-spin text-neutral-950" />
                    <span>AI Face Track ({trackingState.activeSpeaker.toUpperCase()})</span>
                  </div>

                  {/* Tracking reticle corners */}
                  <div className="absolute inset-4 border border-dashed border-amber-400/40 rounded-lg pointer-events-none flex flex-col justify-between p-2">
                    <div className="flex justify-between items-center text-[9px] font-mono text-amber-300 bg-black/60 px-1.5 py-0.5 rounded self-start">
                      <span>Tracking Active Speaker</span>
                    </div>
                  </div>
                </div>
              )}

              {cropMode === 'split' && (
                <div className="h-full aspect-[9/16] border-2 border-purple-400 bg-purple-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] flex flex-col">
                  {/* Top Speaker Box */}
                  <div className="flex-1 border-b-2 border-amber-400 relative flex items-start p-2 bg-neutral-900/30">
                    <span className="bg-purple-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                      TOP: Speaker 1 (Host)
                    </span>
                  </div>
                  {/* Bottom Speaker Box */}
                  <div className="flex-1 relative flex items-start p-2 bg-neutral-900/30">
                    <span className="bg-amber-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded">
                      BOTTOM: Speaker 2 (Guest)
                    </span>
                  </div>
                </div>
              )}

              {cropMode === 'center' && (
                <div className="h-full aspect-[9/16] border-2 border-amber-400/90 bg-amber-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-amber-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>9:16 Center (1080×1920)</span>
                  </div>
                </div>
              )}

              {cropMode === 'blur' && (
                <div className="h-full aspect-[9/16] border-2 border-cyan-400/90 bg-cyan-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-cyan-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>9:16 Blurred Edges</span>
                  </div>
                </div>
              )}

              {cropMode === 'custom' && (
                <div
                  className="h-full aspect-[9/16] border-2 border-orange-400/90 bg-orange-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-transform duration-75"
                  style={{
                    transform: `translateX(${(panPercent - 50) * 1.5}%)`,
                  }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-orange-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>9:16 Pan ({panPercent}%)</span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 16:9 Landscape Overlay */}
          {aspectRatio === '16:9' && (
            <div className="w-full h-full border-2 border-emerald-400/90 bg-emerald-400/5 relative p-2">
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-emerald-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                <span>16:9 Landscape (1920×1080)</span>
              </div>
            </div>
          )}

          {/* 1:1 Square Overlay */}
          {aspectRatio === '1:1' && (
            <>
              {cropMode === 'autoface' && (
                <div
                  className="h-full aspect-square border-2 border-amber-400 bg-amber-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] transition-transform duration-200 ease-out"
                  style={{
                    transform: `translateX(${(trackingState.smoothedPanX - 0.5) * 80}%)`,
                  }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 px-2 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <Crosshair className="w-3 h-3 text-neutral-950" />
                    <span>AI Face Track ({trackingState.activeSpeaker.toUpperCase()})</span>
                  </div>
                </div>
              )}

              {cropMode === 'center' && (
                <div className="h-full aspect-square border-2 border-purple-400/90 bg-purple-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-purple-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>1:1 Square Center (1080×1080)</span>
                  </div>
                </div>
              )}

              {cropMode === 'blur' && (
                <div className="h-full aspect-square border-2 border-cyan-400/90 bg-cyan-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-cyan-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>1:1 Blurred Backdrop</span>
                  </div>
                </div>
              )}

              {cropMode === 'custom' && (
                <div
                  className="h-full aspect-square border-2 border-purple-400/90 bg-purple-400/10 relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-transform duration-75"
                  style={{
                    transform: `translateX(${(panPercent - 50) * 0.9}%)`,
                  }}
                >
                  <div className="absolute top-2 left-2 flex items-center gap-1 bg-purple-500 text-neutral-950 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shadow">
                    <span>1:1 Square Pan ({panPercent}%)</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
