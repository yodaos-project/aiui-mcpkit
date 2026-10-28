# Restore scoped App state

English | [简体中文](state-restoration.zh-CN.md) · [Documentation index](../README.md)

A live App preserves its state when switching between inline and fullscreen. Destroying that View destroys its realm. To rebuild state in a new View, configure an explicit restoration adapter backed by a host-owned or application-owned store. Restoration is optional; MCPKit does not assume every MCP Apps host has a persistence API.

## Choose what survives

| State | Ownership and lifetime |
| --- | --- |
| In-flight requests, signals, timers, render objects, display mode | Transient; recreate these and never save them. Restoring state does not replay business operations. |
| Model-visible state | Publish deliberately through Action results or explicit context APIs. Saving a snapshot does not publish it to the model. |
| Selection, draft, validated result cache, navigation | Application-selected JSON projection; validate before saving and restoring. Save route/data, not a serialized runtime or navigation stack. |

The [Business App](../../examples/business/app.js) checkpoints the catalog, private note and current page using the [catalog contract](../../examples/business/state-contract.js). Its `catalog_state` Action excludes the private note. Fresh tool results are delivered after restoration; a new search can update results while the restored selection, note and detail page remain. Reconstruction restores a minimal route; the catalog explicitly returns to search when the restored detail page has no previous stack entry. Result caches are presentation data: revalidate prices, permissions and availability before a business operation.

## Bind the store in trusted code

Every store capability is bound to four nonempty identifiers: `userId`, `conversationId`, `applicationId` and `instanceId`. `applicationId` must equal the plugin's build `name`. The trusted host/backend supplies identity and decides whether a reconstructed View is the same logical instance. A newly opened card normally receives another instance ID. Reusing a resource URI does not grant access to another instance.

Scope strings are namespacing, not authentication. Authenticate and authorize in the host/backend, and give each View only its bound `ScopedSnapshotStore`. Never expose the factory that can bind arbitrary scopes to the App. Never derive authority from tool arguments, Page messages, query strings, browser storage or a model-supplied user ID. A persistent backend must enforce the binding on every read, write and removal.

`createMemorySnapshotStore()` from `@yodaos-pkg/aiui-mcpkit/state` is a reference host-side store. Its factory stays in trusted host code; `factory.bind(trustedScope)` returns an immutable capability. It survives View teardown only while that factory remains alive. It does not survive host process/page restart. Implement `ScopedSnapshotStore` with an authenticated durable service when restart recovery is required.

## Configure the browser adapter

```js
await buildPlugin({
  source: 'examples/business', name: 'business-demo',
  worker: { name: 'business' },
  applications: { catalog: { page: 'pages/catalog/index' } },
  restoration: { adapter: './host/restoration.ts' },
});
```

The adapter is a browser module, resolved from the build caller's working directory, bundled into `view.html`. It must export `createRestoration(context)` and live outside the output directory. Its code and bundled constants are public; keep credentials in the trusted service. Networked adapters also need matching `uiCsp.connectDomains` and host permission.

The following is the integration shape; `openBoundStore` is an application-provided authenticated host bridge, **not** an MCPKit API:

```ts
import type { RestorationAdapter } from '@yodaos-pkg/aiui-mcpkit/state';
import { catalogStateContract } from '../examples/business/state-contract.js';
import { openBoundStore } from './authenticated-host-bridge.js';

export const createRestoration: RestorationAdapter = async context => {
  // The bridge authenticates the caller and assigns user/chat/instance authority.
  // applicationId is an expected identity to check, not proof of permission.
  const store = await openBoundStore(context.applicationId, context.signal);
  if (!store) return undefined; // Unsupported host: ordinary transient UI.
  return { ...catalogStateContract, store };
};
```

A complete cross-origin test integration is in [port-adapter.js](../../tests/fixtures/state/port-adapter.js) and its [trusted host](../../tests/state-browser.test.mjs). It verifies sender origin/source, binds by the owning iframe rather than request claims, and transfers a MessagePort capability. This fixture has simulated identities and an in-memory backend; replace its identity assignment with real host authentication before deployment. The standard example build deliberately omits this adapter.

## Public snapshot contract

Import the browser-safe API from `@yodaos-pkg/aiui-mcpkit/state`. The root package also exports these types and helpers for Node callers.

| Contract | Fields or methods |
| --- | --- |
| `RestorationContext` | `applicationId`, `initialPage`, lifetime `signal` |
| `RestorationBinding` | `store`, positive integer `dataVersion`, `validate(data, page)`, optional `migrate(payload, from, to)` |
| `SnapshotPayload` | `{ page, data }`; page must be registered in `app.json`, data must be a JSON object |
| `AgentSnapshot` | `{ formatVersion: 1, dataVersion, scope, payload }` |
| `SnapshotRecord` | `{ revision: string, snapshot }` |
| `ScopedSnapshotStore` | Readonly `scope`; `read({signal})`, `write(snapshot, {expectedRevision, signal})`, `remove({expectedRevision, signal})` |
| `createSnapshotSession(binding, options)` | One session per View: `restore()`, `save(payload)`, `close()`; options include expected `applicationId`, allowed `pages` and optional `timeoutMs` (default 5000) |

A missing record has revision `null` for writes/removals. Stores must implement atomic compare-and-swap: accept only the expected revision and return a new nonempty revision for each committed write. Avoid revision reuse after deletion. Concurrent stale Views fail rather than overwrite a newer View. Reads and writes detach JSON copies. A session serializes saves, freezes its scope, and disables further writes after storage failure or conflict. Invalid application data is rejected before writing.

The payload/envelope is limited to 256 KiB of UTF-8 JSON and nesting depth 64. Only plain JSON values are accepted: no functions, signals, cyclic references, holes, accessors, symbols, non-finite numbers or prototype-manipulation keys. Keep the application validator strict about fields, bounds and page/data consistency. The memory store limits the complete stored record, including revision, to the same size; leave headroom for that metadata.

## Restore, then receive new results

The View initializes the adapter and reads the snapshot before starting Ink. Adapter initialization and each storage/migration operation have a five-second deadline. Stores must honor abort signals before committing; MCPKit cannot undo a remote write by a backend that ignores cancellation.

Pages forward restoration messages to their owning App. The handshake is:

1. On show, the Page posts `{ type: 'mcpkit:state-connect' }` after attaching to its App.
2. The View sends `{ type: 'mcpkit:restore-state', restoreId, supported, snapshot? }`. `snapshot` is a validated `{page, data}`, without identity or store credentials.
3. The App applies the projection and posts `{ type: 'mcpkit:state-ready', restoreId }`.
4. On mutations, it posts `{ type: 'mcpkit:state-save', restoreId, page, data }`.
5. The View replies with `{ type: 'mcpkit:state-status', restoreId, status, code? }`, without snapshot contents.

The random `restoreId` binds messages to the current launch. Old IDs are ignored. Only an acknowledged launch can save; if the App does not acknowledge within five seconds, normal tool results resume and writes remain disabled. A Page cannot change its store scope by adding identity fields to messages. State messages are consumed before the debug logger and do not enter model context. An App can still disclose its own data through its Actions; choose public projections deliberately.

Checkpoint each meaningful change. While writes are pending the status is `saving`; `saved` is emitted only when the latest submitted checkpoint has completed. It does not acknowledge later changes. MCP teardown drains queued saves before destroying the View. `pagehide`, abrupt process exit and hard crashes cannot guarantee completion of the last unacknowledged edit. A durable backend is required for recovery beyond the host's lifetime.

## Versions, failure and unavailable hosts

Snapshots use envelope format 1 and a separately versioned application projection. A different user/chat/app/instance is rejected. Older data requires an explicit `migrate(payload, from, to)`; MCPKit validates its result and commits it using the loaded revision before use. Future data versions, unknown envelope formats, corrupt payloads and failed migrations are rejected without overwriting the old record. An authorized user can deliberately reset a record through its bound store's `remove`, with its current revision; there is no silent destructive fallback.

No adapter, or an adapter returning `undefined`, leaves ordinary transient UI available. Read/initialization failures reject restoration and continue normal UI without saving over existing records. Write failures report an error and stop further session writes. Diagnostics expose codes, not backend messages or private payloads.

The View's `body[data-restoration]` reports `unavailable`, `empty`, `restored`, `ready`, `saving`, `saved`, `rejected` or `error`. Failures add `data-restoration-error` with codes such as `SCOPE_MISMATCH`, `VERSION_UNSUPPORTED`, `INVALID_DATA`, `CONFLICT`, `TIMEOUT` or `RESTORE_NOT_HANDLED`. Intermediate states can be brief; use acknowledged writes for durability checks.

Counter is intentionally transient and no longer uses app-wide `wx` storage to recover an unscoped count. Existing counts in that old cache are not imported. The shared catalog demonstrates the explicit restoration protocol.

## Verification boundary

The [validation record](../validation/state-restoration.md) covers real Ink/WASM reconstruction, draft input, selection/navigation recovery, display modes, isolation, migration, conflicts and unavailable storage. It uses an application-owned test host, not Codex Desktop persistence. MCPKit does not provide a universal Codex/Claude snapshot store; production restoration requires a host or authenticated application integration and separate acceptance in that target environment.
