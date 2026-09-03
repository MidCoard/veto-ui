import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { useSessions } from '../state/SessionContext';
import type { BusStatus } from '../bus/VetoBus';
import { useI18n } from '../i18n/I18nContext';
import type { MessageKey } from '../i18n/en';

/**
 * StatusBar — wordmark, bus connection dot with a collapsible activity popover,
 * settings gear, authed username, sign-out. Language + theme live ONLY in
 * Settings → Preferences (one canonical surface). The dot's color is the whole
 * connection story: pass = connected, accent = connecting/reconnecting,
 * verdict = disconnected.
 *
 * The header carries `relative z-40` so the bus-activity popover stacks above
 * the session rail (z-30) instead of painting underneath it.
 */

const dotStyles: Record<BusStatus, string> = {
  connected: 'bg-pass',
  connecting: 'bg-accent animate-pulse',
  reconnecting: 'bg-accent animate-pulse',
  disconnected: 'bg-verdict',
};

const dotLabelKeys: Record<BusStatus, MessageKey> = {
  connected: 'status.busConnected',
  connecting: 'status.busConnecting',
  reconnecting: 'status.busReconnecting',
  disconnected: 'status.busDisconnected',
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

interface StatusBarProps {
  onToggleRail?: () => void;
  onToggleInspector?: () => void;
  recordsOpen?: boolean;
  onToggleRecords?: () => void;
  /** True while the settings view is showing — the gear becomes a back button. */
  settingsOpen?: boolean;
  onToggleSettings?: () => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onToggleRail,
  onToggleInspector,
  recordsOpen = false,
  onToggleRecords,
  settingsOpen = false,
  onToggleSettings,
}) => {
  const { username, signOut } = useAuth();
  const { busStatus, busActivity } = useSessions();
  const { t } = useI18n();
  const [activityOpen, setActivityOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activityOpen) return;
    const handleClickOutside = (event: MouseEvent): void => {
      if (popoverRef.current !== null && !popoverRef.current.contains(event.target as Node)) {
        setActivityOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activityOpen]);

  return (
    <header className="relative z-40 flex items-center gap-3 h-12 px-4 bg-panel border-b border-rule shrink-0">
      {onToggleRail !== undefined && (
        <button
          type="button"
          onClick={onToggleRail}
          aria-label={t('status.toggleRail')}
          className="md:hidden text-dim hover:text-paper hover:bg-raised rounded-md p-1.5"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <span className="font-display font-bold tracking-widest text-paper">VETO</span>

      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setActivityOpen((open) => !open)}
          aria-expanded={activityOpen}
          aria-label={t('status.busActivityAria', { status: t(dotLabelKeys[busStatus]) })}
          className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-raised"
        >
          <span className={`w-2 h-2 rounded-full ${dotStyles[busStatus]}`} />
          <span className="font-mono text-xs text-dim">{busStatus}</span>
        </button>

        {activityOpen && (
          <div className="absolute left-0 top-full mt-2 w-80 max-h-72 overflow-y-auto bg-raised border border-rule rounded-lg shadow-2xl z-50">
            <div className="px-3 py-2 border-b border-rule font-display text-[11px] uppercase tracking-[0.14em] text-dim">
              {t('status.busActivity')}
            </div>
            {busActivity.length === 0 ? (
              <p className="px-3 py-3 text-sm text-dim">{t('status.busEmpty')}</p>
            ) : (
              <ul className="divide-y divide-rule/60">
                {busActivity.map((item) => (
                  <li key={item.id} className="px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs text-accent">{item.label}</span>
                      <span className="font-mono text-[11px] text-dim/70">{formatTime(item.at)}</span>
                    </div>
                    {item.detail !== undefined && (
                      <p className="text-xs text-dim mt-0.5 break-words">{item.detail}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {onToggleRecords !== undefined && (
        <button
          type="button"
          onClick={onToggleRecords}
          aria-label={recordsOpen ? t('records.back') : t('records.title')}
          title={recordsOpen ? t('records.back') : t('records.title')}
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs ${
            recordsOpen ? 'bg-accent/10 text-accent' : 'text-dim hover:bg-raised hover:text-paper'
          }`}
        >
          {recordsOpen ? (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h11" />
            </svg>
          )}
          <span className="hidden sm:inline">{recordsOpen ? t('records.back') : t('records.title')}</span>
        </button>
      )}

      {onToggleSettings !== undefined && (
        <button
          type="button"
          onClick={onToggleSettings}
          aria-label={settingsOpen ? t('settings.back') : t('settings.title')}
          title={settingsOpen ? t('settings.back') : t('settings.title')}
          className={`rounded-md p-1.5 ${
            settingsOpen ? 'text-accent hover:bg-accent/10' : 'text-dim hover:text-paper hover:bg-raised'
          }`}
        >
          {settingsOpen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      )}

      {onToggleInspector !== undefined && (
        <button
          type="button"
          onClick={onToggleInspector}
          aria-label={t('status.toggleInspector')}
          className="hidden lg:inline-flex text-dim hover:text-paper hover:bg-raised rounded-md p-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 4h11a1 1 0 011 1v14a1 1 0 01-1 1H9m0-16v16m0-16H4a1 1 0 00-1 1v14a1 1 0 001 1h5" />
          </svg>
        </button>
      )}

      {username !== null && (
        <span className="font-mono text-sm text-dim">{username}</span>
      )}
      <button
        type="button"
        onClick={signOut}
        className="text-sm text-dim hover:text-paper hover:bg-raised rounded-md px-3 py-1.5"
      >
        {t('status.signOut')}
      </button>
    </header>
  );
};

export default StatusBar;
