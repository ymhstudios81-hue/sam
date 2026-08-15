import React from 'react';
import { X, Terminal, Monitor, CheckCircle2, Download, ExternalLink, HelpCircle, FileCode } from 'lucide-react';

interface WindowsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WindowsGuideModal: React.FC<WindowsGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Local Windows Setup Guide</h2>
              <p className="text-xs text-neutral-400">
                How to run ShortsForge AI natively on your Windows 10/11 PC
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs text-neutral-300">
          {/* Step 1 */}
          <div className="space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">1</span>
              <span>Install Python 3.11+</span>
            </div>
            <p className="text-neutral-400 pl-8">
              Download Python from <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-1">python.org <ExternalLink className="w-3 h-3" /></a>.
            </p>
            <div className="ml-8 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-amber-300">
              ⚠️ <strong>Critical:</strong> Check the box <strong>"Add Python to PATH"</strong> during installation!
            </div>
          </div>

          {/* Step 2 */}
          <div className="space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">2</span>
              <span>Install FFmpeg & FFprobe</span>
            </div>
            <p className="text-neutral-400 pl-8">
              FFmpeg is required for 1080x1920 video cropping and rendering. Install in Windows Terminal:
            </p>
            <div className="ml-8 bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-neutral-200 text-[11px] select-all">
              winget install Gyan.FFmpeg
            </div>
            <p className="text-neutral-500 pl-8 text-[11px]">
              Alternatively, download from <a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank" rel="noreferrer" className="text-amber-400 underline">gyan.dev/ffmpeg/builds</a>, extract to <code className="text-neutral-300">C:\ffmpeg</code>, and add <code className="text-neutral-300">C:\ffmpeg\bin</code> to your System PATH.
            </p>
          </div>

          {/* Step 3 */}
          <div className="space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">3</span>
              <span>Configure Anthropic Claude Key</span>
            </div>
            <p className="text-neutral-400 pl-8">
              Get an API key from <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-amber-400 underline inline-flex items-center gap-1">console.anthropic.com <ExternalLink className="w-3 h-3" /></a> and paste it into <code className="text-neutral-300 font-mono">.env</code> or the Settings tab:
            </p>
            <div className="ml-8 bg-neutral-900 p-3 rounded-lg border border-neutral-800 font-mono text-neutral-200 text-[11px]">
              ANTHROPIC_API_KEY=sk-ant-api03-...<br />
              CLAUDE_MODEL=claude-3-7-sonnet-20250219
            </div>
          </div>

          {/* Step 4 */}
          <div className="space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-800">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-400">
              <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs">4</span>
              <span>1-Click Launch with start.bat</span>
            </div>
            <p className="text-neutral-400 pl-8">
              Simply double-click <code className="text-amber-300 font-mono font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">start.bat</code> in the project folder.
            </p>
            <p className="text-neutral-400 pl-8">
              The batch script automatically validates Python/FFmpeg, creates your virtual environment, installs dependencies, starts FastAPI on <code className="text-neutral-300 font-mono">http://127.0.0.1:8000</code>, and opens your browser!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition"
          >
            Got It!
          </button>
        </div>
      </div>
    </div>
  );
};
