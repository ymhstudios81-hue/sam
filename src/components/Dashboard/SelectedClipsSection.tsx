import React from 'react';
import { Sparkles, Scissors, CheckSquare, Square, Download, Film, Layers } from 'lucide-react';
import { Clip, CropMode, AspectRatioFormat } from '../../types';
import { ClipCard } from './ClipCard';

interface SelectedClipsSectionProps {
  clips: Clip[];
  onToggleSelect: (clipId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onOpenPreview: (clip: Clip) => void;
  onGenerateSingle: (clip: Clip) => void;
  onGenerateBatch: (selectedClips: Clip[]) => void;
  onCropModeChange: (clipId: string, mode: CropMode) => void;
  onAspectRatioChange?: (clipId: string, format: AspectRatioFormat) => void;
  onToggleCaptions?: (clipId: string) => void;
  onToggle4kFilter?: (clipId: string) => void;
  onExportZip: () => void;
  isRenderingBatch: boolean;
}

export const SelectedClipsSection: React.FC<SelectedClipsSectionProps> = ({
  clips,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onOpenPreview,
  onGenerateSingle,
  onGenerateBatch,
  onCropModeChange,
  onAspectRatioChange,
  onToggleCaptions,
  onToggle4kFilter,
  onExportZip,
  isRenderingBatch,
}) => {
  const selectedClips = clips.filter((c) => c.selected);
  const allSelected = clips.length > 0 && selectedClips.length === clips.length;

  if (clips.length === 0) {
    return null;
  }

  return (
    <section id="section-ai-clips" className="space-y-4 pt-2">
      {/* Header with Batch Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-900 border border-neutral-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">4. AI Selected Clips</h2>
              <span className="text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {clips.length} moments found
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Ranked from highest viral score to lowest. Fine-tune timestamps, formats (9:16, 16:9, 1:1), or crop framing before cutting.
            </p>
          </div>
        </div>

        {/* Batch Actions */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition"
          >
            {allSelected ? <Square className="w-3.5 h-3.5" /> : <CheckSquare className="w-3.5 h-3.5" />}
            <span>{allSelected ? 'Deselect All' : 'Select All'}</span>
          </button>

          <button
            id="btn-generate-batch"
            onClick={() => onGenerateBatch(selectedClips)}
            disabled={selectedClips.length === 0 || isRenderingBatch}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-amber-500/10 disabled:opacity-50"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Generate Selected ({selectedClips.length})</span>
          </button>

          <button
            onClick={onExportZip}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium border border-neutral-700 flex items-center gap-1.5 transition"
            title="Download ZIP archive of rendered shorts"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Export ZIP</span>
          </button>
        </div>
      </div>

      {/* Grid of Clip Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clips.map((clip) => (
          <ClipCard
            key={clip.id}
            clip={clip}
            onToggleSelect={onToggleSelect}
            onOpenPreview={onOpenPreview}
            onGenerateSingle={onGenerateSingle}
            onCropModeChange={onCropModeChange}
            onAspectRatioChange={onAspectRatioChange}
            onToggleCaptions={onToggleCaptions}
            onToggle4kFilter={onToggle4kFilter}
          />
        ))}
      </div>
    </section>
  );
};
