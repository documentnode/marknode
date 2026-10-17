# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email **[support@documentnode.io](mailto:support@documentnode.io)** with `SECURITY` in the subject
line. Include as much of the following as you can:

- What the issue is and why you believe it is a security problem
- The MarkNode version and your operating system
- Steps to reproduce, or a proof of concept (for an extension, the extension file)
- What an attacker could achieve with it

You will get an acknowledgement that a human has read your report. We will keep you informed as we
investigate, and we will tell you when a fix ships. If you would like credit in the release notes,
say so and tell us how you would like to be named.

Please give us a reasonable opportunity to fix the issue before disclosing it publicly.

## Supported versions

Only the latest released version of MarkNode receives security fixes. Update from within the app,
or download the current version from [marknode.com](https://marknode.com).

## Scope

In scope: the MarkNode desktop application, including the extension sandbox that runs extension
scripts. A way for an extension script to read or write files, reach the network, start a process,
or affect anything beyond the document operations it was granted is a vulnerability.

Out of scope: the example code in `extensions/examples/`. It is illustrative, is not shipped with
MarkNode, and is not hardened for use beyond demonstrating the extension API. Report bugs in it as
an issue, not as a security report.
