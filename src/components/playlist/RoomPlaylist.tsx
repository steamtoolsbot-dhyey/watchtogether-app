'use client';

import React, { useState } from 'react';
import { PlaylistItem } from '@/lib/types';
import { ListPlus, Play, Trash2, SkipForward, Music, Radio, Film } from 'lucide-react';
import { AddMediaModal } from '../modals/AddMediaModal';

interface RoomPlaylistProps {
  currentVideo: PlaylistItem | null;
  queue: PlaylistItem[];
  isHost: boolean;
  onPlayNow: (video: PlaylistItem) => void;
  onRemoveItem: (videoId: string) => void;
  onNextVideo: () => void;
  onAddVideo: (video: Omit<PlaylistItem, 'id' | 'addedBy'>) => void;
}

export function RoomPlaylist({
  currentVideo,
  queue,
  isHost,
  onPlayNow,
  onRemoveItem,
  onNextVideo,
  onAddVideo,
}: RoomPlaylistProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-cinema-900 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl select-none">
      {/* Playlist Header */}
      <div className="p-3.5 border-b border-slate-800/80 bg-cinema-850/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-brand-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
            Room Queue ({queue.length})
          </h3>
        </div>

        <div className="flex items-center gap-1.5">
          {queue.length > 0 && (
            <button
              onClick={onNextVideo}
              title="Skip to next video"
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <SkipForward className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[10px] hidden sm:inline font-mono">Next</span>
            </button>
          )}

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-2.5 py-1 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Add Video</span>
          </button>
        </div>
      </div>

      {/* Now Playing Banner */}
      {currentVideo && (
        <div className="p-3 bg-brand-950/20 border-b border-brand-500/20 flex items-center gap-3">
          <div className="w-12 h-9 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0 relative border border-brand-500/30">
            {currentVideo.thumbnail ? (
              <img src={currentVideo.thumbnail} alt={currentVideo.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
                <Film className="w-4 h-4" />
              </div>
            )}
            <div className="absolute inset-0 bg-brand-600/10 flex items-center justify-center">
              <Radio className="w-3 h-3 text-brand-400 animate-pulse" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-400">
              Now Playing
            </span>
            <p className="text-xs font-bold text-white truncate">
              {currentVideo.title}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              Source: <span className="uppercase font-mono">{currentVideo.type}</span>
            </p>
          </div>
        </div>
      )}

      {/* Queue List */}
      <div className="flex-1 p-2 space-y-1.5 overflow-y-auto min-h-[220px] max-h-[420px]">
        {queue.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Film className="w-8 h-8 opacity-30 text-slate-400" />
            <p className="text-xs font-medium">The queue is empty.</p>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs text-brand-400 hover:text-brand-300 font-semibold cursor-pointer"
            >
              + Click here to add a video
            </button>
          </div>
        ) : (
          queue.map((item, idx) => (
            <div
              key={item.id}
              className="p-2 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 flex items-center justify-between gap-2.5 transition-all group"
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span className="text-[11px] font-mono font-bold text-slate-600 w-4 text-center">
                  {idx + 1}
                </span>
                <div className="w-10 h-7 rounded bg-slate-900 overflow-hidden flex-shrink-0 relative">
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500">
                      <Music className="w-3 h-3" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-brand-300">
                    {item.title}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate">
                    Added by {item.addedBy}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  onClick={() => onPlayNow(item)}
                  title="Play immediately"
                  className="p-1.5 rounded-lg hover:bg-brand-600 hover:text-white text-slate-400 transition-colors cursor-pointer"
                >
                  <Play className="w-3 h-3 fill-current" />
                </button>
                <button
                  onClick={() => onRemoveItem(item.id)}
                  title="Remove from queue"
                  className="p-1.5 rounded-lg hover:bg-rose-950 hover:text-rose-400 text-slate-500 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Media Modal */}
      <AddMediaModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddVideo={onAddVideo}
      />
    </div>
  );
}
