import MarkdownIt from 'markdown-it';
import type { Context, OutlineViewNode } from 'marknode';

const markdown = new MarkdownIt('commonmark', { html: true });

interface SourceRange { end: number; start: number; followsParagraph?: boolean; }
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
  const candidates: CandidateRange[] = [];
  const ancestors: { type: string; included: boolean }[] = [];
  const openHeadings: { level: number; range: CandidateRange }[] = [];
  for (const [index, token] of tokens.entries()) {
    if (token.nesting === -1) { ancestors.pop(); continue; }
    const parent = ancestors[ancestors.length - 1];
    // Native outline traversal visits only direct List children of an Item.
    // Headings and blockquotes inside items remain part of that item's body.
    const included = parent === undefined || (parent.included && (parent.type !== 'list_item_open'
      || token.type === 'bullet_list_open' || token.type === 'ordered_list_open'));
    if (token.nesting === 1) ancestors.push({ type: token.type, included });
    if (!included || token.map === null) continue;
    if (token.type === 'heading_open') {
      const level = Number(token.tag.slice(1));
      const start = offsets[token.map[0]];
      // Each heading enters and leaves the stack once, including flat outlines.
      while (openHeadings.length > 0 && openHeadings[openHeadings.length - 1].level >= level) {
        openHeadings.pop()!.range.end = start;
      }
      const range: CandidateRange = { kind: 'heading', start, end: source.length };
      openHeadings.push({ level, range });
      candidates.push(range);
    } else if (token.type === 'list_item_open') {
      candidates.push({
        kind: parent?.type === 'ordered_list_open' ? 'ordered' : 'bullet',
        start: offsets[token.map[0]], end: offsets[token.map[1]] ?? source.length,
        followsParagraph: tokens[index - 1]?.type === 'ordered_list_open' && tokens[index - 2]?.type === 'paragraph_close',
      });
    }
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
    if (range === undefined) return null;
    const text = source.slice(range.start, range.end);
    // A boundary belongs to its source slot, not to the section moved out of it.
    // In particular, a section at EOF may have no newline of its own.
    const separator = text.match(/(?:\r?\n[ \t]*)+$/u)?.[0] ?? '';
    return { index, range, title: node.title, content: text.slice(0, text.length - separator.length), separator };
  });
  if (sections.some((section) => section === null)) return null;
  const present = sections as { index: number; range: SourceRange; title: string; content: string; separator: string }[];
  const sorted = present.slice().sort((left, right) => compareTitles(left.title, right.title) || left.index - right.index);
  if (sorted.every((section, index) => section === present[index])) return source;
  let cursor = 0; let result = '';
  for (const [index, section] of present.entries()) {
    result += source.slice(cursor, section.range.start);
    const content = sorted[index].content;
    const orderedStart = content.match(/^((?:[ \t]{0,3}>[ \t]?)*)([ \t]*)(\d+)[.)](?:[ \t]+|$)/u);
    // Only an ordered marker starting at 1 can interrupt a paragraph. A moved
    // later item needs a blank line here; keep its marker width and body indent.
    if (section.range.followsParagraph && orderedStart !== null && Number(orderedStart[3]) !== 1
      && result.length > 0 && !/\r?\n(?:[ \t]*>[ \t]*)*\r?\n[ \t]*$/u.test(result)) {
      result += orderedStart[1].trimEnd() + (source.includes('\r\n') ? '\r\n' : '\n');
    }
    result += content + section.separator;
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
