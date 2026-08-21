import type { HistoryTurn, PendingVeto } from '../api/types';

/**
 * LedgerEntry — one line in the audit ledger for a session.
 *
 * - `seq` is the turn label (rendered T-01, T-02…). It continues across the
 *   exchanges of a session - the label matches the absolute position in the
 *   conversation, not the position within one prompt. User prompt entries
 *   carry seq 0 and render as "YOU" instead; live entries carry seq -1 (no
 *   persisted turn yet) and render as "…".
 * - `live` marks entries streamed from the WS bus while a prompt is in flight;
 *   they are dropped when the authoritative REST response arrives.
 * - Thoughts and tool results render collapsed by default (see LedgerEntryView).
 */
export interface LedgerEntry {
  id: string;
  seq: number;
  kind: 'user' | 'thought' | 'message' | 'tool_call' | 'tool_result' | 'error';
  text: string;
  toolName?: string;
  args?: Record<string, unknown>;
  /** Tool-result outcome, or exchange outcome (false flags a failed run). */
  success?: boolean;
  live?: boolean;
}

let entryCounter = 0;

export function nextEntryId(prefix = 'e'): string {
  entryCounter += 1;
  return `${prefix}-${entryCounter}`;
}

/** Format a turn label: seq 3 → "T-03". */
export function turnLabel(seq: number): string {
  return `T-${String(seq).padStart(2, '0')}`;
}

/** A user prompt entry opens a new exchange (seq 0 — the agent turns number from T-01). */
export function userEntry(text: string): LedgerEntry {
  return { id: nextEntryId('u'), seq: 0, kind: 'user', text };
}

/**
 * A live entry streamed from the bus while the prompt is in flight. The bus
 * frame's `sequence` is a broker-local counter, NOT the backend turnNumber, so
 * live entries carry seq -1 and render a "…" turn tag until the persisted turn
 * lands in history and replaces them (see reconcileLocal).
 */
export function liveEntry(kind: 'thought' | 'message', text: string): LedgerEntry {
  return { id: nextEntryId('live'), seq: -1, kind, text, live: true };
}

export function errorEntry(text: string): LedgerEntry {
  return { id: nextEntryId('err'), seq: 0, kind: 'error', text };
}

// ---- Persisted history (GET /api/sessions/{name}/history) ----

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * ASSISTANT_THOUGHT payloads carry the RAW veto_pulse JSON string; the
 * displayable text is its `thought` field. Unparseable input shows as-is.
 */
function thoughtText(raw: string): string {
  try {
    const parsed = asRecord(JSON.parse(raw));
    const thought = parsed?.thought;
    if (typeof thought === 'string') return thought;
  } catch {
    // Not JSON — fall through to the raw string.
  }
  return raw;
}

/**
 * Rebuild ledger entries from persisted turns. The real turnNumber becomes
 * the T-nn label; user prompts keep seq 0 ("YOU"). Meta turns (AGENT_INIT,
 * REWIND, COMPACTION_SUMMARY, RECALL, USER_INTERRUPT) are skipped.
 *
 * Ids are deterministic (`h-<turnNumber>`): rebuilding from a longer history
 * keeps the same React keys for existing entries, so expand/collapse state
 * survives the history-driven rebuilds.
 */
export function entriesFromHistory(turns: HistoryTurn[]): LedgerEntry[] {
  const entries: LedgerEntry[] = [];
  // TOOL_RESPONSE payloads carry no tool_name — recover it via call_id.
  const toolNameByCallId = new Map<string, string>();
  let lastToolName: string | undefined;
  for (const turn of turns) {
    const payload = turn.payload;
    const id = `h-${turn.turnNumber}`;
    switch (turn.type) {
      case 'USER_PROMPT':
        entries.push({ id, seq: 0, kind: 'user', text: asString(payload.content) });
        break;
      case 'ASSISTANT_THOUGHT':
        entries.push({
          id,
          seq: turn.turnNumber,
          kind: 'thought',
          text: thoughtText(asString(payload.response)),
        });
        break;
      case 'ASSISTANT_RESPONSE':
        entries.push({
          id,
          seq: turn.turnNumber,
          kind: 'message',
          text: asString(payload.content),
        });
        break;
      case 'TOOL_CALL': {
        const toolName = asString(payload.tool_name);
        const callId = asString(payload.call_id);
        if (callId !== '' && toolName !== '') toolNameByCallId.set(callId, toolName);
        lastToolName = toolName !== '' ? toolName : undefined;
        entries.push({
          id,
          seq: turn.turnNumber,
          kind: 'tool_call',
          text: toolName,
          toolName,
          args: asRecord(payload.args),
        });
        break;
      }
      case 'TOOL_RESPONSE': {
        const callId = asString(payload.call_id);
        entries.push({
          id,
          seq: turn.turnNumber,
          kind: 'tool_result',
          text: asString(payload.content),
          success: typeof payload.success === 'boolean' ? payload.success : undefined,
          toolName: toolNameByCallId.get(callId) ?? lastToolName,
        });
        break;
      }
      default:
        // AGENT_INIT / REWIND / COMPACTION_SUMMARY / RECALL / USER_INTERRUPT.
        break;
    }
  }
  return entries;
}

// ---- Unified append pipeline: history turns + local (not-yet-persisted) entries ----

/**
 * Per-session ledger state. `turns` is the durable backend turn log — the
 * single source of truth for ordering and T-nn numbering. `local` holds
 * entries that exist only client-side or haven't landed in the turn log yet:
 * the just-sent user prompt, live bus thought/message frames, and error
 * entries. Rendered entries are always [...entriesFromHistory(turns), ...local]
 * so the ledger is strictly append-ordered.
 */
export interface SessionLedger {
  /** Undefined until the first successful history fetch. */
  turns: HistoryTurn[] | undefined;
  local: LedgerEntry[];
}

export const EMPTY_LEDGER: SessionLedger = { turns: undefined, local: [] };

/** Derived display entries: persisted turns first, not-yet-persisted local entries appended. */
export function deriveEntries(ledger: SessionLedger): LedgerEntry[] {
  const persisted = ledger.turns !== undefined ? entriesFromHistory(ledger.turns) : [];
  return [...persisted, ...ledger.local];
}

function removeFirst(entries: LedgerEntry[], match: (entry: LedgerEntry) => boolean): void {
  const index = entries.findIndex(match);
  if (index !== -1) entries.splice(index, 1);
}

/**
 * Drop local entries now represented in the persisted turns, so nothing
 * renders twice. Matching is FIFO by text (live frames carry no turnNumber,
 * so text is the only reliable key):
 * - USER_PROMPT turns consume local user entries.
 * - ASSISTANT_THOUGHT / ASSISTANT_RESPONSE turns consume local live
 *   thought/message entries.
 * Error entries and unmatched locals survive.
 */
export function reconcileLocal(turns: HistoryTurn[], local: LedgerEntry[]): LedgerEntry[] {
  const remaining = [...local];
  for (const turn of turns) {
    switch (turn.type) {
      case 'USER_PROMPT': {
        const text = asString(turn.payload.content);
        removeFirst(
          remaining,
          (entry) => entry.kind === 'user' && entry.live !== true && entry.text === text,
        );
        break;
      }
      case 'ASSISTANT_THOUGHT': {
        const text = thoughtText(asString(turn.payload.response));
        removeFirst(
          remaining,
          (entry) => entry.kind === 'thought' && entry.live === true && entry.text === text,
        );
        break;
      }
      case 'ASSISTANT_RESPONSE': {
        const text = asString(turn.payload.content);
        removeFirst(
          remaining,
          (entry) => entry.kind === 'message' && entry.live === true && entry.text === text,
        );
        break;
      }
      default:
        break;
    }
  }
  return remaining;
}

/**
 * Merge a fresh /vetoes poll into the previously-rendered list, preserving
 * first-seen order: a parked veto stays at the position it was raised, newly
 * parked vetoes append behind it, resolved ones drop out. Callers key the
 * cards by callId, so stable order keeps the cards' local UI state.
 */
export function mergeVetoes(prev: PendingVeto[], next: PendingVeto[]): PendingVeto[] {
  const fresh = new Map(next.map((veto) => [veto.callId, veto]));
  const kept = prev
    .filter((veto) => fresh.has(veto.callId))
    .map((veto) => fresh.get(veto.callId) as PendingVeto);
  const known = new Set(prev.map((veto) => veto.callId));
  const added = next.filter((veto) => !known.has(veto.callId));
  return [...kept, ...added];
}
