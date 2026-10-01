# Create your own agent

English | [简体中文](first-agent.zh-CN.md) · [Documentation index](../README.md)

**Prerequisites:** complete [the quickstart](quickstart.md) and keep the repository dependencies installed. This tutorial creates a separate `my-agent` source directory; build commands run from the MCPKit repository root. Start with a static page, then replace it with the interactive version below.

## 1. Create the two source files

Create `my-agent/` wherever convenient, add a `pages/` directory, then save the following contents as `app.json` and `pages/home.ink`. Paths in build/install commands are placeholders: replace `/path/to/my-agent` with the actual absolute path, quoted if it contains spaces.

Once the example works, replace it with your own page. You can start with this minimal project:

```text
my-agent/
├── app.json
└── pages/
    └── home.ink
```

`app.json` gives the app a name and lists its pages:

```json
{
  "name": "My Agent",
  "pages": ["pages/home"]
}
```

`pages/home.ink` defines the first screen:

```html
<page>
  <view>
    <text>Hello from AIUI Agent</text>
  </view>
</page>
```

Page paths in `app.json` omit the `.ink` extension. For buttons and state, use the [Counter page](../../examples/counter/pages/counter/index.ink) as a working reference.

From the MCPKit repository, run the local build helper. Replace `/path/to/my-agent` with your project's actual path:

```sh
npm run build
node scripts/build-plugin.mjs /path/to/my-agent \
  --name my-agent \
  --out /path/to/my-agent/dist/plugin
```

The project root directly contains `app.json` and `pages/`. Output may live under the project’s `dist/` directory and is excluded from UI assets. The output directory cannot equal or contain the source directory. The helper is for development in this repository. The package's public integration API is the [ESM library](../guides/esm-build.md).

To install your new plugin in Codex:

```sh
codex plugin marketplace add /path/to/my-agent/dist/plugin
codex plugin add my-agent@my-agent-local
```

Reload the desktop host after installation. Your agent's opener tool is `open_app` by default. Other clients can [connect directly to its server](../guides/clients.md).

## 2. Verify the static page

After building and installing with the commands above, reload your host and ask it to invoke `open_app` with `{}`. An Apps host should show “Hello from AIUI Agent”. A text-only client returns an explanation rather than a rendered page.

You do not open `view.html` directly in a browser. The generated View expects its MCP Apps host to supply the initialization channel and tool data.

## 3. Add state and a button

Replace the **entire** `pages/home.ink` file with:

```html
<script setup>
export default {
  data: { count: 0 },
  increment() { this.setData({ count: this.data.count + 1 }); },
};
</script>

<page>
  <view class="screen">
    <text class="title">My first Agent</text>
    <text class="count">{{count}}</text>
    <button class="control" bindtap="increment">+ ADD ONE</button>
  </view>
</page>

<style>
.screen { width: 100%; min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 16px; background-color: #000000; color: #40ff5e; }
.title { font-size: 20px; }
.count { font-size: 40px; }
.control { padding: 8px 16px; background-color: #000000; color: #40ff5e; border-width: 1px; border-style: solid; border-color: #40ff5e; }
</style>
```

`data` stores page state. `{{count}}` reads that state. `bindtap="increment"` calls the `increment` method when tapped, and `setData` updates the state and redraws the page. This button changes local UI state; it does not call a business handler.

## 4. Rebuild and inspect the new version

Run the same `node scripts/build-plugin.mjs ...` command again. For a directly registered server, reload that server and open a new View. For a Codex-installed plugin, use the client's plugin update/reinstall flow so its cached copy receives the rebuilt directory, then reload the host and open a new card. Repository `update:examples` updates the bundled examples only, not `my-agent`.

Expected result: the page starts at 0 and becomes 1 after **+ ADD ONE**. Ink may format numeric interpolation as `0.0` and `1.0`; these represent the same counts. This example has no persistence: a newly created page starts at 0 again.

## 5. Where to go next

- To accept input from the AI, add a page input schema using [page tools](../guides/page-tools.md).
- To calculate or fetch data on the server, add an output schema and handler using [business tools](../guides/business-tools.md).
- To put this build into your own project, use [the ESM library](../guides/esm-build.md).
- To understand the generated files and options, consult [the build API](../reference/build-api.md).

---

[Documentation index](../README.md) · Previous: [Run the examples](quickstart.md) · Next: [Page tools](../guides/page-tools.md)
