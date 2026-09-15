const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** Accept persisted basic and detailed tool results without guessing a selection. */
export function userQuestionAnswers(text?: string): Record<string, string> | undefined {
  if (!text) return undefined;
  try {
    let value: unknown = JSON.parse(text);
    if (object(value) && value.status === 'success' && value.format === 'json' && typeof value.content === 'string') value = JSON.parse(value.content);
    if (!object(value) || value.cancelled === true || (value.status !== undefined && value.status !== 'success') || !object(value.answers)) return undefined;
    if (!Object.values(value.answers).every(answer => typeof answer === 'string')) return undefined;
    return value.answers as Record<string, string>;
  } catch { return undefined; }
}
