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

/** The capture groups of one regex match; a group that did not take part is the empty string. */
export interface FindGroups {
  /** Index 0 is the whole match, index `n` is group `n`. */
  byIndex: string[];
  byName: Record<string, string>;
}

/** One occurrence of the query. */
export interface FindMatch {
  /** Up to 40 UTF-16 code units of the same line after the match. */
  after: string;
  /** Up to 40 UTF-16 code units of the same line before the match. */
  before: string;
  /** The capture groups of a regex search; absent otherwise. */
  groups?: FindGroups | null;
  /** The index path of the innermost node whose section contains the match; null before the first node. */
  node: string | null;
  range: TextRange;
  /** The whole matched text. */
  text: string;
}

/** How `find` searches: the options of Find in Files, plus the part of the document to search. */
export interface FindOptions {
  /** Match letter case exactly. False when absent. */
  caseSensitive?: boolean;
  /** The most matches to return, 1 to 1000; 1000 when absent. */
  limit?: number | null;
  /** Search only this node's section; the whole document when absent. */
  node?: NodeHandle;
  /** Treat the query as a regular expression (the Rust `regex` syntax). False when absent. */
  regex?: boolean;
  /** `code` leaves out everything a reader does not see as prose (code, math, frontmatter, HTML, link destinations); nothing is left out when absent. */
  skip?: FindSkip | null;
  /** Match only whole words. False when absent. */
  wholeWord?: boolean;
}

/** What `find` leaves out of its search. */
export type FindSkip = 'code';

export type InsertPosition = 'before' | 'after' | 'into' | 'replace';

/** The only outline node kinds exposed by the document-operations contract. */
export type OutlineNodeKind = 'heading' | 'bullet' | 'ordered';

export interface OutlineViewNode {
  anchor?: string | null;
  children: OutlineViewNode[];
  indexPath: string;
  kind: OutlineNodeKind;
  level?: number | null;
  plainText?: string | null;
  title: string;
}

/** All rendered headings in source order, including headings inside lists, quotes and footnotes that are not individually addressable outline nodes. */
export interface RenderedHeading {
  anchor: string;
  /** Zero-based UTF-16 column of the heading start in its original source line. */
  column: number;
  /** Exclusive source end line, including a setext underline when present. */
  endLine: number;
  level: number;
  /** Zero-based source start line. */
  line: number;
  plainText: string;
}

/** One replacement of `replaceText`: the text of `range` becomes `text`. */
export interface ReplaceTextEdit {
  range: TextRange;
  text: string;
}

/** A position in a document's text: a zero-based line and a zero-based UTF-16 column within that line's content. */
export interface TextPosition {
  column: number;
  line: number;
}

/** A range of a document's text, tied to the version it was read from. */
export interface TextRange {
  end: TextPosition;
  start: TextPosition;
  version: string;
}

/** The result of `doc.outline`. */
export interface OutlineResult {
  headings: RenderedHeading[];
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

/** The result of `doc.find`. */
export interface FindResult {
  matches: FindMatch[];
  /** True when there were more than `limit` matches and only the first `limit` are returned. */
  truncated: boolean;
  /** The version of exactly the text searched; every match's range carries it. */
  version: string;
}

/** The result of `doc.replaceText`. */
export interface ReplaceTextResult {
  ranges: TextRange[];
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
  replaceSection(node: WriteNodeHandle | undefined, markdown: string): WriteResult;

  /**
   * Changes the document; needs the `doc.write` permission.
   * @param name The template's name in the user's template library.
   * @param values Values for the template's user fields, by field name.
   */
  applyTemplate(node: WriteNodeHandle, name: string, values: Record<string, string> | undefined, position: InsertPosition): WriteResult;

  /**
   * Reads the document; needs the `doc.read` permission.
   * @param query The text to search for: a literal, or a regular expression when `options.regex` is set. At most 1,024 bytes; empty or whitespace-only is refused.
   */
  find(query: string, options?: FindOptions): FindResult;

  /**
   * Changes the document; needs the `doc.write` permission.
   * @param edits The text ranges to replace, all read from one version, without overlap.
   */
  replaceText(edits: ReplaceTextEdit[]): ReplaceTextResult;
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

/** One proposed change of a `ui.review` list. */
export interface ReviewItem {
  /** The text to replace, for example a `doc.find` match's `range`; text this run has not changed. All items share one version. */
  range: TextRange;
  /** The proposed text; `''` proposes a deletion. */
  replacement: string;
  label?: string;
  detail?: string;
  /** `true` unless given. */
  checked?: boolean;
}

/** `title` is cut to 80, `applyLabel` to 40 and `note` to 200 characters. */
export interface ReviewOptions {
  title?: string;
  applyLabel?: string;
  note?: string;
}

/** The selection the command was invoked with: the editor's main selection (its cursor when empty). */
export interface Selection {
  /** A range of the run's first version; a cursor has equal ends. */
  range: TextRange;
  /** The selected text: empty for a cursor, `null` when it is longer than 1 MiB. */
  text: string | null;
}

/** User interface calls. A dismissed dialog returns `null`. */
export interface Ui {
  /** Shows a form and returns the answers by field name. */
  prompt(fields: readonly PromptField[]): Record<string, string> | null;
  /** Shows a list and returns the chosen item exactly as passed. */
  pick<T extends PickItem>(items: readonly T[]): T | null;
  toast(message: string): void;
  /** Shows proposed changes to tick; returns the accepted items exactly as passed, in document order, or `null`. */
  review<T extends ReviewItem>(items: readonly T[], options?: ReviewOptions): T[] | null;
}

/** What a command receives. */
export interface Context {
  doc: Doc;
  /** The node the command was invoked on, if any. */
  target: Target | null;
  ui: Ui;
  /** The editor's main selection; `null` without `doc.read`, when no editor shows the document, or in Preview only. */
  selection: Selection | null;
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
  | 'file-open-in-app'
  | 'outcome-unknown'
  | 'too-large'
  | 'internal'
  | 'cancelled';
