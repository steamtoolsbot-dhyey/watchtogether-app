# 🍿 Charon WatchTogether — Synced Cinema Lounge

A modern, ultra-low latency collaborative streaming room web application built with **Next.js 14 App Router**, featuring client-side **End-to-End Encryption (AES-GCM-256)** and **100% Anti-Torrent** verified streaming architecture.

Deployable to **Vercel** in 1 click!

---

## 🌟 Key Features

- 🔒 **Client-Side End-to-End Encryption (E2EE)**: Powered by standard Web Crypto API (`window.crypto.subtle`). Chat messages and room secrets are encrypted in the sender's browser and decrypted only by room participants. The server never observes plaintext.
- 🛡️ **100% Torrent-Free & Compliant**: Strictly blocks all BitTorrent protocols, `.torrent` files, magnet hashes, and P2P swarms on both the client and server API levels. Only authorized direct HTTPS video streams (`.mp4`, `.webm`, `.m3u8`), YouTube, and Twitch are permitted.
- 🎬 **Universal Synced Media Player**:
  - Full synchronization of YouTube IFrame API, Twitch live streams, and HTML5 video files.
  - Sub-second drift detection & auto-correction algorithm.
  - Glassmorphic cinema controls (Play/Pause, Seekbar, Volume, Speed slider, Sync with Host button).
  - Dynamic Ambient Glow backlight behind the video.
- 💬 **Live E2EE Chat & Floating Emoji Reactions**:
  - Live chat with customizable nicknames, avatar colors, and system event logs.
  - Floating emoji reactions (🍿, ❤️, 🔥, 😂, 👏, 🚀) bursting across the screen for all connected viewers.
- 📜 **Shared Playlist & Auto-Play Queue**:
  - Add custom video URLs or choose from curated high-definition demo presets.
  - Auto-advances to the next video when playback ends.
- 👑 **Host Protection & Permissions**:
  - Host-only lock mode prevents viewers from interrupting playback or changing videos.
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
| **E2EE Cipher** | AES-GCM 256-bit |
| **Key Derivation** | PBKDF2 with 100,000 SHA-256 iterations |
| **Integrity Tag** | 128-bit authentication tag |
| **Protocol Policy** | HTTPS, WSS, YouTube Embed, Twitch Embed |
| **Disallowed Protocols** | `magnet:`, `torrent:`, `webtorrent:`, `ed2k:`, `.torrent` files |

---

## 📜 License
MIT License
