import { NextResponse } from 'next/server';
import { getOrCreateRoom } from '@/lib/room-store';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const roomSlug =
      body.roomSlug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') ||
      `cinema-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`;
    
    const roomName = body.roomName?.trim() || `WatchParty #${roomSlug.slice(-4)}`;
    const hostId = body.hostId || 'host';

    const room = getOrCreateRoom(roomSlug, roomName, hostId);

    return NextResponse.json({
      success: true,
      roomId: room.id,
      room,
    });
  } catch (error) {
    console.error('Failed to create room:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
