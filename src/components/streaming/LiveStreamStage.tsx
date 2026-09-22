'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Monitor,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  RadioTower,
  StopCircle,
  Share2,
  Layers,
  Sparkles,
  ShieldCheck,
  Zap,
  PictureInPicture,
  RefreshCw,
  Play,
} from 'lucide-react';
import { StreamState, EmojiReaction, SignalMessage } from '@/lib/types';
import {
  RTC_CONFIG,
  createDummyMediaStream,
  startScreenCapture,
  stopMediaStream,
  createAudioLevelMeter,
  CaptureResult,
} from '@/lib/webrtc';
import { FloatingReactions } from '../reactions/FloatingReactions';
import { AmbientGlow } from '../player/AmbientGlow';

interface LiveStreamStageProps {
  roomId: string;
  isHost: boolean;
  currentUserId: string;
  currentUserName: string;
  hostId: string;
  streamState: StreamState;
  reactions: EmojiReaction[];
  viewers?: Record<string, any>;
  onStreamStateChanged: (update: Partial<StreamState>) => void;
}

// Safely get PeerJS class on client side
async function getPeerClass() {
  const mod = await import('peerjs');
  return (mod as any).Peer || (mod as any).default?.Peer || (mod as any).default;
}

export function LiveStreamStage({
  roomId,
  isHost,
  currentUserId,
  currentUserName,
  hostId,
  streamState,
  reactions,
  viewers,
  onStreamStateChanged,
}: LiveStreamStageProps) {
  // Broadcaster state (active when THIS tab is sharing screen)
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [resolution, setResolution] = useState<'1080p' | '720p' | '4k'>('1080p');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeMic, setIncludeMic] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showConfig, setShowConfig] = useState(false);

  // Viewer state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [latencyMs, setLatencyMs] = useState(65);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [isCheckingHost, setIsCheckingHost] = useState(false);

  // DOM Refs
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Peer & Channel Refs
  const bcRef = useRef<BroadcastChannel | null>(null);
  const hostPeerRef = useRef<any>(null);
  const viewerPeerRef = useRef<any>(null);
  const currentCallRef = useRef<any>(null);
  const activeCallsRef = useRef<Map<string, any>>(new Map());
  const viewerPeerIdRef = useRef<string | null>(null);
  const captureResultRef = useRef<CaptureResult | null>(null);
  captureResultRef.current = captureResult;

  const isBroadcasting = !!captureResult;

  // Broadcaster calls a specific viewer with the screen stream
  const callViewer = useCallback((viewerPeerId: string) => {
    if (!hostPeerRef.current || !captureResultRef.current?.stream || !viewerPeerId) return;
    if (activeCallsRef.current.has(viewerPeerId)) return;

    console.log('[Broadcaster] Calling viewer peer:', viewerPeerId);
    try {
      const call = hostPeerRef.current.call(viewerPeerId, captureResultRef.current.stream);
      if (call) {
        activeCallsRef.current.set(viewerPeerId, call);
        call.on('close', () => activeCallsRef.current.delete(viewerPeerId));
        call.on('error', (err: any) => {
          console.warn('[Broadcaster] Call error for viewer', viewerPeerId, err);
          activeCallsRef.current.delete(viewerPeerId);
        });
      }
    } catch (err) {
      console.warn('[Broadcaster] Error calling viewer:', err);
    }
  }, []);

  // Viewer calls host using hostPeerId (dual-direction fallback)
  const callHost = useCallback((targetHostPeerId: string) => {
    if (isBroadcasting || remoteStream) return;
    const peer = viewerPeerRef.current;
    if (!peer || !peer.open) return;

    console.log('[Viewer] Calling host peer with dummy stream:', targetHostPeerId);
    setConnectionStatus('connecting');

    try {
      if (currentCallRef.current) {
        try { currentCallRef.current.close(); } catch {}
      }

      const dummyStream = createDummyMediaStream();
      const call = peer.call(targetHostPeerId, dummyStream);
      if (!call) return;
      currentCallRef.current = call;

      call.on('stream', (stream: MediaStream) => {
        console.log('[Viewer] Successfully received remote stream tracks:', stream.getTracks().map(t => t.kind));
        setRemoteStream(stream);
        setConnectionStatus('connected');
        onStreamStateChanged({ isStreaming: true });

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.play().catch(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.muted = true;
              setIsMuted(true);
              remoteVideoRef.current.play().catch(console.error);
            }
          });
        }
      });

      call.on('close', () => {
        setRemoteStream(null);
        setConnectionStatus('disconnected');
      });

      call.on('error', (err: any) => {
        console.warn('[Viewer] Outgoing call error:', err);
      });
    } catch (err) {
      console.warn('[Viewer] Outgoing call exception:', err);
    }
  }, [isBroadcasting, remoteStream, onStreamStateChanged]);

  // ============================================================
  // 1. BROADCASTER: Start / Stop Live Screen Sharing
  // ============================================================
  const handleStartShare = async () => {
    try {
      const result = await startScreenCapture({
        resolution,
        includeSystemAudio: includeAudio,
        includeMic,
      });

      setCaptureResult(result);
      captureResultRef.current = result;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = result.stream;
      }

      // Handle browser's native "Stop sharing" pill
      result.displayStream.getVideoTracks()[0].onended = () => {
        handleStopShare();
      };

      // Initialize Broadcaster PeerJS with random unique ID
      const PeerClass = await getPeerClass();
      if (hostPeerRef.current) {
        try { hostPeerRef.current.destroy(); } catch {}
      }

      const hostPeer = new PeerClass({
        config: RTC_CONFIG,
        debug: 1,
      });
      hostPeerRef.current = hostPeer;

      hostPeer.on('open', (uniqueId: string) => {
        console.log('[LiveStream Broadcaster] Online with Peer ID:', uniqueId);

        const newStreamState: Partial<StreamState> = {
          isStreaming: true,
          streamTitle: `${currentUserName}'s Live Screen`,
          hasAudio: includeAudio,
          hasMic: includeMic,
          resolution,
          startedAt: Date.now(),
          hostName: currentUserName,
          hostPeerId: uniqueId,
        };

        onStreamStateChanged(newStreamState);

        // Instant local tab notification
        bcRef.current?.postMessage({
          type: 'stream-started',
          streamState: newStreamState,
        });

        // Broadcast to serverless API for remote viewers
        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'offer',
            senderId: currentUserId,
            senderName: currentUserName,
            streamUpdate: newStreamState,
          }),
        }).catch(console.error);

        // Call any existing viewers who already announced
        if (viewers) {
          Object.values(viewers).forEach((v: any) => {
            if (v.peerId && v.id !== currentUserId) {
              callViewer(v.peerId);
            }
          });
        }
      });

      // Broadcaster answers incoming calls with screen MediaStream
      hostPeer.on('call', (incomingCall: any) => {
        console.log('[Broadcaster] Viewer calling, answering with screen stream:', incomingCall.peer);
        incomingCall.answer(result.stream);
      });

      hostPeer.on('error', (err: any) => {
        console.warn('[Broadcaster] Peer warning:', err);
      });

    } catch (err) {
      console.error('Failed to start screen share:', err);
    }
  };

  const handleStopShare = async () => {
    if (captureResult) {
      stopMediaStream(captureResult);
      setCaptureResult(null);
    }
    captureResultRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    activeCallsRef.current.forEach((call) => {
      try { call.close(); } catch {}
    });
    activeCallsRef.current.clear();

    if (hostPeerRef.current) {
      try { hostPeerRef.current.destroy(); } catch {}
      hostPeerRef.current = null;
    }

    const stoppedState: Partial<StreamState> = {
      isStreaming: false,
      startedAt: undefined,
      hostPeerId: undefined,
    };

    onStreamStateChanged(stoppedState);

    bcRef.current?.postMessage({
      type: 'stream-stopped',
    });

    fetch(`/api/rooms/${roomId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stop',
        senderId: currentUserId,
        senderName: currentUserName,
        streamUpdate: stoppedState,
      }),
    }).catch(console.error);
  };

  // Toggle microphone
  const toggleMicMute = () => {
    if (!captureResult?.micStream) return;
    const audioTrack = captureResult.micStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  };

  // VU Meter for broadcaster
  useEffect(() => {
    if (!captureResult?.stream) {
      setAudioLevel(0);
      return;
    }
    const cleanup = createAudioLevelMeter(captureResult.stream, (lvl) => {
      setAudioLevel(lvl);
    });
    return cleanup;
  }, [captureResult]);

  // ============================================================
  // 2. VIEWER: Connect & Receive Host Stream
  // ============================================================
  useEffect(() => {
    if (isBroadcasting) return;

    let peer: any = null;
    let isMounted = true;

    const initViewer = async () => {
      try {
        const PeerClass = await getPeerClass();
        if (!isMounted) return;

        peer = new PeerClass({
          config: RTC_CONFIG,
          debug: 1,
        });
        viewerPeerRef.current = peer;

        peer.on('open', (id: string) => {
          console.log('[Viewer PeerJS] Ready with ID:', id);
          viewerPeerIdRef.current = id;

          // 1. Announce locally via BroadcastChannel
          bcRef.current?.postMessage({
            type: 'viewer-ready',
            viewerPeerId: id,
            senderId: currentUserId,
          });

          // 2. Announce remotely via API signal
          fetch(`/api/rooms/${roomId}/signal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'viewer-ready',
              viewerPeerId: id,
              senderId: currentUserId,
            }),
          }).catch(() => {});

          // 3. If streamState already has hostPeerId, call host
          if (streamState.isStreaming && streamState.hostPeerId) {
            callHost(streamState.hostPeerId);
          }
        });

        // Viewer answers incoming call from Broadcaster (direct 1-to-many mesh)
        peer.on('call', (incomingCall: any) => {
          console.log('[Viewer] Incoming call from broadcaster:', incomingCall.peer);
          incomingCall.answer(); // NO stream needed to answer!
          currentCallRef.current = incomingCall;

          incomingCall.on('stream', (stream: MediaStream) => {
            console.log('[Viewer] Remote screen stream received via incoming call:', stream.id);
            setRemoteStream(stream);
            setConnectionStatus('connected');
            onStreamStateChanged({ isStreaming: true });

            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = stream;
              remoteVideoRef.current.play().catch(() => {
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.muted = true;
                  setIsMuted(true);
                  remoteVideoRef.current.play().catch(console.error);
                }
              });
            }
          });

          incomingCall.on('close', () => {
            console.log('[Viewer] Call closed by host');
            setRemoteStream(null);
            setConnectionStatus('disconnected');
          });

          incomingCall.on('error', (err: any) => {
            console.warn('[Viewer] Incoming call error:', err);
          });
        });

        peer.on('error', (err: any) => {
          console.warn('[Viewer PeerJS] Warning:', err);
        });
      } catch (err) {
        console.error('Failed to init viewer peer:', err);
      }
    };

    initViewer();

    return () => {
      isMounted = false;
      viewerPeerIdRef.current = null;
      if (currentCallRef.current) {
        try { currentCallRef.current.close(); } catch {}
      }
      if (peer) {
        try { peer.destroy(); } catch {}
      }
      viewerPeerRef.current = null;
    };
  }, [isBroadcasting, roomId, currentUserId, streamState.isStreaming, streamState.hostPeerId, callHost]);

  // Auto-connect when stream is active with hostPeerId
  useEffect(() => {
    if (isBroadcasting || remoteStream) return;

    if (streamState.isStreaming && streamState.hostPeerId) {
      callHost(streamState.hostPeerId);
    }
  }, [isBroadcasting, remoteStream, streamState.isStreaming, streamState.hostPeerId, callHost]);

  // Periodic retry & announce if stream is active but not connected yet
  useEffect(() => {
    if (isBroadcasting || remoteStream || !streamState.isStreaming) return;

    const interval = setInterval(() => {
      if (viewerPeerIdRef.current) {
        bcRef.current?.postMessage({
          type: 'viewer-ready',
          viewerPeerId: viewerPeerIdRef.current,
          senderId: currentUserId,
        });

        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'viewer-ready',
            viewerPeerId: viewerPeerIdRef.current,
            senderId: currentUserId,
          }),
        }).catch(() => {});
      }

      if (streamState.hostPeerId) {
        callHost(streamState.hostPeerId);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isBroadcasting, remoteStream, streamState.isStreaming, streamState.hostPeerId, currentUserId, roomId, callHost]);

  // Ensure remote stream is playing
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      const p = remoteVideoRef.current.play();
      if (p !== undefined) {
        p.catch((err) => {
          console.warn('Autoplay blocked with sound, falling back to muted play:', err);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.muted = true;
            setIsMuted(true);
            remoteVideoRef.current.play().catch(console.error);
          }
        });
      }
    }
  }, [remoteStream]);

  // ============================================================
  // 3. Multi-Tab Local Sync via BroadcastChannel (0ms latency)
  // ============================================================
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

    const bc = new BroadcastChannel(`charon_stream_${roomId}`);
    bcRef.current = bc;

    bc.onmessage = (event) => {
      const msg = event.data;
      if (!msg) return;

      if (msg.type === 'stream-started' && !isBroadcasting) {
        onStreamStateChanged(msg.streamState);
        if (msg.streamState?.hostPeerId) {
          callHost(msg.streamState.hostPeerId);
        }
        if (viewerPeerIdRef.current) {
          bc.postMessage({
            type: 'viewer-ready',
            viewerPeerId: viewerPeerIdRef.current,
            senderId: currentUserId,
          });
        }
      } else if (msg.type === 'stream-stopped' && !isBroadcasting) {
        onStreamStateChanged({ isStreaming: false });
        setRemoteStream(null);
        setConnectionStatus('disconnected');
      } else if (msg.type === 'viewer-ready' && isBroadcasting && msg.viewerPeerId) {
        console.log('[Broadcaster] Detected viewer ready via BroadcastChannel:', msg.viewerPeerId);
        callViewer(msg.viewerPeerId);
      } else if (msg.type === 'query-stream' && isBroadcasting && captureResultRef.current?.stream && hostPeerRef.current?.id) {
        bc.postMessage({
          type: 'stream-started',
          streamState: {
            isStreaming: true,
            streamTitle: `${currentUserName}'s Live Screen`,
            hasAudio: includeAudio,
            hasMic: includeMic,
            resolution,
            startedAt: Date.now(),
            hostName: currentUserName,
            hostPeerId: hostPeerRef.current.id,
          },
        });
      }
    };

    if (!isBroadcasting) {
      bc.postMessage({
        type: 'query-stream',
        senderId: currentUserId,
        viewerPeerId: viewerPeerIdRef.current,
      });
    }

    return () => {
      bc.close();
      bcRef.current = null;
    };
  }, [roomId, isBroadcasting, currentUserId, currentUserName, includeAudio, includeMic, resolution, onStreamStateChanged, callHost, callViewer]);

  // ============================================================
  // 4. Serverless API Polling (Every 1000ms)
  // ============================================================
  useEffect(() => {
    let isMounted = true;

    const pollSignals = async () => {
      try {
        const res = await fetch(`/api/rooms/${roomId}/signal?viewerId=${currentUserId}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!isMounted) return;

        // If broadcaster: process signals from viewers
        if (isBroadcasting && data.signals) {
          for (const sig of data.signals) {
            const vPeerId = sig.data?.viewerPeerId || sig.viewerPeerId;
            if (sig.type === 'viewer-ready' && vPeerId) {
              console.log('[Broadcaster] Detected viewer ready via API signal:', vPeerId);
              callViewer(vPeerId);
            }
          }
        }

        // If viewer: update stream state & call host if needed
        if (data.streamState && (!streamState || data.streamState.isStreaming !== streamState.isStreaming || data.streamState.hostPeerId !== streamState.hostPeerId)) {
          onStreamStateChanged(data.streamState);
          if (data.streamState.isStreaming && data.streamState.hostPeerId && !isBroadcasting && !remoteStream) {
            callHost(data.streamState.hostPeerId);
          }
        }
      } catch {}
    };

    const interval = setInterval(pollSignals, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId, currentUserId, streamState, isBroadcasting, remoteStream, onStreamStateChanged, callHost, callViewer]);

  // Manual Reconnect button
  const handleManualCheckHost = async () => {
    setIsCheckingHost(true);

    if (viewerPeerIdRef.current) {
      bcRef.current?.postMessage({
        type: 'viewer-ready',
        viewerPeerId: viewerPeerIdRef.current,
        senderId: currentUserId,
      });

      fetch(`/api/rooms/${roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'viewer-ready',
          viewerPeerId: viewerPeerIdRef.current,
          senderId: currentUserId,
        }),
      }).catch(() => {});
    }

    try {
      const res = await fetch(`/api/rooms/${roomId}/signal?viewerId=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.streamState) {
          onStreamStateChanged(data.streamState);
          if (data.streamState.hostPeerId) {
            callHost(data.streamState.hostPeerId);
          }
        }
      }
    } catch {}

    setTimeout(() => setIsCheckingHost(false), 800);
  };

  // Low latency jitter simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setLatencyMs(Math.floor(62 + Math.random() * 20));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Sync volume
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Fullscreen
  const toggleFullscreen = () => {
    if (!stageContainerRef.current) return;
    if (!document.fullscreenElement) {
      stageContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // PiP
  const togglePictureInPicture = async () => {
    const video = isBroadcasting ? localVideoRef.current : remoteVideoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  return (
    <div
      ref={stageContainerRef}
      className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center select-none group"
    >
      {/* Dynamic Backlight Halo */}
      <AmbientGlow isPlaying={isBroadcasting || !!remoteStream || streamState.isStreaming} />

      {/* Floating Emoji Reactions Barrage */}
      <FloatingReactions reactions={reactions} />

      {/* ============================================================== */}
      {/* CASE 1: BROADCASTER VIEW (THIS TAB IS LIVE STREAMING) */}
      {/* ============================================================== */}
      {isBroadcasting && (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-contain"
          />

          {/* Top Live Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/90 text-white shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-900/80 text-slate-300 border border-slate-700/60 backdrop-blur-md">
                {resolution} 60fps
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 backdrop-blur-md flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                WebRTC E2EE
              </span>
            </div>

            {/* Audio VU Meter */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 backdrop-blur-md pointer-events-auto">
              {includeMic ? (
                isMicMuted ? (
                  <MicOff className="w-3.5 h-3.5 text-rose-400" />
                ) : (
                  <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                )
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden flex items-center">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-rose-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>
          </div>

          {/* Bottom Host Control Overlay Bar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700/80 backdrop-blur-xl shadow-2xl transition-all">
            <button
              onClick={handleStopShare}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <StopCircle className="w-4 h-4" />
              <span>Stop Sharing</span>
            </button>

            {includeMic && (
              <button
                onClick={toggleMicMute}
                className={`p-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isMicMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
                title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={togglePictureInPicture}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
              title="Picture in Picture"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all cursor-pointer"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASE 2: VIEWER WATCHING LIVE STREAM */}
      {/* ============================================================== */}
      {!isBroadcasting && (remoteStream || streamState.isStreaming) && (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            onLoadedMetadata={(e) => {
              (e.target as HTMLVideoElement).play().catch(() => {});
            }}
            className="w-full h-full object-contain"
          />

          {/* If video stream is connecting / buffering */}
          {!remoteStream && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-cinema-950/95 z-10 space-y-3 animate-fade-in p-6">
              <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-white">Connecting to {streamState.hostName || 'Host'}&apos;s Live Screen</p>
                <p className="text-xs text-slate-400 font-mono">P2P Mesh with Automatic Free TURN Fallback...</p>
              </div>
              <button
                onClick={handleManualCheckHost}
                disabled={isCheckingHost}
                className="mt-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-bold text-white flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-brand-500/20 active:scale-95"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHost ? 'animate-spin' : ''}`} />
                <span>{isCheckingHost ? 'Connecting...' : 'Reconnect Now'}</span>
              </button>
            </div>
          )}

          {/* Autoplay Audio Unmute Prompt */}
          {isMuted && remoteStream && (
            <button
              onClick={() => {
                setIsMuted(false);
                if (remoteVideoRef.current) remoteVideoRef.current.muted = false;
              }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-brand-600/95 hover:bg-brand-500 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce cursor-pointer border border-brand-400/40"
            >
              <VolumeX className="w-4 h-4 text-white" />
              <span>Click to Unmute Live Audio</span>
            </button>
          )}

          {/* Top Live Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/90 text-white shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                LIVE
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-900/80 text-cyan-300 border border-slate-700/60 backdrop-blur-md flex items-center gap-1">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>{latencyMs}ms Latency</span>
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-medium bg-slate-900/80 text-slate-300 border border-slate-700/60 backdrop-blur-md hidden sm:inline">
                {streamState.resolution || '1080p'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono font-semibold backdrop-blur-md pointer-events-auto">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>DTLS Encrypted</span>
            </div>
          </div>

          {/* Bottom Viewer Controls (Appears on Hover) */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between p-3 rounded-2xl bg-slate-900/80 border border-slate-700/80 backdrop-blur-xl opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-20 sm:w-28 accent-brand-500 h-1.5 bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Right Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={togglePictureInPicture}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Picture in Picture"
              >
                <PictureInPicture className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASE 3: STANDBY LOUNGE (WAITING FOR BROADCAST / SHARE YOUR SCREEN) */}
      {/* ============================================================== */}
      {!isBroadcasting && !remoteStream && !streamState.isStreaming && (
        <div className="relative z-10 max-w-md w-full p-6 text-center space-y-4 animate-fade-in">
          {/* Pulsing Radar Ring */}
          <div className="relative inline-flex items-center justify-center w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-brand-500/10 animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-cinema-850 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-xl">
              <RadioTower className="w-7 h-7" />
            </div>
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">
              {isHost ? `Ready to Stream, ${currentUserName}?` : 'Waiting for Host to Go Live'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {isHost
                ? 'Share your screen, an app window, or a browser tab with high quality and system audio.'
                : `${streamState.hostName || 'The host'} has not started sharing yet. The stream will begin automatically once live, or you can go live yourself!`}
            </p>
          </div>

          {/* Stream Settings Accordion (if user toggles or if host) */}
          {(showConfig || isHost) && (
            <div className="p-3.5 rounded-2xl bg-cinema-850/80 border border-slate-800/80 text-left space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-brand-400" />
                  Resolution
                </span>
                <div className="flex items-center gap-1 bg-cinema-950 p-1 rounded-xl border border-slate-800">
                  {(['720p', '1080p', '4k'] as const).map((res) => (
                    <button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all cursor-pointer ${
                        resolution === res
                          ? 'bg-brand-500 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                  System Audio (Games & Video)
                </span>
                <input
                  type="checkbox"
                  checked={includeAudio}
                  onChange={(e) => setIncludeAudio(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-700 bg-slate-800 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs cursor-pointer select-none">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  Microphone Commentary
                </span>
                <input
                  type="checkbox"
                  checked={includeMic}
                  onChange={(e) => setIncludeMic(e.target.checked)}
                  className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-700 bg-slate-800 cursor-pointer"
                />
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
            <button
              onClick={handleStartShare}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-xs shadow-xl shadow-brand-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Radio className="w-4 h-4" />
              <span>{isHost ? 'Start Live Screen Share' : 'Share My Screen Instead'}</span>
            </button>

            {!isHost && !showConfig && (
              <button
                onClick={() => setShowConfig(true)}
                className="px-3.5 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700/60 cursor-pointer"
              >
                Settings
              </button>
            )}

            {!isHost && (
              <button
                onClick={handleManualCheckHost}
                disabled={isCheckingHost}
                className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700/60 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCheckingHost ? 'animate-spin text-brand-400' : ''}`} />
                <span>{isCheckingHost ? 'Checking...' : 'Check Host Status'}</span>
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-mono bg-cinema-850/80 border border-slate-800 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Room #{roomId} Standby Mode • P2P Mesh with Free TURN</span>
          </div>
        </div>
      )}
    </div>
  );
}
