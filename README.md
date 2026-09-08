# Veto UI

<img src="public/veto-icon.svg" alt="Veto" width="80" height="80" />

The browser interface for **veto-core**. It provides session control, human approval,
an interactive agent ledger, and a complete rewind-aware record view.

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
  `o` / `a[...]` / `h` framing). It carries `DeltaFrame` JSON
  (`{sessionId, sequence, emittedAt, kind, text, attrs}`) for assistant output, tool
  activity, approvals, background tasks, compaction, errors, and episode completion.
  The connection URL carries the Veto login token; the backend only forwards frames for
  sessions owned by that user.
- **Prompts** — `POST /api/sessions/{name}/prompt` returns a `202` acknowledgement after
  enqueueing the episode. Live progress arrives through the WebSocket bus;
  `EPISODE_DONE` ends the in-flight UI state, and
  `GET /api/sessions/{name}/history` remains the authoritative interactive ledger.
- **Records** — `GET /api/sessions/{name}/records` returns the complete append-only trace,
  including `AGENT_INIT`, rewind boundaries, records superseded by rewind, and aggregate
  tool usage. Superseded records remain visible with their projection state.
- **Cancel** — `POST /api/sessions/{name}/cancel` declines pending approval waits. The UI
  detaches from the current run and refreshes durable history; an episode that is not waiting
  for approval may continue on the backend.

The browser connects directly to the configured backend port. `veto-core` allows
the required CORS requests from local UI origins (`localhost`, `127.0.0.1`, and
`[::1]`), so changing the port does not require restarting Vite.

## Features

- **Auth** — first-run vault setup, sign-in, sign-out, automatic return to
  the gate on 401 (e.g. after a backend restart).
- **Sessions** — create with a pattern, workspace roots, and a per-session tool-result
  presentation mode; select and delete sessions from the rail.
- **Prompt ledger** — turn-numbered entries: user prompts, collapsible thoughts, markdown
  assistant messages, tool-call cards with syntax-highlighted JSON args, collapsible
  tool results with pass/fail indicators, plain-language error entries.
- **Complete records** — shows every durable record in server order, renders system prompts
  as Markdown or raw text, and strikes through records removed from the effective history.
- **Live streaming** — DeltaFrames from the bus render as live thought/message entries
  while a prompt is in flight, then reconcile with the authoritative REST response.
  Frames for unknown sessions land in the StatusBar's bus-activity log.
- **Human interaction** — approval cards and structured agent questions remain attached to
  the session that raised them, even while the user views another session.
- **Inspector** — background processes started by `run_task`, plus backend DAG task status.
- **Settings** — backend port, language, theme, agent patterns, model-tier profiles, and
  credential notes.
- **Themes** — dark console (default) and light ledger, toggled from the status bar and
  persisted in localStorage. Tokens are CSS variables, so every component follows.

## Tech stack

- React 18 + TypeScript (strict) + Vite
- TailwindCSS 3.4 (custom "Audit Ledger" token set)
- react-markdown + remark-gfm, react-syntax-highlighter
- Native WebSocket client (`src/bus/VetoBus.ts`) with heartbeat and bounded reconnect
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
├── api/                  # REST DTOs, transport, and endpoint functions
├── bus/                  # authenticated SockJS WebSocket transport
├── config/               # persisted backend connection settings
├── state/                # auth, sessions, live runs, and ledger projection
├── components/
│   ├── ledger/           # interactive conversation and tool cards
│   ├── records/          # complete rewind-aware durable trace
│   ├── inspector/        # background and DAG task views
│   └── settings/         # preferences, patterns, models, credentials
├── i18n/                 # English and Simplified Chinese UI text
└── lib/                  # rendering parsers and shared utilities
```
