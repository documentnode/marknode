import MarkdownIt from 'markdown-it';
import type { Context, OutlineViewNode } from 'marknode';

const markdown = new MarkdownIt('commonmark', { html: true });

interface SourceRange { end: number; start: number; }
interface CandidateRange extends SourceRange { kind: OutlineViewNode['kind']; }

function compareTitles(left: string, right: string): number {
  const leftFolded = left.toLowerCase();
  const rightFolded = right.toLowerCase();
  return leftFolded < rightFolded ? -1 : leftFolded > rightFolded ? 1 : 0;
}

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') offsets.push(index + 1);
  return offsets;
}

function sourceCandidates(source: string): CandidateRange[] {
  const offsets = lineOffsets(source);
  const tokens = markdown.parse(source, {});
  const headings = tokens.flatMap((token, index) => token.type === 'heading_open' && token.map !== null
    ? [{ index, level: Number(token.tag.slice(1)), startLine: token.map[0] }] : []);
  const candidates: CandidateRange[] = [];
  for (const heading of headings) {
    const next = headings.slice(headings.indexOf(heading) + 1).find((candidate) => candidate.level <= heading.level);
    candidates.push({ kind: 'heading', start: offsets[heading.startLine], end: next === undefined ? source.length : offsets[next.startLine] });
  }
  for (const token of tokens) {
    if (token.type !== 'list_item_open' || token.map === null) continue;
    const line = source.slice(offsets[token.map[0]], offsets[token.map[0] + 1]).trimStart();
    candidates.push({ kind: /^\d+[.)]\s/u.test(line) ? 'ordered' : 'bullet', start: offsets[token.map[0]], end: offsets[token.map[1]] ?? source.length });
  }
  return candidates.sort((left, right) => left.start - right.start || right.end - left.end);
}

function flatten(nodes: readonly OutlineViewNode[]): OutlineViewNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function mapNodeRanges(source: string, nodes: readonly OutlineViewNode[]): Map<string, SourceRange> {
  const outlineNodes = flatten(nodes);
  const candidates = sourceCandidates(source);
  if (outlineNodes.length !== candidates.length) throw new Error('The document structure no longer matches its source ranges.');
  const ranges = new Map<string, SourceRange>();
  for (const [index, node] of outlineNodes.entries()) {
    const candidate = candidates[index];
    if (candidate.kind !== node.kind) throw new Error('The document structure no longer matches its source ranges.');
    if (candidate.start < 0 || candidate.end < candidate.start || (index > 0 && candidate.start < candidates[index - 1].start)) {
      throw new Error('The document source ranges overlap or are out of order.');
    }
    ranges.set(node.indexPath, candidate);
  }
  return ranges;
}

function findNode(nodes: readonly OutlineViewNode[], indexPath: string): OutlineViewNode | null {
  for (const node of nodes) {
    if (node.indexPath === indexPath) return node;
    const nested = findNode(node.children, indexPath);
    if (nested !== null) return nested;
  }
  return null;
}

export function sortChildRanges(source: string, children: readonly OutlineViewNode[], ranges: ReadonlyMap<string, SourceRange>): string | null {
  const sections = children.map((node, index) => {
    const range = ranges.get(node.indexPath);
    return range === undefined ? null : { index, range, title: node.title };
  });
  if (sections.some((section) => section === null)) return null;
  const present = sections as { index: number; range: SourceRange; title: string }[];
  const sorted = present.slice().sort((left, right) => compareTitles(left.title, right.title) || left.index - right.index);
  if (sorted.every((section, index) => section === present[index])) return source;
  let cursor = 0; let result = '';
  for (const [index, section] of present.entries()) {
    result += source.slice(cursor, section.range.start);
    const replacement = sorted[index].range;
    result += source.slice(replacement.start, replacement.end);
    cursor = section.range.end;
  }
  return result + source.slice(cursor);
}

export default async function sortSection({ doc, target }: Context): Promise<void> {
  const outline = doc.outline();
  const { markdown: source } = doc.readSection();
  const ranges = mapNodeRanges(source, outline.nodes);
  const targetIndexPath = target !== null && 'indexPath' in target.node ? target.node.indexPath : null;
  if (target !== null && targetIndexPath === null) return;
  const targetNode = targetIndexPath === null ? null : findNode(outline.nodes, targetIndexPath);
  if (target !== null && targetNode === null) return;
  const children = targetNode === null ? outline.nodes : targetNode.children;
  if (children.length < 2) return;
  const sorted = sortChildRanges(source, children, ranges);
  if (sorted !== null && sorted !== source) doc.replaceSection(undefined, sorted);
}
