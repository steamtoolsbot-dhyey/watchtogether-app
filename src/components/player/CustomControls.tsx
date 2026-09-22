'use client';

import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Radio,
  Lock,
  Sparkles,
} from 'lucide-react';

interface CustomControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isHost: boolean;
  hostOnlyControls: boolean;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (vol: number) => void;
  onMuteToggle: () => void;
  onSpeedChange: (speed: number) => void;
  onSyncWithHost: () => void;
  onFullscreenToggle: () => void;
  isFullscreen: boolean;
}

export function CustomControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isHost,
  hostOnlyControls,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onMuteToggle,
  onSpeedChange,
  onSyncWithHost,
  onFullscreenToggle,
  isFullscreen,
}: CustomControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const canControl = !hostOnlyControls || isHost;

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-cinema-950 via-cinema-950/80 to-transparent pt-12 pb-3 px-4 flex flex-col gap-2 transition-opacity duration-300 z-30 select-none">
      {/* Host Only Lock Notice */}
      {!canControl && (
        <div className="self-center px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-medium flex items-center gap-1.5 backdrop-blur-md">
          <Lock className="w-3 h-3 text-amber-400" />
          <span>Host has locked playback controls (Syncing automatically)</span>
        </div>
      )}

      {/* Progress / Seek Bar */}
      <div className="flex items-center gap-2 group cursor-pointer">
        <div
          className="relative w-full h-1.5 group-hover:h-2.5 bg-slate-800/80 rounded-full transition-all overflow-hidden"
          onClick={(e) => {
            if (!canControl || duration <= 0) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            onSeek(clickPos * duration);
          }}
        >
          {/* Active progress */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-brand-500 to-fuchsia-500 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Bottom Bar: Action buttons */}
      <div className="flex items-center justify-between gap-3 text-white text-xs">
        {/* Left: Play/Pause, Rewind, Forward, Time */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={onPlayPause}
            disabled={!canControl}
            title={canControl ? (isPlaying ? 'Pause' : 'Play') : 'Playback locked by host'}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              canControl
                ? 'bg-white/10 hover:bg-white/20 active:scale-95 text-white'
                : 'opacity-40 cursor-not-allowed'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white translate-x-0.5" />
            )}
          </button>

          {/* Quick Skip 10s */}
          <button
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            disabled={!canControl}
            title="Rewind 10 seconds"
            className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            disabled={!canControl}
            title="Forward 10 seconds"
            className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* Time Counter */}
          <span className="text-[11px] font-mono text-slate-300 ml-1">
            {formatTime(currentTime)} <span className="text-slate-500">/</span> {formatTime(duration)}
          </span>
        </div>

        {/* Right: Volume, Speed, Sync, Fullscreen */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Volume Control */}
          <div className="flex items-center gap-1.5 group">
            <button
              onClick={onMuteToggle}
              title={isMuted ? 'Unmute' : 'Mute'}
              className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-14 sm:w-18 h-1"
            />
          </div>

          {/* Playback Speed Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu((prev) => !prev)}
              disabled={!canControl}
              title="Playback Speed"
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-mono font-bold text-slate-200 transition-colors cursor-pointer disabled:opacity-30"
            >
              {playbackRate}x
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full mb-2 right-0 bg-cinema-900 border border-slate-700/80 rounded-xl p-1 shadow-2xl flex flex-col gap-1 z-40 min-w-[70px]">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onSpeedChange(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`px-2 py-1 rounded-lg text-left text-xs font-mono transition-colors ${
                      playbackRate === s
                        ? 'bg-brand-600 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Resync Button */}
          <button
            onClick={onSyncWithHost}
            title="Resync video with Room Host"
            className="px-2.5 py-1 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer"
          >
            <Radio className="w-3 h-3 text-brand-400 animate-pulse" />
            <span className="hidden sm:inline">Sync</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={onFullscreenToggle}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
