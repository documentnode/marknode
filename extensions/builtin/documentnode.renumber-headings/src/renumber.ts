import MarkdownIt from 'markdown-it';
import type { Context, OutlineViewNode } from 'marknode';

const parser = new MarkdownIt('commonmark', { html: true });

/** Keep the original heading syntax and all bytes outside its leading number. */
export function renumberHeadings(source: string, headings: readonly OutlineViewNode[], numbers: readonly string[] = []): string {
  const tokens = parser.parse(source, {});
  const headingTokens = tokens.filter(token => token.type === 'heading_open');
  if (headingTokens.length !== headings.length) {
    throw new Error('The Markdown headings do not match the document outline. No text was changed.');
  }
  const lines = source.match(/[^\n]*(?:\n|$)/gu)?.slice(0, -1) ?? [];
  for (const [index, token] of headingTokens.entries()) {
    if (token.map === null || Number(token.tag.slice(1)) !== headings[index].level) {
      throw new Error('A heading could not be matched to its source. No text was changed.');
    }
    const lineIndex = token.map[0];
    const line = lines[lineIndex];
    const ending = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
    const text = line.slice(0, line.length - ending.length);
    const number = numbers[index] ?? String(index + 1);
    // The block parser identifies headings, including container prefixes. A fence,
    // HTML block or indented code line can never reach this source edit.
    if (token.markup.startsWith('#')) {
      // Match the exact marker followed by whitespace (or an empty heading).
      const atx = text.match(new RegExp(`^(.*?${'#'.repeat(Number(token.tag.slice(1)))})([ \\t]+|$)(.*?)([ \\t]+#+[ \\t]*)?$`));
      if (!atx) throw new Error('An ATX heading could not be matched. No text was changed.');
      const title = atx[3].replace(/^\d+(?:\.\d+)*\.?(?:[ \t]+|$)/u, '');
      lines[lineIndex] = `${atx[1]}${atx[2] || ' '}${number}${title ? ` ${title}` : ''}${atx[4] ?? ''}${ending}`;
    } else {
      // For Setext headings keep the underline and any continuation lines intact.
      const prefix = text.match(/^(?:[ \t]*>[ \t]?)*[ \t]*/u)?.[0] ?? '';
      const title = text.slice(prefix.length).replace(/^\d+(?:\.\d+)*\.?(?:[ \t]+|$)/u, '');
      lines[lineIndex] = `${prefix}${number} ${title}${ending}`;
    }
  }
  return lines.join('');
}

function numberedHeadings(nodes: readonly OutlineViewNode[], prefix: readonly number[] = [], sibling = { value: 0 }): { node: OutlineViewNode; number: string }[] {
  return nodes.flatMap(node => {
    if (node.kind !== 'heading') return numberedHeadings(node.children, prefix, sibling);
    const number = [...prefix, ++sibling.value];
    return [{ node, number: number.join('.') }, ...numberedHeadings(node.children, number)];
  });
}

export default async function renumber({ doc }: Context): Promise<void> {
  const headings = numberedHeadings(doc.outline().nodes);
  if (headings.length === 0) return;
  const source = doc.readSection().markdown;
  const result = renumberHeadings(source, headings.map(item => item.node), headings.map(item => item.number));
  if (result !== source) doc.replaceSection(undefined, result);
}
