# Veto UI

The frontend for **veto-core** — a zero-trust backend that checkpoints an autonomous
coding agent. The UI is built as an audit ledger: every prompt exchange is entered,
numbered (T-01, T-02…), and stamped with a verdict.

## Integration contract

The backend defaults to `http://localhost:8443`. Its port can be changed from
the sign-in page or **Settings → Preferences**; the selection is persisted in
`localStorage` and applies to both REST and WebSocket traffic after reconnect.

- **REST** — `http://localhost:8443/api/**`. Authentication is a UUID token returned by
  `POST /api/auth/login` (or `POST /api/auth/setup` on first run), sent on every request
  as the `X-Veto-Session-Token` header. Tokens are in-memory server-side: a backend
  restart invalidates them and the UI routes back to sign-in.
- **WebSocket bus** — `ws://localhost:8443/ws/veto/bus`. The endpoint is SockJS-only
  (raw upgrades on the base path are rejected), so the client speaks the SockJS
  websocket transport directly (`/ws/veto/bus/<server>/<session>/websocket` with
  `o` / `a[...]` / `h` framing — no client library needed). It carries the live agent
  stream as flat `DeltaFrame` JSON (`{sessionId, sequence, emittedAt, kind, text, attrs}` —
  `ASSISTANT_THOUGHT` / `ASSISTANT_MESSAGE`) plus `{type: ...}` bus messages
  (`welcome`, `heartbeat_ack`, `veto.result`, `dag.*`, `error`). No handshake auth.
- **Prompts** — `POST /api/sessions/{name}/prompt` blocks server-side (up to 5 minutes)
  and returns the whole exchange: `messages[]`, `thoughts[]`, `toolCalls[]`,
  `toolResults[]`, `history[]`. Live progress comes from DeltaFrames whose `sessionId`
  matches the session; cancel from the composer is client-side only.

The browser connects directly to the configured backend port. `veto-core` allows
the required CORS requests from local UI origins (`localhost`, `127.0.0.1`, and
`[::1]`), so changing the port does not require restarting Vite.

## Features

- **Auth** — first-run vault setup (password ≥ 8), sign-in, sign-out, automatic return to
  the gate on 401 (e.g. after a backend restart).
- **Sessions** — create (pattern + optional name + workspace roots CSV), select, delete
  with inline confirm; last-active times in the rail.
- **Prompt ledger** — turn-numbered entries: user prompts, collapsible thoughts, markdown
  assistant messages, tool-call cards with syntax-highlighted JSON args, collapsible
  tool results with pass/fail indicators, plain-language error entries.
- **Live streaming** — DeltaFrames from the bus render as live thought/message entries
  while a prompt is in flight, then reconcile with the authoritative REST response.
  Unmatched frames land in the StatusBar's bus-activity log.
- **Inspector** — Patterns (list/create/delete), Tasks (list/detail/cancel), and the
  Veto gateway (status counters + a Check/Process payload tester with verdict stamps).
- **Themes** — dark console (default) and light ledger, toggled from the status bar and
  persisted in localStorage. Tokens are CSS variables, so every component follows.

## Tech stack

- React 18 + TypeScript (strict) + Vite
- TailwindCSS 3.4 (custom "Audit Ledger" token set)
- react-markdown + remark-gfm + rehype-raw, react-syntax-highlighter
- Native WebSocket client (`src/bus/VetoBus.ts`) with heartbeat + backoff reconnect
- Vitest + Testing Library

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173 — backend port is editable in the UI
npm run build    # tsc -b && vite build
npm test         # vitest run
```

## Project structure

```text
src/
├── api/                  # REST layer (DTOs, fetch wrapper, typed endpoints)
│   ├── types.ts
│   ├── client.ts         # token storage, error normalization, 401 handling
│   └── endpoints.ts
├── bus/
│   └── VetoBus.ts        # WebSocket bus client (DeltaFrames + bus messages)
├── state/
│   ├── AuthContext.tsx   # boot flow, sign-in/out, first-run setup
│   ├── SessionContext.tsx# sessions, ledger entries, shared bus, sendPrompt
│   └── ledger.ts         # LedgerEntry model + exchange builders
├── components/
│   ├── VerdictStamp.tsx  # PASS / VETOED / REDACTED / PENDING stamp
│   ├── LoginGate.tsx
│   ├── StatusBar.tsx     # bus status dot + activity log, inspector toggle
│   ├── SessionRail.tsx
│   ├── Composer.tsx
│   ├── StreamingMarkdown.tsx
│   ├── CodeHighlight.tsx
│   ├── ledger/           # LedgerStream + LedgerEntry
│   └── inspector/        # InspectorPanel + Patterns/Tasks/Gateway tabs
├── App.tsx               # three-column shell
└── main.tsx
```
