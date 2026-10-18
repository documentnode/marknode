import type { Context, RenderedHeading } from 'marknode';

function markdownLabel(plainText: string): string {
  return plainText.replace(/[!"#$%&'()*+\-,./:;<=>?@[\\\]^_`{|}~]/gu, '\\$&');
}

export function tableOfContentsMarkdown(headings: readonly RenderedHeading[]): string {
  const levels: number[] = [];
  return headings.map((heading) => {
    if (heading.plainText == null || heading.anchor == null) throw new Error('MarkNode did not provide rendered heading metadata.');
    while (levels.length > 0 && (levels.at(-1) ?? 0) >= (heading.level ?? 1)) levels.pop();
    const indentation = '  '.repeat(levels.length);
    levels.push(heading.level ?? 1);
    return `${indentation}- [${markdownLabel(heading.plainText)}](#${heading.anchor})`;
  }).join('\n');
}

export default async function addTableOfContents({ doc }: Context): Promise<void> {
  const outline = doc.outline();
  const headings = outline.headings;
  if (headings.length === 0) return;
  const toc = tableOfContentsMarkdown(headings);
  const source = doc.readSection().markdown;
  doc.replaceSection(undefined, `${toc}\n\n${source}`);
}
