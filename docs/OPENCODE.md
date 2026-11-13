# OpenCode integration

AskCue uses the official `@opencode-ai/sdk` and `opencode-ai` packages, pinned to the same version. Provider authentication, model inventory and inference belong to OpenCode. No OpenAI-compatible proxy or separately maintained model catalog is involved.

## Use

1. Open **Settings → AI Providers → OpenCode**.
2. An existing OpenCode Go/Zen API token is detected and used automatically, including connections previously saved as OpenAI-compatible endpoints. For a new connection, paste the API token and click **Save token**. The **OpenCode Go subscription** link opens the official subscription page.
3. Refresh models, search by model/provider name, and click a model to make it the chat default. Models also appear in the chat model selectors.

The official SDK imports the saved token into local OpenCode when models are first requested. Concurrent requests share that connection, and refreshing the list does not repeatedly reset the OpenCode instance. Tokens are masked in the UI and are never returned to the renderer by the connection-status API.

OpenCode reads its own global configuration and authentication as well. The development checkout includes the CLI at `node_modules/.bin/opencode`.

The bundled server is an internal implementation detail. Go uses an API token; its settings card does not ask for server URLs, usernames or passwords. Legacy server settings remain supported by the backend for existing installations. Saved API tokens are never imported into remote servers.

## Behavior

- Model IDs retain both the provider and complete model namespace (`opencode:provider/model`).
- Only connected providers and non-deprecated text models are shown. Image support comes from OpenCode's model metadata.
- Chat, structured tasks, screenshot analysis and meeting summaries use the selected OpenCode model. Groq Fast Response Mode does not override an explicitly selected OpenCode model.
- Requests use separate temporary sessions with tools denied. Visible text streams to the UI; reasoning and other sessions' events are excluded. Sessions are removed after success, error or cancellation.
- A process started by AskCue uses an authenticated loopback listener, a separate working directory and a random port. It stops when AskCue quits. An existing external server is never stopped.

## Validation

- `pnpm test`: HTTP/SSE tests use the real SDK against a local test server; routing and IPC tests cover selection, credentials, failures and cancellation.
- `pnpm test:ui`: built-renderer checks include OpenCode discovery, search, default selection and error recovery.
- After compiling Electron, `pnpm test:opencode` runs the real bundled CLI with an isolated profile and verifies automatic startup, authenticated SDK discovery and shutdown. It does not send inference requests.

Official references: [SDK](https://opencode.ai/v1/docs/sdk/), [server](https://opencode.ai/v1/docs/server/).
