# Veto UI design context

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
UserQuestionCard owns pending interactive questions. ToolConversationDetails owns read-only conversation summaries; ToolDetailViews owns detailed records. Both derive recorded answers from persisted tool results. I18nContext owns user-facing labels.

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
