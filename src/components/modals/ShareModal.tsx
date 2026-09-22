'use client';

import React, { useState } from 'react';
import { X, Copy, Check, Share2, ShieldCheck } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomName: string;
}

export function ShareModal({ isOpen, onClose, roomId, roomName }: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : `https://charon-watchtogether.vercel.app/room/${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in select-none">
      <div className="bg-cinema-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-brand-400" />
            <span>Invite Friends to Cinema</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Anyone with this link can join <strong className="text-white">{roomName}</strong> and watch in sync.
          </p>
        </div>

        {/* E2EE Guarantee Banner */}
        <div className="p-3 rounded-2xl bg-brand-950/40 border border-brand-500/30 flex items-center gap-2.5 text-xs text-brand-300">
          <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0" />
          <span>Room chat & signals are protected with End-to-End Encryption.</span>
        </div>

        {/* Share Link Input with Copy Button */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
            Shareable Room Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={roomUrl}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono truncate select-all"
            />
            <button
              onClick={handleCopy}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 text-white'
              }`}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Room Code Badge */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-400">Room Code:</span>
          <span className="font-mono font-bold text-brand-300">{roomId}</span>
        </div>
      </div>
    </div>
  );
}
