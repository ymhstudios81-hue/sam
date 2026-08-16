import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  AlertCircle,
  Wand2,
  Cpu,
  BrainCircuit
} from 'lucide-react';
import { AppSettings, TranscriptData } from '../../types';

interface ClaudeAnalyzeCardProps {
  transcript?: TranscriptData;
  settings: AppSettings;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  onAnalyze: (engine?: 'original' | 'claude') => void;
  isAnalyzing: boolean;
  hasClips: boolean;
  selectedEngine?: 'original' | 'claude';
  onEngineChange?: (engine: 'original' | 'claude') => void;
}

export const ClaudeAnalyzeCard: React.FC<ClaudeAnalyzeCardProps> = ({
  transcript,
  settings,
  clipCount,
  onClipCountChange,
  onAnalyze,
  isAnalyzing,
  hasClips,
  selectedEngine = 'original',
  onEngineChange,
}) => {
  const [engine, setEngine] = useState<'original' | 'claude'>(selectedEngine);
  const clipOptions = [3, 5, 8, 10, 15, 20];
  const canAnalyze = Boolean(transcript?.isTimestamped && transcript.segments.length > 0 && !isAnalyzing);

  const handleEngineToggle = (newEngine: 'original' | 'claude') => {
    setEngine(newEngine);
    if (onEngineChange) {
      onEngineChange(newEngine);
    }
  };

  return (
    <div
      id="card-clip-detector"
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0 mt-0.5">
            <Wand2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                3. AI Viral Clip Detector
              </h2>

              {/* Model Switcher */}
              <div className="flex items-center bg-neutral-950 p-0.5 rounded-lg border border-neutral-800 text-[11px]">
                <button
                  onClick={() => handleEngineToggle('original')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition ${
                    engine === 'original'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Original built-in viral detection model (Instant, automatic)"
                >
                  <Cpu className="w-3 h-3" />
                  <span>Original Model (Auto)</span>
                </button>
                <button
                  onClick={() => handleEngineToggle('claude')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition ${
                    engine === 'claude'
                      ? 'bg-purple-950 text-purple-300 font-bold border border-purple-800'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                  title="Analyze using Anthropic Claude API"
                >
                  <BrainCircuit className="w-3 h-3" />
                  <span>Claude AI</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-neutral-400 mt-1 max-w-2xl">
              {engine === 'original'
                ? 'Original built-in model automatically detects high-retention storytelling hooks, viral punchlines, and question/answer pairs directly upon SRT upload.'
                : `Claude AI (${settings.claudeModel}) evaluates full dialogue depth for viral candidate scoring.`}
            </p>
          </div>
        </div>

        {/* Action button & Clip count */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          {/* Clip count picker */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <span className="text-[11px] text-neutral-400 px-2 font-medium">Clips:</span>
            {clipOptions.map((num) => (
              <button
                key={num}
                onClick={() => {
                  onClipCountChange(num);
                }}
                className={`text-xs px-2.5 py-1 rounded font-mono font-medium transition ${
                  clipCount === num
                    ? 'bg-amber-500 text-neutral-950 font-bold'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            id="btn-detect-clips"
            onClick={() => onAnalyze(engine)}
            disabled={!canAnalyze}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition whitespace-nowrap ${
              canAnalyze
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 hover:brightness-110 shadow-amber-500/20 active:scale-98'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Detecting Viral Clips...</span>
              </>
            ) : hasClips ? (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Re-Detect Clips ({engine === 'original' ? 'Original Model' : 'Claude AI'})</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Auto-Detect Clips</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Warning if cannot analyze */}
      {!transcript?.isTimestamped && (
        <div className="mt-3.5 pt-3 border-t border-neutral-800/80 flex items-center gap-2 text-xs text-neutral-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>
            Upload an SRT, VTT, or timestamped transcript above to automatically detect viral clips.
          </span>
        </div>
      )}
    </div>
  );
};
