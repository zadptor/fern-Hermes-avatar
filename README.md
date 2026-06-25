# fern-Hermes-avatar

`fern-Hermes-avatar` is a standalone Electron desktop overlay for the Hermes AI assistant. Hermes remains the brain; this app only renders avatar state.

```text
Hermes Agent -> WebSocket ws://localhost:9120 -> fern-Hermes-avatar overlay
```

## Features

- Transparent, frameless, always-on-top Electron panel window.
- Local WebSocket server on port `9120` for Hermes overlay events.
- Vue 3 renderer with Pinia state.
- PixiJS v7 modular renderer wired for Cubism 4 Live2D models.
- Runtime avatar animation for idle gaze, blinking, breathing, expression changes, and speech mouth movement.
- Speech bubble, voice/speaking visualizer, expression mapping, and lip-sync smoothing.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

The overlay opens as a transparent panel positioned near the bottom-right of the primary display.

## Build

Compile the Electron app bundle:

```bash
npm run compile
```

Create distributable packages:

```bash
npm run build
```

Linux builds an AppImage. Windows builds an NSIS installer.

## Live2D Model

The app can select between bundled Live2D sample models:

```text
src/assets/live2d/models/hiyori_free/runtime/hiyori_free_t08.model3.json
src/assets/live2d/models/chitose/runtime/chitose.model3.json
```

Each model's referenced textures, `.moc3`, physics, expressions, and motion files must stay in the paths expected by the `.model3.json` file.

Cubism rendering also requires `src/assets/vendor/live2dcubismcore.min.js`, which is loaded before the renderer entrypoint. The bundled sample models include their original `ReadMe.txt`; review those files and the Live2D sample data license before redistributing.

If the model file is missing or fails to load, the avatar stage remains empty and the renderer logs the load error.

Chitose is a Cubism 3 sample. The current Cubism 4 renderer is used for both bundled models.

## Hermes Plugin Requirement

For the avatar overlay to react to Hermes responses automatically, you need the `hermes-overlay-bridge` plugin installed and enabled in your Hermes Agent.

### Install the plugin

The plugin lives at `~/.hermes/plugins/hermes-overlay-bridge/` and was built for this avatar:

**`plugin.yaml`**
```yaml
name: hermes-overlay-bridge
hooks:
  - pre_llm_call
  - post_llm_call
```

**What it does:**
- `pre_llm_call` — sends `assistant_message_started` → avatar shows thinking animation
- `post_llm_call` — detects emotion from response text (keyword matching) and sends `assistant_message_completed` with the detected emotion

The plugin uses a **persistent WebSocket connection** to `ws://localhost:9120` (not connect-send-close per event), so the overlay's `isConnected` state stays accurate.

### Enable the plugin

```bash
hermes plugins list          # verify it's registered
hermes plugins enable hermes-overlay-bridge
```

Then restart Hermes for the plugin to take effect:

```bash
# exit current session with /exit, then:
hermes
```

### How it works

```text
Hermes Agent
  ↓ pre_llm_call / post_llm_call hooks
hermes-overlay-bridge plugin
  ↓ WebSocket ws://localhost:9120
fern-Hermes-avatar overlay
  ↓
Live2D avatar + manga speech bubbles
```

## Hermes Event Contract

Hermes connects to `ws://localhost:9120` and sends JSON messages:

```ts
type HermesOverlayEvent =
  | { type: "assistant_message_started"; mode: "text" | "voice" }
  | { type: "assistant_message_delta"; text: string }
  | { type: "assistant_message_completed"; text: string; audioUrl?: string; emotion?: "neutral" | "happy" | "thinking" | "annoyed" | "sad" }
  | { type: "assistant_speaking"; volume: number; phoneme?: string }
  | { type: "assistant_idle" }
```

Quick manual test:

```bash
node -e "const WebSocket=require('ws');const ws=new WebSocket('ws://localhost:9120');ws.on('open',()=>{ws.send(JSON.stringify({type:'assistant_message_started',mode:'voice'}));ws.send(JSON.stringify({type:'assistant_message_delta',text:'Hello from Hermes.'}));ws.send(JSON.stringify({type:'assistant_speaking',volume:.7,phoneme:'a'}));setTimeout(()=>ws.send(JSON.stringify({type:'assistant_message_completed',text:'Hello from Hermes.',emotion:'happy'})),800);});"
```

## pixi-live2d-display Note

Some `pixi-live2d-display` installs can incorrectly detect `items_pinned_to_model.json` as the model settings file. If your model fails to load and that file is present, patch the installed package so model settings detection excludes:

```ts
!file.name.endsWith("items_pinned_to_model.json")
```
