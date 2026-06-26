"""Hermes plugin — forward response lifecycle events to fern-Hermes-avatar overlay.

Hooks into pre_llm_call and post_llm_call to send assistant_message_started
and assistant_message_completed events to the overlay's WebSocket server.

Maintains a persistent WebSocket connection so the overlay always knows
Hermes is connected and avoids showing "Waiting..." between events.

Emotion is inferred from response text using simple heuristics.
"""

from __future__ import annotations

import json
import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

OVERLAY_WS_URL = "ws://localhost:9120"

_emotion_keywords: dict[str, list[str]] = {
    "happy": [
        "glad", "great", "wonderful", "awesome", "excellent", "fantastic",
        "amazing", "delighted", "joy", "happy", "perfect", "lovely",
    ],
    "thinking": [
        "hmm", "interesting", "curious", "wonder", "maybe", "perhaps",
        "let me think", "not sure", "depends",
    ],
    "sad": [
        "sorry", "unfortunately", "unfortunately", "sadly", "apologize",
        "regret", "afraid", "unable",
    ],
    "annoyed": [
        "cannot", "won't", "refuse", "denied", "blocked", "invalid",
        "error", "failed", "incorrect",
    ],
}

# ── Persistent WebSocket connection ──────────────────────────────────────

_ws_lock = threading.Lock()
_ws_instance: Any = None
"""Reusable persistent WebSocket connection. None = disconnected."""


def _ensure_connected() -> Any | None:
    """Return the persistent WS connection, (re)connecting if needed."""
    global _ws_instance
    if _ws_instance is not None:
        return _ws_instance

    try:
        from websockets.sync.client import connect  # type: ignore[import-untyped]

        _ws_instance = connect(
            OVERLAY_WS_URL,
            open_timeout=3,
            close_timeout=1,
        )
        logger.debug("overlay bridge connected (persistent)")
    except Exception as exc:
        logger.debug("overlay bridge connect failed: %s", exc)
        _ws_instance = None
    return _ws_instance


def _close_ws() -> None:
    """Close the persistent connection cleanly."""
    global _ws_instance
    with _ws_lock:
        if _ws_instance is not None:
            try:
                _ws_instance.close()
            except Exception:
                pass
            _ws_instance = None


def _send_event(event: dict) -> None:
    """Send a JSON event over the persistent WebSocket connection."""
    global _ws_instance
    payload = json.dumps(event)
    with _ws_lock:
        ws = _ensure_connected()
        if ws is None:
            return
        try:
            ws.send(payload)
        except Exception as exc:
            logger.debug("overlay bridge send failed: %s", exc)
            _ws_instance = None
            ws = _ensure_connected()
            if ws is None:
                return
            try:
                ws.send(payload)
            except Exception as retry_exc:
                logger.debug("overlay bridge retry failed: %s", retry_exc)
                _ws_instance = None


# ── Emotion inference ────────────────────────────────────────────────────

def _detect_emotion(text: str) -> str:
    """Infer emotion from response text using keyword heuristics."""
    lower = text.lower()
    for emotion, keywords in _emotion_keywords.items():
        for kw in keywords:
            if kw in lower:
                return emotion
    return "neutral"


# ── Hook handlers ────────────────────────────────────────────────────────

def register(ctx):
    """Register Hermes hooks for overlay event forwarding."""
    ctx.register_hook("pre_llm_call", _on_pre_llm_call)
    ctx.register_hook("post_llm_call", _on_post_llm_call)


def shutdown(ctx):
    """Clean up persistent connection on plugin unload."""
    _close_ws()


def _on_pre_llm_call(
    session_id: str | None = None,
    user_message: str | None = None,
    **_kwargs,
) -> None:
    """Send assistant_message_started to overlay."""
    _send_event({"type": "assistant_message_started", "mode": "text"})


def _on_post_llm_call(
    session_id: str | None = None,
    user_message: str | None = None,
    assistant_response: str | None = None,
    **_kwargs,
) -> None:
    """Send assistant_message_completed to overlay with inferred emotion."""
    if not assistant_response:
        _send_event({"type": "assistant_idle"})
        return

    emotion = _detect_emotion(assistant_response)
    _send_event({
        "type": "assistant_message_completed",
        "text": assistant_response,
        "emotion": emotion,
    })
