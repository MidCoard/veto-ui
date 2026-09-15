export interface AssistantContent {
  thought: string;
  actions?: Record<string, unknown>[];
  diagnostic: boolean;
}

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const bareFence = (value: string): boolean => /^\s*```(?:json)?\s*$/i.test(value);

/** Historical thought records can contain a replay envelope, not just display text. */
export function assistantContent(raw: string): AssistantContent {
  try {
    const value: unknown = JSON.parse(raw);
    if (!object(value)) return { thought: '', diagnostic: true };
    const thought = typeof value.thought === 'string' ? value.thought : '';
    if (object(value.guide) && Array.isArray(value.guide.actions) && value.guide.actions.every(object)) {
      return { thought, actions: value.guide.actions, diagnostic: false };
    }
    if (value.guide != null || typeof value.thought !== 'string') return { thought, diagnostic: true };
    if (bareFence(thought)) return { thought: '', diagnostic: true };
    return { thought, diagnostic: false };
  } catch {
    return /^[\s]*[\[{]/.test(raw) || bareFence(raw) ? { thought: '', diagnostic: true } : { thought: raw, diagnostic: false };
  }
}
