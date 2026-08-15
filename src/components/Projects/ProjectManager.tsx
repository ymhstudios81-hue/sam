import React, { useState } from 'react';
import { FolderKanban, Plus, Trash2, ArrowRight, Video, FileText, Sparkles, Film, Calendar, Edit2 } from 'lucide-react';
import { Project } from '../../types';
import { formatSecondsToTimecode } from '../../services/transcriptParser';

interface ProjectManagerProps {
  projects: Project[];
  activeProjectId?: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreating(false);
    }
  };

  const handleRenameSubmit = (projectId: string) => {
    if (editName.trim()) {
      onRenameProject(projectId, editName.trim());
      setEditingId(null);
    }
  };

  return (
    <div id="view-projects" className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Project Workspace</h2>
            <p className="text-xs text-neutral-400">
              Manage video projects, cached Claude clip analyses, and rendered short outputs
            </p>
          </div>
        </div>

        <button
          id="btn-new-project"
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-amber-500/10"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Create Project Modal / Inline Form */}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="bg-neutral-900/90 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
        >
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="Project name (e.g. Podcast Episode #48 - AI Revolution)"
            autoFocus
            className="flex-1 px-3.5 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-sm text-white focus:outline-none focus:border-amber-500 font-medium"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium border border-neutral-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newProjectName.trim()}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition disabled:opacity-50"
            >
              Create Project
            </button>
          </div>
        </form>
      )}

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="text-center py-16 border border-neutral-800 rounded-xl bg-neutral-900/30 p-8">
          <FolderKanban className="w-12 h-12 text-neutral-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300">No Projects Yet</h3>
          <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-4">
            Create your first project to start converting long podcasts and videos into viral vertical shorts.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition"
          >
            Create New Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const isEditing = editingId === proj.id;

            return (
              <div
                key={proj.id}
                id={`project-card-${proj.id}`}
                className={`rounded-xl border p-5 flex flex-col justify-between transition ${
                  isActive
                    ? 'bg-neutral-900 border-amber-500/50 shadow-lg shadow-amber-500/5'
                    : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div>
                  {/* Title & Active badge */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2.5 py-1 rounded bg-neutral-950 border border-amber-500 text-xs text-white flex-1"
                        />
                        <button
                          onClick={() => handleRenameSubmit(proj.id)}
                          className="text-xs text-amber-400 hover:underline font-bold"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs text-neutral-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm sm:text-base line-clamp-1">
                          {proj.name}
                        </h3>
                        {isActive && (
                          <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingId(proj.id);
                          setEditName(proj.name);
                        }}
                        className="p-1 text-neutral-500 hover:text-neutral-300"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteProject(proj.id)}
                        className="p-1 text-neutral-500 hover:text-red-400"
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Metadata Chips */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                    <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-neutral-500 text-[10px] block font-mono">Video</span>
                      <span className="font-medium text-neutral-300 truncate block">
                        {proj.video ? `${proj.video.width}×${proj.video.height}` : 'None'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-neutral-500 text-[10px] block font-mono">Transcript</span>
                      <span className="font-medium text-neutral-300 truncate block">
                        {proj.transcript?.segments.length ? `${proj.transcript.segments.length} lines` : 'None'}
                      </span>
                    </div>

                    <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-800">
                      <span className="text-neutral-500 text-[10px] block font-mono">AI Clips</span>
                      <span className="font-medium text-amber-400 font-mono">
                        {proj.clips.length} moments
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Switch button */}
                <div className="flex items-center justify-between pt-3 border-t border-neutral-800/80 text-xs">
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Created {new Date(proj.createdAt).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => onSelectProject(proj.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                      isActive
                        ? 'bg-neutral-800 text-amber-400 border border-amber-500/30'
                        : 'bg-amber-500 hover:bg-amber-400 text-neutral-950'
                    }`}
                  >
                    <span>{isActive ? 'Currently Open' : 'Open Project'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
