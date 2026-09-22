'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Film,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  Tv,
  Lock,
  Users,
  Play,
  Share2,
} from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success && data.roomId) {
        router.push(`/room/${data.roomId}`);
      }
    } catch (err) {
      console.error('Failed to create room:', err);
      // Fallback local slug
      const fallbackId = `cinema-${Math.random().toString(36).substring(2, 7)}`;
      router.push(`/room/${fallbackId}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = roomCodeInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (clean) {
      router.push(`/room/${clean}`);
    }
  };

  return (
    <div className="min-h-screen bg-cinema-950 text-white flex flex-col justify-between selection:bg-brand-500 selection:text-white">
      {/* Top Navbar */}
      <header className="h-20 w-full max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-black text-lg tracking-tight">
              CHARON <span className="text-brand-400 font-normal">WATCHTOGETHER</span>
            </span>
            <span className="block text-[10px] font-mono text-emerald-400">
              E2EE • 100% Anti-Torrent
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 active:scale-95 text-white text-xs font-bold shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isCreating ? 'Creating Room...' : 'Start Cinema Room'}</span>
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 flex flex-col items-center text-center space-y-8">
        {/* Security / Quality Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Client-Side End-to-End Encryption</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/30">
            <Zap className="w-3.5 h-3.5" />
            <span>Vercel Serverless Ready</span>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/30">
            <Lock className="w-3.5 h-3.5" />
            <span>100% Anti-Torrent Protected</span>
          </div>
        </div>

        {/* Hero Title */}
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-[1.15]">
            Share your screen & stream live in{' '}
            <span className="bg-gradient-to-r from-brand-400 via-fuchsia-400 to-cyan-400 bg-clip-text text-transparent">
              sub-second sync.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Host a private live stream lounge in seconds. Broadcast your entire monitor, gaming apps, or browser tabs directly to friends with ultra-low WebRTC latency, system audio, microphone commentary, and client-side End-to-End Encryption.
          </p>
        </div>

        {/* Action Panel: 1-Click Create or Join */}
        <div className="w-full max-w-md p-6 rounded-3xl bg-cinema-900 border border-slate-800/80 shadow-2xl space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:opacity-95 active:scale-98 text-white font-black text-sm shadow-xl shadow-brand-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-white" />
            <span>{isCreating ? 'Launching Stream Lounge...' : 'Start Live Stream Room'}</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-cinema-900 px-3 text-xs font-mono text-slate-500 uppercase">
              Or join existing lounge
            </span>
          </div>

          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              placeholder="Enter room code (e.g. stream-904)..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 outline-none font-mono"
            />
            <button
              type="submit"
              disabled={!roomCodeInput.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <span>Join</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Features Highlight Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-4xl text-left pt-6">
          <div className="p-5 rounded-3xl bg-cinema-900/60 border border-slate-800/60 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
              WebRTC Screen Share
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Broadcast screens, apps, or browser tabs at 1080p 60fps with sub-100ms ultra-low latency directly to viewers.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-cinema-900/60 border border-slate-800/60 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
              User-End Encryption
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every stream track is encrypted with DTLS-SRTP, and chat is protected via client-side AES-GCM-256 Web Crypto.
            </p>
          </div>

          <div className="p-5 rounded-3xl bg-cinema-900/60 border border-slate-800/60 space-y-2">
            <div className="w-8 h-8 rounded-xl bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
              Zero Torrents
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              100% torrent-free. Magnet links, .torrent files, and P2P swarm trackers are strictly blocked by protocol.
            </p>
          </div>
        </div>

        {/* Quick Demo Rooms Bar */}
        <div className="pt-4 space-y-2">
          <p className="text-[11px] font-mono uppercase text-slate-500">
            Quick-start curated public lounges:
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {[
              { id: 'scifi-theater', label: '🎬 Sci-Fi Theater (Dune 2)' },
              { id: 'lofi-lounge', label: '🎧 24/7 Lo-Fi Study Lounge' },
              { id: 'anime-hub', label: '⚡ Cyberpunk Anime Room' },
              { id: 'bunny-4k', label: '🐰 4K Ultra HD Direct Stream' },
            ].map((room) => (
              <Link
                key={room.id}
                href={`/room/${room.id}`}
                className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-brand-500/60 text-xs text-slate-300 hover:text-white transition-all font-medium"
              >
                {room.label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-16 border-t border-slate-800/60 max-w-7xl mx-auto w-full px-6 flex items-center justify-between text-xs text-slate-500">
        <span>Charon WatchTogether • Built for Vercel</span>
        <span className="font-mono">Client-Side E2EE • Anti-Torrent Guaranteed</span>
      </footer>
    </div>
  );
}
