'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PlaylistItem, PlaybackState, EmojiReaction } from '@/lib/types';
import { CustomControls } from './CustomControls';
import { AmbientGlow } from './AmbientGlow';
import { FloatingReactions } from '../reactions/FloatingReactions';
import { Loader2 } from 'lucide-react';

interface VideoPlayerProps {
  currentVideo: PlaylistItem | null;
  playbackState: PlaybackState;
  isHost: boolean;
  hostOnlyControls: boolean;
  reactions: EmojiReaction[];
  onPlaybackChange: (update: {
    action: 'play' | 'pause' | 'seek' | 'speed';
    currentTime: number;
    isPlaying: boolean;
    playbackRate?: number;
  }) => void;
  onVideoEnded: () => void;
}

export function VideoPlayer({
  currentVideo,
  playbackState,
  isHost,
  hostOnlyControls,
  reactions,
  onPlaybackChange,
  onVideoEnded,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const html5VideoRef = useRef<HTMLVideoElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const isSyncingFromRemoteRef = useRef(false);

  const [localPlaying, setLocalPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Extract YouTube ID
  const getYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : null;
  };

  const ytVideoId = currentVideo?.type === 'youtube' ? getYouTubeId(currentVideo.url) : null;

  // Initialize YouTube IFrame API
  useEffect(() => {
    if (!ytVideoId) return;

    const loadYtApi = () => {
      if ((window as any).YT && (window as any).YT.Player) {
        initYtPlayer();
      } else {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        tag.id = 'yt-api-script';
        if (!document.getElementById('yt-api-script')) {
          document.body.appendChild(tag);
        }
        (window as any).onYouTubeIframeAPIReady = () => {
          initYtPlayer();
        };
      }
    };

    const initYtPlayer = () => {
      if (ytPlayerRef.current) {
        try {
          ytPlayerRef.current.loadVideoById(ytVideoId);
          return;
        } catch {
          // ignore
        }
      }

      ytPlayerRef.current = new (window as any).YT.Player('yt-player-target', {
        videoId: ytVideoId,
        playerVars: {
          autoplay: playbackState.isPlaying ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: (e: any) => {
            setIsLoading(false);
            setDuration(e.target.getDuration() || 0);
            e.target.setVolume(volume * 100);
          },
          onStateChange: (e: any) => {
            const state = e.data;
            if (state === 0) {
              // Ended
              onVideoEnded();
            } else if (state === 1) {
              setLocalPlaying(true);
              if (!isSyncingFromRemoteRef.current) {
                onPlaybackChange({
                  action: 'play',
                  currentTime: e.target.getCurrentTime(),
                  isPlaying: true,
                });
              }
            } else if (state === 2) {
              setLocalPlaying(false);
              if (!isSyncingFromRemoteRef.current) {
                onPlaybackChange({
                  action: 'pause',
                  currentTime: e.target.getCurrentTime(),
                  isPlaying: false,
                });
              }
            }
          },
        },
      });
    };

    loadYtApi();

    return () => {
      if (ytPlayerRef.current && ytPlayerRef.current.destroy) {
        try {
          ytPlayerRef.current.destroy();
        } catch {
          // ignore
        }
        ytPlayerRef.current = null;
      }
    };
  }, [ytVideoId]);

  // Update current time tick
  useEffect(() => {
    const timer = setInterval(() => {
      if (currentVideo?.type === 'youtube' && ytPlayerRef.current?.getCurrentTime) {
        try {
          setCurrentTime(ytPlayerRef.current.getCurrentTime() || 0);
          setDuration(ytPlayerRef.current.getDuration() || 0);
        } catch {}
      } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
        setCurrentTime(html5VideoRef.current.currentTime || 0);
        setDuration(html5VideoRef.current.duration || 0);
      }
    }, 500);

    return () => clearInterval(timer);
  }, [currentVideo]);

  // Handle incoming remote playback sync events
  useEffect(() => {
    if (!playbackState) return;

    const targetTime = playbackState.isPlaying
      ? playbackState.currentTime + (Date.now() - playbackState.updatedAt) / 1000
      : playbackState.currentTime;

    isSyncingFromRemoteRef.current = true;

    // 1. YouTube Sync
    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      try {
        const localTime = ytPlayerRef.current.getCurrentTime?.() || 0;
        const drift = Math.abs(localTime - targetTime);

        if (drift > 1.2) {
          ytPlayerRef.current.seekTo(targetTime, true);
        }

        if (playbackState.isPlaying && ytPlayerRef.current.playVideo) {
          ytPlayerRef.current.playVideo();
          setLocalPlaying(true);
        } else if (!playbackState.isPlaying && ytPlayerRef.current.pauseVideo) {
          ytPlayerRef.current.pauseVideo();
          setLocalPlaying(false);
        }

        if (playbackState.playbackRate && ytPlayerRef.current.setPlaybackRate) {
          ytPlayerRef.current.setPlaybackRate(playbackState.playbackRate);
          setPlaybackRate(playbackState.playbackRate);
        }
      } catch (err) {
        console.error('YT Sync error:', err);
      }
    }

    // 2. HTML5 Video Sync
    if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      const vid = html5VideoRef.current;
      const drift = Math.abs(vid.currentTime - targetTime);

      if (drift > 1.2) {
        vid.currentTime = targetTime;
      }

      if (playbackState.isPlaying && vid.paused) {
        vid.play().catch(() => {});
        setLocalPlaying(true);
      } else if (!playbackState.isPlaying && !vid.paused) {
        vid.pause();
        setLocalPlaying(false);
      }

      if (playbackState.playbackRate) {
        vid.playbackRate = playbackState.playbackRate;
        setPlaybackRate(playbackState.playbackRate);
      }
    }

    setTimeout(() => {
      isSyncingFromRemoteRef.current = false;
    }, 300);
  }, [playbackState, currentVideo]);

  // Controls Handlers
  const handlePlayPause = () => {
    const nextPlaying = !localPlaying;
    setLocalPlaying(nextPlaying);

    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      if (nextPlaying) ytPlayerRef.current.playVideo?.();
      else ytPlayerRef.current.pauseVideo?.();
    } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      if (nextPlaying) html5VideoRef.current.play().catch(() => {});
      else html5VideoRef.current.pause();
    }

    onPlaybackChange({
      action: nextPlaying ? 'play' : 'pause',
      currentTime,
      isPlaying: nextPlaying,
    });
  };

  const handleSeek = (time: number) => {
    setCurrentTime(time);
    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.seekTo(time, true);
    } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      html5VideoRef.current.currentTime = time;
    }

    onPlaybackChange({
      action: 'seek',
      currentTime: time,
      isPlaying: localPlaying,
    });
  };

  const handleVolumeChange = (vol: number) => {
    setVolume(vol);
    setIsMuted(vol === 0);
    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.setVolume?.(vol * 100);
      if (vol === 0) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      html5VideoRef.current.volume = vol;
      html5VideoRef.current.muted = vol === 0;
    }
  };

  const handleMuteToggle = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      if (nextMuted) ytPlayerRef.current.mute?.();
      else ytPlayerRef.current.unMute?.();
    } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      html5VideoRef.current.muted = nextMuted;
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackRate(speed);
    if (currentVideo?.type === 'youtube' && ytPlayerRef.current) {
      ytPlayerRef.current.setPlaybackRate?.(speed);
    } else if (currentVideo?.type === 'direct' && html5VideoRef.current) {
      html5VideoRef.current.playbackRate = speed;
    }

    onPlaybackChange({
      action: 'speed',
      currentTime,
      isPlaying: localPlaying,
      playbackRate: speed,
    });
  };

  const handleSyncWithHost = () => {
    const target = playbackState.isPlaying
      ? playbackState.currentTime + (Date.now() - playbackState.updatedAt) / 1000
      : playbackState.currentTime;

    handleSeek(target);
  };

  const handleFullscreenToggle = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-slate-800/80 group select-none"
    >
      <AmbientGlow isPlaying={localPlaying} />
      <FloatingReactions reactions={reactions} />

      {/* Video Elements by Source */}
      {currentVideo?.type === 'youtube' && (
        <div className="w-full h-full pointer-events-none sm:pointer-events-auto">
          <div id="yt-player-target" className="w-full h-full" />
        </div>
      )}

      {currentVideo?.type === 'direct' && (
        <video
          ref={html5VideoRef}
          src={currentVideo.url}
          className="w-full h-full object-contain"
          onEnded={onVideoEnded}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration || 0);
            setIsLoading(false);
          }}
          playsInline
        />
      )}

      {currentVideo?.type === 'twitch' && (
        <iframe
          src={`https://player.twitch.tv/?channel=${currentVideo.url.split('twitch.tv/')[1] || 'shroud'}&parent=${
            typeof window !== 'undefined' ? window.location.hostname : 'localhost'
          }`}
          className="w-full h-full border-0"
          allowFullScreen
        />
      )}

      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 bg-cinema-950/60 backdrop-blur-xs flex items-center justify-center z-10">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
        </div>
      )}

      {/* Custom Cinema Controls Bar */}
      <CustomControls
        isPlaying={localPlaying}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        isMuted={isMuted}
        playbackRate={playbackRate}
        isHost={isHost}
        hostOnlyControls={hostOnlyControls}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onSpeedChange={handleSpeedChange}
        onSyncWithHost={handleSyncWithHost}
        onFullscreenToggle={handleFullscreenToggle}
        isFullscreen={isFullscreen}
      />
    </div>
  );
}
