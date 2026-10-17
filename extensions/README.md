# Writing MarkNode extensions

An **extension** adds commands (and, in a package, templates, mind map themes and preview styles)
to MarkNode. A command runs a JavaScript **script** against the document it was invoked from,
through MarkNode's document operations and nothing else. Scripts run in an isolated, sandboxed
process: a script cannot touch your files, the network, the clipboard, other documents, other
extensions, or the app's settings.

This folder is the authoring kit: the [type definitions](types/marknode.d.ts), this guide, and
[working examples](examples/). It is MIT-licensed (see [`LICENSE`](LICENSE)).

- [The two forms of extension](#the-two-forms-of-extension)
- [The script](#the-script)
- [The API](#the-api)
- [Permissions and approval](#permissions-and-approval)
- [Limits](#limits)
- [Undo and failure](#undo-and-failure)
- [Error codes](#error-codes)
- [Packaging: `.mnext`](#packaging-mnext)
- [Installing](#installing)
- [Using TypeScript](#using-typescript)
- [Repository layout](#repository-layout)

## The two forms of extension

Both forms are installed, approved, enabled and removed the same way.

### One-file extension

A single `.js` file whose first block comment is its manifest. It contributes exactly one command.

```js
/** @marknode
 * name: Add lesson summary
 * description: Adds a summary under the section.
 * version: 1.0.0
 * menus: [editor/slash, mindmap/node, outline/node]
 * permissions: [doc.read, doc.write]
 */
export default async function ({ doc, target, ui }) {
  // ...
}
```

The header is `key: value` lines in the file's **first block comment**, starting with `@marknode`.

| Key | Required | Meaning |
|---|---|---|
| `name` | yes | Display name |
| `description` | no | One-line description |
| `version` | no | Semantic version; `0.0.0` when absent |
| `menus` | no | Where the command appears, a list of `editor/slash`, `mindmap/node`, `outline/node` |
| `permissions` | no | A list of `doc.read` and `doc.write` |

`name`, `description`, `version`, `menus` and `permissions` mean exactly what they mean in a package
manifest.

**The file name is the identity.** The extension id is `personal.` plus the file name without
`.js`, lowercased, with every run of other characters (anything but lowercase letters and digits)
replaced by `-` and leading and trailing `-` trimmed. `My Script.js` becomes `personal.my-script`.
A name that is empty after this is invalid. Renaming the file therefore changes the extension's id,
and two files that map to the same id are both disabled. This is why the example's built file is
named `hello-world.js`.

### Package

A folder with a `manifest.json` and the files it names. Use a package for more than one command, or
to add templates, mind map themes or preview styles.

```jsonc
{
  "id": "acme.course-authoring",
  "name": "Course Authoring",
  "version": "1.2.0",
  "minAppVersion": "2.2.2",
  "description": "Commands for course writers.",
  "author": "Acme",
  "products": ["marknode"],
  "permissions": ["doc.read", "doc.write"],
  "contributes": {
    "commands": [{ "id": "summary", "title": "Add lesson summary", "script": "scripts/summary.js" }],
    "menus": { "editor/slash": ["summary"], "mindmap/node": ["summary"], "outline/node": ["summary"] },
    "templates": ["templates/image-slide.md"],
    "mindThemes": ["themes/course.json"],
    "previewStyles": ["styles/course.css"]
  }
}
```

| Field | Required | Rules |
|---|---|---|
| `id` | yes | `publisher.name`; each part is lowercase letters, digits and `-`, for example `acme.course-authoring`. `documentnode.*` is reserved for built-in extensions and `personal.*` for one-file extensions |
| `name` | yes | Display name, shown as written |
| `version` | yes | Semantic version |
| `minAppVersion` | yes | The oldest MarkNode that can run it; an older app lists the extension as "Requires MarkNode x.y or later" and disables it |
| `description`, `author` | no | Shown in the Extensions section |
| `products` | no | Defaults to `["marknode"]`; an extension that does not include the running product is disabled |
| `permissions` | no | `doc.read`, `doc.write`; any other value makes the manifest invalid |
| `contributes.commands` | no | Objects `{ id, title, script }`. The command id is `<extension id>.<id>`. `script` is a path under `scripts/` |
| `contributes.menus` | no | Maps a surface (`editor/slash`, `mindmap/node`, `outline/node`) to a list of command `id`s that appear there |
| `contributes.templates` | no | Paths under `templates/`, `.md` |
| `contributes.mindThemes` | no | Paths under `themes/`, `.json` |
| `contributes.previewStyles` | no | Paths under `styles/`, `.css` |

Rules:

- Unknown manifest keys are rejected, so a typo cannot be silently ignored.
- A command appears on a surface only when `menus` lists it there. Every enabled command is also
  listed in **Run Extension Command…**.
- A manifest that is malformed, has an invalid id, an unknown permission, or names a file that is
  missing is not installed (import) or is listed with the reason and disabled (folder).
- File paths are relative, use `/`, contain no `.`, `..`, empty or absolute segment, and lie in the
  folder for their kind: `scripts/` (`.js`), `templates/` (`.md`), `themes/` (`.json`),
  `styles/` (`.css`). Files must be valid UTF-8 text.
- A package is at most 256 KiB, measured in `.mnext` form (below).

The [`section-tools`](examples/section-tools/) example is a complete package. To try it, copy the
folder into your extensions folder as `example.section-tools` (its `id`); `src/` is ignored there.

## The script

A script is an ES module, one self-contained file per command, whose default export is an `async`
function receiving a single object `{ doc, target, ui }`:

```js
export default async function ({ doc, target, ui }) {
  const { markdown } = doc.readSection(target?.node);
  ui.toast(`${markdown.split(/\s+/).length} words`);
}
```

- **No imports.** A script containing a static `import` or a dynamic `import()` fails with
  `script-error` ("Imports are not supported; bundle the script into one file"). Write the whole
  command in one file or [bundle it](#using-typescript). `import type` is fine in TypeScript
  because the compiler erases it.
- **Calls are synchronous.** `doc.*` and `ui.*` return their value directly; the script is paused
  while MarkNode answers. `await` on a value still works, so `async function` is fine.
- **`target`** is the node the command was invoked on from a mind map or outline node menu, as
  `{ node, version }`; it is `null` from the `/` menu and **Run Extension Command…**, where the
  script addresses nodes itself (`ui.pick` can ask the user to choose one).
- **Errors** thrown by a `doc.*` or `ui.*` call are `Error`s with a string `code` property
  (see [Error codes](#error-codes)). They can be caught; an uncaught error ends the run and the
  document is left unchanged.
- A script reading the document after writing it in the same run sees its own writes.
- A script has no access to files, the network, the clipboard, timers beyond its run, other
  documents, other extensions, or the app's settings.
- Scripts are plain JavaScript source text. TypeScript is supported only by compiling to JavaScript
  yourself.

## The API

The full, exact signatures are in [`types/marknode.d.ts`](types/marknode.d.ts), which matches the
MarkNode release it ships with. In summary:

**`doc`** — the document operations, on the document the command was invoked from. Nodes are
addressed by `{ indexPath: "1.2" }` or `{ titlePath: "Plan/Goals" }`, or by a `Target`
(`{ node, version }`) that also carries the document `version` the node was read at, so a write can
detect a concurrent change. A **write by index path must carry that version** — pass `target`, or
`{ node: { indexPath }, version: outline.version }` with the `version` from the `doc.outline()` the
path came from; a bare `{ indexPath }` is refused with `invalid`. The types enforce this
(`WriteNodeHandle`).

| Call | Needs | Does |
|---|---|---|
| `doc.outline()` | `doc.read` | Returns the outline tree and the document `version` |
| `doc.readSection(node?)` | `doc.read` | Returns a section's Markdown and `version` |
| `doc.insert(node, position, markdown)` | `doc.write` | Inserts Markdown `before`, `after`, `into` or in place of (`replace`) a node |
| `doc.replaceSection(node, markdown)` | `doc.write` | Replaces a section |
| `doc.applyTemplate(node, name, values, position)` | `doc.write` | Applies one of the user's templates by name |

Templates (personal, team, and those contributed by enabled extensions) can be read without a
permission by `applyTemplate`.

**`ui`** — always available, no permission:

| Call | Does |
|---|---|
| `ui.prompt(fields)` | Shows a form and returns the answers by field name, or `null` if dismissed. 1 to 20 fields `{ name, label?, type?, default?, choices? }`; `name`s are unique and non-empty; `type` is `text` (default), `multiline`, `choice` (needs non-empty `choices`) or `date` |
| `ui.pick(items)` | Shows a filterable list of 1 to 200 strings or `{ label, detail? }` objects and returns the chosen item exactly as passed, or `null` if dismissed |
| `ui.toast(message)` | Shows a short informational message (truncated to 200 characters) and returns at once |

Invalid arguments throw an error with code `invalid`.

## Permissions and approval

| Permission | Lets the script |
|---|---|
| `doc.read` | Read the document it runs on |
| `doc.write` | Change the document it runs on |

Without `doc.read`, every read fails with `out-of-scope`; without `doc.write`, every write fails
with `out-of-scope`. MarkNode shows permissions to the user in plain language. How an extension is
approved depends on where it came from:

- **Personal folder.** Files you place there are trusted and enabled without a prompt.
- **Import.** **Import…** shows the extension's name, id, version, author, permissions and
  contributions; **Install** is the approval. Importing a newer version of an installed personal
  extension shows an update, including any permissions it adds.
- **Team.** An extension from a team library is off until each member enables it; enabling is the
  approval. If a team extension (or any installed extension) changes to request a new permission,
  it is disabled until the user approves again.
- **Built-in.** Built-in extensions need no approval; they can be disabled but not uninstalled.

An extension id can be active from only one source: Built-in wins over Team, which wins over
Personal. The exact wording of permissions in the app may change between releases.

## Limits

Limits are fixed; an extension cannot change them. A run that exceeds one is stopped and the
document is unchanged.

| Limit | Value |
|---|---|
| Script time | 5 s (time waiting in `ui.prompt` or `ui.pick` is not counted) |
| Script memory | 64 MiB |
| Operation calls (`doc.*`) | 200 per run |
| Markdown inserted | 1 MiB in total per run |
| Package size | 256 KiB |
| `ui.prompt` fields | 20 |
| `ui.pick` items | 200 |

A run longer than 300 ms shows a "Running *command*…" status with **Cancel**.

## Undo and failure

A run is all or nothing. If it succeeds and changed the document, exactly one undo step is added,
however many `doc.*` calls it made. If it stops early for any reason (limit, error, crash,
cancel, a conflicting edit), the document is unchanged. If the user edited the part of the
document the run changes while it ran, the run fails with `conflict`; the failure notice offers
**Run Again** when the command was started on a node.

## Error codes

Errors thrown by a `doc.*` or `ui.*` call carry one of these `code`s (the `ErrorCode` type in
`types/marknode.d.ts`):

`invalid`, `not-found`, `ambiguous`, `conflict`, `stale`, `out-of-scope`, `unavailable`,
`too-large`, `internal`, `cancelled`.

A run that fails shows one of these codes (with the message, and for `script-error` the file,
line and column) under **Details**: the codes above, plus `limit-time`, `limit-memory`,
`limit-calls`, `limit-insert`, `crashed`, `protocol` and `script-error`.

## Packaging: `.mnext`

An extension travels as one JSON file with the extension `.mnext`:

```json
{ "format": 1, "manifest": { "…": "…" }, "files": { "scripts/summary.js": "…" } }
```

`manifest` is the package manifest and `files` maps each relative path to its UTF-8 text. A
one-file extension is packed into the same format (as a package with a single `scripts/main.js`).
**Export…** in the Extensions section writes `<id>-<version>.mnext`; importing it again gives the
same id.

## Installing

Open **Templates & Extensions…** and choose the **Extensions** section:

- **Import…** — pick a `.mnext` file or a one-file `.js` file. A dialog shows what it is and what
  it may do; **Install** adds it to your personal extensions.
- **Reveal Extensions Folder** — opens your personal extensions folder in the system file manager.
  Drop a one-file `.js`, or a package folder containing `manifest.json`, into it. A package folder
  must be named after its manifest `id`. MarkNode picks up additions, edits and removals while it
  is running, with no restart.

Other actions in the section: enable or disable, **Uninstall** (personal extensions), **Export…**.

## Using TypeScript

MarkNode runs JavaScript, so TypeScript is compiled before it ships. This folder is a working
setup:

- [`types/marknode.d.ts`](types/marknode.d.ts) types the API. `tsconfig.json` maps the bare
  specifier `marknode` to it (`paths`), so a script can write
  `import type { Context } from 'marknode'`. Type imports are erased, so the built `.js` has no
  import. In plain JavaScript use
  `/** @param {import('marknode').Context} context */`.
- **Outside this repository**, copy `types/marknode.d.ts` into your project and add the same
  `paths` entry (`"marknode": ["./types/marknode.d.ts"]`) to your `tsconfig.json`.
- `npm run typecheck` runs `tsc` over `examples/` and `builtin/` (JavaScript included: `allowJs`
  and `checkJs`).
- `npm run build` bundles each entry with [esbuild](https://esbuild.github.io/) into **one
  self-contained ES module**. Shared code you import from another file is inlined, which is how a
  command can use a helper even though scripts cannot import. In the output the default export may
  appear as `export { name as default }`; that is the same default export.

How the build finds entries (`build.mjs`):

- An example folder **without** `manifest.json` is a one-file extension. Each `src/<name>.ts` is
  built to `<name>.js` next to `src/`. The file must begin with the `/** @marknode … */` header;
  the build writes it first in the output, verbatim, so it stays the first block comment. The built
  file name is the extension id, so choose it deliberately.
- An example folder **with** `manifest.json` is a package. Each command's `script`
  (`scripts/<name>.js`) is built from `src/<name>.ts`. Any other file in `src/` is a shared module
  for the commands to import (such as `section.ts`).
- The built `.js` files are committed, and CI fails when a committed file differs from what the
  build produces.

## Repository layout

```
extensions/
  LICENSE                     MIT
  README.md                   this guide
  types/marknode.d.ts         the script API; generated with each release, do not edit
  builtin/                    built-in extensions that ship with MarkNode (README.md for now)
  examples/hello-world/       one-file extension: src/hello-world.ts builds to hello-world.js
  examples/section-tools/     package: manifest.json, src/*.ts built to scripts/*.js
  package.json, package-lock.json   pins typescript and esbuild
  tsconfig.json               strict TypeScript; checks the examples and built-ins
  build.mjs                   the esbuild build
```

`types/marknode.d.ts` is produced from MarkNode's own operation table when a release is prepared;
change a copy in your project if you must, but changes made here are overwritten.
