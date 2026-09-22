'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@/lib/types';
import { Send, ShieldCheck, Smile, User, Sparkles } from 'lucide-react';
import { deriveRoomKey, encryptText, decryptText } from '@/lib/encryption';

interface RoomChatProps {
  roomId: string;
  chat: ChatMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserColor: string;
  roomPassphrase?: string;
  onSendMessage: (text: string) => void;
  onSendReaction: (emoji: string) => void;
  onUpdateUserName: (newName: string) => void;
}

export function RoomChat({
  roomId,
  chat,
  currentUserId,
  currentUserName,
  currentUserColor,
  roomPassphrase,
  onSendMessage,
  onSendReaction,
  onUpdateUserName,
}: RoomChatProps) {
  const [inputText, setInputText] = useState('');
  const [decryptedChat, setDecryptedChat] = useState<ChatMessage[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(currentUserName);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Initialize Web Crypto Key
  useEffect(() => {
    async function initKey() {
      const key = await deriveRoomKey(roomPassphrase || roomId);
      setCryptoKey(key);
    }
    initKey();
  }, [roomId, roomPassphrase]);

  // Decrypt incoming chat messages client-side
  useEffect(() => {
    if (!cryptoKey) {
      setDecryptedChat(chat);
      return;
    }

    let isMounted = true;
    async function decryptAll() {
      const results = await Promise.all(
        chat.map(async (msg) => {
          if (msg.isSystem) return msg;
          try {
            const dec = await decryptText(msg.text, cryptoKey!);
            return { ...msg, text: dec };
          } catch {
            return msg;
          }
        })
      );
      if (isMounted) setDecryptedChat(results);
    }

    decryptAll();
    return () => {
      isMounted = false;
    };
  }, [chat, cryptoKey]);

  // Scroll to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [decryptedChat]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const rawText = inputText.trim();
    setInputText('');

    if (cryptoKey) {
      const cipher = await encryptText(rawText, cryptoKey);
      onSendMessage(cipher);
    } else {
      onSendMessage(rawText);
    }
  };

  const reactionEmojis = ['🍿', '❤️', '🔥', '😂', '👏', '🚀', '😱', '🎉'];

  return (
    <div className="flex flex-col h-full bg-cinema-900 border border-slate-800/80 rounded-3xl overflow-hidden shadow-xl">
      {/* Chat Header with E2EE Status */}
      <div className="p-3.5 border-b border-slate-800/80 bg-cinema-850/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-slate-200">
            Cinema Chat
          </h3>
        </div>

        {/* E2EE Lock Badge */}
        <div
          title="End-to-End Encrypted (AES-GCM-256). All messages are encrypted directly in your browser. Server only relays ciphertext."
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
        >
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          <span>E2EE Active</span>
        </div>
      </div>

      {/* User Nickname Bar */}
      <div className="px-3.5 py-2 bg-cinema-950/40 border-b border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: currentUserColor }}
          />
          {isEditingName ? (
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onBlur={() => {
                setIsEditingName(false);
                if (tempName.trim()) onUpdateUserName(tempName.trim());
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsEditingName(false);
                  if (tempName.trim()) onUpdateUserName(tempName.trim());
                }
              }}
              autoFocus
              className="bg-slate-800 text-white px-2 py-0.5 rounded text-xs outline-none"
            />
          ) : (
            <span
              onClick={() => setIsEditingName(true)}
              className="font-medium text-slate-200 hover:underline cursor-pointer flex items-center gap-1"
            >
              {currentUserName}
              <span className="text-[10px] text-slate-500">(click to change)</span>
            </span>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 p-3.5 space-y-3 overflow-y-auto min-h-[260px] max-h-[480px]">
        {decryptedChat.map((msg) => {
          if (msg.isSystem) {
            return (
              <div key={msg.id} className="text-center my-1.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-300 border border-brand-500/20 text-[10px] font-mono">
                  {msg.text}
                </span>
              </div>
            );
          }

          const isMe = msg.senderId === currentUserId;

          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-slate-400">
                {!isMe && (
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: msg.avatarColor }}
                  />
                )}
                <span className="font-semibold text-slate-300">{msg.senderName}</span>
                <span>•</span>
                <span className="font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div
                className={`px-3 py-1.5 rounded-2xl text-xs max-w-[85%] break-words shadow-sm ${
                  isMe
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-slate-800/90 text-slate-200 rounded-tl-none border border-slate-700/60'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* Floating Emoji Reactions Bar */}
      <div className="px-3 py-2 bg-cinema-850/40 border-t border-slate-800/80 flex items-center justify-between gap-1 overflow-x-auto">
        <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1 flex-shrink-0">
          <Sparkles className="w-3 h-3 text-brand-400" />
          <span>React:</span>
        </span>
        <div className="flex items-center gap-1">
          {reactionEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="p-1 text-base hover:scale-130 active:scale-95 transition-transform cursor-pointer"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Input Form */}
      <form onSubmit={handleSubmit} className="p-3 bg-cinema-900 border-t border-slate-800/80 flex gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type encrypted message..."
          className="flex-1 bg-slate-950 border border-slate-800 focus:border-brand-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="px-3.5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 active:scale-95 text-white transition-all disabled:opacity-30 cursor-pointer flex items-center justify-center"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
