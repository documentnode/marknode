// examples/section-tools/src/section.ts
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

// examples/section-tools/src/add-note.ts
async function add_note_default(context) {
  const section = chooseSection(context);
  if (section === null) {
    return;
  }
  const answers = context.ui.prompt([{ name: "note", label: "Note", type: "multiline" }]);
  if (answers === null || answers.note.trim() === "") {
    return;
  }
  context.doc.insert(section, "into", `> **Note:** ${answers.note.trim()}`);
  context.ui.toast("Note added.");
}
export {
  add_note_default as default
};
