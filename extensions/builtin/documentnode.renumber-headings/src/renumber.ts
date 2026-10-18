import type { Context, RenderedHeading } from 'marknode';

/** Edit native heading source positions while preserving every other source byte. */
export function renumberHeadings(source: string, headings: readonly RenderedHeading[], numbers: readonly string[] = []): string {
  const lines = source.match(/[^\n]*(?:\n|$)/gu)?.slice(0, -1) ?? [];
  let previousLine = -1;
  for (const [index, heading] of headings.entries()) {
    const { line: lineIndex, column, endLine, level } = heading;
    if (!Number.isInteger(lineIndex) || lineIndex <= previousLine || lineIndex >= lines.length ||
        !Number.isInteger(column) || column < 0 || !Number.isInteger(endLine) || endLine <= lineIndex || endLine > lines.length) {
      throw new Error('A heading could not be matched to its source. No text was changed.');
    }
    previousLine = lineIndex;
    const line = lines[lineIndex];
    const ending = line.endsWith('\r\n') ? '\r\n' : line.endsWith('\n') ? '\n' : '';
    const text = line.slice(0, line.length - ending.length);
    if (column > text.length) throw new Error('A heading could not be matched to its source. No text was changed.');
    const prefix = text.slice(0, column);
    const titleSource = text.slice(column);
    const number = numbers[index] ?? String(index + 1);
    if (/^#{1,6}(?:[ \t]|$)/u.test(titleSource)) {
      const atx = titleSource.match(new RegExp(`^(${'#'.repeat(level)})([ \\t]+|$)(.*?)([ \\t]+#+[ \\t]*)?$`));
      if (!atx) throw new Error('An ATX heading could not be matched. No text was changed.');
      const title = atx[3].replace(/^\d+(?:\.\d+)*\.?(?:[ \t]+|$)/u, '');
      lines[lineIndex] = `${prefix}${atx[1]}${atx[2] || ' '}${number}${title ? ` ${title}` : ''}${atx[4] ?? ''}${ending}`;
    } else {
      if (endLine < lineIndex + 2) throw new Error('A Setext heading could not be matched. No text was changed.');
      const title = titleSource.replace(/^\d+(?:\.\d+)*\.?(?:[ \t]+|$)/u, '');
      lines[lineIndex] = `${prefix}${number}${title ? ` ${title}` : ''}${ending}`;
    }
  }
  return lines.join('');
}

function headingNumbers(headings: readonly RenderedHeading[]): string[] {
  const levels: number[] = []; const counters: number[] = [];
  return headings.map(({ level }) => {
    while (levels.length > 0 && levels[levels.length - 1] >= level) levels.pop();
    const depth = levels.length;
    counters[depth] = (counters[depth] ?? 0) + 1;
    counters.length = depth + 1;
    levels.push(level);
    return counters.join('.');
  });
}

export default async function renumber({ doc }: Context): Promise<void> {
  const headings = doc.outline().headings;
  if (headings.length === 0) return;
  const source = doc.readSection().markdown;
  const result = renumberHeadings(source, headings, headingNumbers(headings));
  if (result !== source) doc.replaceSection(undefined, result);
}
