import React, { useRef, useState } from 'react';
import { Upload, Film, CheckCircle2, Play, Pause, FileVideo, HardDrive, RefreshCw } from 'lucide-react';
import { VideoMetadata } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';
import { VideoPlayerWithFraming } from '../VideoPlayer/VideoPlayerWithFraming';

interface VideoUploadCardProps {
  video?: VideoMetadata;
  onVideoSelected: (file: File) => void;
  onLoadDemoVideo: () => void;
  isLoading: boolean;
}

export const VideoUploadCard: React.FC<VideoUploadCardProps> = ({
  video,
  onVideoSelected,
  onLoadDemoVideo,
  isLoading,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onVideoSelected(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onVideoSelected(file);
    }
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div
      id="card-video-upload"
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Film className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">1. Source Video</h2>
            <p className="text-xs text-neutral-400">
              Local MP4, MOV, MKV, or WEBM (never uploaded to the cloud)
            </p>
          </div>
        </div>

        {!video && (
          <button
            onClick={onLoadDemoVideo}
            disabled={isLoading}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 transition font-medium"
            title="Load sample podcast video"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Load Demo Video</span>
          </button>
        )}
      </div>

      {!video ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[190px] ${
            isDragging
              ? 'border-amber-500 bg-amber-500/5'
              : 'border-neutral-700 hover:border-neutral-600 bg-neutral-950/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="w-12 h-12 rounded-full bg-neutral-800/80 border border-neutral-700 flex items-center justify-center mb-3 text-neutral-300">
            <Upload className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm font-medium text-neutral-200 mb-1">
            Drag & drop your video here, or <span className="text-amber-400 underline">browse</span>
          </p>
          <p className="text-xs text-neutral-400">
            MP4, MOV, MKV, WEBM (Preserves 100% original quality on local disk)
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Video Preview */}
          <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-neutral-800 group">
            <VideoPlayerWithFraming
              video={video}
              currentTime={currentTime}
              startSec={0}
              endSec={video.duration || 170}
              isPlaying={isPlaying}
              onTimeUpdate={(t) => setCurrentTime(t)}
              onTogglePlay={togglePlay}
              showFramingOverlay={false}
              className="w-full h-full"
            />

            {/* Custom overlay controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex flex-col justify-between p-3">
              <div className="flex justify-end">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/70 text-neutral-300 backdrop-blur">
                  {formatSecondsToTimecode(currentTime)} / {formatSecondsToTimecode(video.duration)}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-11 h-11 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg hover:scale-105 transition"
                >
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                </button>
              </div>
              <div
                className="w-full bg-neutral-700/80 h-1.5 rounded-full overflow-hidden cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  setCurrentTime(pos * (video.duration || 170));
                }}
              >
                <div
                  className="bg-amber-400 h-full transition-all"
                  style={{ width: `${(currentTime / (video.duration || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* FFprobe Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">Duration</span>
              <span className="font-semibold text-neutral-200 font-mono">
                {formatSecondsToTimecode(video.duration, true)}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">Resolution</span>
              <span className="font-semibold text-neutral-200 font-mono">
                {video.width}×{video.height} ({video.fps} FPS)
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">Codecs</span>
              <span className="font-semibold text-neutral-200 font-mono uppercase">
                {video.videoCodec} / {video.audioCodec}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">File Size</span>
              <span className="font-semibold text-neutral-200 font-mono">
                {formatFileSize(video.fileSize)}
              </span>
            </div>
          </div>

          {/* Video path & change button */}
          <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
            <div className="flex items-center gap-1.5 truncate max-w-[70%]">
              <FileVideo className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="truncate text-neutral-300">{video.originalName}</span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Replace Video
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/webm"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
