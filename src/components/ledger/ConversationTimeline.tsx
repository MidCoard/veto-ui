import { useMemo, useState } from 'react';
import type { SessionRecord } from '../../api/types';
import { combineToolEntries, entriesFromHistory, type LedgerEntry } from '../../state/ledger';
import { useI18n } from '../../i18n/I18nContext';
import LedgerEntryView from './LedgerEntry';

type Block = { id: string; at: number; records: SessionRecord[] };
function RewoundBlock({ block }: { block: Block }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(40);
  const entries = useMemo(() => open ? combineToolEntries(entriesFromHistory(block.records)) : [], [open, block.records]);
  return <section className="my-3 overflow-hidden rounded-lg border border-dashed border-rule bg-panel/30">
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="ui-button flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-dim hover:bg-raised/40">
      <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      <span><span className="block font-medium">{t('conversation.rewoundTitle')}</span><span className="mt-1 block text-xs">{t('conversation.rewoundHint')}</span></span>
    </button>
    {open && <div className="border-t border-rule/60 px-3 py-2">
      {entries.slice(0, limit).map(entry => <LedgerEntryView key={entry.id} entry={entry} toolRunning={false} />)}
      {entries.length > limit && <button type="button" className="ui-button my-2 rounded border border-rule px-3 py-1 text-xs" onClick={() => setLimit(value => value + 40)}>{t('records.loadMore', { count: entries.length - limit })}</button>}
    </div>}
  </section>;
}

export default function ConversationTimeline({ entries, records = [], running = false }: { entries: LedgerEntry[]; records?: SessionRecord[]; running?: boolean }) {
  const { blocks, visible } = useMemo(() => {
    const blocks: Block[] = [];
    const removed = new Set<string>();
    let current: Block | undefined;
    for (const record of [...records].sort((a, b) => a.turnNumber - b.turnNumber)) {
      if (!record.active) removed.add(`h-${record.turnNumber}`);
      if (!record.active && record.rewoundByTurnNumber > 0) {
        if (!current || current.records[0].rewoundByTurnNumber !== record.rewoundByTurnNumber) {
          current = { id: `${record.agentId}-${record.turnNumber}-${record.rewoundByTurnNumber}`, at: record.turnNumber, records: [] };
          blocks.push(current);
        }
        current.records.push(record);
      } else current = undefined;
    }
    return { blocks: blocks.filter(block => block.records.some(record => ['USER_PROMPT', 'ASSISTANT_THOUGHT', 'ASSISTANT_RESPONSE', 'TOOL_CALL', 'TOOL_RESPONSE'].includes(record.type) && typeof record.payload.restored_from_turn !== 'number')), visible: combineToolEntries(entries.filter(entry => !removed.has(entry.id))) };
  }, [entries, records]);
  const lastUser = visible.reduce((last, entry, index) => entry.kind === 'user' ? index : last, -1);
  const output = [];
  let nextBlock = 0;
  for (const [index, entry] of visible.entries()) {
    const turn = /^h-(\d+)$/.exec(entry.id);
    const at = turn ? Number(turn[1]) : Infinity;
    while (nextBlock < blocks.length && blocks[nextBlock].at < at) {
      const block = blocks[nextBlock++];
      output.push(<RewoundBlock key={block.id} block={block} />);
    }
    output.push(<LedgerEntryView key={entry.id} entry={entry} toolRunning={running && index > lastUser} />);
  }
  for (; nextBlock < blocks.length; nextBlock++) output.push(<RewoundBlock key={blocks[nextBlock].id} block={blocks[nextBlock]} />);
  return <>{output}</>;
}
