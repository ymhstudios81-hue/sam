import { Clip, TranscriptData, VideoMetadata, AspectRatioFormat, CropMode } from '../types';

export interface RenderProgressCallback {
  (progress: number, stage: string): void;
}

/**
 * Client-side video render engine that takes the user's actual video source (MP4/WebM/MOV),
 * seeks to the exact clip timestamps (clip.start to clip.end), applies aspect ratio framing
 * (9:16 vertical, 16:9 landscape, 1:1 square) with chosen crop mode (center, blur, custom pan),
 * burns in synchronized viral subtitle captions, and exports a genuine full-length MP4/WebM video file.
 */
export async function renderClipToBlob(
  clip: Clip,
  video?: VideoMetadata,
  transcript?: TranscriptData,
  onProgress?: RenderProgressCallback
): Promise<{ blob: Blob; url: string; filename: string }> {
  return new Promise(async (resolve, reject) => {
    try {
      onProgress?.(5, 'Preparing video source and audio tracks...');

      const aspect = clip.aspectRatio || '9:16';
      let width = 1080;
      let height = 1920;

      if (aspect === '16:9') {
        width = 1920;
        height = 1080;
      } else if (aspect === '1:1') {
        width = 1080;
        height = 1080;
      }

      // Create offscreen canvas for frame compositing
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        throw new Error('Canvas 2D rendering context is not supported in this browser.');
      }

      // Setup HTML5 video element to read actual user video
      const videoEl = document.createElement('video');
      videoEl.crossOrigin = 'anonymous';
      videoEl.playsInline = true;
      videoEl.muted = false; // We will route audio through Web Audio
      videoEl.volume = 1.0;
      videoEl.preload = 'auto';

      const videoSrc = video?.previewUrl || '';
      if (!videoSrc) {
        throw new Error('No video source file found. Please upload or load a video first.');
      }
      videoEl.src = videoSrc;

      // Wait for video metadata to load
      await new Promise<void>((res, rej) => {
        const onLoaded = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onErr);
          res();
        };
        const onErr = () => {
          videoEl.removeEventListener('loadedmetadata', onLoaded);
          videoEl.removeEventListener('error', onErr);
          rej(new Error('Failed to decode source video file. Check format support.'));
        };
        if (videoEl.readyState >= 1) {
          res();
        } else {
          videoEl.addEventListener('loadedmetadata', onLoaded);
          videoEl.addEventListener('error', onErr);
        }
      });

      const videoDuration = videoEl.duration || clip.end || 60;
      const startSec = Math.max(0, Math.min(clip.start, videoDuration - 0.5));
      const endSec = Math.min(videoDuration, Math.max(startSec + 1, clip.end || startSec + clip.duration));
      const totalClipSec = Math.max(1, endSec - startSec);

      onProgress?.(10, `Seeking video to start marker (${startSec.toFixed(1)}s)...`);

      // Seek video element to start timestamp
      await new Promise<void>((res) => {
        const onSeeked = () => {
          videoEl.removeEventListener('seeked', onSeeked);
          res();
        };
        videoEl.currentTime = startSec;
        videoEl.addEventListener('seeked', onSeeked, { once: true });
      });

      // Setup audio routing via Web Audio to capture clear audio without speaker feedback
      let audioCtx: AudioContext | null = null;
      let dest: MediaStreamAudioDestinationNode | null = null;
      let audioTracks: MediaStreamTrack[] = [];

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          audioCtx = new AudioContextClass();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          dest = audioCtx.createMediaStreamDestination();
          const source = audioCtx.createMediaElementSource(videoEl);
          source.connect(dest);
          // Connect to destination stream only, not audioCtx.destination (keeps it silent during rendering)
          audioTracks = dest.stream.getAudioTracks();
        }
      } catch (audioErr) {
        console.warn('Web Audio capture fallback:', audioErr);
        try {
          if ((videoEl as any).captureStream) {
            const elStream = (videoEl as any).captureStream();
            audioTracks = elStream.getAudioTracks();
          } else if ((videoEl as any).mozCaptureStream) {
            const elStream = (videoEl as any).mozCaptureStream();
            audioTracks = elStream.getAudioTracks();
          }
        } catch {}
      }

      // Capture canvas stream at 30 FPS
      const canvasStream = canvas.captureStream(30);
      const combinedTracks = [...canvasStream.getVideoTracks(), ...audioTracks];
      const combinedStream = new MediaStream(combinedTracks);

      // Determine best supported recording format
      let mimeType = 'video/mp4';
      if (!MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/webm;codecs=vp9,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8,opus';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined,
        videoBitsPerSecond: 8_000_000, // 8 Mbps high-quality video encoding
        audioBitsPerSecond: 192_000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      let isFinished = false;
      let animFrameId: number | null = null;
      let renderInterval: any = null;

      const cleanup = () => {
        isFinished = true;
        if (animFrameId) cancelAnimationFrame(animFrameId);
        if (renderInterval) clearInterval(renderInterval);
        try {
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch {}
        if (audioCtx && audioCtx.state !== 'closed') {
          try {
            audioCtx.close();
          } catch {}
        }
      };

      mediaRecorder.onstop = () => {
        cleanup();
        const isMp4 = mimeType.includes('mp4');
        const finalBlob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : 'video/webm' });
        const url = URL.createObjectURL(finalBlob);
        const safeTitle = (clip.title || 'short').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
        const filename = `ShortsForge_Clip_${String(clip.rank).padStart(2, '0')}_${aspect.replace(':', 'x')}_${safeTitle}.${isMp4 ? 'mp4' : 'webm'}`;

        onProgress?.(100, 'Video rendered successfully!');
        resolve({ blob: finalBlob, url, filename });
      };

      // Start recording
      mediaRecorder.start(250);
      onProgress?.(15, `Rendering full ${totalClipSec.toFixed(1)}s clip with real video frames & audio...`);

      // Draw single frame to canvas
      const vWidth = videoEl.videoWidth || 1920;
      const vHeight = videoEl.videoHeight || 1080;
      const cropMode = clip.cropMode || 'center';
      const panFactor = Math.max(0, Math.min(100, clip.customPanPercent ?? 50)) / 100;

      // Filter transcript segments for this clip
      const relevantSegments = transcript?.segments?.filter(
        (s) => s.end >= startSec && s.start <= endSec
      ) || [];

      const drawFrame = () => {
        if (isFinished) return;

        const curTime = videoEl.currentTime;
        const progressFrac = Math.max(0, Math.min(1, (curTime - startSec) / totalClipSec));

        // 1. Draw Background
        ctx.fillStyle = '#09090b';
        ctx.fillRect(0, 0, width, height);

        // 2. Draw Real Video Frame according to aspect ratio and crop strategy
        if (aspect === '9:16') {
          // Vertical 1080x1920 from source video
          const targetAspect = 9 / 16;
          const srcAspect = vWidth / vHeight;

          if (cropMode === 'blur') {
            // Blurred full background
            ctx.save();
            ctx.filter = 'blur(24px) brightness(0.55)';
            ctx.drawImage(videoEl, 0, 0, width, height);
            ctx.restore();

            // Fitted foreground in center
            const fitH = width / srcAspect;
            const fitY = (height - fitH) / 2;
            ctx.drawImage(videoEl, 0, fitY, width, fitH);
          } else {
            // Cropped full vertical fill
            let sw = vWidth;
            let sh = vHeight;
            let sx = 0;
            let sy = 0;

            if (srcAspect > targetAspect) {
              // Video is wider than 9:16 (standard 16:9 widescreen)
              sw = vHeight * targetAspect;
              sh = vHeight;
              sy = 0;
              if (cropMode === 'custom') {
                sx = (vWidth - sw) * panFactor;
              } else {
                sx = (vWidth - sw) / 2; // Center crop
              }
            } else {
              // Video is taller than 9:16
              sw = vWidth;
              sh = vWidth / targetAspect;
              sx = 0;
              sy = (vHeight - sh) / 2;
            }

            ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, width, height);
          }
        } else if (aspect === '1:1') {
          // Square 1080x1080
          const minDim = Math.min(vWidth, vHeight);
          let sx = (vWidth - minDim) / 2;
          let sy = (vHeight - minDim) / 2;
          if (cropMode === 'custom' && vWidth > vHeight) {
            sx = (vWidth - minDim) * panFactor;
          }
          ctx.drawImage(videoEl, sx, sy, minDim, minDim, 0, 0, width, height);
        } else {
          // 16:9 Landscape (1920x1080)
          ctx.drawImage(videoEl, 0, 0, width, height);
        }

        // 3. Top Header Card (Viral pill & clip number)
        const topGrad = ctx.createLinearGradient(0, 0, 0, 180);
        topGrad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = topGrad;
        ctx.fillRect(0, 0, width, 180);

        // Clip Rank Pill
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.roundRect(40, 36, 160, 48, 12);
        ctx.fill();

        ctx.fillStyle = '#09090b';
        ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`CLIP #${clip.rank}`, 120, 68);

        // Viral Score Badge
        ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.beginPath();
        ctx.roundRect(width - 240, 36, 200, 48, 12);
        ctx.fill();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 20px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🔥 ${clip.viral_score}% VIRAL`, width - 140, 68);

        // 4. Burned-in High-Retention Subtitles
        const activeSegment = relevantSegments.find(
          (s) => curTime >= s.start && curTime <= s.end
        ) || null;

        const subtitleText = activeSegment?.text || (curTime - startSec < 4 ? (clip.hook || clip.title) : '');

        if (subtitleText) {
          const captionBoxW = width * 0.92;
          const captionBoxX = (width - captionBoxW) / 2;
          const captionY = aspect === '9:16' ? height * 0.72 : height * 0.76;

          // Word wrap subtitle lines
          const words = subtitleText.split(' ');
          const lines: string[] = [];
          let currentLine = '';

          words.forEach((w) => {
            if ((currentLine + ' ' + w).trim().length <= 26) {
              currentLine = (currentLine ? currentLine + ' ' : '') + w;
            } else {
              if (currentLine) lines.push(currentLine);
              currentLine = w;
            }
          });
          if (currentLine) lines.push(currentLine);

          const boxH = Math.max(100, lines.length * 55 + 40);

          // Subtitle pill container
          ctx.fillStyle = 'rgba(9, 9, 11, 0.88)';
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.roundRect(captionBoxX, captionY, captionBoxW, boxH, 20);
          ctx.fill();
          ctx.stroke();

          // Speaker tag if present
          if (activeSegment?.speaker) {
            ctx.fillStyle = '#f59e0b';
            ctx.font = 'bold 18px system-ui, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(`🎙️ ${activeSegment.speaker.toUpperCase()}`, captionBoxX + 24, captionY + 32);
          }

          // Draw subtitle text
          lines.forEach((line, idx) => {
            const lineY = captionY + (activeSegment?.speaker ? 68 : 55) + idx * 48;
            ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';

            // Text shadow for high readability
            ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            ctx.fillText(line, width / 2 + 2, lineY + 2);

            // Active yellow highlight for the first line, crisp white for following lines
            ctx.fillStyle = idx === 0 ? '#fef08a' : '#ffffff';
            ctx.fillText(line, width / 2, lineY);
          });
        }

        // 5. Bottom Progress Bar & Watermark
        const botGrad = ctx.createLinearGradient(0, height - 100, 0, height);
        botGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        botGrad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = botGrad;
        ctx.fillRect(0, height - 100, width, 100);

        // Progress bar background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(40, height - 40, width - 80, 8);

        // Progress bar filled
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(40, height - 40, (width - 80) * progressFrac, 8);

        // Timestamp counter
        const elapsedSec = curTime - startSec;
        ctx.fillStyle = '#d4d4d8';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(
          `${elapsedSec.toFixed(1)}s / ${totalClipSec.toFixed(1)}s`,
          width - 40,
          height - 54
        );

        // ShortsForge Studio Branding
        ctx.fillStyle = '#a1a1aa';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('⚡ SHORTSFORGE AI', 40, height - 54);

        onProgress?.(
          Math.min(99, Math.floor(15 + progressFrac * 80)),
          `Rendering ${aspect} • ${elapsedSec.toFixed(1)}s / ${totalClipSec.toFixed(1)}s`
        );

        // Check if finished
        if (curTime >= endSec || videoEl.ended) {
          if (!isFinished) {
            isFinished = true;
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
          }
          return;
        }

        animFrameId = requestAnimationFrame(drawFrame);
      };

      // Start playing video to drive the rendering
      videoEl.onplay = () => {
        drawFrame();
      };

      videoEl.onended = () => {
        if (!isFinished && mediaRecorder.state !== 'inactive') {
          isFinished = true;
          mediaRecorder.stop();
        }
      };

      // Play video to start recording
      try {
        await videoEl.play();
      } catch (playErr) {
        // If autoplay policy blocked audio playback, fallback to muted playback for frames
        videoEl.muted = true;
        await videoEl.play();
      }

      // Safety timeout in case video stalls
      const maxWaitMs = (totalClipSec + 5) * 1000;
      setTimeout(() => {
        if (!isFinished && mediaRecorder.state !== 'inactive') {
          isFinished = true;
          mediaRecorder.stop();
        }
      }, maxWaitMs);

    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generate standard SRT formatted subtitle file content for a single clip
 */
export function generateClipSRT(clip: Clip, transcript?: TranscriptData): string {
  const segments = transcript?.segments?.filter(
    (s) => s.end >= clip.start && s.start <= clip.end
  ) || [];

  if (segments.length === 0) {
    return `1\n00:00:00,000 --> 00:00:${Math.floor(clip.duration)},000\n${clip.hook}\n\n2\n00:00:${Math.floor(clip.duration / 2)},000 --> 00:00:${Math.floor(clip.duration)},000\n${clip.title}\n`;
  }

  return segments
    .map((seg, idx) => {
      const segStart = Math.max(0, seg.start - clip.start);
      const segEnd = Math.max(0.1, seg.end - clip.start);

      const formatSRTTime = (sec: number) => {
        const hrs = Math.floor(sec / 3600);
        const mins = Math.floor((sec % 3600) / 60);
        const secs = Math.floor(sec % 60);
        const ms = Math.floor((sec % 1) * 1000);
        return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
      };

      return `${idx + 1}\n${formatSRTTime(segStart)} --> ${formatSRTTime(segEnd)}\n[${seg.speaker}]: ${seg.text}\n`;
    })
    .join('\n');
}

