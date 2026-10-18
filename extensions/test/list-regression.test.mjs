import assert from 'node:assert/strict';
import test from 'node:test';
import MarkdownIt from 'markdown-it';

const markdownParser = new MarkdownIt('commonmark');

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


test('empty nested list items retain sibling hierarchy and convert to empty headings', async () => {
  for (const eol of ['\n', '\r\n']) {
    const source = ['- A', '', '  -', '  - B', '- C', ''].join(eol);
    const outcome = await runConversion(source, null, []);
    assert.equal(outcome.replacement, ['# A', '', '## ', '', '## B', '', '# C', ''].join(eol));
    assert.equal(outcome.replaceCalls, 1);
  }
});

test('empty root list item and its continuation body do not shift following siblings', async () => {
  const source = '-\n\n  Body.\n\n- Next';
  const outcome = await runConversion(source, null, []);
  assert.equal(outcome.replacement, '# \n  Body.\n\n# Next');
});


test('a Setext heading inside a list does not change following root conversion levels', async () => {
  const outcome = await runConversion('- A\n  -\n  - B\n- C\n', null, []);
  assert.equal(outcome.replacement, '# A\n\n-\n\n## B\n\n# C\n');
});

const listNode = (title, indexPath, children = [], kind = 'bullet') => ({ title, indexPath, children, kind });

// These addresses were checked against the native MarkdownOutlineParser: quote
// containers do not add outline nodes; nested list items do add path segments.
for (const eol of ['\n', '\r\n']) {
  test(`quoted root and empty nested items retain their containers (${JSON.stringify(eol)})`, async () => {
    const source = ['> - A', '>', '>   -', '>   - B', '> - C', ''].join(eol);
    const nodes = [listNode('A', '0', [listNode('', '0.0'), listNode('B', '0.1')]), listNode('C', '1')];
    const outcome = await runConversion(source, null, nodes);
    assert.equal(outcome.replacement, ['> # A', '>', '> ## ', '>', '> ## B', '>', '> # C', ''].join(eol));
    assert.equal(outcome.replaceCalls, 1);
  });

  test(`nested quote prefixes are applied once to headings, bodies, and fences (${JSON.stringify(eol)})`, async () => {
    const source = ['> > - Zebra', '> >', '> >   Body', '> >', '> >   ```md', '> >   - fenced text', '> >   ```', '> >', '> >   - Nested', '> >     Child body', '> > - Alpha'].join(eol);
    const nodes = [listNode('Zebra', '0', [listNode('Nested', '0.0')]), listNode('Alpha', '1')];
    const outcome = await runConversion(source, null, nodes);
    assert.equal(outcome.replacement, ['> > # Zebra', '> >', '> > Body', '> > ', '> > ```md', '> > - fenced text', '> > ```', '> >', '> > ## Nested', '> >', '> > Child body', '> >', '> > # Alpha'].join(eol));
    assert.equal(outcome.replaceCalls, 1);
    const tokens = markdownParser.parse(outcome.replacement, {});
    assert.deepEqual(tokens.filter((token) => token.type === 'fence').map((token) => token.content), ['- fenced text\n']);
    assert.equal(tokens.filter((token) => token.type === 'list_item_open').length, 0);
    let quoteDepth = 0;
    const headingDepths = [];
    for (const token of tokens) {
      if (token.type === 'blockquote_open') quoteDepth += 1;
      if (token.type === 'blockquote_close') quoteDepth -= 1;
      if (token.type === 'heading_open') headingDepths.push(quoteDepth);
    }
    assert.deepEqual(headingDepths, [2, 2, 2]);
    const again = await runConversion(outcome.replacement, null, []);
    assert.equal(again.replaceCalls, 0);
  });

  test(`targeted quoted list conversion preserves other quoted siblings (${JSON.stringify(eol)})`, async () => {
    const source = ['> - Outside', '> - Parent', '>   1. Zebra', '>      Z body', '>   2. Alpha', '>      A body'].join(eol);
    const nodes = [listNode('Outside', '0'), listNode('Parent', '1', [listNode('Zebra', '1.0', [], 'ordered'), listNode('Alpha', '1.1', [], 'ordered')])];
    const outcome = await runConversion(source, { node: { indexPath: '1' }, version: 'outline-v1' }, nodes);
    assert.equal(outcome.replacement, ['> - Outside', '> # Parent', '>', '> ## Zebra', '>', '> Z body', '>', '> ## Alpha', '>', '> A body'].join(eol));
    assert.equal(outcome.replaceCalls, 1);
  });
}

test('quoted list lazy continuation text stays inside the quote after conversion', async () => {
  const source = '> - Item\n  lazy continuation\n> - Next';
  const outcome = await runConversion(source, null, [listNode('Item', '0'), listNode('Next', '1')]);
  assert.equal(outcome.replacement, '> # Item\n>\n> lazy continuation\n>\n> # Next');
  assert.equal(outcome.replaceCalls, 1);
});

test('targeting a nested item in doubled quotes does not repeat the parent quote prefix', async () => {
  const source = '> > - Zebra\n> >   body\n> >   - Nested\n> > - Alpha';
  const nodes = [listNode('Zebra', '0', [listNode('Nested', '0.0')]), listNode('Alpha', '1')];
  const outcome = await runConversion(source, { node: { indexPath: '0.0' }, version: 'outline-v1' }, nodes);
  assert.equal(outcome.replacement, '> > - Zebra\n> >   body\n> > ## Nested\n> >\n> > - Alpha');
  assert.equal(outcome.replaceCalls, 1);
});


test('quoted empty root items preserve the following quoted paragraph', async () => {
  const source = '> -\n>\n>   Body.\n>\n> - Next';
  const outcome = await runConversion(source, null, [listNode('', '0'), listNode('Next', '1')]);
  assert.equal(outcome.replacement, '> # \n>   Body.\n>\n> # Next');
  const tokens = markdownParser.parse(outcome.replacement, {});
  assert.equal(tokens.filter((token) => token.type === 'blockquote_open').length, 1);
  assert.deepEqual(tokens.filter((token) => token.type === 'inline').map((token) => token.content), ['', 'Body.', 'Next']);
});
