# Configure and inspect public metadata

English | [简体中文](metadata.zh-CN.md) · [Documentation index](../README.md)

**Prerequisites:** an Agent you can already build and the [ESM API](esm-build.md). These advanced options customize discovery metadata; you do not need them for the first tutorial. Use [the build reference](../reference/build-api.md) for option/result types.

## Network and resource CSP

Use `uiCsp: { connectDomains: [...], resourceDomains: [...] }` for typed build defaults. Connection domains map to fetch/XHR/WebSocket permissions; resource domains map to images, fonts, scripts, styles and media. The existing `resourceMetadata.ui.csp` option remains available. If both options declare a list, their sets must agree; conflicting declarations fail before writing output. Custom resource `_meta.ui.csp` lists intentionally replace those defaults.

Domain lists accept canonical HTTP(S) origins, optional wildcard subdomains such as `https://*.example.com`, and explicit ports. Connection lists also accept WS(S) origins. No global `*`, scheme-wide origins, paths, credentials, queries, fragments, CSP keywords or injected directives are accepted. Resource lists may declare local `blob:`/`data:` schemes. Validation also applies to CSP in default/custom metadata, including frame/base-URI origin lists. Empty lists require no external domains.

Generated Views with `app.json` fonts add `blob:` to their final resource domain lists for Ink's local font object URLs. Inspect final metadata with `inspectProtocol()` or `resources/read`. Hosts enforce the declarations and may impose stricter constraints; CORS and loader support still apply. See [binary assets and CSP](../reference/build-api.md#binary-assets-and-csp) for size reports and local references. The distinction between connection and resource domains follows the [MCP Apps CSP guide](https://github.com/modelcontextprotocol/ext-apps/blob/main/docs/csp-cors.md).

## A small first change

Start with `resourceMetadata: { ui: { prefersBorder: false } }`, rebuild, and inspect with Apps capabilities. Look for that value in each resource's `_meta.ui`. Hosts decide whether to honor a presentation preference. Then add a public vendor namespace or a custom resource using the complete example below.

Use `toolMetadata` (keyed by discovered tool name), `resourceMetadata` (defaults for every resource), and `uiResources` to customize protocol metadata without editing runtime templates. These options are part of the ESM `buildPlugin()` API:

```js
const result = await buildPlugin({
  source: './my-agent', name: 'my-agent',
  toolMetadata: {
    open_app: {
      ui: { resourceUri: 'ui://my-agent/custom.html' },
      'openai/ui': { entrypoints: [{ type: 'thread' }] },
      'example/display': { theme: 'green' },
    },
  },
  resourceMetadata: { ui: { prefersBorder: false } },
  uiResources: [{
    uri: 'ui://my-agent/custom.html', name: 'Custom dashboard',
    html: '<!doctype html><html><body>My custom View</body></html>',
    _meta: { ui: { csp: { connectDomains: ['https://api.example.com'] } } },
  }],
});
const clientCapabilities = {
  extensions: { 'io.modelcontextprotocol/ui': { mimeTypes: ['text/html;profile=mcp-app'] } },
};
console.log(JSON.stringify(result.inspectProtocol(clientCapabilities), null, 2));
```

For page-defined tools, use the names declared in `<script def>` instead of `open_app`. The example HTML is a static placeholder; custom interactive Views implement the MCP Apps host channel themselves. Generated AIUI Views remain registered at their original URIs. `result.tools` reflects the final tool-to-resource references.

| Rule | Behavior |
| --- | --- |
| Object merge | Defaults merge recursively with author objects. For resources, order is framework defaults → `resourceMetadata` → the custom resource's `_meta`. |
| Replacement | Author scalars, arrays and `null` replace defaults; arrays are never concatenated. Known Apps fields must have valid types and placement (CSP/permissions belong on resources; resource references/visibility belong on tools), so `ui: null` is rejected. Host extension objects are opaque public JSON. |
| Framework/protocol ownership | Author `_meta` cannot set `requestPolicy`, `mcpkit`, `aiui`, `request`, `uiOnly`, `businessError`, or `io.modelcontextprotocol/*`. An attempted override is rejected, not silently discarded. |
| Resource linkage | `ui.resourceUri` or the legacy `ui/resourceUri` can select any registered generated/custom resource. Both normalize to the same URI; conflicting references, unregistered URIs, noncanonical URIs, URI credentials/query/fragment, and duplicate resource URIs are rejected. Custom resources require a nonempty name and HTML and use `text/html;profile=mcp-app`. |
| Client capabilities | `inspectProtocol()` defaults to a client without Apps. UI-capable clients receive UI metadata and host entrypoints; other clients omit `ui`, `ui/resourceUri`, and `openai/ui`, while retaining other public extensions and the normal text fallback. |
| JSON acceptance | Only finite, acyclic plain JSON survives. Functions, undefined, BigInt, nonfinite numbers, sparse arrays, accessors, symbols, custom prototypes, `toJSON`, and prototype-pollution keys are rejected before output is written. Diagnostics identify fields without echoing rejected values. |

`inspectProtocol(capabilities)` returns fresh JSON snapshots of the exact `tools/list` items, `resources/list` items (including final `_meta`), and the `mcp.json` connection descriptor. Resource reads use the same metadata. Inspection and live discovery share one serializer, verified against real clients in both protocol eras. JSON-RPC envelopes and SDK-added response-level metadata are outside these item snapshots; Apps capabilities must match the client being debugged. Modifying an inspection snapshot or `result.tools` does not alter the generated server.

Metadata, HTML and schemas are public author-provided content. Keep credentials in server handlers/environment variables. Inspection does not load handler code, `.env`, process environment, resource HTML, or private source paths. Common credential/configuration field names (`password`, `secret`, `token`, `apiKey`, `authorization`, `credentials`, `env`, `headers`, and access/refresh/client-secret variants) are rejected recursively in metadata. This guard does not detect credentials hidden in arbitrary strings: only provide public values. Invalid metadata fails before output creation or replacement, preserving an existing build.

---

[Documentation index](../README.md) · Previous: [Request lifecycle](tool-lifecycle.md) · Next: [ESM build integration](esm-build.md)
