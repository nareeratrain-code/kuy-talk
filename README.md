# Kuy Talk – แชทหาคู่ + สุ่มคุย + ห้องแชท 77 จังหวัด (ต้นแบบ)
Run: `npm install && node server.js` → http://localhost:3000 (`PORT` env). Data: `data.json` (delete to reset → bots only).
Admin: http://localhost:3000/admin (HTTP Basic auth, any username, password = `ADMIN_PASSWORD` in `.env`, chmod 600, git-ignored).
Tests: `node test.js` (API + sockets, 32 checks). Browser smoke: `npm i puppeteer-core && node smoke.js` (uses /usr/bin/google-chrome).

## Pages
- `/` – the user's original Kuy Talk UI (`public/index.html`) + `public/kuy-bridge.js` wiring it to the backend.
- `/classic.html` – mobile swipe-deck UI, same account (localStorage `kt_token`).
- Both use `public/kt-call.js` (WebRTC 1:1 voice/video, Socket.IO signaling, STUN only).

## Backend (server.js, Express + Socket.IO + JSON store)
Accounts (18+), swipe/like (100 free/day, persisted), match → DM (realtime, typing), random chat (humans, bot fallback, paid gender filter),
77 province rooms (`provinces.js`: join/leave, live counts, last 100 msgs saved, typing, flood limits, swear filter, `<>` stripped server-side, bots in popular rooms),
moments (text/photo, like, comment), friends (request/accept from matches; bots auto-accept), lucky spin (1 free/day) & shake → real match,
block (hidden everywhere, DMs/calls/random refused) & report (stored, admin review), admin ban/unban, Premium 30 days enforced server-side.
Payments are SIMULATED (top-ups, ฿50 Premium); no card data is collected.

## Limitations
JSON file store (single process); token-only auth (no password/OTP); calls need a TURN server for many real networks; age is self-declared; swear list is small.
Backups: `backup-v1/` (first version + user's original file), `backup-v2/` (before this update).

## Deploy to Render
1. Push this repo to GitHub, then on Render: **New → Blueprint** → pick the repo (uses `render.yaml`), or New → Web Service with build `npm install`, start `npm start`.
2. Set env var `ADMIN_PASSWORD` (Render asks because `sync:false`). Without it, `/admin` is disabled. Render sets `PORT` automatically.
3. ⚠️ Free plan disk is ephemeral and the service sleeps after ~15 min idle: `data.json` (accounts, chats, rooms) is wiped on every redeploy/restart. For persistence use a paid plan with a disk (uncomment `disk` + `DATA_DIR=/var/data` in render.yaml) or move to a database.
4. WebSockets work on Render out of the box. Calls may still need a TURN server.
