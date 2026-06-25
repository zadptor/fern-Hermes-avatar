export type CharacterAvatarState = 'idle' | 'talking' | 'thinking' | 'happy' | 'wondering'

const STYLE_ID = 'character-avatar-styles'

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.character-avatar {
  position: absolute;
  width: 200px;
  height: 200px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  filter: drop-shadow(0 18px 32px rgba(42, 38, 58, 0.28));
  transform-origin: 50% 62%;
  transition: filter 0.4s ease, opacity 0.4s ease;
  will-change: transform, filter;
}

.character-avatar__portrait {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 28%;
  border-radius: 50% 50% 46% 46%;
  border: 2px solid rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 0 0 1px rgba(92, 62, 122, 0.12),
    0 12px 34px rgba(52, 42, 72, 0.3);
  transition: transform 0.4s ease, filter 0.4s ease, box-shadow 0.4s ease;
}

.character-avatar::before,
.character-avatar::after {
  content: "";
  position: absolute;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.35s ease;
}

.character-avatar::before {
  left: 50%;
  bottom: 34px;
  width: 28px;
  height: 9px;
  border-radius: 999px;
  background: rgba(70, 42, 82, 0.72);
  transform: translateX(-50%) scaleY(0.35);
}

.character-avatar::after {
  inset: -16px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 20% 24%, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px),
    radial-gradient(circle at 82% 35%, rgba(201, 157, 255, 0.85) 0 2px, transparent 3px),
    radial-gradient(circle at 70% 78%, rgba(255, 236, 168, 0.9) 0 2px, transparent 3px);
}

.character-avatar[data-state="idle"] {
  animation: character-avatar-float 4.2s ease-in-out infinite;
}

.character-avatar[data-state="talking"] {
  animation: character-avatar-talk 0.72s ease-in-out infinite;
}

.character-avatar[data-state="talking"]::before {
  opacity: 1;
  animation: character-avatar-mouth 0.34s ease-in-out infinite;
}

.character-avatar[data-state="thinking"] {
  animation: character-avatar-think 3s ease-in-out infinite;
  filter: drop-shadow(0 14px 28px rgba(42, 38, 58, 0.24)) saturate(0.88);
}

.character-avatar[data-state="thinking"] .character-avatar__portrait {
  filter: brightness(0.9) contrast(1.02);
}

.character-avatar[data-state="happy"] {
  animation: character-avatar-happy 1.4s ease-in-out infinite;
  filter: drop-shadow(0 20px 38px rgba(88, 58, 126, 0.32));
}

.character-avatar[data-state="happy"] .character-avatar__portrait {
  filter: brightness(1.12) saturate(1.1);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.24),
    0 16px 40px rgba(85, 61, 125, 0.34);
}

.character-avatar[data-state="happy"]::after {
  opacity: 1;
  animation: character-avatar-sparkle 1.8s ease-in-out infinite;
}

.character-avatar[data-state="wondering"] {
  animation: character-avatar-wonder 2.2s ease-in-out infinite;
}

@keyframes character-avatar-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.01); }
}

@keyframes character-avatar-talk {
  0%, 100% { transform: translateY(0) scale(1); }
  35% { transform: translateY(-6px) scale(1.035); }
  70% { transform: translateY(1px) scale(0.99); }
}

@keyframes character-avatar-mouth {
  0%, 100% { transform: translateX(-50%) scaleY(0.35); }
  50% { transform: translateX(-50%) scaleY(1); }
}

@keyframes character-avatar-think {
  0%, 100% { transform: translateY(0) rotate(-2deg) scale(0.98); }
  50% { transform: translateY(-5px) rotate(2deg) scale(0.98); }
}

@keyframes character-avatar-happy {
  0%, 100% { transform: translateY(0) scale(1.03); }
  45% { transform: translateY(-10px) scale(1.08); }
}

@keyframes character-avatar-sparkle {
  0%, 100% { transform: rotate(0deg) scale(0.96); opacity: 0.55; }
  50% { transform: rotate(10deg) scale(1.04); opacity: 1; }
}

@keyframes character-avatar-wonder {
  0%, 100% { transform: translateY(0) rotate(-5deg); }
  50% { transform: translateY(-7px) rotate(6deg); }
}
`
  document.head.appendChild(style)
}

export class CharacterAvatar {
  private container: HTMLDivElement
  private img: HTMLImageElement
  private currentState: CharacterAvatarState = 'idle'

  constructor(host: HTMLElement) {
    ensureStyles()

    this.container = document.createElement('div')
    this.container.className = 'character-avatar'

    this.img = document.createElement('img')
    this.img.className = 'character-avatar__portrait'
    this.img.src = new URL('../assets/fern-character.jpg', import.meta.url).href
    this.img.alt = 'Fern'

    this.container.appendChild(this.img)
    host.appendChild(this.container)
    this.setState('idle')
  }

  setState(state: CharacterAvatarState): void {
    if (this.currentState === state && this.container.dataset.state === state) return
    this.container.dataset.state = state
    this.currentState = state
  }

  destroy(): void {
    this.container.remove()
  }
}
