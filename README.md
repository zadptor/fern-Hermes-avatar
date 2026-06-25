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
- Animated fallback avatar when no Live2D model has been added.

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

The app currently loads the bundled Hiyori Cubism 4 sample model from:

```text
src/assets/live2d/models/hiyori_free_zh/runtime/hiyori_free_t08.model3.json
```

The model's referenced textures, `.moc3`, physics, and motion files must stay in the paths expected by the `.model3.json` file.

Cubism 4 rendering also requires `src/assets/vendor/live2dcubismcore.min.js`, which is loaded before the renderer entrypoint. The bundled sample model includes its original `ReadMe.txt`; review that file and the Live2D sample data license before redistributing.

If the model file is missing or fails to load, the app uses an animated fallback avatar so the bridge can still be tested.

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
