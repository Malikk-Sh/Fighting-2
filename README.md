# Fighting-2

Mobile-first online fighting game for two devices. The current implementation includes room creation, joining by a short code, authoritative movement and combat, two health points, a three-second attack cooldown, victory/defeat screens and consensual rematches.

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
│  ├─ src/
│  │  ├─ constants.js
│  │  ├─ index.js
│  │  ├─ match.js
│  │  └─ rooms.js
│  └─ test/
│     └─ match.test.js
└─ client/
   └─ public/
      ├─ index.html
      ├─ styles.css
      ├─ combat.css
      └─ src/
         ├─ main.js
         ├─ waiting-room-connection.js
         ├─ room-lifecycle.js
         └─ combat.js
```

## Run locally

```bash
git clone https://github.com/Malikk-Sh/Fighting-2.git
cd Fighting-2
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

Run the server-side combat tests:

```bash
npm test
```

## Test with two browser windows

1. Open the site in the first window and press **Создать комнату**.
2. Copy the four-character room code.
3. Open the site in another browser or private window.
4. Enter the room code and press **Войти**.
5. Move with `A` / `D`, arrow keys, or the mobile buttons.
6. Attack with the large red button or the space bar.

Each client controls only its own fighter. The server owns positions, attack cooldowns, hit detection, health and the match result.

A hit counts only when the opponent is within the authoritative attack radius at the moment the server receives the attack. A missed attack still consumes the full three-second cooldown. Two successful hits end the match.

After the result screen, both players must press **Играть снова** before a new match begins.

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
- Set `CLIENT_ORIGIN` to the public client origin when the frontend and backend are hosted separately.
- The default deployment serves the frontend and Socket.IO server from the same Node.js process, so no hardcoded WebSocket URL is required.

## Network protocol

Client to server:

- `room:create`
- `room:join` with `{ code }`
- `room:leave`
- `player:input` with `{ direction, sequence }`
- `player:attack`
- `match:rematch`
- `latency:ping`

Server to client:

- `room:created`
- `room:joined`
- `room:waiting`
- `match:start`
- `match:snapshot`
- `match:attack`
- `match:attackRejected`
- `match:hit`
- `match:end`
- `match:rematchPending`
- `opponent:disconnected`
- `server:error`
- `latency:pong`

## Server simulation and combat rules

- Simulation rate: 30 ticks per second.
- Snapshot rate: 20 snapshots per second.
- Clients send movement direction and attack intent only.
- Clients cannot set position, health, cooldown or hit results.
- Movement speed and arena boundaries are enforced on the server.
- Players cannot pass through each other.
- Remote movement is rendered from a small interpolation buffer.
- Maximum health: 2.
- Attack cooldown: 3000 ms.
- Cooldown is consumed on both hits and misses.
- The server checks distance and facing using its current positions.
- Rematches start only after both connected players confirm.

## Next stages

1. Generated sprite sheets and frame-by-frame fighter animations.
2. Final hit sparks, slash effects, hit-stop and synthesized sound.
3. Visual polish for the lobby, match HUD and result screens.
4. Production deployment configuration and hosting documentation.
