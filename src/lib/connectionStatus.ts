import type { BusStatus } from '../bus/VetoBus';
import type { MessageKey } from '../i18n/en';

export const connectionLabelKeys: Record<BusStatus, MessageKey> = {
  connected: 'status.busConnected',
  connecting: 'status.busConnecting',
  reconnecting: 'status.busReconnecting',
  disconnected: 'status.busDisconnected',
};
