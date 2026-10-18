// Builds every example into the single self-contained .js file MarkNode runs.
//
// Entry rule (see README.md, "Using TypeScript"):
//   - An example folder with a manifest.json is a package. Each command in
//     contributes.commands names a script `scripts/<name>.js`; its entry is `src/<name>.ts`.
//     Every other file in src/ is a shared module that entries import.
//   - An example folder without a manifest.json is a one-file extension. Each `src/<name>.ts`
//     is an entry, built to `<name>.js` beside src/; the `<name>.js` file name becomes the
//     extension id (`personal.<name>`), so the name matters.
import { build } from 'esbuild';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionsDir = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(extensionsDir, 'examples');
const builtinDir = join(extensionsDir, 'builtin');
const disabledLinkifierPath = join(extensionsDir, 'builtin', 'markdown-it-no-linkifier.js');
const markdownItLicensePaths = [
  'markdown-it/LICENSE',
  'entities/LICENSE',
  'mdurl/LICENSE',
  'uc.micro/LICENSE.txt',
  'punycode.js/LICENSE-MIT.txt',
];

function markdownItNotice() {
  return `/* Bundled dependencies:\n${markdownItLicensePaths.map((path) => `\n--- ${path} ---\n${readFileSync(join(extensionsDir, 'node_modules', path), 'utf8').trim()}`).join('\n')}\n*/`;
}

/** The leading `/** @marknode ... *\/` block of a one-file extension's source. */
function readMarknodeHeader(entryPath) {
  const source = readFileSync(entryPath, 'utf8');
  const header = source.match(/^\s*(\/\*\*\s*@marknode[\s\S]*?\*\/)/);
  if (header === null) {
    throw new Error(`${relative(extensionsDir, entryPath)}: the file must start with a /** @marknode ... */ header comment`);
  }
  return header[1];
}

function listBuildJobs() {
  const jobs = [];
  for (const example of readdirSync(examplesDir, { withFileTypes: true })) {
    if (!example.isDirectory()) continue;
    const exampleDir = join(examplesDir, example.name);
    const manifestPath = join(exampleDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      for (const command of manifest.contributes?.commands ?? []) {
        const scriptName = command.script.replace(/^scripts\/(.+)\.js$/, '$1');
        jobs.push({
          entryPath: join(exampleDir, 'src', `${scriptName}.ts`),
          outputPath: join(exampleDir, command.script),
          banner: undefined,
        });
      }
    } else {
      for (const file of readdirSync(join(exampleDir, 'src')).filter((name) => name.endsWith('.ts'))) {
        const entryPath = join(exampleDir, 'src', file);
        jobs.push({
          entryPath,
          outputPath: join(exampleDir, file.replace(/\.ts$/, '.js')),
          banner: readMarknodeHeader(entryPath),
        });
      }
    }
  }
  for (const builtin of readdirSync(builtinDir, { withFileTypes: true })) {
    if (!builtin.isDirectory()) continue;
    const packageDir = join(builtinDir, builtin.name);
    const manifestPath = join(packageDir, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    for (const command of manifest.contributes?.commands ?? []) {
      const scriptName = command.script.replace(/^scripts\/(.+)\.js$/, '$1');
      const entryPath = join(packageDir, 'src', `${scriptName}.ts`);
      if (!existsSync(entryPath)) continue;
      jobs.push({
        entryPath,
        outputPath: join(packageDir, command.script),
        banner: undefined,
        minify: true,
        usesMarkdownIt: ['documentnode.list-to-headings', 'documentnode.renumber-headings', 'documentnode.sort-section'].includes(builtin.name),
      });
    }
  }
  return jobs;
}

for (const { entryPath, outputPath, banner, minify = false, usesMarkdownIt = false } of listBuildJobs()) {
  await build({
    entryPoints: [entryPath],
    outfile: outputPath,
    // Source-path comments in the output are relative to this directory, not process.cwd().
    absWorkingDir: extensionsDir,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    plugins: usesMarkdownIt ? [{
      name: 'disable-markdown-it-linkifier',
      setup(build) {
        build.onResolve({ filter: /^linkify-it$/u }, () => ({ path: disabledLinkifierPath }));
      },
    }] : [],
    target: 'es2022',
    minify,
    // The header is a manifest, not a licence comment; it is written first, verbatim.
    banner: { js: [banner, usesMarkdownIt ? markdownItNotice() : undefined].filter(Boolean).join('\n') },
    logLevel: 'warning',
  });
  console.log(`built ${relative(extensionsDir, outputPath)}`);
}
