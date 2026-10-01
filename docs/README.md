# Documentation and tutorials

English | [简体中文](README.zh-CN.md) · [Documentation index](README.md)

This is the complete AIUI MCPKit documentation. Read the getting-started guides in order for your first project, or jump to a topic/reference for a specific task. Tutorials follow the implemented APIs and state where to run commands.

## Start here

1. [Understand MCPKit](getting-started/overview.md) — Concepts, architecture and boundaries.
2. [Prepare your environment](getting-started/installation.md) — Prerequisites, source and output directories.
3. [Run the examples](getting-started/quickstart.md) — Install Counter and the business demo; verify results.
4. [Create your first Agent](getting-started/first-agent.md) — Complete files, build/install, add a button.

## Guides

| Document | Contents |
| --- | --- |
| [Page tools](guides/page-tools.md) | Input schemas, routes and launch arguments |
| [Typed business tools](guides/business-tools.md) | Handlers, generated types, results and errors |
| [Request lifecycle](guides/tool-lifecycle.md) | Loading, progress, cancellation, timeouts and retries |
| [Public metadata](guides/metadata.md) | Merge rules, custom resources and exact inspection |
| [ESM build integration](guides/esm-build.md) | Use MCPKit in your own Node project |
| [Client setup](guides/clients.md) | Codex, Claude Desktop, VS Code and stdio |
| [Development workflow](guides/development.md) | Rebuild, update installed copies and reload Views |
| [Troubleshooting](guides/troubleshooting.md) | Diagnose build, discovery, calls and rendering |

## Reference

| Document | Contents |
| --- | --- |
| [Build API](reference/build-api.md) | All options, outputs and public exports |
| [Page messages](reference/messages.md) | Inputs, result envelopes and lifecycle events |
| [Protocol compatibility](reference/compatibility.md) | Versions, negotiation, verification and scope |
| [Benchmarks](reference/benchmarks.md) | Scenarios, metrics, reports and A/B comparisons |

## Contributing

| Document | Contents |
| --- | --- |
| [Contributing](contributing.md) | Repository checks and contribution expectations |

## Find a path by goal

To see a UI: quickstart → client setup. To build your app: first Agent → page tools → business tools → lifecycle. To integrate a build system: ESM integration → build API → metadata. To measure or change the runtime: contributing → compatibility → benchmarks.

## Conventions and sources

Replace `/path/to/...` and `/absolute/path/...` placeholders. Tool-call examples are not shell commands. `view.html` needs an Apps host. Every article has a matching Chinese page and a language-switch link.

The organization borrows the getting-started, topic-guide, debugging and API-reference structure from [mcp-use documentation](https://docs.mcp-use.com/llms.txt). Content follows MCPKit source; mcp-use commands and server capabilities do not transfer to this project. Compatibility documentation distinguishes protocol support, browser verification and observed desktop behavior.

[Back to the project README](../README.md)

---

[Documentation index](README.md)
