'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { RoomData, PlaylistItem, PlaybackState, ChatMessage, EmojiReaction, StreamState } from '@/lib/types';
import { RoomHeader } from '@/components/room/RoomHeader';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { LiveStreamStage } from '@/components/streaming/LiveStreamStage';
import { RoomChat } from '@/components/chat/RoomChat';
import { RoomPlaylist } from '@/components/playlist/RoomPlaylist';
import { MessageSquare, ListVideo, Loader2, ShieldCheck, Film, Monitor, Tv, Radio } from 'lucide-react';

const AVATAR_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#06b6d4', '#f43f5e'];

export default function CinemaRoomPage() {
  const params = useParams();
  const roomId = (params.roomId as string).toLowerCase();

  const [room, setRoom] = useState<RoomData | null>(null);
  const [activeTab, setActiveTab] = useState<'chat' | 'playlist'>('chat');
  const [viewMode, setViewMode] = useState<'screen' | 'video'>('screen');
  const [userId, setUserId] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [userColor, setUserColor] = useState<string>(AVATAR_COLORS[0]);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize or restore user identity from localStorage
  useEffect(() => {
    let savedId = localStorage.getItem('cw_user_id');
    let savedName = localStorage.getItem('cw_user_name');
    let savedColor = localStorage.getItem('cw_user_color');

    if (!savedId) {
      savedId = `viewer-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('cw_user_id', savedId);
    }
    if (!savedName) {
      savedName = `Viewer ${Math.floor(Math.random() * 900 + 100)}`;
      localStorage.setItem('cw_user_name', savedName);
    }
    if (!savedColor) {
      savedColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      localStorage.setItem('cw_user_color', savedColor);
    }

    setUserId(savedId);
    setUserName(savedName);
    setUserColor(savedColor);
  }, []);

  // Sync Loop & Heartbeat (every 800ms)
  useEffect(() => {
    if (!userId || !userName) return;

    let isSubscribed = true;

    async function fetchRoomSync() {
      try {
        const query = new URLSearchParams({
          viewerId: userId,
          viewerName: userName,
          avatarColor: userColor,
        });

        const res = await fetch(`/api/rooms/${roomId}?${query.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (isSubscribed && data.room) {
            setRoom(data.room);
            setIsLoading(false);
          }
        }
      } catch (err) {
        console.error('Room sync error:', err);
      }
    }

    fetchRoomSync();
    const interval = setInterval(fetchRoomSync, 800);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [roomId, userId, userName, userColor]);

  // Handlers
  const handlePlaybackChange = async (update: {
    action: 'play' | 'pause' | 'seek' | 'speed';
    currentTime: number;
    isPlaying: boolean;
    playbackRate?: number;
  }) => {
    if (!room) return;

    // Optimistic update
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        playback: {
          ...prev.playback,
          ...update,
          updatedAt: Date.now(),
          lastActionBy: userName,
        },
      };
    });

    try {
      await fetch(`/api/rooms/${roomId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...update,
          senderId: userId,
          lastActionBy: userName,
        }),
      });
    } catch (err) {
      console.error('Failed to post playback sync:', err);
    }
  };

  const handleSendMessage = async (encryptedText: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: userId,
          senderName: userName,
          avatarColor: userColor,
          text: encryptedText,
        }),
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleSendReaction = async (emoji: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'reaction',
          emoji,
          senderName: userName,
        }),
      });
    } catch (err) {
      console.error('Failed to send reaction:', err);
    }
  };

  const handleAddVideo = async (video: Omit<PlaylistItem, 'id' | 'addedBy'>) => {
    try {
      await fetch(`/api/rooms/${roomId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          video,
          requestedBy: userName,
        }),
      });
    } catch (err) {
      console.error('Failed to add video:', err);
    }
  };

  const handlePlayNow = async (video: PlaylistItem) => {
    try {
      await fetch(`/api/rooms/${roomId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playNow',
          video,
          requestedBy: userName,
        }),
      });
    } catch (err) {
      console.error('Failed to play now:', err);
    }
  };

  const handleRemoveQueueItem = async (videoId: string) => {
    try {
      await fetch(`/api/rooms/${roomId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          videoId,
        }),
      });
    } catch (err) {
      console.error('Failed to remove queue item:', err);
    }
  };

  const handleNextVideo = async () => {
    try {
      await fetch(`/api/rooms/${roomId}/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'next',
        }),
      });
    } catch (err) {
      console.error('Failed to advance queue:', err);
    }
  };

  const handleToggleHostOnlyControls = async (enabled: boolean) => {
    try {
      await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostOnlyControls: enabled,
        }),
      });
    } catch (err) {
      console.error('Failed to toggle host controls:', err);
    }
  };

  // Auto-switch to screen view when host goes live
  useEffect(() => {
    if (room?.streamState?.isStreaming) {
      setViewMode('screen');
    }
  }, [room?.streamState?.isStreaming]);

  const handleStreamStateChanged = (update: Partial<StreamState>) => {
    setRoom((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        streamState: {
          ...prev.streamState,
          ...update,
        },
      };
    });
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('cw_user_name', newName);
  };

  if (isLoading || !room) {
    return (
      <div className="min-h-screen bg-cinema-950 flex flex-col items-center justify-center space-y-3 text-slate-300">
        <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
        <p className="text-xs font-mono tracking-wider">Connecting to Cinema Room #{roomId}...</p>
      </div>
    );
  }

  const isHost = room.hostId === userId;

  return (
    <div className="min-h-screen flex flex-col bg-cinema-950 text-slate-100">
      {/* Header */}
      <RoomHeader
        roomId={room.id}
        roomName={room.name}
        isHost={isHost}
        hostOnlyControls={room.hostOnlyControls}
        viewers={room.viewers}
        onToggleHostOnlyControls={handleToggleHostOnlyControls}
      />

      {/* Main Cinema Grid */}
      <main className="flex-1 p-3 sm:p-5 max-w-[1600px] w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Streaming Stage / Player & Info (8 Cols on Desktop) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Mode Switcher Bar */}
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-cinema-900 border border-slate-800/80">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setViewMode('screen')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  viewMode === 'screen'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Live Screen Share</span>
                {room.streamState?.isStreaming && (
                  <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full text-[9px] bg-rose-500 text-white animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    LIVE
                  </span>
                )}
              </button>

              <button
                onClick={() => setViewMode('video')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  viewMode === 'video'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Synced Video Player</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400 pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>WebRTC Mesh Active</span>
            </div>
          </div>

          {/* Primary Viewport */}
          {viewMode === 'screen' ? (
            <LiveStreamStage
              roomId={room.id}
              isHost={isHost}
              currentUserId={userId}
              currentUserName={userName}
              hostId={room.hostId}
              streamState={room.streamState}
              reactions={room.reactions}
              onStreamStateChanged={handleStreamStateChanged}
            />
          ) : (
            <VideoPlayer
              currentVideo={room.currentVideo}
              playbackState={room.playback}
              isHost={isHost}
              hostOnlyControls={room.hostOnlyControls}
              reactions={room.reactions}
              onPlaybackChange={handlePlaybackChange}
              onVideoEnded={handleNextVideo}
            />
          )}

          {/* Stream & Room Info Details Card */}
          <div className="p-4 rounded-3xl bg-cinema-900 border border-slate-800/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/30 uppercase font-bold">
                  {viewMode === 'screen' ? (room.streamState?.isStreaming ? 'Live Broadcast' : 'Screen Share') : (room.currentVideo?.type || 'Stream')}
                </span>
                {viewMode === 'screen' && room.streamState?.isStreaming && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                    {room.streamState?.resolution || '1080p'} 60fps
                  </span>
                )}
              </div>

              <h2 className="text-base sm:text-lg font-black text-white mt-1 truncate">
                {viewMode === 'screen'
                  ? (room.streamState?.isStreaming ? room.streamState?.streamTitle : `${room.name} — Live Lounge`)
                  : (room.currentVideo?.title || 'No video loaded')}
              </h2>
              <p className="text-xs text-slate-400 truncate mt-0.5 font-mono">
                {viewMode === 'screen'
                  ? `Host: ${isHost ? 'You (Broadcaster)' : room.streamState?.hostName || 'Room Host'}`
                  : room.currentVideo?.url}
              </p>
            </div>

            {/* Anti-Torrent Guarantee Badge */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-300 self-start sm:self-auto flex-shrink-0">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <div className="text-[11px] leading-tight">
                <span className="font-bold block">100% Anti-Torrent</span>
                <span className="text-emerald-400/80">DTLS P2P Streams</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Tabbed Chat & Queue (4 Cols on Desktop) */}
        <div className="lg:col-span-4 flex flex-col h-[650px] lg:h-auto">
          {/* Tab Switcher */}
          <div className="flex p-1 bg-cinema-900 rounded-2xl border border-slate-800/80 mb-3 select-none">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Room Chat</span>
            </button>

            <button
              onClick={() => setActiveTab('playlist')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'playlist'
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListVideo className="w-3.5 h-3.5" />
              <span>Queue ({room.queue.length})</span>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 min-h-0">
            {activeTab === 'chat' ? (
              <RoomChat
                roomId={room.id}
                chat={room.chat}
                currentUserId={userId}
                currentUserName={userName}
                currentUserColor={userColor}
                onSendMessage={handleSendMessage}
                onSendReaction={handleSendReaction}
                onUpdateUserName={handleUpdateUserName}
              />
            ) : (
              <RoomPlaylist
                currentVideo={room.currentVideo}
                queue={room.queue}
                isHost={isHost}
                onPlayNow={handlePlayNow}
                onRemoveItem={handleRemoveQueueItem}
                onNextVideo={handleNextVideo}
                onAddVideo={handleAddVideo}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
