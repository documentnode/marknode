import assert from 'node:assert/strict';
import test from 'node:test';

import { tableOfContentsMarkdown } from '../builtin/documentnode.toc/scripts/add.js';
import { renumberHeadings } from '../builtin/documentnode.renumber-headings/scripts/renumber.js';
import { convertListToHeadings } from '../builtin/documentnode.list-to-headings/scripts/convert.js';
import { sortChildRanges } from '../builtin/documentnode.sort-section/scripts/sort.js';
import sortSection from '../builtin/documentnode.sort-section/scripts/sort.js';

test('table of contents uses renderer-provided Unicode and duplicate anchors', () => {
  assert.equal(tableOfContentsMarkdown([
    { title: 'raw', plainText: 'Guide', anchor: 'guide', level: 1 },
    { title: 'raw', plainText: 'Alpha', anchor: 'alpha', level: 2 },
    { title: 'raw', plainText: 'Alpha', anchor: 'alpha-1', level: 2 },
    { title: 'raw', plainText: '中文 标题', anchor: '中文-标题', level: 3 },
  ]), [
    '- [Guide](#guide)',
    '  - [Alpha](#alpha)',
    '  - [Alpha](#alpha-1)',
    '    - [中文 标题](#中文-标题)',
  ].join('\n'));
});

test('renumbering preserves preamble, fences, setext headings, and existing numbers', () => {
  const source = [
    'Preamble', '', '# 9 Guide', 'Body', '', '## 8.4 Alpha', 'Body', '', '```md', '# untouched', '```', '', 'Beta', '----', '',
  ].join('\n');
  const headings = [{ level: 1, line: 2, column: 0, endLine: 3 }, { level: 2, line: 5, column: 0, endLine: 6 }, { level: 2, line: 12, column: 0, endLine: 14 }];
  assert.equal(renumberHeadings(source, headings, ['1', '1.1', '1.2']), [
    'Preamble', '', '# 1 Guide', 'Body', '', '## 1.1 Alpha', 'Body', '', '```md', '# untouched', '```', '', '1.2 Beta', '----', '',
  ].join('\n'));
});

test('renumbering closes skipped heading levels without zero components', () => {
  const source = '# Root\n\n### Deep\n\n## Sibling\n';
  const headings = [{ level: 1, line: 0, column: 0, endLine: 1 }, { level: 3, line: 2, column: 0, endLine: 3 }, { level: 2, line: 4, column: 0, endLine: 5 }];
  assert.equal(renumberHeadings(source, headings, ['1', '1.1', '1.2']), '# 1 Root\n\n### 1.1 Deep\n\n## 1.2 Sibling\n');
});

test('list conversion preserves loose item bodies and fenced list-looking content', () => {
  const source = [
    '- Zebra', '', '  Body', '', '  ```md', '  - not a list item', '  ```', '', '  - Nested', '    Child body', '- Alpha', '',
  ].join('\n');
  assert.equal(convertListToHeadings(source), [
    '# Zebra', '', 'Body', '', '```md', '- not a list item', '```', '', '## Nested', '', 'Child body', '', '# Alpha', '',
  ].join('\n'));
});

test('list conversion refuses depths that cannot become Markdown headings', () => {
  const source = ['- 1', '  - 2', '    - 3', '      - 4', '        - 5', '          - 6', '            - 7'].join('\n');
  assert.throws(() => convertListToHeadings(source), /deeper than six levels/u);
});

test('section sort moves complete child sections and preserves equal-title order upstream', () => {
  const source = '# Root\n\n## Zebra\nZebra body\n### Child\nChild body\n\n## Alpha\nAlpha body\n';
  const zebra = '## Zebra\nZebra body\n### Child\nChild body\n\n';
  const alpha = '## Alpha\nAlpha body\n';
  const children = [{ indexPath: '0', title: 'Zebra' }, { indexPath: '1', title: 'Alpha' }];
  assert.equal(sortChildRanges(source, children, new Map([
    ['0', { start: source.indexOf(zebra), end: source.indexOf(zebra) + zebra.length }],
    ['1', { start: source.indexOf(alpha), end: source.indexOf(alpha) + alpha.length }],
  ])), '# Root\n\n## Alpha\nAlpha body\n\n## Zebra\nZebra body\n### Child\nChild body\n');
});

test('section sorting uses bounded document calls with more than 200 siblings', async () => {
  const nodes = Array.from({ length: 201 }, (_, index) => ({ children: [], indexPath: String(index), kind: 'heading', level: 1, title: `Title ${String(201 - index).padStart(3, '0')}` }));
  const markdown = nodes.map((node) => `# ${node.title}\n\nBody\n`).join('\n');
  let outlineCalls = 0; let readCalls = 0; let replaceCalls = 0;
  await sortSection({ target: null, ui: {}, doc: {
    outline: () => { outlineCalls += 1; return { nodes, version: 'v' }; },
    readSection: () => { readCalls += 1; return { markdown, version: 'v' }; },
    replaceSection: (_node, replacement) => { replaceCalls += 1; assert.match(replacement, /^# Title 001/mu); return { version: 'next' }; },
  } });
  assert.deepEqual({ outlineCalls, readCalls, replaceCalls }, { outlineCalls: 1, readCalls: 1, replaceCalls: 1 });
});
