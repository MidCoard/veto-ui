# Records event synchronization: LLD and MVP

## User outcome
Records updates after committed changes without a refresh button or periodic snapshot polling. Existing selection and expanded records survive refreshes.

## Write path
All TurnLogService writes (ordinary append, required notification append, metadata update) publish RECORD_UPDATED through the existing DeltaBroker only after persistence succeeds. When participating in an outer transaction, publish from afterCommit; rollback emits nothing. Payload contains sessionId and turnNumber, with the existing broker sequence and emittedAt. Existing WebSocket authorization/routing remains unchanged. No record contents are added to the signal.

## Read path
Initial selection loads an authoritative REST snapshot. RECORD_UPDATED invalidates that session; the mounted Records page coalesces nearby signals for 250ms and reloads. One request runs at a time. Changes arriving during a fetch mark it dirty and cause a follow-up fetch. Reconnection, page focus, and episode completion resynchronize the snapshot. Session changes abort old requests and reject stale responses. Streaming thought/message deltas do not trigger a snapshot per text chunk.

## MVP boundary
No periodic Records polling, no new WebSocket connection, and no event replay store. Other panels and conversation reconciliation still have their existing polling and are explicitly outside this first slice. A failed fetch displays an error and retries on the next event, reconnect, or page-focus action. A notification lost without a socket disconnect can leave data stale until one of those triggers; durable replay and server-side snapshot versions are follow-up work, not claimed by this MVP. The server must be restarted with this change before relying on complete committed-record notifications.

## Verification
Check successful writes, failed writes, commit/rollback notification timing, metadata updates, event-triggered refresh, reconnect recovery, in-flight invalidation, session isolation, and absence of idle polling. Run existing backend formatting/tests and frontend build/tests.
