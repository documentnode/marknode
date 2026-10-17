// examples/section-tools/src/section.ts
function countWords(markdown) {
  const words = markdown.match(/\S+/g);
  return words === null ? 0 : words.length;
}
function flattenOutline(nodes) {
  return nodes.flatMap((node) => [node, ...flattenOutline(node.children)]);
}
function chooseSection(context) {
  if (context.target !== null) {
    return context.target;
  }
  const outline = context.doc.outline();
  const items = flattenOutline(outline.nodes).map((node) => ({
    label: node.title,
    detail: node.indexPath
  }));
  if (items.length === 0) {
    context.ui.toast("This document has no sections.");
    return null;
  }
  const chosen = context.ui.pick(items);
  return chosen === null ? null : { node: { indexPath: chosen.detail }, version: outline.version };
}

// examples/section-tools/src/count-words.ts
async function count_words_default(context) {
  const section = chooseSection(context);
  if (section === null) {
    return;
  }
  const { markdown } = context.doc.readSection(section);
  context.ui.toast(`${countWords(markdown)} words in this section.`);
}
export {
  count_words_default as default
};
