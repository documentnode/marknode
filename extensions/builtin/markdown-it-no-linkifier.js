// MarkNode's built-ins construct markdown-it in `commonmark` mode, where linkification is disabled.
// Keeping this tiny compatible no-match implementation avoids loading linkify-it's large Unicode data.
export default class DisabledLinkifier {
  test() { return false; }
  match() { return null; }
  tlds() { return this; }
  normalize() { return this; }
}
