import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'

type HermesEmotion = 'neutral' | 'happy' | 'thinking' | 'annoyed' | 'sad'

export type HermesOverlayEvent =
  | { type: 'assistant_message_started'; mode: 'text' | 'voice' }
  | { type: 'assistant_message_delta'; text: string }
  | { type: 'assistant_message_completed'; text: string; audioUrl?: string; emotion?: HermesEmotion }
  | { type: 'assistant_speaking'; volume: number; phoneme?: string }
  | { type: 'assistant_idle' }

export interface HermesServerStatus {
  isListening: boolean
  clients: number
  port: number
  lastError?: string
}

export interface HermesWebSocketServer {
  getStatus: () => HermesServerStatus
  close: () => void
}

interface HermesWebSocketServerOptions {
  port: number
  onEvent: (event: HermesOverlayEvent) => void
  onStatusChange: (status: HermesServerStatus) => void
}

function isHermesOverlayEvent(value: unknown): value is HermesOverlayEvent {
  if (!value || typeof value !== 'object' || !('type' in value)) return false

  const event = value as Record<string, unknown>
  switch (event.type) {
    case 'assistant_message_started':
      return event.mode === 'text' || event.mode === 'voice'
    case 'assistant_message_delta':
      return typeof event.text === 'string'
    case 'assistant_message_completed':
      return typeof event.text === 'string'
    case 'assistant_speaking':
      return typeof event.volume === 'number'
    case 'assistant_idle':
      return true
    default:
      return false
  }
}

export function createHermesWebSocketServer(options: HermesWebSocketServerOptions): HermesWebSocketServer {
  const clients = new Set<WebSocket>()
  let isListening = false
  let lastError: string | undefined

  const status = (): HermesServerStatus => ({
    isListening,
    clients: clients.size,
    port: options.port,
    lastError
  })

  const notifyStatus = (): void => options.onStatusChange(status())

  const server = new WebSocketServer({ port: options.port })

  server.on('listening', () => {
    isListening = true
    lastError = undefined
    notifyStatus()
  })

  server.on('connection', (socket) => {
    clients.add(socket)
    notifyStatus()

    socket.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString()) as unknown
        if (isHermesOverlayEvent(parsed)) {
          options.onEvent(parsed)
        }
      } catch {
        lastError = 'Received invalid JSON from Hermes.'
        notifyStatus()
      }
    })

    socket.on('close', () => {
      clients.delete(socket)
      notifyStatus()
    })

    socket.on('error', (error) => {
      lastError = error.message
      notifyStatus()
    })
  })

  server.on('error', (error) => {
    isListening = false
    lastError = error.message
    notifyStatus()
  })

  server.on('close', () => {
    isListening = false
    clients.clear()
    notifyStatus()
  })

  return {
    getStatus: status,
    close: () => server.close()
  }
}
