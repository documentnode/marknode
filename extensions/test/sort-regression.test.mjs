import assert from 'node:assert/strict';
import test from 'node:test';
import MarkdownIt from 'markdown-it';
import sortSection from '../builtin/documentnode.sort-section/scripts/sort.js';

const markdown = new MarkdownIt('commonmark');
const heading = (title, indexPath, children = [], level = 1) => ({ title, indexPath, children, kind: 'heading', level });
const item = (title, indexPath, children = [], kind = 'bullet') => ({ title, indexPath, children, kind });

async function run(source, nodes, target = null) {
  let result = source; let writes = 0;
  await sortSection({ target, doc: {
    outline: () => ({ nodes, version: 'v1' }),
    readSection: () => ({ markdown: source, version: 'v1' }),
    replaceSection: (node, replacement) => {
      assert.equal(node, undefined); result = replacement; writes += 1; return { version: 'v2' };
    },
  } });
  return { result, writes };
}

function headingTitles(source) {
  const tokens = markdown.parse(source, {});
  return tokens.flatMap((token, index) => token.type === 'heading_open' ? [tokens[index + 1].content] : []);
}

for (const newline of ['\n', '\r\n']) {
  test(`root sort preserves EOF section boundaries and line endings (${JSON.stringify(newline)})`, async () => {
    const source = ['Preamble', '', '# Zebra', '', 'Z body', '', '# Alpha', '', 'A body'].join(newline);
    const nodes = [heading('Zebra', '0'), heading('Alpha', '1')];
    const first = await run(source, nodes);
    assert.equal(first.result, ['Preamble', '', '# Alpha', '', 'A body', '', '# Zebra', '', 'Z body'].join(newline));
    assert.equal(first.writes, 1);
    assert.deepEqual(headingTitles(first.result), ['Alpha', 'Zebra']);
    assert.deepEqual(await run(first.result, [heading('Alpha', '0'), heading('Zebra', '1')]), { result: first.result, writes: 0 });
  });

  test(`targeted sort keeps its preamble and fenced EOF body (${JSON.stringify(newline)})`, async () => {
    const source = ['# Outside', '', 'Unchanged', '', '# Root', '', 'Root body', '', '## Zebra', '', 'Z body', '', '## Alpha', '', '```md', '# fence heading', '```'].join(newline);
    const nodes = [heading('Outside', '0'), heading('Root', '1', [heading('Zebra', '1.0', [], 2), heading('Alpha', '1.1', [], 2)])];
    const target = { node: { indexPath: '1' }, version: 'v1' };
    const first = await run(source, nodes, target);
    assert.equal(first.result, ['# Outside', '', 'Unchanged', '', '# Root', '', 'Root body', '', '## Alpha', '', '```md', '# fence heading', '```', '', '## Zebra', '', 'Z body'].join(newline));
    assert.deepEqual(headingTitles(first.result), ['Outside', 'Root', 'Alpha', 'Zebra']);
    assert.deepEqual(markdown.parse(first.result, {}).filter((token) => token.type === 'fence').map((token) => token.content), ['# fence heading\n']);
    const sortedNodes = [heading('Outside', '0'), heading('Root', '1', [heading('Alpha', '1.0', [], 2), heading('Zebra', '1.1', [], 2)])];
    assert.deepEqual(await run(first.result, sortedNodes, target), { result: first.result, writes: 0 });
  });

  test(`root list sort keeps EOF bodies and nested items separate (${JSON.stringify(newline)})`, async () => {
    const source = ['- Zebra', '  Z body', '  - Nested', '    Child body', '- Alpha', '  A body'].join(newline);
    const nodes = [item('Zebra', '0', [item('Nested', '0.0')]), item('Alpha', '1')];
    const first = await run(source, nodes);
    assert.equal(first.result, ['- Alpha', '  A body', '- Zebra', '  Z body', '  - Nested', '    Child body'].join(newline));
    assert.equal(markdown.parse(first.result, {}).filter((token) => token.type === 'list_item_open').length, 3);
    assert.deepEqual(await run(first.result, [item('Alpha', '0'), item('Zebra', '1', [item('Nested', '1.0')])]), { result: first.result, writes: 0 });
  });
}

test('targeted list sort preserves sibling scope and ordered item Markdown at EOF', async () => {
  const source = '- Outside\n- Parent\n  1. Zebra\n     Z body\n  2. Alpha\n     A body';
  const nodes = [item('Outside', '0'), item('Parent', '1', [item('Zebra', '1.0', [], 'ordered'), item('Alpha', '1.1', [], 'ordered')])];
  const target = { node: { indexPath: '1' }, version: 'v1' };
  const first = await run(source, nodes, target);
  assert.equal(first.result, '- Outside\n- Parent\n\n  2. Alpha\n     A body\n  1. Zebra\n     Z body');
  assert.equal(markdown.parse(first.result, {}).filter((token) => token.type === 'list_item_open').length, 4);
  assert.deepEqual(await run(first.result, [item('Outside', '0'), item('Parent', '1', [item('Alpha', '1.0', [], 'ordered'), item('Zebra', '1.1', [], 'ordered')])], target), { result: first.result, writes: 0 });
});

test('equal title order stays stable while sections retain their own bodies', async () => {
  const source = '# Zebra\n\nZ\n\n# alpha\n\nfirst\n\n# Alpha\n\nsecond';
  const first = await run(source, [heading('Zebra', '0'), heading('alpha', '1'), heading('Alpha', '2')]);
  assert.equal(first.result, '# alpha\n\nfirst\n\n# Alpha\n\nsecond\n\n# Zebra\n\nZ');
  assert.deepEqual(headingTitles(first.result), ['alpha', 'Alpha', 'Zebra']);
  assert.deepEqual(await run(first.result, [heading('alpha', '0'), heading('Alpha', '1'), heading('Zebra', '2')]), { result: first.result, writes: 0 });
});

test('already sorted and single-node documents are exact no-ops', async () => {
  for (const source of ['# Alpha\n\nA body\n\n# Zebra\n\nZ body', '# Alpha\n\nA body\n\n# Zebra\n\nZ body\n']) {
    assert.deepEqual(await run(source, [heading('Alpha', '0'), heading('Zebra', '1')]), { result: source, writes: 0 });
  }
  assert.deepEqual(await run('# Only\n\nBody', [heading('Only', '0')]), { result: '# Only\n\nBody', writes: 0 });
});

test('target sort matches native outline when a list body contains a heading', async () => {
  // Verified against MarkdownOutlineParser: Nested belongs to Item's body and
  // is not a separately addressable outline heading.
  const source = '# Root\n\n## Zebra\n\n- Item\n\n  ### Nested\n\n## Alpha\n';
  const nodes = [heading('Root', '0', [heading('Zebra', '0.0', [item('Item', '0.0.0')], 2), heading('Alpha', '0.1', [], 2)])];
  const target = { node: { indexPath: '0' }, version: 'v1' };
  const first = await run(source, nodes, target);
  assert.equal(first.result, '# Root\n\n## Alpha\n\n## Zebra\n\n- Item\n\n  ### Nested\n');
  assert.deepEqual(headingTitles(first.result), ['Root', 'Alpha', 'Zebra', 'Nested']);
  const sortedNodes = [heading('Root', '0', [heading('Alpha', '0.0', [], 2), heading('Zebra', '0.1', [item('Item', '0.1.0')], 2)])];
  assert.deepEqual(await run(first.result, sortedNodes, target), { result: first.result, writes: 0 });
});

test('list sorting keeps omitted body headings and quoted lists with their owning item', async () => {
  const zebra = '- Zebra\n\n  ## Hidden\n\n  body\n  - Nested\n\n    ### Hidden nested';
  const alpha = '- Alpha\n\n  > ### Also hidden\n  > - Quoted body';
  const source = `# Root\n\nRoot body\n\n${zebra}\n\n${alpha}\n\n# Outside\nBody`;
  const nodes = [heading('Root', '0', [item('Zebra', '0.0', [item('Nested', '0.0.0')]), item('Alpha', '0.1')]), heading('Outside', '1')];
  const target = { node: { indexPath: '0' }, version: 'v1' };
  const first = await run(source, nodes, target);
  assert.equal(first.result, `# Root\n\nRoot body\n\n${alpha}\n\n${zebra}\n\n# Outside\nBody`);
  const sortedNodes = [heading('Root', '0', [item('Alpha', '0.0'), item('Zebra', '0.1', [item('Nested', '0.1.0')])]), heading('Outside', '1')];
  assert.deepEqual(await run(first.result, sortedNodes, target), { result: first.result, writes: 0 });
});

test('wide outlines move nested heading sections whole and close all open levels', async () => {
  const titles = Array.from({ length: 2048 }, (_, index) => String(2048 - index).padStart(4, '0'));
  const section = (title) => `# ${title}\n\nBody ${title}\n\n### Child ${title}\n\nChild body\n\n#### Grandchild ${title}\n\nGrandchild body`;
  const source = titles.map(section).join('\n\n');
  const nodesFor = (order) => order.map((title, index) => heading(title, String(index), [heading(`Child ${title}`, `${index}.0`, [heading(`Grandchild ${title}`, `${index}.0.0`, [], 4)], 3)]));
  const first = await run(source, nodesFor(titles));
  const sortedTitles = titles.slice().reverse();
  assert.equal(first.result, sortedTitles.map(section).join('\n\n'));
  assert.equal(headingTitles(first.result).length, titles.length * 3);
  assert.deepEqual(await run(first.result, nodesFor(sortedTitles)), { result: first.result, writes: 0 });
});

for (const newline of ['\n', '\r\n']) {
  test(`quoted ordered roots map to native kinds and preserve bodies (${JSON.stringify(newline)})`, async () => {
    const source = ['> 1. Zebra', '>    Z body', '> 2. Alpha', '>    A body'].join(newline);
    const nodes = [item('Zebra', '0', [], 'ordered'), item('Alpha', '1', [], 'ordered')];
    const first = await run(source, nodes);
    assert.equal(first.result, ['> 2. Alpha', '>    A body', '> 1. Zebra', '>    Z body'].join(newline));
    const tokens = markdown.parse(first.result, {});
    assert.equal(tokens.filter((token) => token.type === 'blockquote_open').length, 1);
    assert.equal(tokens.filter((token) => token.type === 'list_item_open').length, 2);
    assert.deepEqual(await run(first.result, [item('Alpha', '0', [], 'ordered'), item('Zebra', '1', [], 'ordered')]), { result: first.result, writes: 0 });
  });

  test(`targeted quoted ordered children keep paragraph and list boundaries (${JSON.stringify(newline)})`, async () => {
    const source = ['> - Outside', '> - Parent', '>   1. Zebra', '>      Z body', '>   2. Alpha', '>      A body'].join(newline);
    const nodes = [item('Outside', '0'), item('Parent', '1', [item('Zebra', '1.0', [], 'ordered'), item('Alpha', '1.1', [], 'ordered')])];
    const target = { node: { indexPath: '1' }, version: 'v1' };
    const first = await run(source, nodes, target);
    assert.equal(first.result, ['> - Outside', '> - Parent', '>', '>   2. Alpha', '>      A body', '>   1. Zebra', '>      Z body'].join(newline));
    const tokens = markdown.parse(first.result, {});
    assert.equal(tokens.filter((token) => token.type === 'blockquote_open').length, 1);
    assert.equal(tokens.filter((token) => token.type === 'list_item_open').length, 4);
    const sorted = [item('Outside', '0'), item('Parent', '1', [item('Alpha', '1.0', [], 'ordered'), item('Zebra', '1.1', [], 'ordered')])];
    assert.deepEqual(await run(first.result, sorted, target), { result: first.result, writes: 0 });
  });
}

for (const definition of ['[^n]: ### Note', '[^n]: - Note\n\n    - Nested note']) {
  test(`target sort keeps non-addressable footnote content with its section (${definition.split('\n')[0]})`, async () => {
    // Native addressable outlines omit the relocated FootnoteDefinition subtree;
    // its rendered headings are available separately through outline.headings.
    const source = `# Root\n\n## Zebra\n\nBody[^n].\n\n${definition}\n\n## Alpha\n`;
    const nodes = [heading('Root', '0', [heading('Zebra', '0.0', [], 2), heading('Alpha', '0.1', [], 2)])];
    const target = { node: { indexPath: '0' }, version: 'v1' };
    const first = await run(source, nodes, target);
    assert.equal(first.result, `# Root\n\n## Alpha\n\n## Zebra\n\nBody[^n].\n\n${definition}\n`);
    assert.equal(first.writes, 1);
    assert.deepEqual(headingTitles(first.result), ['Root', 'Alpha', 'Zebra']);
    const sortedNodes = [heading('Root', '0', [heading('Alpha', '0.0', [], 2), heading('Zebra', '0.1', [], 2)])];
    assert.deepEqual(await run(first.result, sortedNodes, target), { result: first.result, writes: 0 });
  });
}
