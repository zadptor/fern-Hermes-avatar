import { WebSocketServer } from 'ws'
import type { WebSocket } from 'ws'
import { isHermesOverlayEvent, type HermesOverlayEvent, type HermesStatus } from '../shared/hermesProtocol.js'

export interface HermesWebSocketServer {
  getStatus: () => HermesStatus
  close: () => void
}

interface HermesWebSocketServerOptions {
  port: number
  onEvent: (event: HermesOverlayEvent) => void
  onStatusChange: (status: HermesStatus) => void
}

export function createHermesWebSocketServer(options: HermesWebSocketServerOptions): HermesWebSocketServer {
  const clients = new Set<WebSocket>()
  let isListening = false
  let lastError: string | undefined

  const status = (): HermesStatus => ({
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
