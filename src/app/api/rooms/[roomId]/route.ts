import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRoom, updateRoomViewer } from '@/lib/room-store';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId.toLowerCase();
  const searchParams = req.nextUrl.searchParams;
  const viewerId = searchParams.get('viewerId');
  const viewerName = searchParams.get('viewerName');
  const avatarColor = searchParams.get('avatarColor') || '#8b5cf6';
  const isBuffering = searchParams.get('isBuffering') === 'true';

  const room = getOrCreateRoom(roomId);

  // Record presence heartbeat if viewer parameters provided
  if (viewerId && viewerName) {
    updateRoomViewer(roomId, {
      id: viewerId,
      name: viewerName,
      avatarColor,
      isHost: room.hostId === viewerId,
      isBuffering,
      lastSeen: Date.now(),
    });
  }

  return NextResponse.json({
    success: true,
    room,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const body = await req.json();
    const room = getOrCreateRoom(roomId);

    if (typeof body.hostOnlyControls === 'boolean') {
      room.hostOnlyControls = body.hostOnlyControls;
    }
    if (body.name && typeof body.name === 'string') {
      room.name = body.name.trim();
    }
    if (body.newHostId && room.viewers[body.newHostId]) {
      room.hostId = body.newHostId;
      for (const v of Object.values(room.viewers)) {
        v.isHost = v.id === body.newHostId;
      }
    }

    return NextResponse.json({
      success: true,
      room,
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to update room' }, { status: 500 });
  }
}
