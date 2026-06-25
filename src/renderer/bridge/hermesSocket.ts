import { useAvatarStore } from '../stores/avatarStore'

export async function startHermesBridge(): Promise<void> {
  const store = useAvatarStore()

  if (!window.hermes) {
    store.setConnection(false)
    return
  }

  window.hermes.onEvent((event) => store.handleEvent(event))
  window.hermes.onStatus((status) => store.setConnection(status.isListening && status.clients > 0))

  const status = await window.hermes.getStatus()
  store.setConnection(status.isListening && status.clients > 0)
}
