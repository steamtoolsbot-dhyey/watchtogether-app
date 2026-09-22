'use client';

import React from 'react';

interface AmbientGlowProps {
  isPlaying: boolean;
}

export function AmbientGlow({ isPlaying }: AmbientGlowProps) {
  return (
    <div
      className={`absolute -inset-4 sm:-inset-6 rounded-3xl bg-gradient-to-r from-brand-600/20 via-fuchsia-600/15 to-indigo-600/20 blur-2xl sm:blur-3xl -z-10 transition-opacity duration-1000 pointer-events-none ${
        isPlaying ? 'opacity-70 sm:opacity-90' : 'opacity-20'
      }`}
    />
  );
}
