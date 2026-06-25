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
- Speech bubble, voice/speaking visualizer, expression mapping, and lip-sync smoothing.
- Graceful placeholder avatar when no Live2D model has been added.

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

Put your Cubism 4 model in:

```text
src/assets/model3.json
```

Keep the model's referenced textures, `.moc3`, expressions, physics, pose, and motion files in the paths expected by the `.model3.json` file.

If the file is missing, the app uses a placeholder avatar so the bridge can still be tested.

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

The app itself does not depend on AIRI code or agent internals.
