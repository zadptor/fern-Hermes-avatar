#!/usr/bin/env bash
# install.sh — install the hermes-overlay-bridge plugin into Hermes Agent
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_SRC="$SCRIPT_DIR/hermes-plugin"
PLUGIN_NAME="hermes-overlay-bridge"

# ── Where does Hermes live? ──────────────────────────────────────────────
HERMES_HOME="${HERMES_HOME:-$HOME/.hermes}"
HERMES_PLUGINS="$HERMES_HOME/plugins"
PLUGIN_DEST="$HERMES_PLUGINS/$PLUGIN_NAME"

echo "=== fern-Hermes-avatar: plugin installer ==="

# ── Sanity checks ────────────────────────────────────────────────────────
if [ ! -d "$PLUGIN_SRC" ]; then
    echo "ERROR: plugin source not found at $PLUGIN_SRC"
    echo "Run this script from the fern-Hermes-avatar repo root."
    exit 1
fi

if [ ! -f "$PLUGIN_SRC/plugin.yaml" ]; then
    echo "ERROR: $PLUGIN_SRC/plugin.yaml missing — plugin source is incomplete."
    exit 1
fi

# ── Ensure Hermes plugins directory exists ───────────────────────────────
mkdir -p "$HERMES_PLUGINS"

# ── Platform detection ───────────────────────────────────────────────────
IS_WSL=false
IS_WINDOWS=false

case "$(uname -s)" in
    Linux)
        if grep -qi microsoft /proc/version 2>/dev/null; then
            IS_WSL=true
        fi
        ;;
    MINGW*|MSYS*|CYGWIN*)
        IS_WINDOWS=true
        ;;
esac

# ── Remove existing install if present ───────────────────────────────────
if [ -e "$PLUGIN_DEST" ] || [ -L "$PLUGIN_DEST" ]; then
    echo "Removing existing plugin at $PLUGIN_DEST"
    rm -rf "$PLUGIN_DEST"
fi

# ── Install ──────────────────────────────────────────────────────────────
if $IS_WINDOWS; then
    # Windows native (Git Bash / MSYS2): copy, symlinks need admin
    echo "Detected: Windows native → copying plugin"
    cp -r "$PLUGIN_SRC" "$PLUGIN_DEST"
    echo "Plugin copied to $PLUGIN_DEST"
else
    # Linux, macOS, WSL: symlink so updates are picked up automatically
    if $IS_WSL; then
        echo "Detected: WSL2 → symlinking plugin"
    else
        echo "Detected: $(uname -s) → symlinking plugin"
    fi
    ln -s "$PLUGIN_SRC" "$PLUGIN_DEST"
    echo "Plugin symlinked to $PLUGIN_DEST"
fi

# ── Verify ────────────────────────────────────────────────────────────────
if [ -f "$PLUGIN_DEST/plugin.yaml" ]; then
    echo ""
    echo "✓ Plugin installed successfully."
    echo ""
    echo "Next steps:"
    echo "  1. Enable:  hermes plugins enable $PLUGIN_NAME"
    echo "  2. Restart Hermes (/exit then hermes)"
    echo ""
else
    echo "ERROR: installation verification failed — plugin.yaml not found at destination."
    exit 1
fi
