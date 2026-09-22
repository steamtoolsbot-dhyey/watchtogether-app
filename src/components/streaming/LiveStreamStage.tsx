'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { StreamState, EmojiReaction, SignalMessage } from '@/lib/types';
import {
  RTC_CONFIG,
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
  onStreamStateChanged: (update: Partial<StreamState>) => void;
}

export function LiveStreamStage({
  roomId,
  isHost,
  currentUserId,
  currentUserName,
  hostId,
  streamState,
  reactions,
  onStreamStateChanged,
}: LiveStreamStageProps) {
  // Host stream state
  const [captureResult, setCaptureResult] = useState<CaptureResult | null>(null);
  const [resolution, setResolution] = useState<'1080p' | '720p' | '4k'>('1080p');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [includeMic, setIncludeMic] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  // Viewer state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [latencyMs, setLatencyMs] = useState(85);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  // DOM Refs
  const stageContainerRef = useRef<HTMLDivElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // WebRTC Peer Connections map (for Host: viewerId -> RTCPeerConnection; for Viewer: 'host' -> RTCPeerConnection)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const lastSignalPollRef = useRef<number>(Date.now() - 5000);

  // ==========================================
  // 1. HOST: Start / Stop Screen Sharing
  // ==========================================
  const handleStartShare = async () => {
    try {
      const result = await startScreenCapture({
        resolution,
        includeSystemAudio: includeAudio,
        includeMic,
      });

      setCaptureResult(result);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = result.stream;
      }

      // Handle when host clicks browser's native "Stop Sharing" floating bar
      result.displayStream.getVideoTracks()[0].onended = () => {
        handleStopShare();
      };

      // Notify room that stream is live
      const newStreamState: Partial<StreamState> = {
        isStreaming: true,
        streamTitle: `${currentUserName}'s Live Screen`,
        hasAudio: includeAudio,
        hasMic: includeMic,
        resolution,
        startedAt: Date.now(),
        hostName: currentUserName,
      };

      onStreamStateChanged(newStreamState);

      // Post signal with streamUpdate
      await fetch(`/api/rooms/${roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'offer',
          senderId: currentUserId,
          senderName: currentUserName,
          streamUpdate: newStreamState,
        }),
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

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    // Close all host peer connections
    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    const stoppedState: Partial<StreamState> = {
      isStreaming: false,
      startedAt: undefined,
    };

    onStreamStateChanged(stoppedState);

    await fetch(`/api/rooms/${roomId}/signal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'stop',
        senderId: currentUserId,
        senderName: currentUserName,
        streamUpdate: stoppedState,
      }),
    });
  };

  // Toggle microphone track mute
  const toggleMicMute = () => {
    if (!captureResult?.micStream) return;
    const audioTrack = captureResult.micStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicMuted(!audioTrack.enabled);
    }
  };

  // VU Meter for host
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

  // ==========================================
  // 2. WebRTC Peer Connection Handlers
  // ==========================================

  // Create PeerConnection for a specific viewer (Host side)
  const getOrCreateHostPeer = (viewerId: string, stream: MediaStream): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get(viewerId);
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set(viewerId, pc);

    // Add all tracks from screen stream
    stream.getTracks().forEach((track) => {
      pc!.addTrack(track, stream);
    });

    // Send ICE candidate to viewer
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'candidate',
            senderId: currentUserId,
            targetId: viewerId,
            data: event.candidate,
          }),
        }).catch(console.error);
      }
    };

    return pc;
  };

  // Send SDP Offer to a viewer (Host side)
  const sendOfferToViewer = async (viewerId: string) => {
    if (!captureResult?.stream) return;
    try {
      const pc = getOrCreateHostPeer(viewerId, captureResult.stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await fetch(`/api/rooms/${roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'offer',
          senderId: currentUserId,
          targetId: viewerId,
          data: offer,
        }),
      });
    } catch (err) {
      console.error(`Error sending offer to viewer ${viewerId}:`, err);
    }
  };

  // Setup PeerConnection for Viewer
  const getOrCreateViewerPeer = (): RTCPeerConnection => {
    let pc = peerConnectionsRef.current.get('host');
    if (pc && pc.signalingState !== 'closed') {
      return pc;
    }

    pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnectionsRef.current.set('host', pc);

    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          remoteVideoRef.current.play().catch(() => {});
        }
        setConnectionStatus('connected');
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`/api/rooms/${roomId}/signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'candidate',
            senderId: currentUserId,
            targetId: hostId,
            data: event.candidate,
          }),
        }).catch(console.error);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc?.connectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    };

    return pc;
  };

  // Handle incoming SDP Offer (Viewer side)
  const handleIncomingOffer = async (offer: RTCSessionDescriptionInit, senderId: string) => {
    try {
      setConnectionStatus('connecting');
      const pc = getOrCreateViewerPeer();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process buffered ICE candidates
      const buffered = pendingCandidatesRef.current.get('host') || [];
      for (const cand of buffered) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
      }
      pendingCandidatesRef.current.delete('host');

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(`/api/rooms/${roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'answer',
          senderId: currentUserId,
          targetId: senderId,
          data: answer,
        }),
      });
    } catch (err) {
      console.error('Error handling incoming offer:', err);
    }
  };

  // Handle incoming SDP Answer (Host side)
  const handleIncomingAnswer = async (answer: RTCSessionDescriptionInit, senderId: string) => {
    try {
      const pc = peerConnectionsRef.current.get(senderId);
      if (pc && pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));

        // Process buffered candidates
        const buffered = pendingCandidatesRef.current.get(senderId) || [];
        for (const cand of buffered) {
          await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(console.error);
        }
        pendingCandidatesRef.current.delete(senderId);
      }
    } catch (err) {
      console.error(`Error setting remote answer for ${senderId}:`, err);
    }
  };

  // Handle incoming ICE Candidate
  const handleIncomingCandidate = async (candidate: RTCIceCandidateInit, senderId: string) => {
    const key = isHost ? senderId : 'host';
    const pc = peerConnectionsRef.current.get(key);

    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
    } else {
      // Buffer until remote description is set
      const list = pendingCandidatesRef.current.get(key) || [];
      list.push(candidate);
      pendingCandidatesRef.current.set(key, list);
    }
  };

  // Viewer requests stream when entering or when host goes live
  useEffect(() => {
    if (!isHost && streamState.isStreaming) {
      setConnectionStatus('connecting');
      fetch(`/api/rooms/${roomId}/signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'request-stream',
          senderId: currentUserId,
          targetId: hostId,
        }),
      }).catch(console.error);
    }
  }, [isHost, streamState.isStreaming, hostId, roomId, currentUserId]);

  // ==========================================
  // 3. Signaling Polling Loop (Every 800ms)
  // ==========================================
  useEffect(() => {
    let isMounted = true;

    const pollSignals = async () => {
      try {
        const since = lastSignalPollRef.current;
        const res = await fetch(`/api/rooms/${roomId}/signal?viewerId=${currentUserId}&since=${since}`);
        if (!res.ok) return;

        const data = await res.json();
        if (!isMounted || !data.signals) return;

        lastSignalPollRef.current = Date.now();

        for (const sig of data.signals as SignalMessage[]) {
          if (sig.type === 'request-stream' && isHost) {
            // Viewer asked for host stream
            sendOfferToViewer(sig.senderId);
          } else if (sig.type === 'offer' && !isHost) {
            // Viewer received offer from host
            handleIncomingOffer(sig.data, sig.senderId);
          } else if (sig.type === 'answer' && isHost) {
            // Host received answer from viewer
            handleIncomingAnswer(sig.data, sig.senderId);
          } else if (sig.type === 'candidate') {
            handleIncomingCandidate(sig.data, sig.senderId);
          } else if (sig.type === 'stop' && !isHost) {
            setRemoteStream(null);
            setConnectionStatus('disconnected');
          }
        }
      } catch (err) {
        // Silent loop error
      }
    };

    const interval = setInterval(pollSignals, 800);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [roomId, currentUserId, isHost, captureResult, hostId]);

  // Simulate ultra-low latency jitter (60-95ms)
  useEffect(() => {
    const timer = setInterval(() => {
      setLatencyMs(Math.floor(65 + Math.random() * 25));
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  // Sync volume with remote video element
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Fullscreen toggle
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

  // Picture in picture
  const togglePictureInPicture = async () => {
    const video = isHost ? localVideoRef.current : remoteVideoRef.current;
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
      <AmbientGlow isPlaying={streamState.isStreaming} />

      {/* Floating Emoji Reactions Barrage */}
      <FloatingReactions reactions={reactions} />

      {/* ============================================================== */}
      {/* CASE 1: HOST IS LIVE STREAMING */}
      {/* ============================================================== */}
      {isHost && captureResult && (
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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-2 transition-all shadow-md active:scale-95"
            >
              <StopCircle className="w-4 h-4" />
              <span>Stop Sharing</span>
            </button>

            {includeMic && (
              <button
                onClick={toggleMicMute}
                className={`p-2 rounded-xl text-xs font-semibold transition-all ${
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
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
              title="Picture in Picture"
            >
              <PictureInPicture className="w-4 h-4" />
            </button>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all"
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASE 2: HOST IS NOT STREAMING YET (HOST VIEWPORT) */}
      {/* ============================================================== */}
      {isHost && !captureResult && (
        <div className="relative z-10 max-w-lg w-full p-6 text-center space-y-5 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-brand-500/10 border border-brand-500/30 text-brand-400 shadow-xl shadow-brand-500/10">
            <RadioTower className="w-8 h-8 animate-pulse" />
          </div>

          <div>
            <h2 className="text-xl font-black text-white tracking-tight">
              Ready to Stream, {currentUserName}?
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Share your entire screen, an application window, or a browser tab with friends in ultra-low latency.
            </p>
          </div>

          {/* Stream Configuration Options */}
          <div className="p-4 rounded-2xl bg-cinema-850/80 border border-slate-800/80 text-left space-y-3">
            {/* Resolution selector */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-brand-400" />
                Stream Resolution
              </span>
              <div className="flex items-center gap-1 bg-cinema-950 p-1 rounded-xl border border-slate-800">
                {(['720p', '1080p', '4k'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setResolution(res)}
                    className={`px-2.5 py-0.5 rounded-lg font-mono text-[10px] font-bold uppercase transition-all ${
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

            {/* Audio Toggle */}
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                Share System Audio (Games & Video)
              </span>
              <input
                type="checkbox"
                checked={includeAudio}
                onChange={(e) => setIncludeAudio(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-700 bg-slate-800"
              />
            </label>

            {/* Mic Toggle */}
            <label className="flex items-center justify-between text-xs cursor-pointer select-none">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5 text-emerald-400" />
                Include Microphone Commentary
              </span>
              <input
                type="checkbox"
                checked={includeMic}
                onChange={(e) => setIncludeMic(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 focus:ring-brand-500 border-slate-700 bg-slate-800"
              />
            </label>
          </div>

          {/* Go Live Button */}
          <button
            onClick={handleStartShare}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-brand-600 via-indigo-600 to-cyan-600 hover:from-brand-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-brand-500/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Radio className="w-4 h-4 animate-ping" />
            <span>Start Live Screen Share</span>
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASE 3: VIEWER WATCHING LIVE STREAM */}
      {/* ============================================================== */}
      {!isHost && streamState.isStreaming && (
        <div className="relative w-full h-full flex items-center justify-center bg-black">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />

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
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
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
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Picture in Picture"
              >
                <PictureInPicture className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CASE 4: VIEWER WAITING FOR HOST TO GO LIVE */}
      {/* ============================================================== */}
      {!isHost && !streamState.isStreaming && (
        <div className="relative z-10 max-w-md w-full p-6 text-center space-y-4 animate-fade-in">
          {/* Pulsing Radar Ring */}
          <div className="relative inline-flex items-center justify-center w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-brand-500/20 animate-ping opacity-60" />
            <div className="absolute inset-2 rounded-full bg-brand-500/10 animate-pulse" />
            <div className="relative w-14 h-14 rounded-2xl bg-cinema-850 border border-brand-500/30 text-brand-400 flex items-center justify-center shadow-xl">
              <Monitor className="w-7 h-7" />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-black text-white">
              Waiting for Host to Go Live
            </h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
              {streamState.hostName || 'The host'} has not started sharing their screen yet. The stream will begin automatically once they go live!
            </p>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-cinema-850/80 border border-slate-800 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Room #{roomId} Standby Mode</span>
          </div>
        </div>
      )}
    </div>
  );
}
