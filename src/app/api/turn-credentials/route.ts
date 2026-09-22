import { NextResponse } from 'next/server';

// Default Metered Open Relay configuration (Built-in free TURN/STUN tier)
const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
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

let cachedServers: RTCIceServer[] | null = null;
let lastCached = 0;

export async function GET() {
  const appName = process.env.METERED_APP_NAME || process.env.NEXT_PUBLIC_METERED_APP_NAME;
  const apiKey = process.env.METERED_API_KEY || process.env.NEXT_PUBLIC_METERED_API_KEY;

  if (appName && apiKey) {
    const now = Date.now();
    // Cache for 30 minutes to conserve API quota
    if (cachedServers && now - lastCached < 30 * 60 * 1000) {
      return NextResponse.json({
        success: true,
        source: 'metered-api-cached',
        iceServers: cachedServers,
      });
    }

    try {
      const endpoint = `https://${appName}.metered.live/api/v1/turn/credentials?apiKey=${apiKey}`;
      const res = await fetch(endpoint, { next: { revalidate: 1800 } });
      if (res.ok) {
        const fetchedServers = await res.json();
        if (Array.isArray(fetchedServers) && fetchedServers.length > 0) {
          // Combine fetched servers with fallback Google STUN
          const combined: RTCIceServer[] = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' },
            ...fetchedServers,
          ];
          cachedServers = combined;
          lastCached = now;
          return NextResponse.json({
            success: true,
            source: 'metered-api',
            iceServers: combined,
          });
        }
      }
    } catch (err) {
      console.warn('[Metered API] Dynamic TURN credential fetch error, using Open Relay fallback:', err);
    }
  }

  return NextResponse.json({
    success: true,
    source: 'metered-openrelay',
    iceServers: DEFAULT_ICE_SERVERS,
  });
}
