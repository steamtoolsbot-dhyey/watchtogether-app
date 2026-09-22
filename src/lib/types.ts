export type VideoSourceType = 'youtube' | 'direct' | 'twitch';

export interface PlaylistItem {
  id: string;
  url: string;
  title: string;
  type: VideoSourceType;
  thumbnail?: string;
  duration?: number;
  addedBy: string;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  playbackRate: number;
  updatedAt: number; // Server timestamp (ms)
  lastActionBy: string;
  action: 'play' | 'pause' | 'seek' | 'load' | 'speed';
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  avatarColor: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface EmojiReaction {
  id: string;
  emoji: string;
  senderName: string;
  xPosition: number; // Percentage 10-90%
  timestamp: number;
}

export interface RoomViewer {
  id: string;
  name: string;
  avatarColor: string;
  isHost: boolean;
  isBuffering: boolean;
  lastSeen: number;
}

export interface RoomData {
  id: string;
  name: string;
  createdAt: number;
  hostId: string;
  hostOnlyControls: boolean;
  currentVideo: PlaylistItem | null;
  playback: PlaybackState;
  queue: PlaylistItem[];
  chat: ChatMessage[];
  reactions: EmojiReaction[];
  viewers: Record<string, RoomViewer>;
}
