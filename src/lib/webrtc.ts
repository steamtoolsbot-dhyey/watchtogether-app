/**
 * WebRTC Client-Side Streaming & Audio Mixing Engine
 * 
 * Provides:
 * 1. Screen / Window / Tab capture with 60fps & system audio
 * 2. Optional Microphone commentary mixed via Web Audio API
 * 3. Audio VU Meter level analyzer
 * 4. Google STUN configuration for NAT traversal
 */

export const METERED_OPENRELAY_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  // Metered.ca Open Relay STUN & TURN Servers (UDP, TCP, and TLS/TURNS for strict firewall traversal)
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turns:openrelay.metered.ca:443?transport=tcp',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

export const RTC_CONFIG: RTCConfiguration = {
  iceServers: METERED_OPENRELAY_SERVERS,
  iceCandidatePoolSize: 10,
};

let cachedRTCConfig: RTCConfiguration | null = null;
let lastFetchTime = 0;

/**
 * Dynamically resolves RTCConfiguration with Metered.ca TURN credentials.
 * Fetches fresh credentials from /api/turn-credentials if available,
 * or falls back seamlessly to the built-in Metered Open Relay servers.
 */
export async function getRTCConfig(): Promise<RTCConfiguration> {
  const now = Date.now();
  if (cachedRTCConfig && now - lastFetchTime < 30 * 60 * 1000) {
    return cachedRTCConfig;
  }

  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/turn-credentials', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.iceServers && Array.isArray(data.iceServers) && data.iceServers.length > 0) {
          cachedRTCConfig = {
            iceServers: data.iceServers,
            iceCandidatePoolSize: 10,
          };
          lastFetchTime = now;
          return cachedRTCConfig;
        }
      }
    }
  } catch (err) {
    console.warn('[WebRTC] Dynamic TURN fetch fallback to built-in Metered config:', err);
  }

  return RTC_CONFIG;
}

/**
 * Creates a silent, ultra-lightweight dummy MediaStream with 1x1 black canvas
 * so that a viewer can originate a WebRTC PeerJS call without needing camera/mic permissions.
 */
export function createDummyMediaStream(): MediaStream {
  if (typeof document === 'undefined') {
    return new MediaStream();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2, 2);
  }
  if ((canvas as any).captureStream) {
    return (canvas as any).captureStream(1);
  }
  return new MediaStream();
}

export interface ScreenCaptureOptions {
  resolution?: '1080p' | '720p' | '4k';
  frameRate?: number;
  includeSystemAudio?: boolean;
  includeMic?: boolean;
}

export interface CaptureResult {
  stream: MediaStream;
  micStream?: MediaStream;
  displayStream: MediaStream;
  audioContext?: AudioContext;
}

export async function startScreenCapture(
  options: ScreenCaptureOptions = {}
): Promise<CaptureResult> {
  const resolution = options.resolution || '1080p';
  const frameRate = options.frameRate || 60;

  let width = 1920;
  let height = 1080;
  if (resolution === '720p') {
    width = 1280;
    height = 720;
  } else if (resolution === '4k') {
    width = 3840;
    height = 2160;
  }

  // 1. Capture Screen Video & System Audio
  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      cursor: 'always',
      width: { ideal: width, max: width },
      height: { ideal: height, max: height },
      frameRate: { ideal: frameRate, max: 60 },
    } as MediaTrackConstraints,
    audio: options.includeSystemAudio !== false,
  });

  let micStream: MediaStream | undefined;
  let audioContext: AudioContext | undefined;
  let finalStream = displayStream;

  // 2. Mix Microphone Commentary with System Audio if enabled
  if (options.includeMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const destination = audioContext.createMediaStreamDestination();

        // Add display audio track if present
        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const displaySource = audioContext.createMediaStreamSource(new MediaStream([displayAudioTracks[0]]));
          displaySource.connect(destination);
        }

        // Add mic audio track
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(destination);

        // Compose final combined stream (display video + mixed audio)
        const combinedTracks = [
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ];
        finalStream = new MediaStream(combinedTracks);
      }
    } catch (micErr) {
      console.warn('Microphone capture failed or declined, proceeding with screen audio only:', micErr);
    }
  }

  return {
    stream: finalStream,
    displayStream,
    micStream,
    audioContext,
  };
}

export function stopMediaStream(result: Partial<CaptureResult> | MediaStream | null) {
  if (!result) return;

  if (result instanceof MediaStream) {
    result.getTracks().forEach((track) => track.stop());
    return;
  }

  if (result.stream) {
    result.stream.getTracks().forEach((track) => track.stop());
  }
  if (result.displayStream) {
    result.displayStream.getTracks().forEach((track) => track.stop());
  }
  if (result.micStream) {
    result.micStream.getTracks().forEach((track) => track.stop());
  }
  if (result.audioContext && result.audioContext.state !== 'closed') {
    result.audioContext.close().catch(() => {});
  }
}

/**
 * Creates a lightweight audio level analyzer (0-100) for VU meter UI
 */
export function createAudioLevelMeter(
  stream: MediaStream,
  onLevel: (level: number) => void
): () => void {
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) return () => {};

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioCtx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.6;

    const source = ctx.createMediaStreamSource(new MediaStream([audioTracks[0]]));
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId: number;

    const tick = () => {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      const normalized = Math.min(100, Math.round((avg / 128) * 100));
      onLevel(normalized);
      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
      source.disconnect();
      ctx.close().catch(() => {});
    };
  } catch (err) {
    console.warn('VU meter not supported:', err);
    return () => {};
  }
}
