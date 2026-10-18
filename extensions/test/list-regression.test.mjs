import assert from 'node:assert/strict';
import test from 'node:test';

import convertList from '../builtin/documentnode.list-to-headings/scripts/convert.js';

function runConversion(markdown, target, nodes) {
  let outlineCalls = 0; let readCalls = 0; let replaceCalls = 0; let replacement;
  return Promise.resolve(convertList({ target, ui: {}, doc: {
    outline: () => { outlineCalls += 1; return { nodes, version: 'outline-v1' }; },
    readSection: () => { readCalls += 1; return { markdown, version: 'document-v1' }; },
    replaceSection: (node, nextMarkdown) => {
      replaceCalls += 1; assert.equal(node, undefined); replacement = nextMarkdown; return { version: 'document-v2' };
    },
  } })).then(() => ({ outlineCalls, readCalls, replaceCalls, replacement }));
}

test('converts only the selected duplicate list subtree at its containing heading level', async () => {
  const source = ['# Unchanged', '', '- One', '  - Nested', '- One', '  - Nested', '', '## Following', 'Body', ''].join('\n');
  const nodes = [{ children: [
    { children: [{ children: [], indexPath: '0.0.0', kind: 'bullet', title: 'Nested' }], indexPath: '0.0', kind: 'bullet', title: 'One' },
    { children: [{ children: [], indexPath: '0.1.0', kind: 'bullet', title: 'Nested' }], indexPath: '0.1', kind: 'bullet', title: 'One' },
    { children: [], indexPath: '0.2', kind: 'heading', level: 2, title: 'Following' },
  ], indexPath: '0', kind: 'heading', level: 1, title: 'Unchanged' }];
  const outcome = await runConversion(source, { node: { indexPath: '0.1' }, version: 'outline-v1' }, nodes);
  assert.equal(outcome.replacement, ['# Unchanged', '', '- One', '  - Nested', '## One', '', '### Nested', '', '## Following', 'Body', ''].join('\n'));
  assert.deepEqual(outcome, { outlineCalls: 1, readCalls: 1, replaceCalls: 1, replacement: outcome.replacement });
});

test('converts list roots below headings while preserving bodies, fences, ordered and tab indentation', async () => {
  const source = ['# Guide', '', '1. First', '   Body', '', '- Second', '\tIndented body', '', '  ```md', '  - fenced text', '  ```', '', '## Existing', 'Unchanged', ''].join('\n');
  const nodes = [{ children: [], indexPath: '0', kind: 'heading', level: 1, title: 'Guide' }, { children: [], indexPath: '1', kind: 'heading', level: 2, title: 'Existing' }];
  const outcome = await runConversion(source, null, nodes);
  assert.equal(outcome.replacement, ['# Guide', '', '## First', '', 'Body', '', '## Second', '', 'Indented body', '', '```md', '- fenced text', '```', '', '## Existing', 'Unchanged', ''].join('\n'));
  assert.deepEqual(outcome, { outlineCalls: 1, readCalls: 1, replaceCalls: 1, replacement: outcome.replacement });
});

test('rejects a selected conversion that would exceed Markdown heading depth before writing', async () => {
  const source = ['###### Deep', '', '- One'].join('\n');
  const nodes = [{ children: [{ children: [], indexPath: '0.0', kind: 'bullet', title: 'One' }], indexPath: '0', kind: 'heading', level: 6, title: 'Deep' }];
  let replaceCalls = 0;
  await assert.rejects(convertList({ target: { node: { indexPath: '0.0' }, version: 'outline-v1' }, ui: {}, doc: {
    outline: () => ({ nodes, version: 'outline-v1' }), readSection: () => ({ markdown: source, version: 'document-v1' }),
    replaceSection: () => { replaceCalls += 1; return { version: 'document-v2' }; },
  } }), /deeper than six levels/u);
  assert.equal(replaceCalls, 0);
});
