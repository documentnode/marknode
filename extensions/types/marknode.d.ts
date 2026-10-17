// Generated from MarkNode's document-operation table. Do not edit: each MarkNode
// release regenerates it to match that release.

/** A node by its position in the outline, e.g. `"1.2"`. */
export type IndexPathRef = { indexPath: string };

/** A node by its heading titles from the top, e.g. `"Plan/Goals"`. */
export type TitlePathRef = { titlePath: string };

export type NodeRef = IndexPathRef | TitlePathRef;

/** The document version a node was read at; a write against it can detect a concurrent change. */
export interface Target {
  node: NodeRef;
  version: string;
}

/** A node to read, optionally pinned to the document version it came from, or a `Target`. */
export type NodeHandle = NodeRef | (NodeRef & { version: string }) | Target;

/**
 * A node to change. An index path is a position that another edit can shift, so a write by index
 * path carries the `version` of the outline it came from (`doc.outline().version`); a bare
 * `{ indexPath }` is refused with `invalid`. A title path may omit it.
 */
export type WriteNodeHandle =
  | (IndexPathRef & { version: string })
  | TitlePathRef
  | (TitlePathRef & { version: string })
  | Target;

export type InsertPosition = 'before' | 'after' | 'into' | 'replace';

/** The only outline node kinds exposed by the document-operations contract. */
export type OutlineNodeKind = 'heading' | 'bullet' | 'ordered';

export interface OutlineViewNode {
  children: OutlineViewNode[];
  indexPath: string;
  kind: OutlineNodeKind;
  level?: number | null;
  title: string;
}

/** The result of `doc.outline`. */
export interface OutlineResult {
  nodes: OutlineViewNode[];
  version: string;
}

/** The result of `doc.readSection`. */
export interface ReadSectionResult {
  markdown: string;
  version: string;
}

/** The result of `doc.insert`. */
export interface WriteResult {
  indexPath?: string | null;
  version: string;
}

/** Document operations. Calls are synchronous and return the value. */
export interface Doc {
  /**
   * Reads the document; needs the `doc.read` permission.
   */
  outline(): OutlineResult;

  /**
   * Reads the document; needs the `doc.read` permission.
   */
  readSection(node?: NodeHandle): ReadSectionResult;

  /**
   * Changes the document; needs the `doc.write` permission.
   */
  insert(node: WriteNodeHandle, position: InsertPosition, markdown: string): WriteResult;

  /**
   * Changes the document; needs the `doc.write` permission.
   */
  replaceSection(node: WriteNodeHandle, markdown: string): WriteResult;

  /**
   * Changes the document; needs the `doc.write` permission.
   * @param name The template's name in the user's template library.
   * @param values Values for the template's user fields, by field name.
   */
  applyTemplate(node: WriteNodeHandle, name: string, values: Record<string, string> | undefined, position: InsertPosition): WriteResult;
}

/** One field of a `ui.prompt` form. */
export interface PromptField {
  name: string;
  label?: string;
  /** `text` unless given. */
  type?: 'text' | 'multiline' | 'choice' | 'date';
  default?: string;
  /** Required when `type` is `choice`. */
  choices?: readonly string[];
}

/** One row of a `ui.pick` list: its label, or a label with a detail line. */
export type PickItem = string | { label: string; detail?: string };

/** User interface calls. A dismissed dialog returns `null`. */
export interface Ui {
  /** Shows a form and returns the answers by field name. */
  prompt(fields: readonly PromptField[]): Record<string, string> | null;
  /** Shows a list and returns the chosen item exactly as passed. */
  pick<T extends PickItem>(items: readonly T[]): T | null;
  toast(message: string): void;
}

/** What a command receives. */
export interface Context {
  doc: Doc;
  /** The node the command was invoked on, if any. */
  target: Target | null;
  ui: Ui;
}

/** The default export of a command script. */
export type Command = (context: Context) => unknown | Promise<unknown>;

/** An error thrown by a `doc.*` or `ui.*` call. */
export interface MarkNodeError extends Error {
  code: ErrorCode;
}

/** The `code` of a thrown `MarkNodeError`. */
export type ErrorCode =
  | 'invalid'
  | 'not-found'
  | 'ambiguous'
  | 'conflict'
  | 'stale'
  | 'out-of-scope'
  | 'unavailable'
  | 'too-large'
  | 'internal'
  | 'cancelled';
