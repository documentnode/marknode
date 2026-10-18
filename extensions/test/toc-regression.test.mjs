import assert from 'node:assert/strict';
import test from 'node:test';

import addTableOfContents, { tableOfContentsMarkdown } from '../builtin/documentnode.toc/scripts/add.js';

test('TOC escapes Markdown punctuation in renderer-provided labels', () => {
  assert.equal(tableOfContentsMarkdown([{ level: 1, plainText: '*literal* & x <tag>', anchor: 'literal-x', title: 'raw' }]),
    '- [\\*literal\\* \\& x \\<tag\\>](#literal-x)');
});

test('TOC uses three calls for more than 200 headings', async () => {
  const nodes = Array.from({ length: 201 }, (_, index) => ({ anchor: `heading-${index}`, children: [], indexPath: String(index), kind: 'heading', level: 1, plainText: `Heading ${index}`, title: 'raw' }));
  const calls = [];
  await addTableOfContents({ target: null, ui: {}, doc: {
    outline: () => { calls.push('outline'); return { nodes, headings: nodes, version: 'v' }; },
    readSection: () => { calls.push('readSection'); return { markdown: '# Original\n', version: 'v' }; },
    replaceSection: (_node, markdown) => { calls.push('replaceSection'); assert.match(markdown, /^- \[Heading 0\]/u); return { version: 'next' }; },
  } });
  assert.deepEqual(calls, ['outline', 'readSection', 'replaceSection']);
});

test('TOC leaves a no-heading document unchanged', async () => {
  let writes = 0;
  await addTableOfContents({ target: null, ui: {}, doc: { outline: () => ({ nodes: [], headings: [], version: 'v' }), readSection: () => { writes += 1; }, replaceSection: () => { writes += 1; } } });
  assert.equal(writes, 0);
});

test('TOC rejects missing renderer metadata before writing', async () => {
  let writes = 0;
  await assert.rejects(() => addTableOfContents({ target: null, ui: {}, doc: {
    outline: () => ({ nodes: [], headings: [{ level: 1 }], version: 'v' }),
    readSection: () => { writes += 1; },
    replaceSection: () => { writes += 1; },
  } }), /rendered heading metadata/u);
  assert.equal(writes, 0);
});


test('TOC includes rendered headings absent from the addressable outline', async () => {
  let result;
  await addTableOfContents({ doc: {
    outline: () => ({ nodes: [{ kind: 'bullet', title: '## Nested', children: [] }], headings: [{ level: 2, plainText: 'Nested', anchor: 'nested' }] }),
    readSection: () => ({ markdown: '- ## Nested\n' }),
    replaceSection: (_, value) => { result = value; },
  } });
  assert.equal(result, '- [Nested](#nested)\n\n- ## Nested\n');
});
