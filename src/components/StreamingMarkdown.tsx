import React from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import CodeHighlight from './CodeHighlight';

/**
 * C1: Streaming Markdown Renderer
 * Renders streaming Markdown content with code highlighting support.
 * Handles incremental content updates during streaming.
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
          className="bg-gray-800 text-veto-300 px-1.5 py-0.5 rounded text-sm font-mono"
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
        className="text-veto-400 hover:text-veto-300 underline underline-offset-2"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border-collapse border border-gray-700 text-sm">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-gray-700 bg-gray-800 px-3 py-2 text-left font-medium">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border border-gray-700 px-3 py-2">{children}</td>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-4 border-veto-500/50 pl-4 italic text-gray-400 my-3">
        {children}
      </blockquote>
    );
  },
  h1({ children }) {
    return <h1 className="text-2xl font-bold text-gray-100 mt-6 mb-3">{children}</h1>;
  },
  h2({ children }) {
    return <h2 className="text-xl font-semibold text-gray-200 mt-5 mb-2">{children}</h2>;
  },
  h3({ children }) {
    return <h3 className="text-lg font-medium text-gray-200 mt-4 mb-2">{children}</h3>;
  },
  p({ children }) {
    return <p className="leading-relaxed my-2 text-gray-300">{children}</p>;
  },
  ul({ children }) {
    return <ul className="list-disc list-inside space-y-1 my-2 text-gray-300">{children}</ul>;
  },
  ol({ children }) {
    return <ol className="list-decimal list-inside space-y-1 my-2 text-gray-300">{children}</ol>;
  },
  hr() {
    return <hr className="border-gray-800 my-6" />;
  },
};

const StreamingMarkdown: React.FC<StreamingMarkdownProps> = ({
  content,
  className = '',
  isStreaming = false,
}) => {
  return (
    <div className={`prose prose-invert max-w-none ${className} ${isStreaming ? 'streaming-content' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
      {isStreaming && content.length > 0 && !content.endsWith('\n') && (
        <span className="inline-block w-2 h-4 bg-veto-500 animate-pulse ml-0.5" />
      )}
    </div>
  );
};

export default StreamingMarkdown;
