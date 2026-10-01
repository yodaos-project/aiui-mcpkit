# Use the ESM library

English | [简体中文](esm-build.zh-CN.md) · [Documentation index](../README.md)

**Goal:** build your Agent from a standalone Node project. Complete [the first Agent](../getting-started/first-agent.md) so you already have source files. No global MCPKit CLI is required.

## Prepare the consuming project

From an empty directory for your own project, run:

```sh
npm init -y
```

Create an `agent/` directory inside it and copy your `app.json` and `pages/` there. Build the tarball from a separate terminal in the MCPKit repository with `npm pack`. Return to your project directory for the `npm install`, build-script creation and `node build-agent.mjs` commands below. `.mjs` is ESM without changing `package.json`'s `type`.

For developers building a packaging tool or an automated pipeline, call MCPKit directly from JavaScript. There is no need to launch a CLI subprocess.

To try the package from this checkout, run `npm pack` in the MCPKit repository. It builds the library and produces `yodaos-pkg-aiui-mcpkit-0.1.0.tgz`. Then install that file in your own Node.js project:

```sh
npm install /absolute/path/to/aiui-mcpkit/yodaos-pkg-aiui-mcpkit-0.1.0.tgz
```

Create `build-agent.mjs` in your project:

```js
import { buildPlugin } from '@yodaos-pkg/aiui-mcpkit';

const result = await buildPlugin({
  source: './agent',
  name: 'my-agent',
  outputDir: './dist/plugin',
  version: '1.0.0',
});

console.log(result.outputDir);
console.log(result.files.view);
```

Run it with `node build-agent.mjs`. Relative paths resolve from the directory where you run the command. The result contains plugin identity, the absolute output directory, the marketplace name, and generated file paths.

The API exports `BuildPluginOptions` and `BuildPluginResult`. It reports errors by rejecting the promise, without logging, exiting, or changing the working directory. This is the integration point for tools such as AIX; `aix pack --target mcp-apps` is planned for separate implementation in AIX.

## Verify and install

The example writes `dist/plugin/` relative to your own project. Confirm it contains `plugin.json`, `view.html` and `dist/server.mjs`. Install the generated directory with the plugin route from [your first Agent](../getting-started/first-agent.md), or configure that server's absolute path in [your client](clients.md). The generated server already bundles its runtime dependencies; install build dependencies in the consuming project, not in the output directory.

Put your build script in source control and ignore generated plugin output. Add metadata, policy or handler options only when needed; their defaults and constraints are in [BuildPluginOptions](../reference/build-api.md).

---

[Documentation index](../README.md) · Previous: [Public metadata](metadata.md) · Next: [Client setup](clients.md)
