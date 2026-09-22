'use client';

import React from 'react';
import { EmojiReaction } from '@/lib/types';

interface FloatingReactionsProps {
  reactions: EmojiReaction[];
}

export function FloatingReactions({ reactions }: FloatingReactionsProps) {
  // Only display reactions from the last 6 seconds
  const now = Date.now();
  const activeReactions = reactions.filter((r) => now - r.timestamp < 6000);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
      {activeReactions.map((r) => (
        <div
          key={r.id}
          className="absolute bottom-16 animate-float-up flex flex-col items-center select-none"
          style={{
            left: `${r.xPosition}%`,
            transition: 'transform 0.1s linear',
          }}
        >
          <span className="text-3xl sm:text-4xl filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            {r.emoji}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white/90 backdrop-blur-xs mt-0.5 whitespace-nowrap">
            {r.senderName}
          </span>
        </div>
      ))}
    </div>
  );
}
