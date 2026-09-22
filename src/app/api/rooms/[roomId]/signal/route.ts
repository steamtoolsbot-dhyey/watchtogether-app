import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRoom, addRoomSignal, getRoomSignals, updateRoomStreamState, addRoomChat } from '@/lib/room-store';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const searchParams = req.nextUrl.searchParams;
    const viewerId = searchParams.get('viewerId');
    const since = searchParams.get('since') ? parseInt(searchParams.get('since')!, 10) : undefined;

    const room = getOrCreateRoom(roomId);

    if (!viewerId) {
      return NextResponse.json({ success: false, error: 'viewerId is required' }, { status: 400 });
    }

    const signals = getRoomSignals(roomId, viewerId, since);

    return NextResponse.json({
      success: true,
      signals,
      streamState: room.streamState,
      hostId: room.hostId,
    });
  } catch (error) {
    console.error('Signaling GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to retrieve signals' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const body = await req.json();
    const room = getOrCreateRoom(roomId);

    const { type, senderId, targetId, data, streamUpdate, senderName } = body;

    if (!type || !senderId) {
      return NextResponse.json({ success: false, error: 'type and senderId are required' }, { status: 400 });
    }

    // If host updates stream status (start / stop stream)
    if (streamUpdate) {
      updateRoomStreamState(roomId, streamUpdate);

      if (streamUpdate.isStreaming) {
        addRoomChat(roomId, {
          senderId: 'system',
          senderName: 'System',
          avatarColor: '#10b981',
          text: `🔴 ${senderName || 'Host'} started live screen sharing (${streamUpdate.resolution || '1080p'})`,
          isSystem: true,
        });
      } else if (streamUpdate.isStreaming === false) {
        addRoomChat(roomId, {
          senderId: 'system',
          senderName: 'System',
          avatarColor: '#ef4444',
          text: `⏹️ ${senderName || 'Host'} stopped live screen sharing`,
          isSystem: true,
        });
      }
    }

    const signal = addRoomSignal(roomId, {
      type,
      senderId,
      targetId,
      data,
    });

    return NextResponse.json({
      success: true,
      signal,
      streamState: room.streamState,
    });
  } catch (error) {
    console.error('Signaling POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to post signal' }, { status: 500 });
  }
}
