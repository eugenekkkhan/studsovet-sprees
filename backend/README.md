# Field of Miracles WebSocket server

NestJS is the authoritative owner of rooms, turns, scores, letters and wheel
results. The browser only sends commands and renders `state:update` events.

```bash
npm install
npm run start:dev
```

The server listens on `0.0.0.0:3000` by default. Set `PORT` to change it and
`FRONTEND_ORIGIN` to a comma-separated allowlist in production. The frontend
opens the Socket.IO namespace `/field-of-miracles` with WebSocket transport
only. By default it connects to port 3000 on the same hostname as the page, so
a phone opened over LAN does not accidentally connect to its own `localhost`.
Override this with `VITE_BACKEND_URL=http://your-host:3000` when needed. Set
`VITE_PUBLIC_URL` if participant and host invite links need a canonical public
origin.

## Protocol

- `session:create` — create an authoritative room and receive its private owner
  token plus a separate shareable key for additional host devices.
- `host:join` — restore the host connection using room code and token.
- `host:join-remote` — attach another host device using the room code and its
  separate shareable host key. Several authenticated host sockets may control
  the same game and receive the same private state.
- `session:watch` — open the public state without claiming a team.
- `participant:join` — authenticate with a private team key and claim its only
  participant slot. The payload also carries `participantId`; a Telegram
  Mini App can later replace the browser UUID with a verified Telegram user ID.
- `host:command` — host-only game state transitions.
- `spin:request` — host or a member of the active team requests a spin.
- `letter:guess` / `position:choose` — active-team actions from a phone.
- `state:update` — server projection broadcast after every accepted transition.

The public projection contains a masked board and never contains `puzzle.answer`.
Each spin reveals a 256-bit seed. `sha256-v1` hashes the seed, uses the first
32 bits to choose the sector and the next 32 bits for a safe in-sector angle.
The backend settles the spin after the declared duration and applies its effect.
