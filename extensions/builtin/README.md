# Built-in extensions

MarkNode ships these package extensions as public examples of the document API:

- `documentnode.toc` — **Add table of contents** inserts linked, nested heading lists.
- `documentnode.renumber-headings` — **Renumber headings** adds hierarchical numbers to headings.
- `documentnode.list-to-headings` — **Convert list to headings** converts a list subtree to headings.
- `documentnode.sort-section` — **Sort section** alphabetises a section's immediate children.

They use only `outline`, `readSection`, `insert`, and `replaceSection`; none call the extension UI.
Each is a self-contained script under its package's `scripts/` directory. See
[`../README.md`](../README.md) for the package format.
