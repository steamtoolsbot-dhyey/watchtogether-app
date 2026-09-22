'use client';

import React, { useState } from 'react';
import { X, Link2, AlertTriangle, ShieldCheck, Film, Plus } from 'lucide-react';
import { parseVideoUrl, DEMO_VIDEOS } from '@/lib/demo-videos';
import { PlaylistItem } from '@/lib/types';

interface AddMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVideo: (video: Omit<PlaylistItem, 'id' | 'addedBy'>) => void;
}

export function AddMediaModal({ isOpen, onClose, onAddVideo }: AddMediaModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsed = parseVideoUrl(urlInput);
    if (!parsed) {
      setErrorMsg('Please enter a valid YouTube, Twitch, or Direct HTTPS video URL (.mp4, .webm, .m3u8).');
      return;
    }

    if (parsed.error) {
      setErrorMsg(parsed.error);
      return;
    }

    onAddVideo({
      url: parsed.cleanUrl || urlInput.trim(),
      title: titleInput.trim() || (parsed.type === 'youtube' ? 'YouTube Stream' : parsed.type === 'twitch' ? 'Twitch Live' : 'Direct Video Stream'),
      type: parsed.type || 'direct',
      thumbnail: parsed.type === 'youtube' && parsed.videoId ? `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg` : undefined,
    });

    setUrlInput('');
    setTitleInput('');
    onClose();
  };

  const handleSelectPreset = (preset: PlaylistItem) => {
    onAddVideo({
      url: preset.url,
      title: preset.title,
      type: preset.type,
      thumbnail: preset.thumbnail,
      duration: preset.duration,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-cinema-900 border border-slate-700/80 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-brand-400" />
            <span>Add Video to Room Queue</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Supports YouTube, Twitch, and direct HTTPS video files (.mp4, .webm, .m3u8).
          </p>
        </div>

        {/* Anti-Torrent Security Guarantee */}
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            <strong>100% Torrent-Free Platform:</strong> All media is streamed through standard authorized web protocols (HTTPS/CORS/IFrame). P2P BitTorrent networks and magnet links are blocked.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 flex items-center gap-2 text-xs text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Custom URL Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Video URL
            </label>
            <div className="relative">
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste YouTube, Twitch, or Direct MP4 link..."
                className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none pr-9 font-mono"
              />
              <Link2 className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Custom Title (Optional)
            </label>
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="e.g. Dune 2 Trailer..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={!urlInput.trim()}
            className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-98 text-white font-bold text-xs shadow-lg shadow-brand-600/25 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add to Queue</span>
          </button>
        </form>

        {/* Quick Presets Catalog */}
        <div className="pt-3 border-t border-slate-800/80">
          <p className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold mb-2">
            Or pick a starter demo stream:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_VIDEOS.map((demo) => (
              <button
                key={demo.id}
                type="button"
                onClick={() => handleSelectPreset(demo)}
                className="p-2 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-brand-500/60 text-left transition-all text-xs group cursor-pointer flex items-center gap-2"
              >
                <div className="w-10 h-8 rounded bg-slate-800 overflow-hidden flex-shrink-0 relative">
                  {demo.thumbnail && (
                    <img src={demo.thumbnail} alt={demo.title} className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-200 truncate group-hover:text-brand-300">
                    {demo.title}
                  </p>
                  <span className="text-[9px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-400">
                    {demo.type}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
