import React, { useState } from 'react';
import {
  Film,
  Download,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  FileText,
  Play,
  Sparkles,
  HardDrive
} from 'lucide-react';
import { RenderJob, AppSettings, TranscriptData } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';
import { generateClipSRT } from '../../services/videoRenderer';
import { RenderedClipWatchModal } from '../Modals/RenderedClipWatchModal';

interface RenderQueueViewProps {
  jobs: RenderJob[];
  settings: AppSettings;
  transcript?: TranscriptData;
  onCancelJob: (jobId: string) => void;
  onExportZip: () => void;
  onRefresh: () => void;
}

export const RenderQueueView: React.FC<RenderQueueViewProps> = ({
  jobs,
  settings,
  transcript,
  onCancelJob,
  onExportZip,
  onRefresh,
}) => {
  const [copiedJobId, setCopiedJobId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isWorkspaceCopied, setIsWorkspaceCopied] = useState(false);
  const [watchingJob, setWatchingJob] = useState<RenderJob | null>(null);

  const completedJobs = jobs.filter((j) => j.status === 'completed');
  const activeJobs = jobs.filter((j) => j.status === 'processing' || j.status === 'queued');

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Open Workspace Folder
  const handleOpenWorkspaceFolder = async (folderPath?: string) => {
    const target = folderPath || settings.workspaceDir;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(target);
      }
    } catch {}

    try {
      await fetch('/api/system/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: target }),
      });
    } catch {}

    setIsWorkspaceCopied(true);
    setTimeout(() => setIsWorkspaceCopied(false), 2000);
    showNotice(`Opened directory & copied path to clipboard: ${target}`);
  };

  // Open specific job folder
  const handleOpenJobFolder = async (job: RenderJob) => {
    const normalizedPath = (job.outputFilePath || '').replace(/\\/g, '/');
    const folderPath = normalizedPath.includes('/')
      ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
      : `${settings.workspaceDir}/Project_${job.projectId.slice(-6)}`;

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(folderPath);
      }
    } catch {}

    try {
      await fetch('/api/system/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath }),
      });
    } catch {}

    setCopiedJobId(job.id);
    setTimeout(() => setCopiedJobId(null), 2000);
    showNotice(`Opened output folder: ${folderPath}`);
  };

  // Download SRT Subtitles
  const handleDownloadSRT = (job: RenderJob) => {
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
    showNotice(`Downloaded subtitles for Clip #${job.clipRank}`);
  };

  // Trigger browser-native download of the generated MP4 file from local server
  const handleDownloadJob = async (job: RenderJob) => {
    const safeTitle = (job.clipTitle || 'short').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const aspect = (job.aspectRatio || '9:16').replace(':', 'x');
    const filename = `ShortsForge_Clip_${String(job.clipRank).padStart(2, '0')}_${aspect}_${safeTitle}.mp4`;

    let downloadUrl = job.outputFileUrl;
    if (!downloadUrl && job.outputFilePath) {
      downloadUrl = `/api/files/download?path=${encodeURIComponent(job.outputFilePath)}`;
    } else if (!downloadUrl) {
      downloadUrl = `/api/render-jobs/${job.id}/download`;
    }

    if (!downloadUrl) {
      showNotice(`Error: No downloadable media stream found for Clip #${job.clipRank}`);
      return;
    }

    showNotice(`Downloading ${filename}...`);

    try {
      if (downloadUrl.startsWith('blob:') || downloadUrl.startsWith('data:')) {
        const anchor = document.createElement('a');
        anchor.href = downloadUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } else {
        const res = await fetch(downloadUrl);
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        const blob = await res.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
      }
    } catch (err: any) {
      console.warn('Direct blob download fallback:', err);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;
      anchor.download = filename;
      anchor.target = '_blank';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  };

  return (
    <div id="view-render-queue" className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Local FFmpeg Render Queue & Output</h2>
              {activeJobs.length > 0 && (
                <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse">
                  {activeJobs.length} active
                </span>
              )}
              {completedJobs.length > 0 && (
                <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                  {completedJobs.length} ready to download
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              1080×1920 vertical cuts & captions rendered locally (H.264 / AAC)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-refresh-queue"
            onClick={onRefresh}
            className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
            title="Refresh queue status"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {completedJobs.length > 0 && (
            <button
              id="btn-export-all-zip"
              onClick={onExportZip}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-500/10"
            >
              <Download className="w-4 h-4" />
              <span>Export All Shorts (ZIP)</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionNotice && (
        <div className="p-3 bg-neutral-900 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-medium flex items-center justify-between shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span className="truncate">{actionNotice}</span>
          </div>
          <button onClick={() => setActionNotice(null)} className="text-neutral-400 hover:text-white text-xs px-1">
            ✕
          </button>
        </div>
      )}

      {/* Output directory notice with Open Folder button */}
      <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800 text-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-neutral-400 min-w-0">
          <HardDrive className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <span className="flex-shrink-0 font-medium">Workspace Directory:</span>
          <code className="font-mono text-neutral-200 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 truncate">
            {settings.workspaceDir}/
          </code>
        </div>
        <button
          id="btn-open-workspace-folder"
          onClick={() => handleOpenWorkspaceFolder()}
          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700 transition self-end sm:self-auto"
          title="Open workspace directory on your computer or copy path"
        >
          <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
          <span>{isWorkspaceCopied ? 'Path Copied!' : 'Open Workspace Folder'}</span>
        </button>
      </div>

      {/* Jobs List */}
      {jobs.length === 0 ? (
        <div className="text-center py-16 border border-neutral-800 rounded-xl bg-neutral-900/30 p-8">
          <Film className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300">Queue is Empty</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1">
            Analyze a video on the Dashboard and click "Generate Shorts" to start local FFmpeg rendering.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const isCompleted = job.status === 'completed';

            return (
              <div
                key={job.id}
                id={`job-card-${job.id}`}
                className={`bg-neutral-900 border rounded-xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition ${
                  isCompleted
                    ? 'border-emerald-900/40 bg-gradient-to-r from-neutral-900 to-emerald-950/20'
                    : 'border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* Left: Info */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-amber-400 border border-neutral-700">
                      Clip #{job.clipRank}
                    </span>
                    <h4 className="text-sm font-bold text-white truncate max-w-md">
                      {job.clipTitle}
                    </h4>
                    {/* Status Badge */}
                    <span
                      className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
                        isCompleted
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                          : job.status === 'processing'
                          ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60 animate-pulse'
                          : job.status === 'failed'
                          ? 'bg-red-950/60 text-red-300 border border-red-800/60'
                          : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {job.status === 'processing' && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />}
                      {job.status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
                      {job.status === 'queued' && <Clock className="w-3 h-3 text-neutral-400" />}
                      <span className="capitalize">{isCompleted ? 'Rendered & Ready' : job.status}</span>
                    </span>
                  </div>

                  {/* Metadata line */}
                  <div className="flex items-center gap-3 text-xs text-neutral-400 font-mono flex-wrap">
                    <span>
                      {formatSecondsToTimecode(job.start)} → {formatSecondsToTimecode(job.end)} ({(typeof job.duration === 'number' && !isNaN(job.duration) ? job.duration : 0).toFixed(1)}s)
                    </span>
                    <span>•</span>
                    <span className="text-amber-400 font-bold">{job.aspectRatio || '9:16'}</span>
                    <span>•</span>
                    <span className="capitalize">Crop: {job.cropMode}</span>
                    {job.outputFilePath && (
                      <>
                        <span>•</span>
                        <span className="text-neutral-400 font-mono truncate max-w-xs" title={job.outputFilePath}>
                          📁 {job.outputFilePath}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Progress bar if processing or queued */}
                  {(job.status === 'processing' || job.status === 'queued') && (
                    <div className="w-full max-w-md bg-neutral-950 rounded-full h-2 overflow-hidden border border-neutral-800 mt-2">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-orange-500 h-full transition-all duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, isNaN(job.progress) ? 0 : (job.progress || 0)))}%` }}
                      />
                    </div>
                  )}

                  {/* Error if failed */}
                  {job.status === 'failed' && job.error && (
                    <p className="text-xs text-red-400 mt-1 font-mono">{job.error}</p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 self-stretch sm:self-center flex-wrap justify-end">
                  {/* When completed: Show Watch, Download, Subtitles, and Folder buttons */}
                  {isCompleted && (
                    <>
                      {/* Watch Video Button */}
                      <button
                        id={`btn-watch-${job.id}`}
                        onClick={() => setWatchingJob(job)}
                        className="px-3.5 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                        title="Watch full rendered video with burned-in subtitles and animations"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Clip</span>
                      </button>

                      {/* Download MP4 Action */}
                      <button
                        id={`btn-download-${job.id}`}
                        onClick={() => handleDownloadJob(job)}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition shadow-md shadow-emerald-500/20"
                        title="Trigger browser-native download of the generated MP4 file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download MP4</span>
                      </button>

                      {/* Download SRT Subtitles */}
                      <button
                        id={`btn-download-srt-${job.id}`}
                        onClick={() => handleDownloadSRT(job)}
                        className="px-2.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 transition"
                        title="Download .SRT subtitles file"
                      >
                        <FileText className="w-3.5 h-3.5 text-neutral-400" />
                        <span>.SRT</span>
                      </button>

                      {/* Open Folder Button */}
                      <button
                        id={`btn-open-folder-${job.id}`}
                        onClick={() => handleOpenJobFolder(job)}
                        className="px-2.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium border border-neutral-700 transition"
                        title="Open containing folder in explorer or copy directory path"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                        <span>{copiedJobId === job.id ? 'Copied' : 'Folder'}</span>
                      </button>
                    </>
                  )}

                  {(job.status === 'processing' || job.status === 'queued') && (
                    <button
                      id={`btn-cancel-job-${job.id}`}
                      onClick={() => onCancelJob(job.id)}
                      className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-red-950 hover:text-red-300 text-neutral-400 text-xs font-medium border border-neutral-700 transition"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rendered Clip Watch Modal */}
      {watchingJob && (
        <RenderedClipWatchModal
          job={watchingJob}
          transcript={transcript}
          onClose={() => setWatchingJob(null)}
          onOpenFolder={handleOpenJobFolder}
        />
      )}
    </div>
  );
};
