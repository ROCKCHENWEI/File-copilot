# File-copilot

**[中文说明](README.zh-CN.md)** | English

A work-agent assistant inside Obsidian — chat with MiniMax, Kimi, and GLM while the agent searches, reads, and organizes your notes through built-in tools.

## Why

You take notes in Obsidian; your AI should live there too. File-copilot puts an agent in the sidebar that can actually *touch* your vault: summarize the note you're writing, pull related notes from anywhere in the vault, draft and create new notes — with every write gated behind your approval.

It is not locked to one vendor: MiniMax, Kimi, and GLM (Zhipu) are all one click away, connected through their official OpenAI-compatible endpoints. No proxies, no middlemen, no telemetry.

## Features

| Feature | Details |
|---------|---------|
| Multi-provider | MiniMax, Kimi, and GLM (Zhipu) — switch provider/model from the sidebar, anytime |
| **Agent tools** | The model can call `search_notes`, `read_note`, `list_recent_notes` to explore your vault, and `create_note`, `append_note`, `replace_note_content` to write — all visible as collapsible step blocks |
| Write permissions | Three modes: **read-only** / **confirm each write** (default, with a content preview) / **auto-write** (Notice only) |
| Connection test | A ⚡ button pings the exact provider + model + key you selected, so you know it works *before* you send a real message |
| Live model list | Fetch the models actually available under your key from each provider's `/models` endpoint; one click to reset to the built-in list |
| Inline API key | Enter keys right in the sidebar panel (masked, with a configured/missing badge) — no digging through settings |
| Active note context | Optional per-chat `@当前笔记` chip appends the active note to your message |
| Quick actions | One-click prompts: summarize current note / find related notes / draft a new note / polish text |
| Streaming | Token-by-token replies (can be disabled); Markdown rendering with copyable code blocks |
| History | Save conversations as JSON or export to Markdown; delete sends to system trash |
| Privacy first | API keys stay in memory by default (never written to disk unless you opt in); requests go directly to official endpoints; conversations are not auto-saved |

## Providers & models

| Provider | Models | Endpoint | Get a key |
|----------|--------|----------|-----------|
| **MiniMax** | `MiniMax-M2.7` · `MiniMax-M2.5` · `MiniMax-M2.1` · `MiniMax-M2.5-highspeed` | `https://api.minimax.io/v1` | [MiniMax platform](https://platform.minimaxi.com/) |
| **Kimi** | `kimi-for-coding` · `kimi-k2.5` · `kimi-k2-0905-preview` · `kimi-k2-turbo-preview` | `https://api.kimi.com/coding/v1` | [Kimi](https://kimi.com/) |
| **GLM (Zhipu)** | `glm-5.2` · `glm-5.1` · `glm-4.7` · `glm-5-turbo` · `glm-4.5-air` | `https://open.bigmodel.cn/api/coding/paas/v4` | [Zhipu BigModel](https://open.bigmodel.cn/) |

> The model list lives in `PROVIDERS` in [`src/constants.ts`](src/constants.ts) — add a model in one place. GLM and Kimi use their Coding Plan endpoints, so bring a key from the matching plan. If a provider's list drifts, just hit the ↻ *fetch models* button — it pulls whatever your key can actually use.

## Install

### Option 1: Community directory (once approved)

Search "File-copilot" in Obsidian's community plugin browser. *(Submission under review.)*

### Option 2: BRAT (recommended before approval)

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from the community directory.
2. BRAT: **Add Beta plugin** → `ROCKCHENWEI/File-copilot`.
3. Enable **File-copilot** in Settings → Community plugins.

### Option 3: Manual

1. Download `main.js`, `manifest.json`, `styles.css` from the [latest release](https://github.com/ROCKCHENWEI/File-copilot/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/copilot-agent-cn/`.
3. Enable the plugin in Settings → Community plugins.

## Quick start

1. Open the sidebar (robot icon, or command *“Open File Copilot sidebar”*).
2. In the model panel, paste the API key for your provider.
3. Optional: ↻ fetch the live model list, then ⚡ test the connection — you should see `✓ connected (1.4s)`.
4. Try a quick action, or just ask: *"Summarize the note I have open"*, *"Find notes about 4DGS and list them"*, *"Turn today's meeting points into a new note"*.

Write operations pop a confirmation with a content preview (default mode) — nothing lands in your vault without your OK.

## Upgrading from Copilot CN (v0.1.x)

File-copilot uses the id `copilot-agent-cn` and runs alongside the legacy `copilot-cn` plugin. On first launch it imports settings and API keys from the old plugin (read-only; nothing is written back). You can also re-import anytime from Settings → *Import from legacy Copilot CN*.

## Privacy & security

- **Keys stay in memory by default.** Nothing is persisted unless you explicitly enable local storage; leftover keys found on disk are scrubbed on load.
- **Direct connections only.** Requests go straight to each provider's official endpoint — no third-party relay, no analytics, no telemetry.
- **Notes leave your vault only when you expect it**: sending with the active-note chip attached, or when the agent calls a read tool.
- **Writes are gated** behind the permission mode; confirm mode shows exactly what will be written.

## FAQ

- **"Please configure an API key"** — fill the key in the sidebar model panel or Settings.
- **401 / auth failed** — wrong or expired key, or a key from the wrong plan (e.g. a non-Coding-Plan GLM key on the coding endpoint).
- **A provider fails with `Failed to fetch`** — some endpoints don't send CORS headers; the plugin automatically falls back to Obsidian's `requestUrl` (main-process) transport, so this should be rare. If you see it, reload the plugin and retry.
- **Kimi requests can't be stopped mid-flight** — `requestUrl` doesn't support abort; the reply finishes and can be discarded.
- **Changed the model list in source** — rebuild (`npm run build`) and update `main.js` in your vault.

## Build from source

```bash
git clone https://github.com/ROCKCHENWEI/File-copilot.git
cd File-copilot
npm install
npm run dev        # watch mode
npm test           # vitest
npm run build      # tsc --noEmit + esbuild production → main.js
```

Deploy to your vault by copying `main.js`, `manifest.json`, `styles.css` into `<vault>/.obsidian/plugins/copilot-agent-cn/` (**never** overwrite `data.json` — it holds your settings and keys).

## License

[MIT](LICENSE)
