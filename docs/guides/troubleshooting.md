# Troubleshooting

English | [简体中文](troubleshooting.zh-CN.md) · [Documentation index](../README.md)

Work through failures in this order: **build → server startup → tool discovery → tool call → UI rendering → page-initiated call**. A successful earlier step does not prove the later step works. Use the current client's actual tool list and logs rather than assuming a README command made a tool available.

## Common symptoms

| Symptom | Check and fix |
| --- | --- |
| `node` / `npm` not found, or Node is older than 22 | Install Node 22+, reopen the terminal and run `node --version`. For desktop startup use the absolute Node executable path if its PATH differs. |
| `codex plugin` is unavailable | Confirm `codex plugin --help`. Use a compatible CLI or the direct stdio registration route in [client setup](clients.md). |
| Generated `dist/server.mjs` does not exist | Run `npm run build:examples` from the repository root, or rerun your Agent's build. Point the client at generated output, not source. |
| Build says initial/page file not found | `source` must directly contain `app.json`. Check each `pages` route, omit `.ink` in the manifest and ensure the matching file exists. |
| Invalid name/schema/metadata | Read the diagnostic field path. Use the naming rules in [build API](../reference/build-api.md), resolve local schema refs and correct [metadata](metadata.md) field types/placement. |
| Output directory error | Output cannot equal or contain source. Use `source/dist/plugin` or a sibling output directory; never choose a parent of source. |
| Missing handlers or generated types | Provide a handler for every `schema.output` tool. Build before typechecking and ensure `typesFile` matches the type import. See [business tools](business-tools.md). |
| `node .../server.mjs` stays silent | Expected for stdio: it is waiting for MCP protocol input. Use a client; there is no HTTP URL. Stop a manual process with Ctrl+C. |
| Server startup fails inside the client | Check Node path/version, absolute server path and client logs. Do not replace `${PLUGIN_ROOT}` with a literal string in manual configurations: use real absolute paths. |
| Plugin installs but no tools appear | Reload host/server and check the active session's MCP/tool configuration. Confirm the correct catalog/plugin identifiers; bundled Counter uses `ink-counter@aiui-mcpkit-examples`. |
| `open_app` disappeared | Adding `schema.data` creates page tools and replaces fallback discovery. Use the declared name or generated route name. |
| Missing/incorrect argument rejected | Inspect the actual input schema. `open_countdown` needs positive integer `start`; numeric strings are not integers. |
| Tool data arrives but no UI | The client may lack Apps capability/MIME support. Check [compatibility](../reference/compatibility.md), WASM permissions and resource size limits. |
| Opening `view.html` gives no working page | Use an Apps host. Standalone HTML lacks host initialization and tool notifications. |
| Rebuild appears to have no effect | Update the installed copy, reload the server and open a new card. Follow [development](development.md). |
| `update:examples` finds no installed plugins | Install the bundled examples first. For direct servers, use `build:examples`. For your own Agent, use its build/update flow. |
| CALCULATE does nothing or tool unavailable | Check host `serverTools`, tool permissions, request name and unique ID. Handle `error` as well as `ready`; see [messages](../reference/messages.md). |
| UI stays loading after failure/cancel | Stop loading on `ready`, `error` and `cancelled`, and correlate by requestId. Progress alone is not completion. |
| `INVALID_OUTPUT` | Handler result does not match `schema.output`. Fix `structuredContent`, rebuild types/server and retest. |
| Cancelling UI did not undo an operation | Pass `signal` to the real service call. Cancellation stops waiting/aborts work; it cannot roll back a completed action. |
| Browser tests cannot launch Chromium | Run `npx playwright install chromium`; on Linux use `--with-deps` if system libraries are missing. Or set `CHROMIUM_PATH` to an existing executable. |
| Benchmark fails on Windows | RSS measurement currently requires macOS/Linux. Run the benchmark in a supported environment. |
| Benchmark A/B comparison rejects files | Match machine, methodology, fixture/host, tool versions and settings. See [benchmarks](../reference/benchmarks.md). |

## Inspect metadata before debugging the host

Use an ESM build script to call `result.inspectProtocol(capabilities)` and compare the selected tool's `resourceUri` with listed resources. An inspection without Apps capabilities deliberately omits UI metadata. See the [exact inspection example](metadata.md). Inspection tests serialization; it does not open a View or prove host support.

## Isolate your failure

1. Reproduce with the unmodified Counter example to separate custom source from client configuration.
2. If discovery works, call with the explicit JSON arguments from the quickstart.
3. If only page calls fail, compare host capabilities/permissions and inspect `mcpkit:tool-state` messages.
4. If your changes affect runtime/packaging, run the local checks from [contributing](../contributing.md).
5. For rendering issues, capture the actual host error and check its UI sandbox/resource policy. Browser-harness success alone does not prove desktop compatibility.

## Report a reproducible issue

Include OS, Node and client versions, MCPKit Git revision/package version, your build command, connection method, tool name/input, expected/actual result and a small source reproduction. Specify whether it fails at startup, discovery, call or rendering. Include sanitized stderr/client/browser diagnostics, preserving error codes but removing credentials.

[Open an issue](https://github.com/yodaos-project/aiui-mcpkit/issues). For benchmark reports, also attach settings, `status.json`, report files and screenshots rather than only a single timing number.

---

[Documentation index](../README.md) · Previous: [Development workflow](development.md) · Next: [Build API](../reference/build-api.md)
