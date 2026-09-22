import { RoomData, PlaylistItem, PlaybackState, ChatMessage, EmojiReaction, RoomViewer } from './types';
import { DEMO_VIDEOS } from './demo-videos';

declare global {
  // eslint-disable-next-line no-var
  var __charon_rooms: Map<string, RoomData> | undefined;
}

const rooms = globalThis.__charon_rooms ?? new Map<string, RoomData>();
globalThis.__charon_rooms = rooms;

export function getOrCreateRoom(roomId: string, name?: string, hostId?: string): RoomData {
  let room = rooms.get(roomId);

  if (!room) {
    const initialVideo: PlaylistItem = { ...DEMO_VIDEOS[0] };
    room = {
      id: roomId,
      name: name || `Cinema Room #${roomId.slice(0, 4)}`,
      createdAt: Date.now(),
      hostId: hostId || 'host',
      hostOnlyControls: false,
      currentVideo: initialVideo,
      playback: {
        isPlaying: false,
        currentTime: 0,
        playbackRate: 1,
        updatedAt: Date.now(),
        lastActionBy: 'System',
        action: 'load',
      },
      queue: DEMO_VIDEOS.slice(1).map((v) => ({ ...v })),
      chat: [
        {
          id: 'welcome-msg',
          senderId: 'system',
          senderName: 'Charon System',
          avatarColor: '#8b5cf6',
          text: 'Welcome to the cinema room! Paste any YouTube, Direct MP4, or Twitch stream URL to watch in sync.',
          timestamp: Date.now(),
          isSystem: true,
        },
      ],
      reactions: [],
      viewers: {},
    };
    rooms.set(roomId, room);
  }

  // Prune viewers older than 20 seconds
  const now = Date.now();
  for (const [id, viewer] of Object.entries(room.viewers)) {
    if (now - viewer.lastSeen > 20000) {
      delete room.viewers[id];
    }
  }

  // Prune reactions older than 10 seconds
  room.reactions = room.reactions.filter((r) => now - r.timestamp < 10000);

  return room;
}

export function updateRoomPlayback(
  roomId: string,
  update: Partial<PlaybackState> & { lastActionBy: string; action: PlaybackState['action'] }
): RoomData | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.playback = {
    ...room.playback,
    ...update,
    updatedAt: Date.now(),
  };

  return room;
}

export function addRoomChat(roomId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const msg: ChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  };

  room.chat.push(msg);
  if (room.chat.length > 150) {
    room.chat.shift();
  }

  return msg;
}

export function addRoomReaction(roomId: string, reaction: Omit<EmojiReaction, 'id' | 'timestamp'>): EmojiReaction | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const react: EmojiReaction = {
    ...reaction,
    id: `react-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
  };

  room.reactions.push(react);
  return react;
}

export function updateRoomViewer(roomId: string, viewer: RoomViewer): RoomData | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.viewers[viewer.id] = {
    ...viewer,
    lastSeen: Date.now(),
  };

  // If room host left or hasn't been seen, promote first active viewer
  if (!room.viewers[room.hostId]) {
    room.hostId = viewer.id;
    room.viewers[viewer.id].isHost = true;
  }

  return room;
}

export function loadNewVideo(roomId: string, video: PlaylistItem, requestedBy: string): RoomData | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.currentVideo = video;
  room.playback = {
    isPlaying: true,
    currentTime: 0,
    playbackRate: 1,
    updatedAt: Date.now(),
    lastActionBy: requestedBy,
    action: 'load',
  };

  addRoomChat(roomId, {
    senderId: 'system',
    senderName: 'System',
    avatarColor: '#8b5cf6',
    text: `${requestedBy} loaded "${video.title}"`,
    isSystem: true,
  });

  return room;
}

export function autoAdvanceQueue(roomId: string): RoomData | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  if (room.queue.length > 0) {
    const nextVideo = room.queue.shift()!;
    return loadNewVideo(roomId, nextVideo, 'Auto-Queue');
  }

  return room;
}
