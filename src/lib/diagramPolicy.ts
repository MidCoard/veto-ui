export type DiagramFailure = 'unsupported' | 'unsafe' | 'size' | 'timeout' | 'error';
export const MAX_DIAGRAM_BYTES = 16 * 1024;

/** Deliberately smaller than the renderer's full language. */
export function diagramFailure(source: string): DiagramFailure | undefined {
  if (new TextEncoder().encode(source).length > MAX_DIAGRAM_BYTES) return 'size';
  // Built-in stereotypes (e.g. <<choice>> and <<interface>>) are not HTML.
  const markup = source.replace(/<<[a-z][\w-]*>>/gi, '');
  if (/%%\s*\{|^\s*---|<\s*\/?\s*[a-z!]|(?:https?:|data:|javascript:|file:|blob:|url\s*\()|:::|@\{/im.test(markup)) return 'unsafe';
  // Match commands, not words in labels, messages or accessibility descriptions.
  const commands = source
    .replace(/^\s*accDescr\s*\{[^}]*}/gim, '')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');
  if (/(?:^|[;\n])\s*(?:click|classDef|linkStyle|style|cssClass)\s/im.test(commands)) return 'unsafe';
  const declaration = source.replace(/^\s*%%[^\n]*(?:\n|$)/gm, '').trimStart();
  if (!/^(?:flowchart(?:\s|$)|sequenceDiagram(?:\s|$)|stateDiagram-v2(?:\s|$)|erDiagram(?:\s|$)|classDiagram(?:\s|$))/.test(declaration)) return 'unsupported';
  return undefined;
}
