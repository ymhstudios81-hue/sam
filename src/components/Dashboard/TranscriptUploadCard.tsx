import React, { useState, useRef } from 'react';
import { FileText, Upload, AlertCircle, CheckCircle2, RefreshCw, Edit3, FileCode } from 'lucide-react';
import { TranscriptData } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';

interface TranscriptUploadCardProps {
  transcript?: TranscriptData;
  onTranscriptSubmitted: (rawText: string, fileName?: string) => void;
  onLoadDemoTranscript: () => void;
  isLoading: boolean;
}

export const TranscriptUploadCard: React.FC<TranscriptUploadCardProps> = ({
  transcript,
  onTranscriptSubmitted,
  onLoadDemoTranscript,
  isLoading,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        onTranscriptSubmitted(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  const handlePasteSubmit = () => {
    if (pastedText.trim()) {
      onTranscriptSubmitted(pastedText.trim(), 'pasted_transcript.srt');
    }
  };

  return (
    <div
      id="card-transcript-upload"
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <FileText className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">2. Timestamped Transcript</h2>
            <p className="text-xs text-neutral-400">
              SRT, VTT, or JSON required for AI clip detection & timing
            </p>
          </div>
        </div>

        <button
          onClick={onLoadDemoTranscript}
          disabled={isLoading}
          className="text-xs px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-amber-500/20 flex items-center gap-1.5 transition font-medium"
          title="Load sample podcast transcript with timestamps"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Load Demo SRT</span>
        </button>
      </div>

      {!transcript || (!transcript.segments.length && !transcript.rawText) ? (
        <div>
          {/* Mode Switcher */}
          <div className="flex border-b border-neutral-800 mb-4">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === 'upload'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition ${
                activeTab === 'paste'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Paste Text</span>
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center min-h-[160px] ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/5'
                  : 'border-neutral-700 hover:border-neutral-600 bg-neutral-950/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt,.json,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-10 h-10 rounded-full bg-neutral-800/80 border border-neutral-700 flex items-center justify-center mb-2.5 text-neutral-300">
                <FileCode className="w-5 h-5 text-amber-400" />
              </div>
              <p className="text-sm font-medium text-neutral-200 mb-1">
                Drop your transcript file here (.srt, .vtt, .json)
              </p>
              <p className="text-xs text-neutral-500">
                Automatic timestamp normalization to decimal seconds
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="1&#10;00:00:01,200 --> 00:00:05,800&#10;Welcome to our podcast interview with Alex Vance..."
                className="w-full h-36 p-3 rounded-lg bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-200 focus:outline-none focus:border-amber-500/50 resize-none"
              />
              <div className="flex justify-end">
                <button
                  onClick={handlePasteSubmit}
                  disabled={!pastedText.trim() || isLoading}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition disabled:opacity-50"
                >
                  Parse & Validate Transcript
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Validation Warning banner if not timestamped */}
          {!transcript.isTimestamped ? (
            <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 flex items-start gap-2.5 text-xs text-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">Plain text transcript loaded</p>
                <p className="text-[11px] text-amber-200/80 mt-0.5">
                  Timestamped transcript required for automatic clip generation. Upload an .srt or .vtt file to enable video cutting.
                </p>
              </div>
            </div>
          ) : (
            /* Success Status */
            <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/50 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-medium text-emerald-200">
                  {transcript.segments.length} timestamped dialogue segments parsed
                </span>
              </div>
              <span className="font-mono text-neutral-400 uppercase text-[10px] bg-neutral-800 px-2 py-0.5 rounded">
                Format: {transcript.format}
              </span>
            </div>
          )}

          {/* Transcript segment preview */}
          {transcript.segments.length > 0 && (
            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
              {transcript.segments.slice(0, 10).map((seg, idx) => (
                <div key={idx} className="flex items-start gap-2 text-neutral-300 py-0.5 border-b border-neutral-900 last:border-0">
                  <span className="font-mono text-[10px] text-amber-400/80 bg-neutral-900 px-1.5 py-0.5 rounded flex-shrink-0">
                    {formatSecondsToTimecode(seg.start)} - {formatSecondsToTimecode(seg.end)}
                  </span>
                  <p className="truncate text-neutral-300 text-xs">{seg.text}</p>
                </div>
              ))}
              {transcript.segments.length > 10 && (
                <p className="text-center text-[10px] text-neutral-500 pt-1 font-mono">
                  + {transcript.segments.length - 10} more segments ready for auto clip detection
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-neutral-400 pt-1">
            <span className="text-[11px] text-neutral-500">
              {transcript.totalDuration ? `Covering ${formatSecondsToTimecode(transcript.totalDuration, true)} of dialogue` : ''}
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-amber-400 hover:text-amber-300 underline font-medium"
            >
              Upload Different Transcript
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt,.vtt,.json,.txt"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      )}
    </div>
  );
};
