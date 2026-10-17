/** @marknode
 * name: Say hello
 * description: Greets the person you name and reports how many outline items the document has.
 * version: 1.0.0
 * menus: [editor/slash]
 * permissions: [doc.read, doc.write]
 */
import type { Context, OutlineViewNode } from 'marknode';

function countOutlineItems(nodes: readonly OutlineViewNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countOutlineItems(node.children), 0);
}

export default async function ({ doc, target, ui }: Context): Promise<void> {
  const outline = doc.outline();
  const firstNode = outline.nodes[0];
  if (firstNode === undefined) {
    ui.toast('This document has no outline items to add a greeting after.');
    return;
  }

  const answers = ui.prompt([{ name: 'person', label: 'Who should I greet?', default: 'world' }]);
  if (answers === null) {
    return;
  }

  // From the "/" menu there is no target, so greet after the document's first top-level section.
  // A write by index path carries the version of the outline the path came from.
  const anchor = target ?? { node: { indexPath: firstNode.indexPath }, version: outline.version };
  const itemCount = countOutlineItems(outline.nodes);
  doc.insert(anchor, 'after', `Hello, ${answers.person}! This document has ${itemCount} outline items.`);
  ui.toast(`Said hello to ${answers.person}.`);
}
