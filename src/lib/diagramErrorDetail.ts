/** Keep renderer diagnostics as bounded plain text, without stack traces. */
export function diagramErrorDetail(error: unknown): string | undefined {
  const message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error ? error.message : undefined;
  if (typeof message !== 'string' || !message.trim()) return undefined;
  return message.length > 8192 ? `${message.slice(0, 8192)}\n…` : message;
}
