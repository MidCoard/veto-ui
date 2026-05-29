# Project Veto-UI — The Zero-Trust Presentation Engine

## Overview

**Veto-UI** is the official frontend for [Project Veto](https://github.com/MidCoard/veto), an enterprise-grade agent client. It serves as the primary interface for human-in-the-loop (HITL) interaction, providing a transparent and secure way to monitor and authorize agent actions.

In the Veto 9-Grid Topology, this project implements:
- **C1: UI & Presentation Engine**: Real-time rendering of agent thoughts, tool calls, and results.
- **C2: Memory & Context System**: Client-side state management for sessions, workspace trees, and preferences.

## Key Features

- **Streaming Markdown**: Fluid rendering of agent responses with syntax highlighting.
- **HITL Approval Cards**: Specialized UI components for reviewing and authorizing sensitive tool executions (file reads, compilations, etc.).
- **Session Sidebar**: Management of multiple agent sessions and interaction history.
- **Veto Status Bar**: Real-time visibility into the [Veto Gateway] status and local SLM activity.
- **Workspace Tree**: Visual representation of the local sandboxed environment.

## Tech Stack

- **Framework**: [React 18](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [TailwindCSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Communication**: WebSocket (via `WebSocketService.ts`)

## Project Structure

```text
src/
├── components/          # C1: UI Components
│   ├── CodeHighlight.tsx
│   ├── HITLApprovalCard.tsx
│   ├── SessionSidebar.tsx
│   ├── StreamingMarkdown.tsx
│   └── VetoStatusBar.tsx
├── context/             # C2: State & Memory
│   ├── SessionManager.ts
│   ├── WorkspaceTree.ts
│   ├── PreferencesVector.ts
│   └── VetoContext.tsx
├── services/            # C3 Interface
│   └── WebSocketService.ts
├── App.tsx              # Main Layout
└── main.tsx             # Entry Point
```

## Getting Started

### Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **Veto Core**: A running instance of the [Veto Backend](https://github.com/MidCoard/veto)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server:

```bash
npm run dev
```

The UI will be available at `http://localhost:5173`. By default, it attempts to connect to the Veto Core at `ws://localhost:8443/ws/veto/bus`.

### Production Build

```bash
npm run build
```

## Communication Protocol

Veto-UI communicates with the backend via the **C3 Communication Bus** (WebSocket). It handles the following message types:
- `heartbeat`: Connectivity monitoring.
- `dag.payload`: Incoming task and thought streams.
- `veto.approval`: Requests for human authorization of redacted/sensitive actions.
- `session.sync`: Synchronization of workspace and history state.

## License

Proprietary — Project Veto. All rights reserved.
