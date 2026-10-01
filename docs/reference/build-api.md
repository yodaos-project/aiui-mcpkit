# Build reference

English | [简体中文](build-api.zh-CN.md) · [Documentation index](../README.md)

`buildPlugin(options): Promise<BuildPluginResult>` is exported by `@yodaos-pkg/aiui-mcpkit`. This reference complements the [ESM walkthrough](../guides/esm-build.md). For authoritative implementation types, see [`src/index.ts`](../../src/index.ts).

## Path and naming rules

All relative paths resolve from the caller's current working directory, not the build-script location. `source` must contain `app.json`. The output may be inside source (for example `source/dist/plugin`), but it cannot equal source or contain source. Page routes are relative, omit `.ink`, and cannot contain traversal segments. Input schemas are validated before output is written. The builder bundles handlers without executing them.

## Generated files

```text
plugin/
├── plugin.json                       # Plugin name and display metadata
├── mcp.json                          # Plugin-host stdio configuration
├── view.html                         # Agent interface and embedded runtime
├── tools.d.ts                        # Generated tool and handler types
├── dist/server.mjs                   # Bundled MCP server
└── .agents/plugins/marketplace.json  # Local Codex installation catalog
```

The server exposes an opener tool and a `ui://` HTML resource with MIME type `text/html;profile=mcp-app`. The host loads the resource into its app view and forwards display-mode changes to the agent. In the generated `mcp.json`, `${PLUGIN_ROOT}` is resolved by the plugin host; manual client configurations need real paths.

## API and helper options

| ESM option | Local helper argument | Default |
| --- | --- | --- |
| `source` | `[source]` | API: required; helper: current directory |
| `name` | `--name` | Required |
| `outputDir` | `--out` | `dist/<name>` |
| `title` | `--title` | `app.json` name, then plugin name |
| `description` | `--description` | Generated from the display name |
| `tool` | `--tool` | `open_app` fallback when no page declares a schema |
| `page` | `--page` | First page in `app.json`, without `.ink` |
| `version` | `--version` | `0.1.0` |
| `requestPolicy` | ESM only | [Lifecycle defaults](../guides/tool-lifecycle.md) |
| `retrySafeTools` | ESM only | `[]` |
| `handlers` | ESM only | `<source>/mcp-server/handlers.ts` for business tools |
| `typesFile` | ESM only | `<outputDir>/tools.d.ts` |
| `toolMetadata` | ESM only | `{}` |
| `resourceMetadata` | ESM only | `{}` |
| `uiResources` | ESM only | `[]` |

Plugin names start with a lowercase letter and contain lowercase letters, numbers, or hyphens. Tool names contain 1–128 letters, numbers, underscores, or hyphens. Use `node scripts/build-plugin.mjs --help` for helper usage. If you omit `[source]`, the current project root is used; output is excluded from UI assets.

## Current scope

The UI host must allow WebAssembly compilation. The embedded HTML is roughly 10 MB, so resource size limits also matter. Source files are read as UTF-8; packaging binary assets is not supported yet.

Automated tests cover packaging, MCP tool/resource responses, and the browser runtime. They do not establish full compatibility with every desktop host, account-connected tool access, or resource-cache behavior.

## Metadata option types

| Option | Shape | Purpose |
| --- | --- | --- |
| `toolMetadata` | `Record<string, PublicMetadata>` | Author `_meta` overrides keyed by discovered tool names. Unknown names are rejected. |
| `resourceMetadata` | `PublicMetadata` | Default author `_meta` for every generated/custom UI resource. |
| `uiResources` | `UiResource[]` | Additional HTML resources; each has `uri`, `name`, `html`, optional `description` and `_meta`. |

`PublicMetadata` accepts plain JSON values. Merge rules, reserved fields, URI validation and client-dependent inspection are in [public metadata](../guides/metadata.md). These options are not supported by the repository helper's command-line flags.

## BuildPluginResult

| Member | Meaning |
| --- | --- |
| `name`, `title`, `version` | Final plugin identity/display values. |
| `tool` | First registered tool name; not necessarily `open_app`. |
| `page` | Selected initial page route. Individual page tools retain their own routes. |
| `tools` | Tool-to-page mappings: `name`, `title`, `description`, `page`, `inputSchema`, final `resourceUri`, and optional business `outputSchema`. |
| `outputDir` | Absolute generated plugin directory. |
| `marketplaceName` | Standalone catalog name `${name}-local`; bundled examples use their separate shared catalog. |
| `requestPolicy` | Fully resolved lifecycle defaults/options. |
| `inspectProtocol(capabilities?)` | Fresh JSON snapshots of final tool/resource list items and the connection descriptor. Defaults to no Apps capabilities. |
| `files.view` | Absolute path to `view.html`. |
| `files.server` | Absolute path to `dist/server.mjs`. |
| `files.plugin`, `files.mcp` | Absolute manifest and client configuration paths. |
| `files.marketplace` | Absolute `.agents/plugins/marketplace.json` path. |
| `files.types` | Absolute generated declarations path, including custom `typesFile`. |

A successful promise means the build completed. It does not mean the server has been registered, the host has discovered tools, or the View has been rendered. Errors reject the promise; the API does not log, exit the process or change its working directory. Inspecting or mutating returned snapshots does not mutate the generated server.

## Public runtime exports

| Export | Use | Guide |
| --- | --- | --- |
| `DEFAULT_REQUEST_POLICY`, `RequestPolicy`, `RequestState`, `RequestSnapshot`, `RequestContext`, `RequestOptions`, `RequestHandle` | Lifecycle defaults and context/handle types. | [Lifecycle](../guides/tool-lifecycle.md) |
| `BusinessToolDefinition`, `BusinessToolResult`, `BusinessToolHandler`, `businessToolExecutor`, `businessToolFailure` | Business contract types and validation/error adapters used by the generated server. Page authors normally use generated `BusinessHandlers`. | [Business tools](../guides/business-tools.md) |
| `AgentToolRequest`, `ToolBridgeOptions` | Page-call and bridge configuration types. | [Lifecycle](../guides/tool-lifecycle.md) |
| `BusinessToolError` | Expected business failure with an explicit public code/message and optional UI-only details. Root package or `/tools`. | [Business tools](../guides/business-tools.md) |
| `RequestLifecycle`, `RequestLifecycleError`, `resolveRequestPolicy` | Wrap async work in timeout, cancellation and retry policies. | [Lifecycle](../guides/tool-lifecycle.md) |
| `AgentToolBridge` | Bridge correlated page requests to host tool calls using the same lifecycle. | [Lifecycle](../guides/tool-lifecycle.md) |
| `BuildPluginOptions`, `BuildPluginResult`, `PageTool` | Build inputs/results and discovered mappings. | This reference |
| `JsonValue`, `PublicMetadata`, `UiResource`, `MetadataOptions`, `ProtocolInspection` | Typed metadata, resource and inspection configuration. | [Metadata](../guides/metadata.md) |

For the complete handler/context and lifecycle interfaces, see [`business-tools.ts`](../../src/runtime/business-tools.ts), [`lifecycle.ts`](../../src/runtime/lifecycle.ts) and [`tool-bridge.ts`](../../src/runtime/tool-bridge.ts). The package emits corresponding `.d.ts` files when built.

## Packaging boundaries

`mcp-server/`, `dist/`, `.mcpkit/`, `.git/`, `node_modules/`, `.env`/`.env.*`, the actual output directory and transitive handler imports are excluded from UI assets. Other UTF-8 source assets are public. Server code remains in the server bundle; this is not a credential scanner for arbitrary public strings.

Generated plugin files are self-contained for execution with Node 22+. `view.html` includes compressed WASM; the client must permit compilation and support its resource size. Do not hand-edit generated server/HTML files to implement features; configure the build or edit source.

---

[Documentation index](../README.md) · Previous: [Troubleshooting](../guides/troubleshooting.md) · Next: [Page messages](messages.md)
