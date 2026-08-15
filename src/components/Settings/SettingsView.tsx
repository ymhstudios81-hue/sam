import React, { useState } from 'react';
import { SlidersHorizontal, Sparkles, CheckCircle2, AlertTriangle, Key, HardDrive, Cpu, Film, Save, RefreshCw } from 'lucide-react';
import { AppSettings, CropMode, AspectRatioFormat } from '../../types';

interface SettingsViewProps {
  settings: AppSettings;
  onSaveSettings: (newSettings: Partial<AppSettings>) => void;
  onRefreshSystemStatus: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onRefreshSystemStatus,
}) => {
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [claudeModel, setClaudeModel] = useState(settings.claudeModel);
  const [defaultClipCount, setDefaultClipCount] = useState(
    typeof settings.defaultClipCount === 'number' && !isNaN(settings.defaultClipCount) ? settings.defaultClipCount : 5
  );
  const [minDuration, setMinDuration] = useState<number | string>(
    typeof settings.minClipDuration === 'number' && !isNaN(settings.minClipDuration) ? settings.minClipDuration : 20
  );
  const [maxDuration, setMaxDuration] = useState<number | string>(
    typeof settings.maxClipDuration === 'number' && !isNaN(settings.maxClipDuration) ? settings.maxClipDuration : 90
  );
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<AspectRatioFormat>(settings.aspectRatio || '9:16');
  const [defaultCropMode, setDefaultCropMode] = useState<CropMode>(settings.cropMode);
  const [defaultIncludeCaptions, setDefaultIncludeCaptions] = useState<boolean>(settings.defaultIncludeCaptions ?? true);
  const [defaultCaptionStyle, setDefaultCaptionStyle] = useState<'viral_yellow' | 'clean_white' | 'minimal' | 'none'>(settings.defaultCaptionStyle || 'viral_yellow');
  const [defaultShowOverlays, setDefaultShowOverlays] = useState<boolean>(settings.defaultShowOverlays ?? false);
  const [videoQuality, setVideoQuality] = useState(settings.videoQuality);
  const [workspaceDir, setWorkspaceDir] = useState(settings.workspaceDir);
  const [isSaved, setIsSaved] = useState(false);

  const availableModels = [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (Latest & Recommended)', desc: 'Highest intelligence and viral clip selection precision' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', desc: 'Fast, highly accurate editorial analysis' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', desc: 'Ultra-fast, cost-efficient analysis' },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMin = typeof minDuration === 'number' ? minDuration : (parseInt(minDuration, 10) || 20);
    const parsedMax = typeof maxDuration === 'number' ? maxDuration : (parseInt(maxDuration, 10) || 90);
    onSaveSettings({
      claudeModel,
      defaultClipCount,
      minClipDuration: parsedMin,
      maxClipDuration: parsedMax,
      aspectRatio: defaultAspectRatio,
      cropMode: defaultCropMode,
      defaultIncludeCaptions,
      defaultCaptionStyle,
      defaultShowOverlays,
      videoQuality,
      workspaceDir,
      anthropicApiKeyConfigured: Boolean(apiKeyInput.trim() || settings.anthropicApiKeyConfigured),
    });

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  return (
    <div id="view-settings" className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Application Settings</h2>
            <p className="text-xs text-neutral-400">
              Configure Anthropic Claude API, local FFmpeg defaults, and output preferences
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshSystemStatus}
          className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition"
          title="Refresh system diagnostics"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Anthropic Claude API Configuration */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-neutral-800 pb-3">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Anthropic Claude API</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Anthropic API Key
              </label>
              <div className="flex items-center gap-2">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    settings.anthropicApiKeyConfigured
                      ? '•••••••••••••••••••••••••••••••• (API Key Configured)'
                      : 'sk-ant-api03-...'
                  }
                  className="flex-1 px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-300 font-medium border border-neutral-700"
                >
                  {showKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                Stored locally in <code className="text-neutral-400">.env</code>. Never exposed to browser or logged.
              </p>
            </div>

            {/* Claude Model Selector */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Claude Model Architecture
              </label>
              <div className="space-y-2">
                {availableModels.map((m) => (
                  <label
                    key={m.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                      claudeModel === m.id
                        ? 'bg-purple-950/30 border-purple-600/60 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="claudeModel"
                      value={m.id}
                      checked={claudeModel === m.id}
                      onChange={() => setClaudeModel(m.id)}
                      className="mt-1 accent-purple-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-neutral-200 block">{m.name}</span>
                      <span className="text-[11px] text-neutral-500">{m.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Video & Render Defaults */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-neutral-800 pb-3">
            <Film className="w-4 h-4 text-amber-400" />
            <span>Video & Render Defaults</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Default Clip Count */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Default Clip Discovery Count
              </label>
              <select
                value={defaultClipCount}
                onChange={(e) => setDefaultClipCount(parseInt(e.target.value, 10))}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value={3}>3 Top Clips</option>
                <option value={5}>5 Top Clips (Recommended)</option>
                <option value={10}>10 Clips</option>
                <option value={20}>20 Clips</option>
              </select>
            </div>

            {/* Default Aspect Ratio */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Default Aspect Ratio Format
              </label>
              <select
                value={defaultAspectRatio}
                onChange={(e) => setDefaultAspectRatio(e.target.value as AspectRatioFormat)}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="9:16">9:16 Vertical (1080×1920 • Shorts, Reels, TikTok)</option>
                <option value="16:9">16:9 Landscape (1920×1080 • YouTube, Desktop)</option>
                <option value="1:1">1:1 Square (1080×1080 • Instagram, LinkedIn)</option>
              </select>
            </div>

            {/* Default Crop Strategy */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Default Framing / Crop Strategy
              </label>
              <select
                value={defaultCropMode}
                onChange={(e) => setDefaultCropMode(e.target.value as CropMode)}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="autoface">🎯 Auto Face & Active Speaker Tracking (Recommended)</option>
                <option value="split">👥 Multi-Speaker Split Screen (Stacked Top/Bottom)</option>
                <option value="center">Center Crop (Direct Center Cut)</option>
                <option value="blur">Fit with Blurred Background</option>
                <option value="custom">Custom Horizontal Pan</option>
              </select>
            </div>

            {/* Subtitles Burning Default */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Default Subtitles (Captions)
              </label>
              <select
                value={defaultIncludeCaptions ? 'true' : 'false'}
                onChange={(e) => setDefaultIncludeCaptions(e.target.value === 'true')}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="true">Burn Subtitles into Video (Enabled)</option>
                <option value="false">Clean Video (No Subtitles on Pixels)</option>
              </select>
            </div>

            {/* Subtitles Style Default */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Default Subtitle Style
              </label>
              <select
                value={defaultCaptionStyle}
                onChange={(e) => setDefaultCaptionStyle(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="viral_yellow">Viral Yellow Highlight (High Retention)</option>
                <option value="clean_white">Clean White Text with Dark Stroke</option>
                <option value="minimal">Minimalist Translucent Subtitle Plate</option>
              </select>
            </div>

            {/* Video Overlays (Clean by default) */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Export Overlays & Badges
              </label>
              <select
                value={defaultShowOverlays ? 'true' : 'false'}
                onChange={(e) => setDefaultShowOverlays(e.target.value === 'true')}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="false">Clean Export (No Rank or Score Badges)</option>
                <option value="true">Burn Rank (#1) & Viral Score Badges</option>
              </select>
            </div>

            {/* Min Duration */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Minimum Clip Duration (Seconds)
              </label>
              <input
                type="number"
                min="15"
                max="60"
                value={minDuration === '' || isNaN(Number(minDuration)) ? '' : minDuration}
                onChange={(e) => {
                  const v = e.target.value;
                  setMinDuration(v === '' ? '' : parseInt(v, 10) || '');
                }}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Max Duration */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Maximum Clip Duration (Seconds)
              </label>
              <input
                type="number"
                min="30"
                max="180"
                value={maxDuration === '' || isNaN(Number(maxDuration)) ? '' : maxDuration}
                onChange={(e) => {
                  const v = e.target.value;
                  setMaxDuration(v === '' ? '' : parseInt(v, 10) || '');
                }}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Video Quality */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                FFmpeg Video Quality Preset
              </label>
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              >
                <option value="high">High Quality (CRF 18, Fast preset) - Recommended</option>
                <option value="ultra">Ultra Quality (CRF 15, Medium preset)</option>
                <option value="medium">Medium Quality (CRF 23, Faster preset)</option>
              </select>
            </div>

            {/* Workspace directory */}
            <div>
              <label className="text-xs font-semibold text-neutral-300 block mb-1">
                Local Workspace Folder
              </label>
              <input
                type="text"
                value={workspaceDir}
                onChange={(e) => setWorkspaceDir(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Section 3: System Diagnostics */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-neutral-800 pb-3">
            <Cpu className="w-4 h-4 text-amber-400" />
            <span>Local System Diagnostics</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* FFmpeg */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">FFmpeg</span>
              <div className="flex items-center gap-1.5">
                {settings.ffmpegDetected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-semibold text-neutral-200">
                  {settings.ffmpegDetected ? 'Detected' : 'Missing'}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono truncate">
                {settings.ffmpegVersion || 'Not available'}
              </p>
            </div>

            {/* FFprobe */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">FFprobe</span>
              <div className="flex items-center gap-1.5">
                {settings.ffprobeDetected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                )}
                <span className="font-semibold text-neutral-200">
                  {settings.ffprobeDetected ? 'Detected' : 'Missing'}
                </span>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono">Metadata extraction engine</p>
            </div>

            {/* Python */}
            <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 space-y-1">
              <span className="text-neutral-500 block text-[10px] uppercase font-mono">Python Runtime</span>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="font-semibold text-neutral-200">Python 3.11+ Ready</span>
              </div>
              <p className="text-[10px] text-neutral-500 font-mono">FastAPI / Uvicorn backend</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {isSaved && (
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Settings Saved!
            </span>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:brightness-110 text-neutral-950 text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Save Settings</span>
          </button>
        </div>
      </form>
    </div>
  );
};
