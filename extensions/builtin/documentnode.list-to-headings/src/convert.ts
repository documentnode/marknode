import MarkdownIt from 'markdown-it';
import type { Context, OutlineViewNode } from 'marknode';

interface SourceRange { end: number; start: number; }
interface ListItem extends SourceRange { children: ListItem[]; endLine: number; startLine: number; title: string; quotePrefix: string; quoteDepth: number; }

const markdown = new MarkdownIt('commonmark', { html: true });

function lineOffsets(source: string): number[] {
  const offsets = [0];
  for (let index = 0; index < source.length; index += 1) if (source[index] === '\n') offsets.push(index + 1);
  return offsets;
}

function sourceLines(source: string): string[] { return source.match(/[^\n]*(?:\n|$)/gu)?.slice(0, -1) ?? []; }
function lineWithoutBreak(line: string): string { return line.replace(/\r?\n$/u, ''); }
function splitQuotePrefix(line: string, limit = Infinity): { prefix: string; content: string; depth: number } {
  let prefix = ''; let content = line; let depth = 0;
  while (depth < limit) {
    const match = content.match(/^[ \t]{0,3}>[ \t]?/u);
    if (match === null) break;
    prefix += match[0]; content = content.slice(match[0].length); depth += 1;
  }
  return { prefix, content, depth };
}

function quotedLine(line: string, prefix: string): string {
  return prefix + line;
}

function listItemTitle(line: string): string | null {
  const match = lineWithoutBreak(line).match(/^[ \t]*(?:[-+*]|\d+[.)])(?:[ \t]+(.*))?$/u);
  return match === null ? null : match[1] ?? '';
}

function parseListItems(source: string): ListItem[] {
  const lines = sourceLines(source); const offsets = lineOffsets(source); const roots: ListItem[] = []; const openItems: ListItem[] = [];
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'list_item_open') {
      if (token.map === null) continue;
      const quote = splitQuotePrefix(lines[token.map[0]] ?? '');
      const title = listItemTitle(quote.content);
      if (title === null) throw new Error('A list item could not be matched to its source. No text was changed.');
      const item: ListItem = { children: [], end: offsets[token.map[1]] ?? source.length, endLine: token.map[1], start: offsets[token.map[0]] ?? source.length, startLine: token.map[0], title, quotePrefix: quote.prefix, quoteDepth: quote.depth };
      const parent = openItems.at(-1);
      if (parent === undefined) roots.push(item); else parent.children.push(item);
      openItems.push(item);
    } else if (token.type === 'list_item_close') openItems.pop();
  }
  return roots;
}

function trimBlankLines(lines: readonly string[]): string[] {
  let start = 0; let end = lines.length;
  while (start < end && /^\s*\r?\n$/u.test(lines[start])) start += 1;
  while (end > start && /^\s*\r?\n$/u.test(lines[end - 1])) end -= 1;
  return lines.slice(start, end);
}

function continuationIndentation(line: string): string {
  const match = lineWithoutBreak(line).match(/^([ \t]*(?:[-+*]|\d+[.)]))([ \t]+|$)/u);
  return match === null ? '' : match[1] + (match[2] || ' ');
}

function removeContinuationIndentation(line: string, indentation: string): string {
  if (/^\s*\r?\n$/u.test(line) || indentation === '') return line;
  let offset = 0;
  while (offset < indentation.length && offset < line.length && /[ \t]/u.test(line[offset])) offset += 1;
  return line.slice(offset);
}

function itemBody(item: ListItem, lines: readonly string[]): string {
  const bodyLines: string[] = []; let cursor = item.startLine + 1;
  for (const child of item.children) { bodyLines.push(...lines.slice(cursor, child.startLine)); cursor = child.endLine; }
  bodyLines.push(...lines.slice(cursor, item.endLine));
  const indentation = continuationIndentation(splitQuotePrefix(lines[item.startLine] ?? '', item.quoteDepth).content);
  // Strip only the item's outer quote containers. Inner quoted body blocks stay
  // in the content; lazy continuation lines may omit some or all outer markers.
  const body = bodyLines.map((line) => removeContinuationIndentation(splitQuotePrefix(line, item.quoteDepth).content, indentation));
  return trimBlankLines(body).map((line) => quotedLine(line, item.quotePrefix)).join('').replace(/\r?\n$/u, '');
}

function convertItem(item: ListItem, lines: readonly string[], level: number, lineBreak: string): string {
  if (level > 6) throw new Error('A list deeper than six levels cannot be converted to headings.');
  const body = itemBody(item, lines);
  const children = item.children.map((child) => convertItem(child, lines, level + 1, lineBreak));
  return [`${item.quotePrefix}${'#'.repeat(level)} ${item.title}`, body, ...children].filter((part) => part !== '').join(`${lineBreak}${item.quotePrefix.trimEnd()}${lineBreak}`);
}

function replacementForRange(rendered: string, source: string, range: ListItem, lineBreak: string): string {
  let replacement = /\r?\n$/u.test(source.slice(range.start, range.end)) ? `${rendered}${lineBreak}` : rendered;
  const following = splitQuotePrefix(source.slice(range.end)).content;
  if (/^(?:#{1,6}(?:\s|$)|[ \t]*(?:[-+*]|\d+[.)])(?:\s|$))/u.test(following) && !/\r?\n(?:[ \t]*>[ \t]*)*\r?\n$/u.test(replacement)) {
    replacement += range.quotePrefix.trimEnd() + lineBreak;
  }
  return replacement;
}

function replaceRanges(source: string, replacements: readonly { range: SourceRange; replacement: string }[]): string {
  let cursor = 0; let result = '';
  for (const { range, replacement } of replacements) {
    if (range.start < cursor) throw new Error('The selected list overlaps another selected list.');
    result += source.slice(cursor, range.start) + replacement; cursor = range.end;
  }
  return result + source.slice(cursor);
}

function containingHeadingLevel(source: string, offset: number): number {
  const offsets = lineOffsets(source);
  let level = 0; let listDepth = 0;
  for (const token of markdown.parse(source, {})) {
    if (token.type === 'list_item_open') listDepth += 1;
    if (token.type === 'list_item_close') listDepth -= 1;
    if (listDepth === 0 && token.type === 'heading_open' && token.map !== null && (offsets[token.map[0]] ?? source.length) < offset) {
      level = Number(token.tag.slice(1));
    }
  }
  return level;
}

function flatten(nodes: readonly OutlineViewNode[]): OutlineViewNode[] { return nodes.flatMap((node) => [node, ...flatten(node.children)]); }

function findNodeWithAncestors(nodes: readonly OutlineViewNode[], indexPath: string, ancestors: readonly OutlineViewNode[] = []): { ancestors: OutlineViewNode[]; node: OutlineViewNode } | null {
  for (const node of nodes) {
    if (node.indexPath === indexPath) return { ancestors: [...ancestors], node };
    const found = findNodeWithAncestors(node.children, indexPath, [...ancestors, node]);
    if (found !== null) return found;
  }
  return null;
}

function itemByIndexPath(source: string, nodes: readonly OutlineViewNode[], indexPath: string): ListItem | null {
  const tokenItems: ListItem[] = [];
  const visit = (items: readonly ListItem[]): void => { for (const item of items) { tokenItems.push(item); visit(item.children); } };
  visit(parseListItems(source));
  const outlineLists = flatten(nodes).filter((node) => node.kind === 'bullet' || node.kind === 'ordered');
  if (outlineLists.length !== tokenItems.length) throw new Error('The document structure no longer matches its source ranges.');
  const targetIndex = outlineLists.findIndex((node) => node.indexPath === indexPath);
  return targetIndex === -1 ? null : tokenItems[targetIndex] ?? null;
}

export function convertListToHeadings(source: string, level = 1): string {
  const lines = sourceLines(source); const lineBreak = source.includes('\r\n') ? '\r\n' : '\n';
  const replacements = parseListItems(source).map((item) => ({ range: item, replacement: replacementForRange(convertItem(item, lines, level === 1 ? containingHeadingLevel(source, item.start) + 1 : level, lineBreak), source, item, lineBreak) }));
  return replaceRanges(source, replacements);
}

export default async function convertList({ doc, target }: Context): Promise<void> {
  const outline = doc.outline(); const { markdown: source } = doc.readSection(); const lineBreak = source.includes('\r\n') ? '\r\n' : '\n';
  if (target === null) {
    const lines = sourceLines(source);
    const replacements = parseListItems(source).map((item) => ({ range: item, replacement: replacementForRange(convertItem(item, lines, containingHeadingLevel(source, item.start) + 1, lineBreak), source, item, lineBreak) }));
    const converted = replaceRanges(source, replacements);
    if (converted !== source) doc.replaceSection(undefined, converted);
    return;
  }
  if (!('indexPath' in target.node)) return;
  const targetOutlineNode = findNodeWithAncestors(outline.nodes, target.node.indexPath);
  if (targetOutlineNode === null || (targetOutlineNode.node.kind !== 'bullet' && targetOutlineNode.node.kind !== 'ordered')) return;
  const item = itemByIndexPath(source, outline.nodes, target.node.indexPath);
  if (item === null) return;
  const containingHeading = [...targetOutlineNode.ancestors].reverse().find((node) => node.kind === 'heading');
  const headingLevel = containingHeading?.level ?? 0;
  const listDepth = targetOutlineNode.ancestors.filter((node) => node.kind === 'bullet' || node.kind === 'ordered').length;
  const replacement = replacementForRange(convertItem(item, sourceLines(source), headingLevel + listDepth + 1, lineBreak), source, item, lineBreak);
  const converted = replaceRanges(source, [{ range: item, replacement }]);
  if (converted !== source) doc.replaceSection(undefined, converted);
}
