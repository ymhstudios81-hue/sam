import React from 'react';
import { Video, Sparkles, CheckCircle2, AlertTriangle, Monitor, Terminal, Settings } from 'lucide-react';
import { AppSettings, RenderJob } from '../types';

interface HeaderProps {
  settings: AppSettings;
  activeJobs: RenderJob[];
  onOpenSettings: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  activeJobs,
  onOpenSettings,
  onOpenGuide,
}) => {
  const processingCount = activeJobs.filter(
    (j) => j.status === 'processing' || j.status === 'queued'
  ).length;

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-3.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Video className="w-5 h-5 text-neutral-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                  ShortsForge <span className="text-amber-400 font-extrabold">AI</span>
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                  Local Windows
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                1080×1920 Shorts Engine • Powered by Claude & FFmpeg
              </p>
            </div>
          </div>

          {/* Mobile Windows guide button */}
          <button
            onClick={onOpenGuide}
            className="sm:hidden p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
            title="Windows Setup Guide"
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* System & Status Badges */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end w-full sm:w-auto">
          {/* FFmpeg Status */}
          <div
            id="badge-ffmpeg-status"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              settings.ffmpegDetected
                ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                : 'bg-red-950/60 border-red-800/80 text-red-300 animate-pulse'
            }`}
          >
            {settings.ffmpegDetected ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>FFmpeg Local</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                <span>FFmpeg Required</span>
              </>
            )}
          </div>

          {/* Claude Brain Status */}
          <div
            id="badge-claude-status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-purple-950/50 border-purple-800/60 text-purple-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate max-w-[120px] sm:max-w-none">
              Claude AI Brain
            </span>
          </div>

          {/* Active Queue Status */}
          {processingCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-950/50 border-amber-800/60 text-amber-300 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>Rendering ({processingCount})</span>
            </div>
          )}

          {/* Windows Guide Button */}
          <button
            id="btn-windows-guide"
            onClick={onOpenGuide}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition"
          >
            <Terminal className="w-3.5 h-3.5 text-amber-400" />
            <span>start.bat Guide</span>
          </button>

          {/* Settings Trigger */}
          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 transition"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
