import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateRoom, addRoomChat, addRoomReaction } from '@/lib/room-store';

export async function GET(req: NextRequest, { params }: { params: { roomId: string } }) {
  const roomId = params.roomId.toLowerCase();
  const room = getOrCreateRoom(roomId);
  const since = Number(req.nextUrl.searchParams.get('since') || 0);

  const newChat = since ? room.chat.filter((c) => c.timestamp > since) : room.chat;
  const newReactions = since ? room.reactions.filter((r) => r.timestamp > since) : room.reactions;

  return NextResponse.json({
    success: true,
    chat: newChat,
    reactions: newReactions,
  });
}

export async function POST(req: NextRequest, { params }: { params: { roomId: string } }) {
  try {
    const roomId = params.roomId.toLowerCase();
    const body = await req.json();

    if (body.type === 'reaction') {
      const reaction = addRoomReaction(roomId, {
        emoji: body.emoji || '❤️',
        senderName: body.senderName || 'Anonymous',
        xPosition: Math.floor(Math.random() * 80) + 10, // 10% to 90%
      });
      return NextResponse.json({ success: true, reaction });
    }

    // Default chat message
    if (!body.text || !body.text.trim()) {
      return NextResponse.json({ success: false, error: 'Empty message' }, { status: 400 });
    }

    const message = addRoomChat(roomId, {
      senderId: body.senderId || 'anon',
      senderName: body.senderName || 'Anonymous',
      avatarColor: body.avatarColor || '#8b5cf6',
      text: body.text.trim(),
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ success: false, error: 'Failed to post message' }, { status: 500 });
  }
}
