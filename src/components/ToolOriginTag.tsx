import { useI18n } from '../i18n/I18nContext';

export default function ToolOriginTag({ origin, pluginId }: { origin?: unknown; pluginId?: unknown }) {
  const { t } = useI18n();
  if (typeof origin !== 'string' || !['plugin', 'native', 'agent_loop', 'external_mcp'].includes(origin)) return null;
  const keys = { plugin: 'tool.origin.plugin', native: 'tool.origin.native', agent_loop: 'tool.origin.agent_loop', external_mcp: 'tool.origin.external_mcp' } as const;
  const label = t(keys[origin as keyof typeof keys]);
  const detail = origin === 'plugin' && typeof pluginId === 'string' ? `${label} · ${pluginId}` : label;
  return <span title={`${t('tool.origin.label')}: ${detail}`} className="shrink-0 rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] leading-4 text-dim">{detail}</span>;
}
