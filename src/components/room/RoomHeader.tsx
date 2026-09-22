'use client';

import React, { useState } from 'react';
import { RoomViewer } from '@/lib/types';
import {
  Users,
  Share2,
  Lock,
  Unlock,
  ShieldCheck,
  Crown,
  Home,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { ShareModal } from '../modals/ShareModal';

interface RoomHeaderProps {
  roomId: string;
  roomName: string;
  isHost: boolean;
  hostOnlyControls: boolean;
  viewers: Record<string, RoomViewer>;
  onToggleHostOnlyControls: (enabled: boolean) => void;
}

export function RoomHeader({
  roomId,
  roomName,
  isHost,
  hostOnlyControls,
  viewers,
  onToggleHostOnlyControls,
}: RoomHeaderProps) {
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [showViewersPopup, setShowViewersPopup] = useState(false);

  const viewersList = Object.values(viewers);

  return (
    <header className="h-16 w-full bg-cinema-900/90 border-b border-slate-800/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 z-40 select-none">
      {/* Brand & Room Title */}
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href="/"
          title="Back to Lobby"
          className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white transition-all flex items-center justify-center flex-shrink-0"
        >
          <Home className="w-4 h-4" />
        </Link>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-black text-white truncate font-sans">
              {roomName}
            </h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 flex-shrink-0 hidden sm:inline">
              #{roomId}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3 h-3" />
              <span>E2EE Active</span>
            </span>
            <span>•</span>
            <span className="hidden sm:inline">Anti-Torrent Verified</span>
          </div>
        </div>
      </div>

      {/* Right Controls: Viewers, Host Controls, Share */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Host Controls Toggle */}
        {isHost && (
          <button
            onClick={() => onToggleHostOnlyControls(!hostOnlyControls)}
            title={hostOnlyControls ? 'Host Only Playback is ON (Click to allow anyone to control)' : 'Free-for-All Playback is ON (Click to lock to host only)'}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              hostOnlyControls
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'bg-slate-800/80 text-slate-400 hover:text-white border border-slate-700/60'
            }`}
          >
            {hostOnlyControls ? (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Host Lock</span>
              </>
            ) : (
              <>
                <Unlock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Free Control</span>
              </>
            )}
          </button>
        )}

        {/* Viewers Counter & Avatar Avatars */}
        <div className="relative">
          <button
            onClick={() => setShowViewersPopup((prev) => !prev)}
            className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Users className="w-3.5 h-3.5 text-brand-400" />
            <span>{viewersList.length}</span>
          </button>

          {/* Viewers Popup */}
          {showViewersPopup && (
            <div className="absolute top-full mt-2 right-0 w-64 bg-cinema-900 border border-slate-700/80 rounded-2xl p-3 shadow-2xl flex flex-col gap-2 z-50">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300">Watching Now</span>
                <span className="text-[10px] font-mono text-brand-400">{viewersList.length} Connected</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {viewersList.map((v) => (
                  <div
                    key={v.id}
                    className="p-1.5 rounded-xl bg-slate-950/60 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: v.avatarColor }}
                      />
                      <span className="font-semibold text-slate-200 truncate">{v.name}</span>
                    </div>
                    {v.isHost && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-bold flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                        <span>Host</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Share Button */}
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-brand-600/25 transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Invite</span>
        </button>
      </div>

      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        roomId={roomId}
        roomName={roomName}
      />
    </header>
  );
}
