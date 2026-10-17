import type { Context, OutlineViewNode, Target } from 'marknode';

/** Shared by both commands; the build bundles it into each command's script. */
export function countWords(markdown: string): number {
  const words = markdown.match(/\S+/g);
  return words === null ? 0 : words.length;
}

function flattenOutline(nodes: readonly OutlineViewNode[]): OutlineViewNode[] {
  return nodes.flatMap((node) => [node, ...flattenOutline(node.children)]);
}

/**
 * The section the command was invoked on, or, from the "/" menu or the picker (no target),
 * the section the user chooses. Returns null when the user dismisses the list.
 *
 * Either way the result keeps the document version the section was found at, which a write
 * by index path needs and which lets MarkNode detect an edit made in the meantime.
 */
export function chooseSection(context: Context): Target | null {
  if (context.target !== null) {
    return context.target;
  }
  const outline = context.doc.outline();
  const items = flattenOutline(outline.nodes).map((node) => ({
    label: node.title,
    detail: node.indexPath,
  }));
  if (items.length === 0) {
    context.ui.toast('This document has no sections.');
    return null;
  }
  const chosen = context.ui.pick(items);
  return chosen === null ? null : { node: { indexPath: chosen.detail }, version: outline.version };
}
