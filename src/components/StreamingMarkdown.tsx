import { QuoteChecks, ActiveCitation, type QuoteOrigin } from './QuoteChecks';
import React from 'react';
import ReactMarkdown, { Components, defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeHighlight from './CodeHighlight';
import remarkCjkAutolinks from '../lib/remarkCjkAutolinks';
import MermaidDiagram from './MermaidDiagram';
import type { Root, RootContent } from 'mdast';
import { useI18n } from '../i18n/I18nContext';

function remarkDiagramBudget() {
  return (tree: Root) => {
    let count = 0;
    const walk = (node: Root | RootContent) => {
      if (node.type === 'code' && node.lang?.toLowerCase() === 'mermaid') {
        node.data = { ...node.data, hProperties: { 'data-diagram-auto': String(count++ < 3) } };
      }
      if ('children' in node) node.children.forEach(walk);
    };
    walk(tree);
  };
}

function MarkdownImage({ src, alt }: { src?: string; alt?: string }) {
  const [loaded, setLoaded] = React.useState(false);
  const { t } = useI18n();
  if (!src) return <span>{alt}</span>;
  if (!loaded) return <button type="button" className="ui-button text-accent underline" onClick={() => setLoaded(true)}>{t('diagram.loadImage')}: {alt || src}</button>;
  return <img src={src} alt={alt ?? ''} loading="lazy" referrerPolicy="no-referrer" className="max-w-full" />;
}

const StreamingContext = React.createContext(false);

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
  quoteOrigin?: QuoteOrigin;
}

const markdownComponents: Partial<Components> = {
  img({ src, alt }) { return <MarkdownImage key={src} src={src} alt={alt} />; },
  code({ node, className, children, ...props }) {
    const isStreaming = React.useContext(StreamingContext);
    const match = /language-(\w+)/.exec(className ?? '');
    const codeString = String(children).replace(/\n$/, '');
    const isInline = !match && !codeString.includes('\n');

    if (match?.[1].toLowerCase() === 'mermaid') {
      return <MermaidDiagram code={codeString} isStreaming={isStreaming} autoRender={node?.properties?.['data-diagram-auto'] !== 'false'} />;
    }

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
    if (href && /^cite:[A-Za-z0-9_-]{1,64}$/.test(href)) return <ActiveCitation id={href.slice(5)}>{children}</ActiveCitation>;
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
    return <blockquote className="border-l-2 border-accent/50 pl-4 text-dim my-3">{children}</blockquote>;
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
  quoteOrigin,
}) => {
  return (
    <div className={`max-w-none ${className}`}>
      <StreamingContext.Provider value={isStreaming}>
        <QuoteChecks origin={quoteOrigin} body={content} streaming={isStreaming}><ReactMarkdown urlTransform={url => /^cite:[A-Za-z0-9_-]{1,64}$/.test(url) ? url : defaultUrlTransform(url)} remarkPlugins={[remarkGfm, remarkCjkAutolinks, remarkDiagramBudget]} components={markdownComponents}>
          {content}
        </ReactMarkdown></QuoteChecks>
      </StreamingContext.Provider>
      {isStreaming && content.length > 0 && !content.endsWith('\n') && (
        <span className="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5" />
      )}
    </div>
  );
};

export default StreamingMarkdown;
