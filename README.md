# Fighting-2

Mobile-first online fighting game for two devices. The current branch contains **stage 1** of the implementation: room creation, joining by a short code, an authoritative movement server, smooth opponent interpolation, touch controls, keyboard controls and disconnect handling.

## Stack

- Node.js 18+
- Express
- Socket.IO
- HTML5 Canvas
- Plain HTML, CSS and JavaScript — no Vite and no TypeScript

## Current repository layout

```text
Fighting-2/
├─ package.json
├─ .env.example
├─ server/
│  └─ src/
│     ├─ constants.js
│     ├─ index.js
│     └─ rooms.js
└─ client/
   └─ public/
      ├─ index.html
      ├─ styles.css
      └─ src/
         └─ main.js
```

## Run locally

```bash
git clone https://github.com/Malikk-Sh/Fighting-2.git
cd Fighting-2
git checkout feat/network-prototype
npm install
cp .env.example .env
npm start
```

Open:

```text
http://localhost:3000
```

For automatic server restarts during development:

```bash
npm run dev
```

## Test with two browser windows

1. Open the site in the first window and press **Создать комнату**.
2. Copy the four-character room code.
3. Open the site in another browser or private window.
4. Enter the room code and press **Войти**.
5. Move with `A` / `D`, arrow keys, or the mobile buttons.

Each client controls only its own rectangle. The server owns the real positions and broadcasts authoritative snapshots.

## Test with two devices over Wi-Fi / LAN

The server listens on `0.0.0.0`, so another device on the same network can connect to it.

Find the local IP of the computer running the server:

### Windows

```powershell
ipconfig
```

Look for the active adapter's `IPv4 Address`, for example `192.168.1.42`.

### macOS

```bash
ipconfig getifaddr en0
```

### Linux

```bash
hostname -I
```

Then open this address on both devices:

```text
http://192.168.1.42:3000
```

Replace `192.168.1.42` with the computer's actual LAN address. The operating system firewall may ask for permission to accept incoming Node.js connections.

## Environment variables

```env
HOST=0.0.0.0
PORT=3000
CLIENT_ORIGIN=*
```

- `HOST=0.0.0.0` is required for LAN access.
- `PORT` is normally supplied automatically by a hosting provider.
- Set `CLIENT_ORIGIN` to the public client origin when the frontend and backend are hosted separately. The current stage serves the client and Socket.IO server from one Node.js process, so same-origin deployment requires no hardcoded WebSocket address.

## Protocol implemented in stage 1

Client to server:

- `room:create`
- `room:join` with `{ code }`
- `player:input` with `{ direction, sequence }`
- `latency:ping`

Server to client:

- `room:created`
- `room:joined`
- `room:waiting`
- `match:start`
- `match:snapshot`
- `opponent:disconnected`
- `server:error`
- `latency:pong`

## Server simulation

- Simulation rate: 30 ticks per second.
- Snapshot rate: 20 snapshots per second.
- Clients send direction intent only (`-1`, `0`, `1`).
- Clients cannot set their own position.
- Movement speed and arena boundaries are enforced on the server.
- Players cannot pass through each other.
- Remote movement is rendered from a small interpolation buffer.

## Next stages

1. Server-authoritative attack, three-second cooldown, two health points and match result.
2. Generated sprite sheets and frame-by-frame fighter animations.
3. Hit sparks, slash effects, screen shake, hit-stop and sound.
4. Final mobile UI, rematch flow and deployment configuration.
