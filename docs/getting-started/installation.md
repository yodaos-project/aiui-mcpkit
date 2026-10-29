# Prepare your computer

English | [简体中文](installation.zh-CN.md) · [Learning path](../README.md)

**Goal:** install the few tools needed for the first browser preview. You can use macOS, Linux or Windows with Node.js 22+.

## 1. Install the essentials

| Tool | Why you need it | Check in a terminal |
| --- | --- | --- |
| [Node.js 22+](https://nodejs.org/en/download) | Runs the build scripts; includes npm, which installs dependencies. | `node --version` and `npm --version` |
| [Git](https://git-scm.com/downloads) | Downloads the project. | `git --version` |
| A browser and text editor | Displays the preview and edits files. | Your usual browser and editor are enough. |

A **terminal** is the window where you type commands: Terminal on macOS, a terminal app on Linux, or PowerShell on Windows. An editor's integrated terminal also works. Paste shell blocks there, one line at a time.

Run:

```sh
node --version
npm --version
git --version
```

Node should report `v22` or a newer major version. If a command is not found after installation, close and reopen the terminal, then try again.

## 2. Download the project

Choose a directory where you keep projects, then run:

```sh
git clone https://github.com/yodaos-project/aiui-mcpkit.git
cd aiui-mcpkit
npm ci
```

`cd` enters the project folder. `npm ci` installs the versions recorded in the lockfile. Wait for it to finish before continuing.

Already cloned the project? Open a terminal in that folder and run `npm ci`; skip the clone command. The **repository root** means this folder, which contains `package.json`, `scripts/`, `examples/` and `docs/`. Tutorial commands run here unless stated otherwise.

**Checkpoint:** the version commands work and `npm ci` exits successfully. Continue with [quickstart step 2](quickstart.md#2-open-the-preview).

## Add other tools when you need them

| Later task | Additional requirement |
| --- | --- |
| Use the app in an AI conversation | A client with MCP Apps and WASM support; see [client setup](../guides/clients.md). |
| Install a Codex plugin | A Codex CLI exposing `codex plugin --help`. |
| Automate browser verification | Playwright and Chromium; see [preview verification](../guides/preview-verification.md). |
| Use the optional Agent Worker backend | A configured Worker host; see [business tools](../guides/business-tools.md). |

The first preview needs no AI account, API key, plugin installation, native Worker or Rust toolchain.

**Next:** [Open Counter in your browser](quickstart.md#2-open-the-preview). If setup fails, start with [troubleshooting](../guides/troubleshooting.md).
