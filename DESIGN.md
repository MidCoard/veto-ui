# Veto UI design context

## Plugin-owned tool presentation

Preserve the established compact call preview and bounded file excerpts. Tool renderers register local contribution IDs; catalog metadata maps effective aliases. Stable plugin/local identity takes precedence over names. Historical name fallback must be unambiguous and remain within a recorded plugin. Unload and renderer errors return to inert generic content, with complete args/results available in raw disclosures. Records and approvals share the same registration. Builtin owns scoped styles and bilingual tool content; its self-contained ESM is generated and checked with the existing frontend toolchain, never during backend packaging.

## Native reasoning records

Provider-exposed reasoning uses the existing expandable thought block and Records renderer. Records marked `response_format: text` are plain content even when they resemble JSON; older envelopes keep their legacy interpretation. Never manufacture a block when the provider exposes no reasoning. Preserve the existing typography, colors, keyboard disclosure, and responsive layout.

## Overview
Veto is an agent console for creating sessions, following tool execution, and answering agent questions. This document records the existing implementation; it introduces no new visual theme.

## Canonical sources
`src/index.css` and `tailwind.config.js` own tokens. Shared controls and ledger components own interaction patterns. Supported locales are English and Simplified Chinese.

## Colors
Use semantic ink, panel, raised, rule, paper, dim, accent, verdict and pass tokens. The existing dark graphite console and light ledger share these roles. Cyan accent denotes actions and selection, verdict denotes failure. Never communicate selection through color alone.

## Typography
Existing Space Mono display, IBM Plex Sans body, and IBM Plex Mono code fonts remain canonical. Tool content is compact; user text wraps without horizontal overflow.

## Layout
Preserve the session layout and bordered ledger cards. Question batches show every question, with wrapping option chips and readable custom answers.

## Elevation & Depth
Use existing tonal surfaces and rule borders; do not introduce decorative shadows.

## Shapes
Reuse rounded-md option chips and existing rounded ledger cards.

## Components
Builtin frontend modules own pending questions and tool-specific conversation, Records and approval presentation. The host owns generic provenance selection, error boundaries and raw payload disclosures. Plugin strings remain with their feature; I18nContext owns host labels.

## Motion
Keep existing motion conventions; this fix adds no animation.

## Accessibility
Pending choices retain aria-pressed. Historical selections include a localized textual marker and remain noninteractive. Render labels and answers as inert text, preserving their contents.

## Verification
Test answer arrival, history restoration, custom answers, failed/malformed results, all ten questions and Unicode label boundaries. Build the frontend and inspect the affected browser workflow when available.

## Connection feedback

Keep connection wording consistent across the status bar and composers. Show a concise stale-data notice above cached conversations, neutral agent indicators until status refreshes, and friendly first-message copy only for confirmed empty history. Preserve the existing layout, tokens, and keyboard behavior.

## Compact usage summary

TokenUsageLine owns usage presentation below both primary and secondary conversations. Keep localized compact totals and context percentage together in a quiet, wrapping summary. A native details disclosure exposes exactly three tightly spaced rows: used tokens, context used/limit, and cache-hit percentage. The expanded grid aligns to the right of the pane; right-aligned labels keep colons in one column, with the adjacent value column also right-aligned. Details stay inline, with keyboard access and no floating overlay. Layout responds to available pane width, not just viewport breakpoints.

## Executable plans

Use “Execution plan” / “执行计划” for submitted steps. The native tool `submit_plan` is available during ordinary work: acceptance starts execution under existing permissions and budgets. Planning has no session setting, API field, or enabled/disabled badge in creation, the rail, or Records. Historical plan records remain readable. Shared locale dictionaries own plan terminology.

## Plugin feature ownership

Feature plugins own their UI and translations, loaded through the public frontend API. The host owns shared tokens and generic slots; builtin monitor presentation ships with veto-builtin. Removing a plugin unmounts its views and cancels its requests/subscriptions. Preserve the existing console typography, panel spacing and keyboard behavior.

Group task presentation also ships with builtin. Plugins scope their own CSS to their view and consume the public host color variables; host Tailwind scanning never includes plugin package paths. Keep bounded list/history pagination, complete chunked report reading, explicit stale/offline feedback and session-checked Agent navigation. Inspector counts remain the total task-node count across all groups.

## Plugin-owned question interaction

Builtin questions.js owns the conversation footer card, bilingual controls, validation and scoped actions. It ships CSS against existing RGB theme tokens and does not require Tailwind to scan plugin sources. The host owns generic Agent waiting notices and mounts panels even when loaded conversation history is empty. Historical plugin calls use inert JSON and persisted result text, preserving old batches without a static question renderer.

## Plugin-owned background tasks

Builtin tasks Inspector preserves compact running/completed rows, merged output, task IDs, cwd, pid and elapsed time. List pages and expandable text pages keep long output and command metadata accessible without oversized responses. Cached data stays visible with a stale notice when disconnected; writes require fresh state and an immutable instance ID. Unload/scope change aborts old work. Host state and translations contain no background-task lifecycle or REST path.
