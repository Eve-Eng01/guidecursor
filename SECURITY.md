# Security policy

## Supported versions

| Version | Supported |
|---|---|
| 0.2.x | ✅ |
| < 0.2 | ❌ |

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Report it privately through GitHub: go to the [Security tab](https://github.com/Eve-Eng01/guidecursor/security) and choose **Report a vulnerability** (or open [this form](https://github.com/Eve-Eng01/guidecursor/security/advisories/new) directly). Include the version, a minimal tour definition or page that reproduces it, and what an attacker could do.

You'll get an acknowledgement within 3 working days. Once a fix is ready we'll publish a patched release and a GitHub security advisory crediting you, unless you'd rather stay anonymous.

## Scope notes

Guide Cursor runs in your users' browsers alongside your app.

- Step titles and string content are always rendered as **text**, never as HTML. If you pass a DOM `Node` as content, you are responsible for what's in it.
- Styles are injected as a `<style>` tag. For a strict Content Security Policy, pass `styleNonce`, or set `injectStyles: false` and import `@guidecursor/core/styles.css`.
- The default storage adapter writes tour progress (statuses and step numbers only) to `localStorage`. Don't put personal data in tour ids.
