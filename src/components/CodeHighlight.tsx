import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

/**
 * C1: Code Highlight Component
 * Renders syntax-highlighted code blocks with language label and copy button.
 * Supports all common programming languages.
 */
interface CodeHighlightProps {
  code: string;
  language?: string;
  className?: string;
  showLineNumbers?: boolean;
}

const CodeHighlight: React.FC<CodeHighlightProps> = ({
  code,
  language = 'text',
  className = '',
  showLineNumbers = true,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback copy
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={`relative group rounded-lg overflow-hidden border border-gray-800 ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <span className="text-xs text-gray-500 font-mono uppercase tracking-wider">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300
                     transition-colors px-2 py-1 rounded hover:bg-gray-800"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-vetoGreen-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-vetoGreen-500">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers={showLineNumbers}
        wrapLines
        customStyle={{
          margin: 0,
          borderRadius: 0,
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          color: '#4a5568',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeHighlight;
