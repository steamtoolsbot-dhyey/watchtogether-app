import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRoom, updateRoomPlayback, loadNewVideo, addRoomChat } from '@/lib/room-store';
import { parseVideoUrl } from '@/lib/demo-videos';

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const body = await req.json();
    const room = getOrCreateRoom(roomId);

    const { action, currentTime, isPlaying, playbackRate, lastActionBy, video } = body;

    // Check host-only permission
    if (room.hostOnlyControls && body.senderId && room.hostId !== body.senderId) {
      return NextResponse.json(
        { success: false, error: 'Host-only controls are enabled in this room' },
        { status: 403 }
      );
    }

    if (action === 'load' && video) {
      // 100% Anti-Torrent & Protocol Validation on Backend
      const parsed = parseVideoUrl(video.url || '');
      if (!parsed || parsed.error) {
        return NextResponse.json(
          {
            success: false,
            error: parsed?.error || 'Invalid video URL. Torrent protocols are strictly prohibited.',
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
        lastActionBy || 'Someone'
      );
      return NextResponse.json({ success: true, playback: room.playback });
    }

    // Format human readable time for chat log
    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    let logText = '';
    if (action === 'play') {
      logText = `${lastActionBy || 'Someone'} played at ${formatTime(currentTime || 0)}`;
    } else if (action === 'pause') {
      logText = `${lastActionBy || 'Someone'} paused at ${formatTime(currentTime || 0)}`;
    } else if (action === 'seek') {
      logText = `${lastActionBy || 'Someone'} jumped to ${formatTime(currentTime || 0)}`;
    } else if (action === 'speed') {
      logText = `${lastActionBy || 'Someone'} set speed to ${playbackRate || 1}x`;
    }

    if (logText) {
      addRoomChat(roomId, {
        senderId: 'system',
        senderName: 'System',
        avatarColor: '#8b5cf6',
        text: logText,
        isSystem: true,
      });
    }

    const updated = updateRoomPlayback(roomId, {
      isPlaying: typeof isPlaying === 'boolean' ? isPlaying : room.playback.isPlaying,
      currentTime: typeof currentTime === 'number' ? currentTime : room.playback.currentTime,
      playbackRate: typeof playbackRate === 'number' ? playbackRate : room.playback.playbackRate,
      lastActionBy: lastActionBy || 'User',
      action: action || 'seek',
    });

    return NextResponse.json({
      success: true,
      playback: updated?.playback,
    });
  } catch (error) {
    console.error('Playback sync error:', error);
    return NextResponse.json({ success: false, error: 'Sync failed' }, { status: 500 });
  }
}
