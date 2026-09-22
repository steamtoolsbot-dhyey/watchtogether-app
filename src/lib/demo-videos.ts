import { PlaylistItem } from './types';

export const DEMO_VIDEOS: PlaylistItem[] = [
  {
    id: 'demo-1',
    url: 'https://www.youtube.com/watch?v=Way9Dexny3w',
    title: 'Dune: Part Two — Official Trailer 3',
    type: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/Way9Dexny3w/hqdefault.jpg',
    duration: 174,
    addedBy: 'Charon System',
  },
  {
    id: 'demo-2',
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk',
    title: 'lofi hip hop radio - beats to relax/study to 🔴',
    type: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/jfKfPfyJRdk/hqdefault.jpg',
    duration: 0, // Live stream
    addedBy: 'Charon System',
  },
  {
    id: 'demo-3',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    title: 'Big Buck Bunny (Direct 4K MP4)',
    type: 'direct',
    thumbnail: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&auto=format&fit=crop&q=80',
    duration: 596,
    addedBy: 'Charon System',
  },
  {
    id: 'demo-4',
    url: 'https://www.youtube.com/watch?v=JtqIas3bYhg',
    title: 'Cyberpunk: Edgerunners — Official Opening',
    type: 'youtube',
    thumbnail: 'https://img.youtube.com/vi/JtqIas3bYhg/hqdefault.jpg',
    duration: 90,
    addedBy: 'Charon System',
  },
  {
    id: 'demo-5',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    title: 'Tears of Steel (Sci-Fi VFX Short)',
    type: 'direct',
    thumbnail: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=600&auto=format&fit=crop&q=80',
    duration: 734,
    addedBy: 'Charon System',
  },
];

export interface ParsedVideoResult {
  type?: 'youtube' | 'direct' | 'twitch';
  videoId?: string;
  cleanUrl?: string;
  error?: string;
}

export function parseVideoUrl(input: string): ParsedVideoResult | null {
  const url = input.trim();
  if (!url) return null;

  // STRICT ANTI-TORRENT & PROTOCOL ENFORCEMENT
  // Block any magnet links, .torrent files, or P2P swarm trackers
  const lower = url.toLowerCase();
  if (
    lower.startsWith('magnet:') ||
    lower.startsWith('torrent:') ||
    lower.startsWith('webtorrent:') ||
    lower.startsWith('ed2k:') ||
    lower.includes('.torrent') ||
    lower.includes('xt=urn:btih:') ||
    lower.includes('btih:') ||
    lower.includes('announce') ||
    lower.includes('peer_id=') ||
    lower.includes('info_hash=') ||
    lower.includes('scrape') ||
    lower.includes('tracker')
  ) {
    return {
      error: 'Torrent protocols, P2P magnet swarms, and torrent trackers are 100% prohibited on this platform. Please use direct HTTPS video streams, YouTube, or Twitch.',
    };
  }

  // Strictly require standard http/https web protocols
  if (!lower.startsWith('https://') && !lower.startsWith('http://')) {
    return {
      error: 'Invalid protocol. Only secure HTTPS/HTTP video streams or YouTube/Twitch are permitted.',
    };
  }

  // 1. YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube',
      videoId: ytMatch[1],
      cleanUrl: `https://www.youtube.com/watch?v=${ytMatch[1]}`,
    };
  }

  // 2. Twitch
  const twitchMatch = url.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
  if (twitchMatch && twitchMatch[1]) {
    return {
      type: 'twitch',
      videoId: twitchMatch[1],
      cleanUrl: `https://twitch.tv/${twitchMatch[1]}`,
    };
  }

  // 3. Direct Video file (.mp4, .webm, .ogg, .m3u8) or direct HTTPS CDN stream
  if (
    url.match(/\.(mp4|webm|ogg|m3u8)($|\?)/i) ||
    url.startsWith('https://') ||
    url.startsWith('http://')
  ) {
    return {
      type: 'direct',
      cleanUrl: url,
    };
  }

  return null;
}
