import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeHighlight from './CodeHighlight';

/**
 * Streaming Markdown Renderer — Audit Ledger styling.
 * Paper text, panel code blocks with rule borders, accent links/accents.
 * Renders incremental content during streaming; a accent cursor marks
 * content still arriving.
 */
interface StreamingMarkdownProps {
  content: string;
  className?: string;
  isStreaming?: boolean;
}

const markdownComponents: Partial<Components> = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const codeString = String(children).replace(/\n$/, '');
    const isInline = !match && !codeString.includes('\n');

    if (isInline) {
      return (
        <code
          className="bg-raised border border-rule text-accent px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <CodeHighlight
        code={codeString}
        language={match?.[1] ?? 'text'}
        className="my-3"
      />
    );
  },
  pre({ children }) {
    return <>{children}</>;
  },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent hover:text-accent/80 underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-rule text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-rule bg-panel px-3 py-2 text-left font-medium text-paper">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-rule px-3 py-2 text-paper/80">{children}</td>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-accent/50 pl-4 italic text-dim my-3">
        {children}
      </blockquote>
    );
  },
  h1({ children }) {
    return <h1 className="text-2xl font-semibold text-paper mt-6 mb-3">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-xl font-semibold text-paper mt-5 mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-medium text-paper mt-4 mb-2">{children}</h3>;
  },
  p({ children }) {
    return <p className="leading-relaxed my-2 text-paper/85">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-outside pl-5 space-y-1 my-2 text-paper/85">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-outside pl-5 space-y-1 my-2 text-paper/85">{children}</ol>;
  },
  li({ children }) {
    return (
      <li className="pl-1 [&>p:first-child]:inline [&>p:first-child]:my-0">
        {children}
      </li>
    );
  },
  hr() {
    return <hr className="border-rule my-6" />;
  },
};

const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
  className = '',
  isStreaming = false,
}) => {
  return (
    <div className={`max-w-none ${className}`}>
      {/*
        No rehype-raw: ledger content includes agent messages and tool output (and web_fetch page
        text) that can be attacker-controlled, so raw HTML embedded in the markdown must NOT be
        rendered as live markup — it stays escaped. Rendering it would be a stored-XSS vector.
      */}
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
      {isStreaming && content.length > 0 && !content.endsWith('\n') && (
        <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
      )}
    </div>
  );
};

export default StreamingMarkdown;
