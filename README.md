# fern-Hermes-avatar

`fern-Hermes-avatar` is a standalone Electron desktop overlay for the Hermes AI assistant. Hermes remains the brain; this app only renders avatar state.

```text
Hermes Agent -> WebSocket ws://localhost:9120 -> fern-Hermes-avatar overlay
```

## Features

- Transparent, frameless, always-on-top Electron panel window.
- Local WebSocket server on port `9120` by default for Hermes overlay events.
- Vue 3 renderer with Pinia state.
- PixiJS v7 modular renderer wired for Cubism 4/5 Live2D models.
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

## Runtime Configuration

Environment-specific settings are read from environment variables in the Electron main process. Defaults match the bundled desktop overlay behavior.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HERMES_PORT` | `9120` | WebSocket server port. |
| `HERMES_WINDOW_WIDTH` | `560` | Overlay window width in pixels. |
| `HERMES_WINDOW_HEIGHT` | `820` | Overlay window height in pixels. |
| `HERMES_WINDOW_MARGIN` | `24` | Distance from the bottom-right work-area edge. |
| `HERMES_ALWAYS_ON_TOP_LEVEL` | `screen-saver` | Electron always-on-top level. |
| `HERMES_DISABLE_HARDWARE_ACCELERATION` | `true` | Disables hardware acceleration for WSL/headless-friendly rendering. |
| `HERMES_ELECTRON_SWITCHES` | `disable-gpu,ignore-gpu-blocklist,enable-unsafe-swiftshader` | Comma-separated Electron command-line switches. |
| `HERMES_TTS_TEMP_DIR_NAME` | `fern-avatar-tts` | Subdirectory name under the OS temp directory for generated audio. |
| `HERMES_TTS_PROVIDER` | `edge` | TTS backend: `edge` or `elevenlabs`. |
| `HERMES_EDGE_TTS_COMMANDS` | `[["edge-tts"],["py","-m","edge_tts"],["python","-m","edge_tts"]]` | Candidate `edge-tts` commands. Accepts JSON or semicolon-separated commands. |
| `HERMES_ELEVENLABS_API_KEY` | unset | ElevenLabs API key. Required when `HERMES_TTS_PROVIDER=elevenlabs`. |
| `HERMES_ELEVENLABS_VOICE_ID` | unset | ElevenLabs voice ID. Required when `HERMES_TTS_PROVIDER=elevenlabs`. |
| `HERMES_ELEVENLABS_MODEL_ID` | `eleven_multilingual_v2` | ElevenLabs TTS model. |
| `HERMES_ELEVENLABS_OUTPUT_FORMAT` | `mp3_44100_128` | ElevenLabs audio output format. |
| `HERMES_ELEVENLABS_BASE_URL` | `https://api.elevenlabs.io` | ElevenLabs API base URL. |
| `HERMES_ELEVENLABS_TIMEOUT_MS` | `30000` | Timeout for ElevenLabs TTS requests. |
| `HERMES_FFMPEG_BIN` | `ffmpeg` | `ffmpeg` executable path or command name. |
| `HERMES_WSLPATH_BIN` | `wslpath` | `wslpath` executable path or command name. |
| `HERMES_POWERSHELL_BIN` | `powershell.exe` | PowerShell executable used for Windows audio playback. |
| `HERMES_TTS_VOICE` | `en-US-AnaNeural` | Voice passed to `edge-tts`. |
| `HERMES_TTS_VOICE_BY_AVATAR` | `{"hiyori":"en-US-AriaNeural","chitose":"en-US-GuyNeural"}` | Per-avatar voice map. Accepts JSON or `hiyori=voice,chitose=voice`. |
| `HERMES_TTS_MAX_TEXT_LENGTH` | `300` | Maximum text sent to TTS per request. |
| `HERMES_EDGE_TTS_TIMEOUT_MS` | `30000` | Timeout for `edge-tts` generation. |
| `HERMES_FFMPEG_TIMEOUT_MS` | `5000` | Timeout for MP3 to WAV conversion. |
| `HERMES_WSLPATH_TIMEOUT_MS` | `5000` | Timeout for converting WSL paths to Windows paths. |
| `HERMES_TTS_PLAYBACK_TIMEOUT_MS` | `60000` | Timeout for PowerShell audio playback. |
| `HERMES_TTS_CLEANUP_TTL_MS` | `86400000` | Deletes generated TTS audio older than this age. |
| `HERMES_TTS_CLEANUP_MAX_BYTES` | `104857600` | Maximum generated TTS temp directory size before oldest files are deleted. |
| `HERMES_TTS_PLAYBACK_MODE` | `renderer` | Audio output path: `renderer`, `windows`, or `both`. Use `renderer` for one clean voice from the app. |
| `HERMES_TTS_WINDOWS_PLAYBACK_ENABLED` | unset | Legacy compatibility flag. If set, `true` maps to `windows` and `false` maps to `renderer` unless `HERMES_TTS_PLAYBACK_MODE` is set. |
| `HERMES_TTS_WINDOWS_TEMP_MOUNT` | unset | Optional Windows-mounted temp directory. If set, generated WAV files are copied there before playback. |

Example:

```bash
HERMES_PORT=9130 HERMES_EDGE_TTS_COMMANDS='[["C:\\Tools\\edge-tts.exe"]]' npm run dev
```

Per-avatar voice example:

```bash
HERMES_TTS_VOICE_BY_AVATAR='{"hiyori":"en-US-AriaNeural","chitose":"en-US-GuyNeural"}' npm run dev
```

ElevenLabs example:

```bash
HERMES_TTS_PROVIDER=elevenlabs HERMES_ELEVENLABS_API_KEY=... HERMES_ELEVENLABS_VOICE_ID=... npm run dev
```

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
src/assets/live2d/models/Haru/Haru.model3.json
src/assets/live2d/models/Mao/Mao.model3.json
src/assets/live2d/models/Mark/Mark.model3.json
src/assets/live2d/models/Natori/Natori.model3.json
src/assets/live2d/models/Ren/Ren.model3.json
src/assets/live2d/models/Rice/Rice.model3.json
src/assets/live2d/models/Wanko/Wanko.model3.json
```

Each model's referenced textures, `.moc3`, physics, expressions, and motion files must stay in the paths expected by the `.model3.json` file.

Cubism rendering also requires `src/assets/vendor/live2dcubismcore.min.js`, which is loaded before the renderer entrypoint. The bundled core exposes Cubism 5 moc support, and the additional sample models come from the Cubism Web Samples `develop` branch, which is documented as compatible with Cubism 5.3. The bundled sample models include their original readme/license files where provided; review those files and the Live2D sample data license before redistributing.

If the model file is missing or fails to load, the avatar stage remains empty and the renderer logs the load error.

Chitose is a Cubism 3 sample. The current Pixi Live2D renderer uses its Cubism 4 entrypoint with the bundled Cubism Core for Cubism 3/4/5 `.model3.json` models.

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

The plugin uses a **persistent WebSocket connection** to `ws://localhost:9120` by default (not connect-send-close per event), so the overlay's `isConnected` state stays accurate. If you set `HERMES_PORT`, point the plugin at the same port.

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

Hermes connects to `ws://localhost:9120` by default and sends JSON messages:

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
