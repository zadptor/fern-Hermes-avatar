/// <reference types="vite/client" />

import type { HermesOverlayEvent } from './bridge/messageTypes'

interface HermesStatus {
  isListening: boolean
  clients: number
  port: number
  lastError?: string
}

interface Window {
  hermes: {
    onEvent: (callback: (event: HermesOverlayEvent) => void) => () => void
    onStatus: (callback: (status: HermesStatus) => void) => () => void
    getStatus: () => Promise<HermesStatus>
  }
}
