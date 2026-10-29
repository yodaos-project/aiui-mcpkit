# What you can build with MCPKit

English | [简体中文](overview.zh-CN.md) · [Learning path](../README.md)

Imagine asking an assistant to show an itinerary. It opens a small app: you switch days, save a place and choose what to share back. MCPKit helps you build that interface and package it for an AI client.

You write an **AIUI app** with JavaScript, page markup and styles. MCPKit builds the files a client needs to call your tools and display your app. You can start in a browser before connecting an assistant.

## See the idea

The repository includes travel planning, a focus timer, analytics, workshop booking, Counter and a business demo. [Browse real runtime screenshots](../../README.md#tools-people-can-use) or [run Counter locally](quickstart.md).

These are working examples with demo data. Workshop confirmation makes no real reservation or payment. The focus timer runs while its View is open and pauses when hidden.

## Three pieces to remember

| Piece | Its job |
| --- | --- |
| **AIUI** | The app format you author: `app.json`, `.ink` pages, JavaScript and assets. |
| **Ink** | The runtime that executes your page code and draws the interface. MCPKit bundles its WebAssembly version. |
| **MCPKit** | The builder that packages your app with an MCP server and an interactive View. |

An `.ink` file groups page markup, JavaScript and styles in one file. Knowing basic HTML, CSS and JavaScript helps; AIUI has its own components and APIs, which the tutorials introduce as needed.

## Learn by adding one capability at a time

1. **See an interface:** run a local browser preview.
2. **Make it yours:** edit a button, then create a two-file app.
3. **Let an assistant open it:** declare tool inputs and connect a client.
4. **Return useful results:** add a server function, then optionally connect UI state to the conversation.

You can stop at each step with a working result. Follow the [learning path](../README.md) rather than reading every guide first.

## Terms you will meet later

- A **tool** is a named operation the assistant can call with JSON arguments, such as `open_counter` with a starting count.
- A **host/client** is the assistant application that starts your server. It needs MCP Apps support to show an interactive interface.
- A **View** is one open instance of your app's interface inside that host.
- **stdio** means the client talks to a local server process through its input/output streams. It is a connection method, not a web address.
- A **handler** is your server function for a business tool. A Worker is an optional execution backend introduced in the advanced guides.

## What works locally and in a client

The browser preview runs real Ink/WASM, supplies launch arguments and reloads when source changes. Conversation messages, assistant tool calls and server-side business results need a supporting host or a test harness. A preview is a place to develop your UI; [client setup](../guides/clients.md) is a later step.

MCPKit currently generates local stdio servers. For HTTP deployment, protocol details and client-specific verification, consult [compatibility](../reference/compatibility.md) when you reach that stage.

**Next:** [Run your first preview](quickstart.md).
