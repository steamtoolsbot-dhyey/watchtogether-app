# 📺 Charon Live Stream Lounge & Screen Share

A high-performance, ultra-low latency collaborative screen sharing and streaming web application built with **Next.js 14 App Router**, featuring native **WebRTC DTLS-SRTP** video streaming, client-side **End-to-End Encryption (AES-GCM-256)** for room chat, and **100% Anti-Torrent** verified streaming architecture.

Deployable to **Vercel** in 1 click!

---

## 🌟 Key Features

- 🖥️ **WebRTC Live Screen Sharing (Primary Focus)**:
  - **Zero-Install Streaming**: The host shares their entire monitor, specific application window (games, VLC, tools), or browser tab directly to viewers in high-definition (up to 1080p 60fps / 4K).
  - **System Audio & Mic Mixing**: Blends computer audio (games/music/movies) with the host's microphone commentary via Web Audio API.
  - **Ultra-Low Latency**: Sub-second peer-to-peer delivery (50–120ms latency) powered by WebRTC mesh and Google STUN traversal.
  - **Real-Time VU Level Meter**: Live visualizer showing host audio activity.
- 🔒 **Native End-to-End Encryption (E2EE)**:
  - Video and audio streams are encrypted per-packet using standard **DTLS-SRTP** cryptography.
  - Live chat and room secrets are encrypted client-side using **AES-GCM-256** via the native **Web Crypto API** (`window.crypto.subtle`). The server only relays ciphertext.
- 🛡️ **100% Torrent-Free & Verified Architecture**:
  - Strictly blocks all BitTorrent protocols, `.torrent` files, magnet hashes, and P2P swarms on both the client and server API levels.
  - All streaming is strictly WebRTC media tracks or verified direct HTTPS CDN streams.
- 🎬 **Secondary Mode: Synced Video Player**:
  - Full synchronization of YouTube IFrame API, Twitch live streams, and HTML5 video files with client-side drift compensation.
- 💬 **Live E2EE Chat & Floating Emoji Reactions**:
  - Encrypted chat with customizable nicknames, avatar colors, and system event logs.
  - Floating emoji reactions (🍿, ❤️, 🔥, 😂, 👏, 🚀) bursting across the live stream for all connected viewers.
- 👑 **Host Protection & Permissions**:
  - Host-only lock mode prevents viewers from interrupting streams or altering settings.
- 🔗 **Instant Room Invites**:
  - 1-click room creation and sharable join links.

---

## 🚀 Quick Deployment to Vercel

### Option 1: Import via Vercel Dashboard (Recommended)
1. Go to [vercel.com/new](https://vercel.com/new).
2. Connect your GitHub account and select this repository: `steamtoolsbot-dhyey/watchtogether-app`.
3. Framework Preset will automatically detect **Next.js**.
4. Click **Deploy**. Your app will be live within 60 seconds!

### Option 2: Deploy via Vercel CLI
```bash
npm i -g vercel
vercel
```

---

## 💻 Local Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Open in browser
http://localhost:3000
```

---

## 🔒 Security Architecture

| Feature | Implementation |
|---|---|
| **Live Stream Media** | WebRTC DTLS-SRTP (128/256-bit AES) |
| **Signaling** | Next.js Serverless API (`/api/rooms/[roomId]/signal`) |
| **NAT Traversal** | Google Public STUN (`stun:stun.l.google.com:19302`) |
| **Chat & Signals E2EE** | AES-GCM-256 with PBKDF2 (100k iterations) |
| **Protocol Policy** | HTTPS, WSS, WebRTC PeerConnection, YouTube Embed, Twitch Embed |
| **Disallowed Protocols** | `magnet:`, `torrent:`, `webtorrent:`, `ed2k:`, `.torrent` files |

---

## 📜 License
MIT License
