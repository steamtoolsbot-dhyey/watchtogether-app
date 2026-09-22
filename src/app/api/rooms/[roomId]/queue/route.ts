import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRoom, autoAdvanceQueue, loadNewVideo } from '@/lib/room-store';
import { PlaylistItem } from '@/lib/types';
import { parseVideoUrl } from '@/lib/demo-videos';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId.toLowerCase();
  const room = getOrCreateRoom(roomId);
  return NextResponse.json({
    success: true,
    currentVideo: room.currentVideo,
    queue: room.queue,
  });
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const body = await req.json();
    const room = getOrCreateRoom(roomId);

    const { action, video, videoId, requestedBy } = body;

    if (action === 'add' && video) {
      // 100% Anti-Torrent & Protocol Validation on Backend
      const parsed = parseVideoUrl(video.url || '');
      if (!parsed || parsed.error) {
        return NextResponse.json(
          {
            success: false,
            error: parsed?.error || 'Invalid video URL. Only YouTube, Twitch, and direct HTTPS streams are supported.',
          },
          { status: 400 }
        );
      }

      const newItem: PlaylistItem = {
        ...video,
        url: parsed.cleanUrl || video.url,
        type: parsed.type || video.type || 'direct',
        id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        addedBy: requestedBy || 'Viewer',
      };
      room.queue.push(newItem);
      return NextResponse.json({ success: true, queue: room.queue });
    }

    if (action === 'remove' && videoId) {
      room.queue = room.queue.filter((v) => v.id !== videoId);
      return NextResponse.json({ success: true, queue: room.queue });
    }

    if (action === 'playNow' && video) {
      // 100% Anti-Torrent & Protocol Validation on Backend
      const parsed = parseVideoUrl(video.url || '');
      if (!parsed || parsed.error) {
        return NextResponse.json(
          {
            success: false,
            error: parsed?.error || 'Invalid video URL. Only YouTube, Twitch, and direct HTTPS streams are supported.',
          },
          { status: 400 }
        );
      }

      loadNewVideo(
        roomId,
        {
          ...video,
          url: parsed.cleanUrl || video.url,
          type: parsed.type || video.type || 'direct',
        },
        requestedBy || 'User'
      );
      return NextResponse.json({ success: true, currentVideo: room.currentVideo, queue: room.queue });
    }

    if (action === 'next') {
      autoAdvanceQueue(roomId);
      return NextResponse.json({ success: true, currentVideo: room.currentVideo, queue: room.queue });
    }

    return NextResponse.json({ success: false, error: 'Invalid queue action' }, { status: 400 });
  } catch (error) {
    console.error('Queue action error:', error);
    return NextResponse.json({ success: false, error: 'Queue action failed' }, { status: 500 });
  }
}
