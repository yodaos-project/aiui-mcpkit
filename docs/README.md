# Learn MCPKit, one working step at a time

English | [简体中文](README.zh-CN.md) · [Learning path](README.md)

New to AI apps? Start with a browser and a button. You can build the first interface with basic JavaScript and a text editor; protocol knowledge and an AI account can wait.

## Start here

[Run your first preview →](getting-started/quickstart.md)

You will open Counter locally and change its count by clicking a button. Need help with Node.js, Git or the terminal? Use [environment setup](getting-started/installation.md). Prefer a short explanation first? Read [what MCPKit does](getting-started/overview.md).

## Follow the main path

Each lesson adds one capability and ends with a visible checkpoint. Finish the first three in the browser, then connect an assistant when you are ready.

1. **[Run a preview](getting-started/quickstart.md)** — A working Counter, without client installation.
2. **[Change a button](getting-started/edit-example.md)** — A saved edit that appears in the preview.
3. **[Create your own app](getting-started/first-agent.md)** — Two source files and your own working button.
4. **[Add tool arguments](guides/page-tools.md)** — A named tool that opens your app with validated input.
5. **[Connect an AI client](guides/clients.md)** — A tool the assistant can discover and call.
6. **[Return a business result](guides/first-business-tool.md)** — A server function returning CNY 40 to both the assistant and UI.

Stop after any lesson and experiment. You do not need Workers, protocol metadata, state restoration or automated browser testing to finish the basic path.

## Choose your next feature

| When you want to… | Read | Bring with you |
| --- | --- | --- |
| Explore other interfaces | [Example collection](../examples/README.md) | A working local preview |
| Edit faster or update an installed app | [Development workflow](guides/development.md) | Your first app |
| Let a button send a message or share selected state | [Agent sessions](guides/agent-session.md) | A connected Apps client |
| Build a product selection flow | [Candidate selection](guides/candidate-selection.md) | Business tools and Agent sessions |
| Show progress, errors or cancellation | [Request lifecycle](guides/tool-lifecycle.md) | A working business call |
| Use MCPKit in another Node.js project | [ESM integration](guides/esm-build.md) | An app you can build |

## Advanced guides: open them for a specific need

| Need | Guide |
| --- | --- |
| Several tools update the same open app | [Shared Apps](guides/shared-agent.md) |
| Restore selected state after a View is destroyed | [Scoped restoration](guides/state-restoration.md) |
| Choose a Worker backend or deploy its host | [Business tools](guides/business-tools.md) · [Runtime integration](guides/runtime-integration.md) |
| Customize resource metadata or network permissions | [Metadata](guides/metadata.md) |
| Inspect a request or a context publication | [Inspector](guides/inspector.md) |
| Capture screenshots and verify readiness | [Preview verification](guides/preview-verification.md) |
| Turn a recorded interaction into a regression check | [Recording and replay](guides/interaction-replay.md) |
| Find which version is actually running | [Build diagnostics](guides/build-diagnostics.md) |

## Look up details

References are for checking a field or behavior, rather than reading in order.

- [Build API](reference/build-api.md): options, files, types and exports.
- [Messages](reference/messages.md): page input, results and request states.
- [Compatibility](reference/compatibility.md): protocol versions, host requirements and verification boundaries.
- [Benchmarks](reference/benchmarks.md): measurement methods and reports.

## Get unstuck or help improve the project

Use [troubleshooting](guides/troubleshooting.md) for the first failing step. [Contributing](contributing.md) explains repository checks and how to report an issue.

In these docs, **terminal commands** are shell blocks, **chat prompts** are text to send to an assistant, and **file contents** are labeled with the path to create or edit. Complete files and integration fragments are identified before the code. Every public guide has an English/Chinese pair.

[Back to the project README](../README.md)
