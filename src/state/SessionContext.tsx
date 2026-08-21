import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError } from '../api/client';
import {
  cancelSession as postCancelSession,
  createSession,
  deleteSession,
  getSessionHistory,
  listBgTasks,
  listSessions,
  listVetoes,
  resolveVeto as postResolveVeto,
  sendPrompt as postPrompt,
} from '../api/endpoints';
import type { BgTask, PendingVeto, SessionEntity } from '../api/types';
import { VetoBus } from '../bus/VetoBus';
import type { BusMessage, BusStatus, DeltaFrame } from '../bus/VetoBus';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { toDate } from '../lib/time';
import { useAuth } from './AuthContext';
import {
  deriveEntries,
  EMPTY_LEDGER,
  errorEntry,
  liveEntry,
  mergeVetoes,
  nextEntryId,
  reconcileLocal,
  userEntry,
} from './ledger';
import type { LedgerEntry, SessionLedger } from './ledger';
import type { HistoryTurn } from '../api/types';

/**
 * SessionContext — sessions from REST, one shared VetoBus, and the per-session
 * audit ledger.
 *
 * The ledger is ONE append-based pipeline driven by the backend turn log
 * (GET /api/sessions/{name}/history) as the single source of truth:
 *   - Per session, state is { turns, local } (SessionLedger). Rendered entries
 *     are [...entriesFromHistory(turns), ...local] — chronological by
 *     turnNumber, with absolute T-nn labels straight from the DB.
 *   - The agent's DeltaFrames drive the ledger live: tool-call / tool-result /
 *     episode events trigger an immediate history refetch, and VETO_REQUIRED /
 *     VETO_RESOLVED add/remove the parked-approval card the moment the agent
 *     parks or resumes. A slower (5s) history + /vetoes poll remains only as a
 *     reconciliation backstop; polling stops when idle.
 *   - Just-sent user prompts and live bus thought/message frames sit in
 *     `local` (appended after the persisted entries) until reconcileLocal
 *     drops them once their turns land in history. Bus frame sequences are
 *     broker-local counters, so live entries render a "…" tag, never a fake
 *     T-nn.
 *   - Prompt submission is fire-and-ack: the POST returns 202 as soon as the
 *     episode is enqueued, and the run's lifecycle rides the bus — EPISODE_DONE
 *     clears the in-flight state, refetches history, and drops the local
 *     transient entries (reconcileLocal keeps unmatched error entries).
 *   - Pending HITL vetoes render inline after the latest entry, in first-seen
 *     order (mergeVetoes); a resolved veto is replaced by the tool_call /
 *     tool_result turns its resolution persisted.
 *
 * DeltaFrames whose sessionId matches no known session, plus notable bus
 * messages, land in `busActivity` (last ~20) — never silently dropped.
 */

export interface BusActivityItem {
  id: string;
  at: string;
  label: string;
  detail?: string;
}

/** Per-session work state for the rail's status LED. */
export type SessionWorkState = 'working' | 'awaiting' | 'idle';

interface SessionContextValue {
  sessions: SessionEntity[];
  currentName: string | null;
  /** Entries for the currently selected session. */
  entries: LedgerEntry[];
  /** True when the CURRENT session has a prompt in flight. */
  pending: boolean;
  elapsedSeconds: number;
  /** Pending HITL vetoes for the current session (parked tool calls). */
  vetoes: PendingVeto[];
  /** run_task background tasks for the current session (running first, then stopped). */
  bgTasks: BgTask[];
  /** Re-fetch the current session's background tasks. */
  refreshBgTasks: () => Promise<void>;
  /** work state per session name — drives the rail's status LEDs. */
  sessionStates: Record<string, SessionWorkState>;
  busStatus: BusStatus;
  busActivity: BusActivityItem[];
  refresh: () => Promise<void>;
  select: (name: string) => void;
  create: (pattern: string, name: string | undefined, workspaceRootsCsv: string) => Promise<void>;
  remove: (name: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => void;
  resolveVeto: (callId: string, option: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const MAX_BUS_ACTIVITY = 20;

/** Stable empty array so `vetoes` doesn't break the context memo when absent. */
const NO_VETOES: PendingVeto[] = [];

/** Stable empty array so `bgTasks` doesn't break the context memo when absent. */
const NO_BG_TASKS: BgTask[] = [];

/**
 * Most-recently-active first — the backend returns creation order, the rail shows
 * latest-on-top so the session the user likely wants is always at the top.
 */
function byActivityDesc(a: SessionEntity, b: SessionEntity): number {
  const millis = (session: SessionEntity): number =>
    toDate(session.lastActiveAt)?.getTime() ?? toDate(session.createdAt)?.getTime() ?? 0;
  return millis(b) - millis(a);
}

/** Bus message types worth surfacing in the bus-activity log. */
const NOTABLE_BUS_TYPES = ['veto.result', 'dag.received', 'dag.payload', 'dag.result', 'error'];

function summarizeBusMessage(message: BusMessage): string | undefined {
  const record = message as Record<string, unknown>;
  for (const key of ['reason', 'message', 'decision', 'status']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/**
 * Rebuild a PendingVeto from a VETO_REQUIRED frame's attrs so the approval card
 * appears the moment the agent parks — no waiting on the /vetoes poll. Options
 * arrive as an array of backend enum-name strings; args as an object. Returns
 * null when the frame lacks the callId the resolve path is keyed by.
 */
function vetoFromFrame(frame: DeltaFrame): PendingVeto | null {
  const attrs = frame.attrs;
  const callId = typeof attrs.callId === 'string' ? attrs.callId : null;
  if (callId === null) return null;
  const toolName = typeof attrs.toolName === 'string' ? attrs.toolName : frame.text;
  const args =
    attrs.args !== null && typeof attrs.args === 'object' && !Array.isArray(attrs.args)
      ? (attrs.args as Record<string, unknown>)
      : {};
  const options = Array.isArray(attrs.options)
    ? (attrs.options as unknown[]).filter((option): option is string => typeof option === 'string')
    : [];
  const danger = typeof attrs.danger === 'string' ? attrs.danger : undefined;
  return { callId, toolName, args, options, danger };
}

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { status: authStatus } = useAuth();
  const { t } = useI18n();
  // Ref mirror so long-lived callbacks/effects always read the current locale.
  const tRef = useRef<Translate>(t);
  tRef.current = t;

  const [sessions, setSessions] = useState<SessionEntity[]>([]);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [ledgersBySession, setLedgersBySession] = useState<Record<string, SessionLedger>>({});
  // A prompt run belongs to its session, not to the window: session name →
  // start millis. Switching sessions must not carry the spinner over.
  const [runsBySession, setRunsBySession] = useState<Record<string, number>>({});
  // Parked HITL vetoes per session name (polled while a run is active).
  const [vetoesBySession, setVetoesBySession] = useState<Record<string, PendingVeto[]>>({});
  // run_task background tasks per session name (refreshed on task events + selection).
  const [bgTasksBySession, setBgTasksBySession] = useState<Record<string, BgTask[]>>({});
  const [now, setNow] = useState(0);
  const [busStatus, setBusStatus] = useState<BusStatus>('disconnected');
  const [busActivity, setBusActivity] = useState<BusActivityItem[]>([]);

  // Refs the bus listeners read, so the single VetoBus instance never holds
  // stale closures.
  const sessionsRef = useRef<SessionEntity[]>([]);
  sessionsRef.current = sessions;
  const currentNameRef = useRef<string | null>(null);
  currentNameRef.current = currentName;
  const runsRef = useRef<Record<string, number>>({});
  runsRef.current = runsBySession;
  const vetoesRef = useRef<Record<string, PendingVeto[]>>({});
  vetoesRef.current = vetoesBySession;
  // In-flight prompt per session: name → { session id, abort controller }.
  const inFlightRef = useRef<Map<string, { id: string; controller: AbortController }>>(
    new Map(),
  );
  // Sessions whose history has already been fetched (or is fetching) —
  // re-selecting never refetches.
  const historyRequestedRef = useRef<Set<string>>(new Set());

  const appendLocal = useCallback((sessionName: string, entries: LedgerEntry[]): void => {
    setLedgersBySession((prev) => {
      const ledger = prev[sessionName] ?? EMPTY_LEDGER;
      return { ...prev, [sessionName]: { ...ledger, local: [...ledger.local, ...entries] } };
    });
  }, []);

  /**
   * Apply a freshly fetched turn log. History only grows within a session's
   * lifetime, so equal/shorter fetches are ignored (keeps object identity —
   * and the derived entries memo — stable across no-op polls). New turns
   * reconcile the local entries they now represent.
   */
  const applyTurns = useCallback((sessionName: string, turns: HistoryTurn[]): void => {
    setLedgersBySession((prev) => {
      const ledger = prev[sessionName] ?? EMPTY_LEDGER;
      if (ledger.turns !== undefined && turns.length <= ledger.turns.length) return prev;
      return {
        ...prev,
        [sessionName]: { turns, local: reconcileLocal(turns, ledger.local) },
      };
    });
  }, []);

  const pushBusActivity = useCallback((label: string, detail?: string): void => {
    setBusActivity((prev) =>
      [
        { id: nextEntryId('bus'), at: new Date().toISOString(), label, detail },
        ...prev,
      ].slice(0, MAX_BUS_ACTIVITY),
    );
  }, []);

  /**
   * Fetch and store the run_task background tasks for a session. Called on session
   * selection and whenever a TASK_STARTED/TASK_EXITED frame arrives, so the panel
   * tracks the live lifecycle without polling.
   */
  const refreshBgTasksByName = useCallback(async (sessionName: string): Promise<void> => {
    try {
      const response = await listBgTasks(sessionName);
      setBgTasksBySession((prev) => ({ ...prev, [sessionName]: response.tasks }));
    } catch {
      // Transient failure — keep the last known task list.
    }
  }, []);

  // The single shared bus instance, created once for the provider's lifetime.
  const busRef = useRef<VetoBus | null>(null);
  if (busRef.current === null) {
    busRef.current = new VetoBus({
      onStatus: (status) => setBusStatus(status),
      onDelta: (frame: DeltaFrame) => {
        // Task lifecycle events route by session id directly — a task can start or
        // exit whether or not a prompt run is in flight (a dev server may die long
        // after the episode that launched it ended).
        if (frame.kind === 'TASK_STARTED' || frame.kind === 'TASK_EXITED') {
          const session = sessionsRef.current.find((candidate) => candidate.id === frame.sessionId);
          if (session !== undefined) {
            void refreshBgTasksByName(session.name);
          }
          return;
        }
        // Route the frame to the session that owns the in-flight run.
        let owner: string | null = null;
        for (const [name, run] of inFlightRef.current) {
          if (run.id === frame.sessionId) {
            owner = name;
            break;
          }
        }
        if (owner === null) {
          const known = sessionsRef.current.some((session) => session.id === frame.sessionId);
          if (!known) {
            pushBusActivity(`frame ${frame.kind}`, frame.text.slice(0, 120));
          }
          // Frames for a session with no in-flight run repeat what REST already
          // recorded — ignored deliberately.
          return;
        }
        const sessionName = owner;
        switch (frame.kind) {
          case 'ASSISTANT_THOUGHT':
            appendLocal(sessionName, [liveEntry('thought', frame.text)]);
            return;
          case 'ASSISTANT_MESSAGE':
            appendLocal(sessionName, [liveEntry('message', frame.text)]);
            return;
          case 'VETO_REQUIRED': {
            // The agent parked — surface the approval card immediately.
            const veto = vetoFromFrame(frame);
            if (veto !== null) {
              setVetoesBySession((prev) => ({
                ...prev,
                [sessionName]: mergeVetoes(prev[sessionName] ?? [], [veto]),
              }));
            }
            return;
          }
          case 'VETO_RESOLVED': {
            const callId = typeof frame.attrs.callId === 'string' ? frame.attrs.callId : null;
            if (callId !== null) {
              setVetoesBySession((prev) => {
                const current = prev[sessionName] ?? [];
                if (!current.some((veto) => veto.callId === callId)) return prev;
                return {
                  ...prev,
                  [sessionName]: current.filter((veto) => veto.callId !== callId),
                };
              });
            }
            return;
          }
          case 'TOOL_CALL':
          case 'TOOL_RESULT':
          case 'COMPACTION':
          case 'BREAKER_TRIPPED':
          case 'ERROR':
            // Refresh the ledger from the turn log (the source of truth) right
            // away instead of waiting for the 5s backstop poll. Events drive the
            // immediacy; REST history stays authoritative (applyTurns ignores a
            // stale/shorter fetch, so racing refetches are safe).
            void getSessionHistory(sessionName)
              .then((turns) => applyTurns(sessionName, turns))
              .catch(() => undefined);
            return;
          case 'EPISODE_DONE': {
            // The authoritative "the run finished" signal (success flag in attrs).
            // Prompt submission only acks, so THIS frame ends the in-flight state
            // the sendPrompt set up — composer, rail LED, and veto cards included.
            inFlightRef.current.delete(sessionName);
            setRunsBySession((prev) => {
              if (!(sessionName in prev)) return prev;
              const next = { ...prev };
              delete next[sessionName];
              return next;
            });
            setVetoesBySession((prev) => {
              if (!(sessionName in prev)) return prev;
              const next = { ...prev };
              delete next[sessionName];
              return next;
            });
            void getSessionHistory(sessionName)
              .then((turns) => applyTurns(sessionName, turns))
              .catch(() => undefined);
            // Prompt activity bumps lastActiveAt — refresh the rail quietly.
            void listSessions()
              .then((list) => setSessions(list.sort(byActivityDesc)))
              .catch(() => undefined);
            return;
          }
          default:
            return;
        }
      },
      onMessage: (message: BusMessage) => {
        if (NOTABLE_BUS_TYPES.includes(message.type)) {
          pushBusActivity(message.type, summarizeBusMessage(message));
        }
      },
    });
  }

  const refresh = useCallback(async (): Promise<void> => {
    const list = (await listSessions()).sort(byActivityDesc);
    setSessions(list);
    setCurrentName((current) => {
      if (current !== null && list.some((session) => session.name === current)) return current;
      // Default to the latest session (the sorted head), never a random old one.
      return list.length > 0 ? list[0].name : null;
    });
  }, []);

  // Connect the bus and load sessions when signed in; tear down on sign-out.
  useEffect(() => {
    if (authStatus === 'signedIn') {
      busRef.current?.connect();
      void refresh().catch(() => {
        // The 401 handler or the rail's own error path surfaces failures.
      });
      return;
    }
    busRef.current?.disconnect();
    setSessions([]);
    setCurrentName(null);
    setLedgersBySession({});
    setRunsBySession({});
    setVetoesBySession({});
    setBgTasksBySession({});
    inFlightRef.current.clear();
    setBusActivity([]);
    historyRequestedRef.current.clear();
  }, [authStatus, refresh]);

  // Selecting a session fetches its persisted history once (the turn log is
  // the ledger's source of truth). Local entries that landed while the fetch
  // is in flight (just-sent prompt, live frames) survive via reconcileLocal.
  useEffect(() => {
    if (currentName === null) return;
    if (ledgersBySession[currentName]?.turns !== undefined) return;
    if (historyRequestedRef.current.has(currentName)) return;
    if (inFlightRef.current.has(currentName)) return;

    historyRequestedRef.current.add(currentName);
    const name = currentName;
    void getSessionHistory(name)
      .then((turns) => applyTurns(name, turns))
      .catch((error: unknown) => {
        // Quiet inline error entry — never crash the stream over history.
        const text =
          error instanceof ApiError ? error.message : tRef.current('error.backendUnreachable');
        appendLocal(name, [errorEntry(text)]);
      });
  }, [currentName, ledgersBySession, applyTurns, appendLocal]);

  // Selecting a session loads its run_task background tasks (the inspector panel
  // shows the current session's). Live TASK_STARTED/TASK_EXITED frames refresh them.
  useEffect(() => {
    if (currentName === null) return;
    void refreshBgTasksByName(currentName);
  }, [currentName, refreshBgTasksByName]);

  // Elapsed ticker: re-render once a second while the current session has a run.
  const pending = currentName !== null && runsBySession[currentName] !== undefined;
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  const elapsedSeconds = pending
    ? Math.max(0, Math.floor((now - runsBySession[currentName as string]) / 1000))
    : 0;

  // Poll parked HITL vetoes: every run-active session (a veto only parks while
  // its episode runs) plus the selected session (a parked veto may outlive the
  // UI's run record, e.g. after a reload). mergeVetoes keeps first-seen order
  // so each card stays where it was raised.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    const poll = async (): Promise<void> => {
      const names = new Set(Object.keys(runsRef.current));
      const current = currentNameRef.current;
      if (current !== null) names.add(current);
      for (const name of names) {
        try {
          const vetoes = await listVetoes(name);
          setVetoesBySession((prev) => {
            if (vetoes.length === 0 && (prev[name] ?? []).length === 0) return prev;
            return { ...prev, [name]: mergeVetoes(prev[name] ?? [], vetoes) };
          });
        } catch {
          // Transient failure — keep the last known veto state.
        }
      }
    };
    void poll();
    // VETO_REQUIRED/VETO_RESOLVED events surface and clear cards live; this poll
    // is a slower reconciliation backstop (a parked veto can outlive the UI's run
    // record, e.g. after a reload, and a missed frame must still heal).
    const timer = setInterval(() => void poll(), 5000);
    return () => clearInterval(timer);
  }, [authStatus, currentName, pending]);

  // While a session is working or parked on a veto, poll its turn log too so
  // the ledger grows live in absolute turnNumber order (tool calls/results,
  // resolved-veto outcomes). Stops when every session is idle.
  const anySessionActive =
    Object.keys(runsBySession).length > 0 ||
    Object.values(vetoesBySession).some((vetoes) => vetoes.length > 0);
  useEffect(() => {
    if (authStatus !== 'signedIn' || !anySessionActive) return;
    const poll = async (): Promise<void> => {
      const names = new Set<string>(Object.keys(runsRef.current));
      for (const [name, vetoes] of Object.entries(vetoesRef.current)) {
        if (vetoes.length > 0) names.add(name);
      }
      for (const name of names) {
        try {
          applyTurns(name, await getSessionHistory(name));
        } catch {
          // Transient failure — the next poll retries.
        }
      }
    };
    void poll();
    // TOOL_CALL/TOOL_RESULT/EPISODE_DONE events trigger an immediate refetch, so
    // this poll is a slower backstop for stretches with no tool events and for
    // healing a missed frame.
    const timer = setInterval(() => void poll(), 5000);
    return () => clearInterval(timer);
  }, [authStatus, anySessionActive, applyTurns]);

  const select = useCallback((name: string): void => {
    setCurrentName(name);
  }, []);

  const create = useCallback(
    async (pattern: string, name: string | undefined, workspaceRootsCsv: string): Promise<void> => {
      const created = await createSession({ pattern, name, workspaceRoots: workspaceRootsCsv });
      // Newest goes to the top of the rail and becomes the selection.
      setSessions((prev) => [created, ...prev]);
      setCurrentName(created.name);
    },
    [],
  );

  const remove = useCallback(
    async (name: string): Promise<void> => {
      await deleteSession(name);
      setSessions((prev) => prev.filter((session) => session.name !== name));
      setLedgersBySession((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
      historyRequestedRef.current.delete(name);
      setCurrentName((current) => (current === name ? null : current));
    },
    [],
  );

  const sendPrompt = useCallback(
    async (text: string): Promise<void> => {
      const sessionName = currentName;
      const session = sessionsRef.current.find((candidate) => candidate.name === sessionName);
      if (sessionName === null || session === undefined) return;
      if (inFlightRef.current.has(sessionName)) return;

      const controller = new AbortController();
      inFlightRef.current.set(sessionName, { id: session.id, controller });

      appendLocal(sessionName, [userEntry(text)]);
      setRunsBySession((prev) => ({ ...prev, [sessionName]: Date.now() }));

      try {
        await postPrompt(sessionName, text);
        // 202 ack: the episode runs on the backend from here. Progress and the
        // outcome arrive as bus events; the EPISODE_DONE handler clears the
        // in-flight state (composer, rail LED, veto cards) and refetches
        // history — nothing to await in this call.
      } catch (error) {
        // Submission itself failed (auth / not found / network) — the episode
        // never started, so roll back the in-flight state and surface it inline.
        inFlightRef.current.delete(sessionName);
        setRunsBySession((prev) => {
          const next = { ...prev };
          delete next[sessionName];
          return next;
        });
        setLedgersBySession((prev) => {
          const ledger = prev[sessionName] ?? EMPTY_LEDGER;
          return {
            ...prev,
            [sessionName]: {
              ...ledger,
              local: ledger.local.filter((entry) => !entry.live),
            },
          };
        });
        if (error instanceof ApiError) {
          appendLocal(sessionName, [errorEntry(error.message)]);
        } else {
          appendLocal(sessionName, [errorEntry(tRef.current('error.backendUnreachable'))]);
        }
      }
    },
    [appendLocal, currentName],
  );

  const cancelPrompt = useCallback((): void => {
    const name = currentNameRef.current;
    if (name === null) return;
    // Backend half first: decline any veto the agent is parked on so it unstucks
    // fail-safe instead of waiting on a decision that will never come. Then end
    // the wait locally — a running episode winds down on the backend and its
    // turns land in history (the backstop poll picks up what the bus misses).
    void postCancelSession(name).catch(() => undefined);
    inFlightRef.current.get(name)?.controller.abort();
    inFlightRef.current.delete(name);
    setRunsBySession((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setVetoesBySession((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    appendLocal(name, [errorEntry(tRef.current('error.promptCancelled'))]);
    void getSessionHistory(name)
      .then((turns) => applyTurns(name, turns))
      .catch(() => undefined);
  }, [applyTurns]);

  const resolveVeto = useCallback(async (callId: string, option: string): Promise<void> => {
    const name = currentNameRef.current;
    if (name === null) return;
    await postResolveVeto(name, callId, option);
    setVetoesBySession((prev) => ({
      ...prev,
      [name]: (prev[name] ?? []).filter((veto) => veto.callId !== callId),
    }));
  }, []);

  const currentLedger =
    currentName !== null ? (ledgersBySession[currentName] ?? EMPTY_LEDGER) : EMPTY_LEDGER;
  const entries = useMemo(() => deriveEntries(currentLedger), [currentLedger]);
  const vetoes = currentName !== null ? (vetoesBySession[currentName] ?? NO_VETOES) : NO_VETOES;
  const bgTasks =
    currentName !== null ? (bgTasksBySession[currentName] ?? NO_BG_TASKS) : NO_BG_TASKS;
  const refreshBgTasks = useCallback(async (): Promise<void> => {
    const name = currentNameRef.current;
    if (name === null) return;
    await refreshBgTasksByName(name);
  }, [refreshBgTasksByName]);
  const sessionStates = useMemo<Record<string, SessionWorkState>>(() => {
    const states: Record<string, SessionWorkState> = {};
    for (const session of sessions) {
      states[session.name] =
        (vetoesBySession[session.name] ?? []).length > 0
          ? 'awaiting'
          : runsBySession[session.name] !== undefined
            ? 'working'
            : 'idle';
    }
    return states;
  }, [sessions, vetoesBySession, runsBySession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      sessions,
      currentName,
      entries,
      pending,
      elapsedSeconds,
      vetoes,
      bgTasks,
      refreshBgTasks,
      sessionStates,
      busStatus,
      busActivity,
      refresh,
      select,
      create,
      remove,
      sendPrompt,
      cancelPrompt,
      resolveVeto,
    }),
    [
      sessions,
      currentName,
      entries,
      pending,
      elapsedSeconds,
      vetoes,
      bgTasks,
      refreshBgTasks,
      sessionStates,
      busStatus,
      busActivity,
      refresh,
      select,
      create,
      remove,
      sendPrompt,
      cancelPrompt,
      resolveVeto,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSessions(): SessionContextValue {
  const context = useContext(SessionContext);
  if (context === null) {
    throw new Error('useSessions must be used within SessionProvider');
  }
  return context;
}
