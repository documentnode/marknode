/** @marknode
 * name: Say hello
 * description: Greets the person you name and reports how many outline items the document has.
 * version: 1.0.0
 * menus: [editor/slash]
 * permissions: [doc.read, doc.write]
 */

// examples/hello-world/src/hello-world.ts
function countOutlineItems(nodes) {
  return nodes.reduce((total, node) => total + 1 + countOutlineItems(node.children), 0);
}
async function hello_world_default({ doc, target, ui }) {
  const outline = doc.outline();
  const firstNode = outline.nodes[0];
  if (firstNode === void 0) {
    ui.toast("This document has no outline items to add a greeting after.");
    return;
  }
  const answers = ui.prompt([{ name: "person", label: "Who should I greet?", default: "world" }]);
  if (answers === null) {
    return;
  }
  const anchor = target ?? { node: { indexPath: firstNode.indexPath }, version: outline.version };
  const itemCount = countOutlineItems(outline.nodes);
  doc.insert(anchor, "after", `Hello, ${answers.person}! This document has ${itemCount} outline items.`);
  ui.toast(`Said hello to ${answers.person}.`);
}
export {
  hello_world_default as default
};
