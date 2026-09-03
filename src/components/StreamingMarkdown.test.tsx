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
});
