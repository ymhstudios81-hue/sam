import React, { useState } from 'react';
import {
  Sparkles,
  BrainCircuit,
  Zap,
  AlertCircle,
  Clock,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  MessageSquareQuote,
  Lightbulb,
  Info
} from 'lucide-react';
import { AppSettings, TranscriptData } from '../../types';

interface ClaudeAnalyzeCardProps {
  transcript?: TranscriptData;
  settings: AppSettings;
  clipCount: number;
  onClipCountChange: (count: number) => void;
  onAnalyze: (customPrompt?: string, durationMode?: 'auto' | 'custom' | 'short' | 'medium' | 'long') => void;
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

  const [customCommand, setCustomCommand] = useState<string>(settings.customPrompt || '');
  const [durationMode, setDurationMode] = useState<'auto' | 'custom' | 'short' | 'medium' | 'long'>(
    settings.durationMode || 'auto'
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(true);

  // Preset custom commands for quick 1-click prompt guidance
  const promptPresets = [
    { label: '🎯 Complete Stories & Lessons', prompt: 'Find complete storytelling moments from start to finish. Include the full context, background, dramatic turning point, and final moral/conclusion. Never cut mid-story.' },
    { label: '💡 Actionable Insights & Tactics', prompt: 'Extract high-value tactical advice, business strategies, and direct step-by-step instructions that viewers can apply immediately.' },
    { label: '🔥 Controversial & Unpopular Opinions', prompt: 'Focus on contrarian beliefs, counter-intuitive debates, shocking truths, and statements that spark intense comments and shares.' },
    { label: '😂 Funny Moments & Banter', prompt: 'Highlight humorous interactions, hilarious anecdotes, sudden reactions, and comedic timing from beginning to punchline.' },
  ];

  const handleStartAnalysis = () => {
    onAnalyze(customCommand.trim(), durationMode);
  };

  return (
    <div
      id="card-claude-analyze"
      className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-sm transition"
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/60 flex items-center justify-center text-purple-400 flex-shrink-0 mt-0.5">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                3. Analyze with Claude AI & Custom Instructions
              </h2>
              <span className="text-[10px] font-mono font-semibold bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full">
                {settings.claudeModel}
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5 max-w-2xl">
              Claude evaluates the entire SRT timestamped transcript to find exact viral moments, following your custom editorial guidelines and natural complete story durations.
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
            onClick={handleStartAnalysis}
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
                <span>Claude Finding Custom Clips...</span>
              </>
            ) : hasClips ? (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Re-Analyze with Custom Command</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Find Clips with Claude</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Custom Command & Auto Duration Controls Panel */}
      <div className="mt-4 pt-4 border-t border-neutral-800/80">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <MessageSquareQuote className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-neutral-200">
              Custom Prompt & Story Duration Directive
            </span>
            <span className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
              AI Command
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition"
          >
            <span>{isAdvancedOpen ? 'Collapse options' : 'Customize prompt & length'}</span>
            {isAdvancedOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isAdvancedOpen && (
          <div className="space-y-3 bg-neutral-950/70 border border-neutral-800 rounded-lg p-3.5">
            {/* Custom Instruction Input Area */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-neutral-300 flex items-center gap-1.5">
                  <span>Specific Instructions for Claude:</span>
                  <span className="text-neutral-500 font-normal">(Describe what you want Claude to extract)</span>
                </label>
                {customCommand && (
                  <button
                    onClick={() => setCustomCommand('')}
                    className="text-[10px] text-neutral-500 hover:text-neutral-300 underline"
                  >
                    Clear instruction
                  </button>
                )}
              </div>

              <textarea
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="e.g. Find clips where Alex explains the $100M decision and the exact hiring formula. Make sure the entire story is captured with beginning and end."
                rows={2}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-700 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500 transition resize-y font-sans leading-relaxed"
              />

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="text-[10px] text-neutral-400 font-medium flex items-center gap-1 mr-1">
                  <Lightbulb className="w-3 h-3 text-amber-400" /> Presets:
                </span>
                {promptPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCustomCommand(preset.prompt)}
                    className="text-[11px] px-2 py-0.5 rounded bg-neutral-900 border border-neutral-700/80 text-neutral-300 hover:text-amber-400 hover:border-amber-500/50 transition"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Video Duration / Story Cutting Rules */}
            <div className="pt-2 border-t border-neutral-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <span>Clip Duration Mode:</span>
                    <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">
                      {durationMode === 'auto' ? 'Auto (Complete Story - No Mid Cut)' : durationMode}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    {durationMode === 'auto'
                      ? 'Claude dynamically keeps the full story duration (e.g. 45s or 5 mins) so it never cuts mid-sentence or mid-explanation.'
                      : 'Constrained within fixed duration thresholds.'}
                  </p>
                </div>
              </div>

              {/* Mode Selector */}
              <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-700/80 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setDurationMode('auto')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                    durationMode === 'auto'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  ⚡ Auto (Complete Story)
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('short')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                    durationMode === 'short'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  30-60s
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('medium')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                    durationMode === 'medium'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  60-180s
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('long')}
                  className={`text-xs px-2.5 py-1 rounded font-medium transition ${
                    durationMode === 'long'
                      ? 'bg-amber-500 text-neutral-950 font-bold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  3-10 mins
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warning if cannot analyze */}
      {!transcript?.isTimestamped && (
        <div className="mt-3.5 pt-3 border-t border-neutral-800/80 flex items-center gap-2 text-xs text-neutral-400">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          <span>
            Please upload a timestamped SRT, VTT, or JSON transcript above to submit to Claude AI.
          </span>
        </div>
      )}
    </div>
  );
};
