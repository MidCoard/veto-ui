import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StreamingMarkdown from './StreamingMarkdown';

describe('StreamingMarkdown lists', () => {
  it('keeps loose-list markers beside the first paragraph', () => {
    const { container } = render(
      <StreamingMarkdown content={'- First item\n\n- Second item'} />,
    );

    const list = container.querySelector('ul');
    const items = container.querySelectorAll('li');

    expect(list).not.toBeNull();
    expect(list?.className).toContain('list-outside');
    expect(list?.className).toContain('pl-5');
    expect(items).toHaveLength(2);
    expect(items[0].querySelector('p')).not.toBeNull();
    expect(items[0].className).toContain('[&>p:first-child]:inline');
    expect(items[0].className).toContain('[&>p:first-child]:my-0');
  });

  it('uses the same aligned layout for compact ordered lists', () => {
    const { container } = render(
      <StreamingMarkdown content={'1. First item\n2. Second item'} />,
    );

    const list = container.querySelector('ol');

    expect(list?.className).toContain('list-outside');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('does not render raw HTML from agent or tool content', () => {
    const { container } = render(
      <StreamingMarkdown content={'<img src="x" onerror="window.__xss = true">'} />,
    );

    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src="x" onerror="window.__xss = true">');
  });
});

describe('StreamingMarkdown links', () => {
  it.each(['：这个域名被保留用于文档示例场合（使用它无需许可）。', '（仅这一次，未使用此前网页的内容）。', '，后续说明', '。下一句话'])('keeps Chinese prose outside a bare URL: %s', (suffix) => {
    const content = `https://example.com${suffix}`;
    const { container } = render(<StreamingMarkdown content={content} />);
    const link = container.querySelector('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link?.textContent).toBe('https://example.com');
    expect(container.textContent).toBe(content);
  });

  it('preserves explicit links, Chinese URL paths, query strings and code', () => {
    const { container } = render(<StreamingMarkdown content={'[中文：说明](https://example.com/中文：路径)\n\nhttps://example.com/中文?q=one&n=2\n\n`https://example.com：代码`'} />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toBe('中文：说明');
    expect(decodeURI(links[0].getAttribute('href') ?? '')).toBe('https://example.com/中文：路径');
    expect(decodeURI(links[1].getAttribute('href') ?? '')).toBe('https://example.com/中文?q=one&n=2');
    expect(container.querySelector('code')?.textContent).toBe('https://example.com：代码');
  });

  it('handles streamed suffixes and www autolinks', () => {
    const { container, rerender } = render(<StreamingMarkdown content="www.example.com" isStreaming />);
    rerender(<StreamingMarkdown content="www.example.com：说明" isStreaming />);
    expect(container.querySelector('a')).toHaveAttribute('href', 'http://www.example.com');
    expect(container.querySelector('a')?.textContent).toBe('www.example.com');
    expect(container.textContent).toBe('www.example.com：说明');
  });
});
