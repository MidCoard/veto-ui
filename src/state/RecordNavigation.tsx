import { createContext } from 'react';

/** Positions are UTF-16 offsets in the decoded source field, as returned by the checker. */
export type RecordLocation = {
  session: string;
  agent: string;
  turn: number;
  field: string;
  start: number;
  end: number;
  text: string;
};

export const RecordNavigation = createContext<((location: RecordLocation) => void) | null>(null);
