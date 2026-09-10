import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ApiError, getToken } from '../api/client';
import {
  answerUserQuestions as postAnswerUserQuestions,
  cancelUserQuestions as postCancelUserQuestions,
  cancelSession as postCancelSession,
  createSession,
  deleteSession,
  listSessions,
  resolveVeto as postResolveVeto,
  sendPrompt as postPrompt,
} from '../api/endpoints';
import type { BgTask, PendingUserQuestions, PendingVeto, SessionEntity } from '../api/types';
import { VetoBus } from '../bus/VetoBus';
import type { BusMessage, BusStatus, DeltaFrame } from '../bus/VetoBus';
import { useI18n } from '../i18n/I18nContext';
import type { Translate } from '../i18n/I18nContext';
import { toDate } from '../lib/time';
import { useAuth } from './AuthContext';
import {
  deriveEntries,
  acceptsHistoryUpdate,
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
import { tokenUsageFromHistory, type TokenUsage } from '../lib/tokenUsage';
import { backendApiUrl } from '../config/backend';
import { sessionResources, resetSessionResources, recoverSessionResources, isSessionResourceName } from './sessionResources';

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
 *     parks or resumes. Shared snapshots reconcile committed invalidations and
 *     connection/focus recovery; no session-data polling is used.
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
  tokenUsage: TokenUsage;
  /** True when the CURRENT session has a prompt in flight. */
  pending: boolean;
  elapsedSeconds: number;
  /** Pending HITL vetoes for the current session (parked tool calls). */
  vetoes: PendingVeto[];
  /** Pending ask_user batches for the current session. */
  questions: PendingUserQuestions[];
  /** run_task background tasks for the current session (running first, then stopped). */
  bgTasks: BgTask[];
  bgTasksStatus: 'loading' | 'ready' | 'error';
  /** Re-fetch the current session's background tasks. */
  refreshBgTasks: () => Promise<void>;
  /** work state per session name — drives the rail's status LEDs. */
  sessionStates: Record<string, SessionWorkState>;
  busStatus: BusStatus;
  busActivity: BusActivityItem[];
  refresh: () => Promise<void>;
  select: (name: string) => void;
  create: (
    pattern: string,
    name: string | undefined,
    workspaceRootsCsv: string,
    toolResultPresentation: 'BASIC' | 'DETAILED',
    guidedEnabled: boolean,
  ) => Promise<void>;
  remove: (name: string) => Promise<void>;
  sendPrompt: (text: string) => Promise<void>;
  cancelPrompt: () => void;
  resolveVeto: (callId: string, option: string) => Promise<void>;
  answerQuestions: (callId: string, answers: Record<string, string>) => Promise<void>;
  cancelQuestions: (callId: string) => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const MAX_BUS_ACTIVITY = 20;

/** Stable empty array so `vetoes` doesn't break the context memo when absent. */
const NO_VETOES: PendingVeto[] = [];
const NO_QUESTIONS: PendingUserQuestions[] = [];

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
  const authStatusRef = useRef(authStatus);
  authStatusRef.current = authStatus;
  const catalogueVersion = useRef(0);
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
  // Authoritative interaction snapshots per session, refreshed by registry events.
  const [vetoesBySession, setVetoesBySession] = useState<Record<string, PendingVeto[]>>({});
  const [questionsBySession, setQuestionsBySession] = useState<
    Record<string, PendingUserQuestions[]>
  >({});
  // run_task background tasks per session name (refreshed on task events + selection).
  const [bgTasksBySession, setBgTasksBySession] = useState<Record<string, BgTask[]>>({});
  const [bgTaskStatusBySession, setBgTaskStatusBySession] = useState<Record<string, 'loading' | 'ready' | 'error'>>({});
  const submitting = useRef(new Set<string>());
  const [busyBySession, setBusyBySession] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(0);
  const [busStatus, setBusStatus] = useState<BusStatus>('disconnected');
  const [busActivity, setBusActivity] = useState<BusActivityItem[]>([]);

  // Refs the bus listeners read, so the single VetoBus instance never holds
  // stale closures.
  const sessionsRef = useRef<SessionEntity[]>([]);
  sessionsRef.current = sessions;
  const currentNameRef = useRef<string | null>(null);
  currentNameRef.current = currentName;
  const questionsRef = useRef<Record<string, PendingUserQuestions[]>>({});
  questionsRef.current = questionsBySession;
  // In-flight prompt per session: name → { session id, abort controller }.
  const inFlightRef = useRef<Map<string, { id: string; controller: AbortController }>>(
    new Map(),
  );
  const appendLocal = useCallback((sessionName: string, entries: LedgerEntry[]): void => {
    setLedgersBySession((prev) => {
      const ledger = prev[sessionName] ?? EMPTY_LEDGER;
      return { ...prev, [sessionName]: { ...ledger, local: [...ledger.local, ...entries] } };
    });
  }, []);

  /**
   * Apply a freshly fetched turn log, including same-length metadata updates
   * accepted by acceptsHistoryUpdate (keeps object identity —
   * and the derived entries memo — stable across unchanged snapshots). New turns
   * reconcile the local entries they now represent.
   */
  const applyTurns = useCallback((sessionName: string, turns: HistoryTurn[]): void => {
    setLedgersBySession((prev) => {
      const ledger = prev[sessionName] ?? EMPTY_LEDGER;
      if (!acceptsHistoryUpdate(ledger.turns, turns)) return prev;
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

  const refreshBgTasksByName = useCallback(async (name: string): Promise<void> => {
    const session = sessionsRef.current.find(candidate => candidate.name === name);
    if (session) sessionResources(name, session.id).tasks.invalidate();
  }, []);

  const requestCatalogueRef = useRef<() => void>(() => {});

  // The single shared bus instance, created once for the provider's lifetime.
  const busRef = useRef<VetoBus | null>(null);
  if (busRef.current === null) {
    busRef.current = new VetoBus({
      onStatus: (status) => setBusStatus(status),
      onDelta: (frame: DeltaFrame) => {
        const changedSession = sessionsRef.current.find(session => session.id === frame.sessionId);
        if (changedSession && (frame.kind === 'RECORD_UPDATED' || frame.kind === 'EPISODE_DONE')) {
          const resources = sessionResources(changedSession.name, changedSession.id);
          resources.records.invalidate();
          resources.history.invalidate();
          if (frame.kind === 'EPISODE_DONE') resources.agents.invalidate();
        }
        if (frame.kind === 'RECORD_UPDATED') { if (!changedSession) requestCatalogueRef.current(); return; }
        // Task lifecycle events route by session id directly — a task can start or
        // exit whether or not a prompt run is in flight (a dev server may die long
        // after the episode that launched it ended).
        if (frame.kind === 'TASK_STARTED' || frame.kind === 'TASK_EXITED') {
          const session = sessionsRef.current.find((candidate) => candidate.id === frame.sessionId);
          if (session !== undefined) {
            void refreshBgTasksByName(session.name);
          } else requestCatalogueRef.current();
          return;
        }
        if (changedSession && frame.kind === 'SESSION_INVALIDATED') {
          const values = frame.attrs.resources;
          if (Array.isArray(values)) {
            const resources = sessionResources(changedSession.name, changedSession.id);
            values.filter(isSessionResourceName).forEach(key => resources[key].invalidate());
          }
          return;
        }
        if (!changedSession) {
          pushBusActivity(`frame ${frame.kind}`, frame.text.slice(0, 120));
          // A catalogue refresh discovers sessions created in another window. The
          // initial resource read includes changes that preceded discovery.
          requestCatalogueRef.current();
          return;
        }
        const sessionName = changedSession.name;
        switch (frame.kind) {
          case 'ASSISTANT_THOUGHT':
            if (frame.attrs.agentId !== changedSession.primaryAgentId) return;
            appendLocal(sessionName, [liveEntry('thought', frame.text, frame.emittedAt)]);
            return;
          case 'ASSISTANT_MESSAGE':
            if (frame.attrs.agentId !== changedSession.primaryAgentId) return;
            appendLocal(sessionName, [liveEntry('message', frame.text, frame.emittedAt)]);
            return;
          case 'VETO_REQUIRED': {
            sessionResources(sessionName, changedSession.id).interactions.invalidate();
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
            sessionResources(sessionName, changedSession.id).interactions.invalidate();
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
          case 'TOKEN_USAGE':
          case 'BREAKER_TRIPPED':
          case 'ERROR':
            // Persisted changes arrive through RECORD_UPDATED. Streaming events do not
            // issue a second history request before persistence has completed.
            return;
          case 'EPISODE_DONE': {
            // Completion of one episode cannot clear a newer queued operation.
            // Reconcile actual runtime state rather than clearing local flags here.
            const resources = sessionResources(sessionName, changedSession.id);
            resources.execution.invalidate();
            resources.interactions.invalidate();
            requestCatalogueRef.current();
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
    const version = ++catalogueVersion.current;
    const token = getToken();
    const origin = backendApiUrl('');
    const list = (await listSessions()).sort(byActivityDesc);
    if (version !== catalogueVersion.current || authStatusRef.current !== 'signedIn' || token !== getToken() || origin !== backendApiUrl('')) return;
    setSessions(list);
    setCurrentName((current) => {
      if (current !== null && list.some((session) => session.name === current)) return current;
      // Default to the latest session (the sorted head), never a random old one.
      return list.length > 0 ? list[0].name : null;
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    requestCatalogueRef.current = () => {
      if (timer !== null || disposed) return;
      timer = setTimeout(() => {
        void refresh().catch(() => undefined).finally(() => { timer = null; });
      }, 250);
    };
    return () => { disposed = true; if (timer !== null) clearTimeout(timer); requestCatalogueRef.current = () => {}; };
  }, [refresh]);

  // Connect the bus and load sessions when signed in; tear down on sign-out.
  useEffect(() => {
    if (authStatus === 'signedIn') {
      busRef.current?.connect();
      void refresh().catch(() => {
        // The 401 handler or the rail's own error path surfaces failures.
      });
      return () => { catalogueVersion.current += 1; busRef.current?.disconnect(); };
    }
    catalogueVersion.current += 1;
    busRef.current?.disconnect();
    setSessions([]);
    setCurrentName(null);
    setLedgersBySession({});
    setRunsBySession({});
    setVetoesBySession({});
    setBgTasksBySession({});
    setBgTaskStatusBySession({});
    inFlightRef.current.forEach(run => run.controller.abort());
    inFlightRef.current.clear();
    setBusActivity([]);
    resetSessionResources();
    submitting.current.clear();
    setBusyBySession({});
    setQuestionsBySession({});
  }, [authStatus, refresh]);

  // One history subscription per selected or locally running session. Other sessions
  // retain dirty cached snapshots until they are observed again.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    const names = new Set(Object.keys(runsBySession));
    if (currentName !== null) names.add(currentName);
    const subscriptions = [...names].flatMap(name => {
      const session = sessions.find(candidate => candidate.name === name);
      if (!session) return [];
      const history = sessionResources(name, session.id).history;
      const update = () => {
        const snapshot = history.getSnapshot();
        if (snapshot.data !== null) applyTurns(name, snapshot.data);
      };
      const unsubscribe = history.subscribe(update);
      update();
      return [unsubscribe];
    });
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [authStatus, currentName, sessions, runsBySession, applyTurns]);

  // Recover observed resources once on connection/focus, using the same coalescing queue.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    const recover = () => {
      if (document.visibilityState !== 'visible') return;
      if (busStatus !== 'connected') busRef.current?.connect();
      recoverSessionResources();
      void refresh().catch(() => undefined);
    };
    if (busStatus === 'connected') recoverSessionResources();
    window.addEventListener('focus', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      window.removeEventListener('focus', recover);
      document.removeEventListener('visibilitychange', recover);
    };
  }, [authStatus, busStatus, refresh]);

  // Execution/interaction summaries are observed for each rail session, including
  // work initiated in another window. Task details only load for the selected session.
  useEffect(() => {
    if (authStatus !== 'signedIn') return;
    const subscriptions: (() => void)[] = [];
    for (const session of sessions) {
      const resources = sessionResources(session.name, session.id);
      const execution = () => {
        const snapshot = resources.execution.getSnapshot();
        if (snapshot.data === null || snapshot.stale || snapshot.error !== null) return;
        setBusyBySession(previous => {
          const busy = snapshot.data!.some(agent => agent.busy);
          return previous[session.name] === busy ? previous : { ...previous, [session.name]: busy };
        });
        if (submitting.current.has(session.name)) return;
        const primaryBusy = snapshot.data.some(agent => agent.agentId === session.primaryAgentId && agent.busy);
        if (!primaryBusy) inFlightRef.current.delete(session.name);
        setRunsBySession(previous => {
          if (primaryBusy) return previous[session.name] === undefined ? { ...previous, [session.name]: Date.now() } : previous;
          if (!(session.name in previous)) return previous;
          const next = { ...previous }; delete next[session.name]; return next;
        });
      };
      const interactions = () => {
        const snapshot = resources.interactions.getSnapshot();
        if (snapshot.data === null || snapshot.stale) return;
        // Authoritative replacement removes approvals resolved in another window.
        setVetoesBySession(previous => previous[session.name] === snapshot.data!.vetoes ? previous : { ...previous, [session.name]: snapshot.data!.vetoes });
        setQuestionsBySession(previous => previous[session.name] === snapshot.data!.questions ? previous : { ...previous, [session.name]: snapshot.data!.questions });
      };
      subscriptions.push(resources.execution.subscribe(execution), resources.interactions.subscribe(interactions));
      execution(); interactions();
      if (session.name === currentName) {
        const tasks = () => {
          const snapshot = resources.tasks.getSnapshot();
          if (snapshot.data !== null) setBgTasksBySession(previous => previous[session.name] === snapshot.data!.tasks ? previous : { ...previous, [session.name]: snapshot.data!.tasks });
          const status = snapshot.error !== null ? 'error' : snapshot.data === null ? 'loading' : 'ready';
          setBgTaskStatusBySession(previous => previous[session.name] === status ? previous : { ...previous, [session.name]: status });
        };
        subscriptions.push(resources.tasks.subscribe(tasks)); tasks();
      }
    }
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [authStatus, sessions, currentName]);

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

  const select = useCallback((name: string): void => {
    setCurrentName(name);
  }, []);

  const create = useCallback(
    async (
      pattern: string,
      name: string | undefined,
      workspaceRootsCsv: string,
      toolResultPresentation: 'BASIC' | 'DETAILED',
      guidedEnabled: boolean,
    ): Promise<void> => {
      const created = await createSession({
        pattern,
        name,
        workspaceRoots: workspaceRootsCsv,
        toolResultPresentation,
        guidedEnabled,
      });
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

      const token = getToken();
      const origin = backendApiUrl('');
      const stillAuthorized = () => authStatusRef.current === 'signedIn' && token === getToken() && origin === backendApiUrl('');
      submitting.current.add(sessionName);
      sessionResources(sessionName, session.id).execution.invalidate();
      try {
        await postPrompt(sessionName, text, controller.signal);
        // 202 ack: the episode runs on the backend from here. Progress and the
        // outcome arrive as bus events; execution snapshots reconcile the
        // in-flight state without clearing newer queued work.
      } catch (error) {
        if (!stillAuthorized()) return;
        // Submission itself failed (auth / not found / network) — the episode
        // may be unconfirmed after a network failure. Surface it without retrying;
        // authoritative execution snapshots recover any work already accepted.
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
      } finally {
        submitting.current.delete(sessionName);
        if (!stillAuthorized()) return;
        const resources = sessionResources(sessionName, session.id);
        resources.execution.invalidate(); resources.records.invalidate(); resources.history.invalidate();
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
    // turns land in history through committed-record events and recovery snapshots.
    void postCancelSession(name).finally(() => { const session = sessionsRef.current.find(candidate => candidate.name === name); if (session) { const resources = sessionResources(name, session.id); resources.execution.invalidate(); resources.interactions.invalidate(); resources.history.invalidate(); } }).catch(() => undefined);
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
    for (const question of questionsRef.current[name] ?? []) {
      void postCancelUserQuestions(name, question.callId).catch(() => undefined);
    }
    setQuestionsBySession((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
    appendLocal(name, [errorEntry(tRef.current('error.promptCancelled'))]);
    const session = sessionsRef.current.find(candidate => candidate.name === name);
    if (session) sessionResources(name, session.id).history.invalidate();
  }, []);

  const resolveVeto = useCallback(async (callId: string, option: string): Promise<void> => {
    const name = currentNameRef.current;
    if (name === null) return;
    await postResolveVeto(name, callId, option);
      const session = sessionsRef.current.find(candidate => candidate.name === name);
      if (session) sessionResources(name, session.id).interactions.invalidate();
    setVetoesBySession((prev) => ({
      ...prev,
      [name]: (prev[name] ?? []).filter((veto) => veto.callId !== callId),
    }));
  }, []);

  const answerQuestions = useCallback(
    async (callId: string, answers: Record<string, string>): Promise<void> => {
      const name = currentNameRef.current;
      if (name === null) return;
      await postAnswerUserQuestions(name, callId, answers);
      const session = sessionsRef.current.find(candidate => candidate.name === name);
      if (session) sessionResources(name, session.id).interactions.invalidate();
      setQuestionsBySession((prev) => ({
        ...prev,
        [name]: (prev[name] ?? []).filter((batch) => batch.callId !== callId),
      }));
    },
    [],
  );

  const cancelQuestions = useCallback(async (callId: string): Promise<void> => {
    const name = currentNameRef.current;
    if (name === null) return;
    await postCancelUserQuestions(name, callId);
      const session = sessionsRef.current.find(candidate => candidate.name === name);
      if (session) sessionResources(name, session.id).interactions.invalidate();
    setQuestionsBySession((prev) => ({
      ...prev,
      [name]: (prev[name] ?? []).filter((batch) => batch.callId !== callId),
    }));
  }, []);

  const currentLedger =
    currentName !== null ? (ledgersBySession[currentName] ?? EMPTY_LEDGER) : EMPTY_LEDGER;
  const entries = useMemo(() => deriveEntries(currentLedger), [currentLedger]);
  const tokenUsage = useMemo(() => tokenUsageFromHistory(currentLedger.turns ?? []), [currentLedger]);
  const vetoes = currentName !== null ? (vetoesBySession[currentName] ?? NO_VETOES) : NO_VETOES;
  const questions =
    currentName !== null ? (questionsBySession[currentName] ?? NO_QUESTIONS) : NO_QUESTIONS;
  const bgTasks =
    currentName !== null ? (bgTasksBySession[currentName] ?? NO_BG_TASKS) : NO_BG_TASKS;
  const bgTasksStatus = currentName === null ? 'ready' : busStatus !== 'connected' ? 'error' : bgTaskStatusBySession[currentName] ?? 'loading';
  const refreshBgTasks = useCallback(async (): Promise<void> => {
    const name = currentNameRef.current;
    if (name === null) return;
    await refreshBgTasksByName(name);
  }, [refreshBgTasksByName]);
  const sessionStates = useMemo<Record<string, SessionWorkState>>(() => {
    const states: Record<string, SessionWorkState> = {};
    for (const session of sessions) {
      states[session.name] =
        (vetoesBySession[session.name] ?? []).length > 0 ||
        (questionsBySession[session.name] ?? []).length > 0
          ? 'awaiting'
          : busyBySession[session.name] || runsBySession[session.name] !== undefined
            ? 'working'
            : 'idle';
    }
    return states;
  }, [sessions, vetoesBySession, questionsBySession, runsBySession, busyBySession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      sessions,
      currentName,
      entries,
      tokenUsage,
      pending,
      elapsedSeconds,
      vetoes,
      questions,
      bgTasks,
      bgTasksStatus,
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
      answerQuestions,
      cancelQuestions,
    }),
    [
      sessions,
      currentName,
      entries,
      tokenUsage,
      pending,
      elapsedSeconds,
      vetoes,
      questions,
      bgTasks,
      bgTasksStatus,
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
      answerQuestions,
      cancelQuestions,
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
