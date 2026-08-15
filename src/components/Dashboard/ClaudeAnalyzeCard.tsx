import React from 'react';
import { Sparkles, BrainCircuit, Target, Zap, AlertCircle } from 'lucide-react';
import { AppSettings, TranscriptData } from '../../types';

interface ClaudeAnalyzeCardProps {
  transcript?: TranscriptData;
  settings: AppSettings;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  hasClips: boolean;
}

export const ClaudeAnalyzeCard: React.FC<ClaudeAnalyzeCardProps> = ({
  transcript,
  settings,
  clipCount,
  onClipCountChange,
  onAnalyze,
  isAnalyzing,
  hasClips,
}) => {
  const clipOptions = [3, 5, 8, 10, 15, 20];
  const canAnalyze = Boolean(transcript?.isTimestamped && transcript.segments.length > 0 && !isAnalyzing);

  return (
    <div
      id="card-claude-analyze"
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 flex-shrink-0 mt-0.5">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                3. Analyze with Claude AI
              </h2>
              <span className="text-[10px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                {settings.claudeModel}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
              Claude evaluates the entire transcript using professional viral editor criteria (hook curiosity, high-stakes conflict, emotional resonance, narrative payoff, 30–60s duration).
            </p>
          </div>
        </div>

        {/* Action button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Clip count picker */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 self-start sm:self-auto">
            <span className="text-[11px] text-neutral-400 px-2 font-medium">Clips:</span>
            {clipOptions.map((num) => (
              <button
                key={num}
                onClick={() => onClipCountChange(num)}
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
            id="btn-analyze-with-claude"
            onClick={onAnalyze}
            disabled={!canAnalyze}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 shadow-lg transition ${
              canAnalyze
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 hover:brightness-110 shadow-amber-500/20 active:scale-98'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700/50'
            }`}
          >
            {isAnalyzing ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin text-neutral-950" />
                <span>Claude is Finding Viral Clips...</span>
              </>
            ) : hasClips ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Re-Analyze with Claude</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Analyze with Claude</span>
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
            Please upload a timestamped SRT, VTT, or JSON transcript above to activate Claude clip selection.
          </span>
        </div>
      )}
    </div>
  );
};
