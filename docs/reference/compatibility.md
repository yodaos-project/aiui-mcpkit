# Protocol compatibility

English | [简体中文](compatibility.zh-CN.md) · [Documentation index](../README.md)

The target released MCP revision is **2026-07-28**. Runtime dependencies are pinned to `@modelcontextprotocol/server`, `client`, and `core` **2.2.0**, and `@modelcontextprotocol/ext-apps` **2.0.3**. The UI contract is the released [MCP Apps 2026-01-26 specification](https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx); a **View** is the Apps iframe containing the AIUI runtime. Draft contracts are not advertised.

| Capability | Support and verification |
| --- | --- |
| Current MCP over stdio | `serveStdio` serves `2026-07-28`: `server/discover`, per-request protocol/capability metadata, tool discovery/calls, and resource listing/reads. Tests pin this revision so fallback cannot hide failures. |
| Legacy MCP over stdio | The same server accepts `initialize` and `notifications/initialized`. Tests cover `2024-11-05`, `2025-03-26`, `2025-06-18`, and `2025-11-25`; original SDK **1.31.0** clients also run the existing regressions. |
| Apps/View negotiation | A client must advertise `extensions["io.modelcontextprotocol/ui"].mimeTypes` containing `text/html;profile=mcp-app`. Legacy capabilities come from initialization; current capabilities are read on each request. |
| Tool metadata and results | Apps clients receive `_meta.ui.resourceUri`, the compatibility alias `_meta["ui/resourceUri"]`, and existing OpenAI entrypoints. Original input/output JSON Schemas, model-visible content/structured data, and UI-only metadata are preserved; the official SDK handles each era's wire encoding. |
| Clients without Apps | Tool discovery omits UI entrypoint metadata. Page openers return arguments and an explicit text-only explanation; business handlers still run and return their data with a UI-unavailable notice. `_meta.mcpkit.ui` reports `available` or `unavailable` on discovery and executed results. Explicit UI resource reads remain available. |
| View/host channel | The existing Apps `ui/initialize` handshake, tool input/result/cancellation notifications, and host-context changes remain in use. Views advertise inline/fullscreen; real Ink WASM browser tests cover host mode restrictions, business rendering, calls and cancellation. |
| Progress and cancellation | Protocol tests cover progress notifications and client cancellation in both eras; existing regressions verify handler abort, timeouts and late-result isolation. |

Run `npm run build:examples`, `npm run typecheck`, and `npm test` for the compatibility suite (including `tests/protocol.test.mjs`). CI runs these on every pull request. This is acceptance coverage for the capabilities above, not certification of the entire MCP specification. HTTP transport, authorization, multi-round-trip input, subscriptions and cache policies are not exposed by MCPKit. Resource/tool lists are static. Desktop-host fullscreen and tool-access behavior still require testing in that host.

---

[Documentation index](../README.md) · Previous: [Page messages](messages.md) · Next: [Benchmarks](benchmarks.md)
