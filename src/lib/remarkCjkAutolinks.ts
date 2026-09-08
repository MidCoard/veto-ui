import type { Parent, Root } from 'mdast';

/** End bare autolinks at CJK prose punctuation, preserving explicitly authored links. */
export default function remarkCjkAutolinks() {
  return (tree: Root, file: { value: unknown }) => {
    const source = String(file.value);
    const visit = (parent: Parent): void => {
      for (let index = 0; index < parent.children.length; index += 1) {
        const node = parent.children[index];
        if (node.type === 'link' && node.children.length === 1 && node.children[0].type === 'text') {
          const start = node.position?.start.offset;
          const end = node.position?.end.offset;
          const label = node.children[0].value;
          // Source positions distinguish GFM's generated links from [text](url) and <url>.
          if (start !== undefined && end !== undefined && source.slice(start, end) === label && /^(?:https?:\/\/|www\.)/i.test(label)) {
            const boundary = label.search(/[，。！？；：、（）【】《》“”‘’]/u);
            if (boundary >= 0) {
              const url = label.slice(0, boundary);
              node.url = /^www\./i.test(url) ? `http://${url}` : url;
              node.children[0].value = url;
              parent.children.splice(index + 1, 0, { type: 'text', value: label.slice(boundary) });
              index += 1;
            }
          }
        } else if ('children' in node) {
          visit(node);
        }
      }
    };
    visit(tree);
  };
}
