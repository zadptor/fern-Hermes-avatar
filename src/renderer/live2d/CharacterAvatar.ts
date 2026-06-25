export type CharacterAvatarState = 'idle' | 'talking' | 'thinking' | 'happy' | 'wondering'

const STYLE_ID = 'character-avatar-styles'

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = `
.character-avatar {
  position: absolute;
  left: 50%;
  top: 50%;
  width: min(72vw, 280px);
  height: min(72vw, 280px);
  transform: translate(-50%, -50%);
  pointer-events: none;
  --mouth-open: 0;
  --talk-energy: 0;
}

.character-avatar__body {
  position: absolute;
  inset: 0;
  transform-origin: 50% 64%;
  filter: drop-shadow(0 22px 28px rgba(42, 38, 58, 0.24));
  transition: filter 0.4s ease, opacity 0.4s ease;
  will-change: transform, filter;
}

.character-avatar__portrait {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: contain;
  object-position: center;
  transform-origin: 50% 64%;
  transition: filter 0.4s ease;
  animation: character-avatar-hair 3.8s ease-in-out infinite;
}

.character-avatar__shadow {
  position: absolute;
  left: 16%;
  right: 16%;
  bottom: -5%;
  height: 9%;
  border-radius: 50%;
  background: rgba(46, 34, 56, 0.18);
  filter: blur(6px);
  animation: character-avatar-shadow 4.1s ease-in-out infinite;
}

.character-avatar__mouth {
  position: absolute;
  left: 50%;
  top: 51.5%;
  width: 12%;
  height: 2.8%;
  border-radius: 999px 999px 60% 60%;
  background: rgba(80, 37, 62, 0.78);
  opacity: calc(0.2 + var(--mouth-open) * 0.8);
  transform: translateX(-50%) scaleY(calc(0.35 + var(--mouth-open) * 2.8));
  transform-origin: 50% 50%;
  box-shadow: inset 0 -1px 0 rgba(255, 179, 190, 0.4);
}

.character-avatar__eye {
  position: absolute;
  top: 34%;
  width: 11%;
  height: 12%;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
}

.character-avatar__eye--left {
  left: 39.5%;
}

.character-avatar__eye--right {
  right: 39.5%;
}

.character-avatar__eye::before,
.character-avatar__eye::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
}

.character-avatar__eye::before {
  border-top: 4px solid rgba(58, 20, 65, 0.72);
  transform: translateY(-42%);
  animation: character-avatar-blink 5.4s ease-in-out infinite;
}

.character-avatar__eye::after {
  width: 33%;
  height: 33%;
  left: 48%;
  top: 19%;
  background: rgba(255, 255, 255, 0.86);
  transform: translate(-50%, -50%);
  animation: character-avatar-glance 4.6s ease-in-out infinite;
}

.character-avatar__blush {
  position: absolute;
  top: 45.5%;
  width: 13%;
  height: 4%;
  border-radius: 999px;
  background: rgba(255, 128, 164, 0.22);
  opacity: 0;
  filter: blur(1px);
  transition: opacity 0.25s ease;
}

.character-avatar__blush--left {
  left: 34%;
}

.character-avatar__blush--right {
  right: 34%;
}

.character-avatar__spark {
  position: absolute;
  width: 5%;
  height: 5%;
  opacity: 0;
  transform: rotate(45deg) scale(0.7);
}

.character-avatar__spark::before,
.character-avatar__spark::after {
  content: "";
  position: absolute;
  inset: 45% 0;
  background: rgba(255, 244, 175, 0.9);
  border-radius: 999px;
}

.character-avatar__spark::after {
  transform: rotate(90deg);
}

.character-avatar__spark--left {
  left: 24%;
  top: 24%;
}

.character-avatar__spark--right {
  right: 21%;
  top: 31%;
}

.character-avatar[data-state="idle"] .character-avatar__body {
  animation: character-avatar-float 4.2s ease-in-out infinite;
}

.character-avatar[data-state="talking"] .character-avatar__body {
  animation: character-avatar-talk 0.72s ease-in-out infinite;
}

.character-avatar[data-state="talking"] .character-avatar__mouth {
  animation: character-avatar-mouth 0.24s ease-in-out infinite;
}

.character-avatar[data-state="thinking"] .character-avatar__body {
  animation: character-avatar-think 3s ease-in-out infinite;
  filter: drop-shadow(0 14px 28px rgba(42, 38, 58, 0.24)) saturate(0.88);
}

.character-avatar[data-state="thinking"] .character-avatar__portrait {
  filter: brightness(0.9) contrast(1.02);
}

.character-avatar[data-state="happy"] .character-avatar__body {
  animation: character-avatar-happy 1.4s ease-in-out infinite;
  filter: drop-shadow(0 20px 38px rgba(88, 58, 126, 0.32));
}

.character-avatar[data-state="happy"] .character-avatar__portrait {
  filter: brightness(1.12) saturate(1.1);
}

.character-avatar[data-state="happy"] .character-avatar__blush,
.character-avatar[data-state="happy"] .character-avatar__spark {
  opacity: 1;
  animation: character-avatar-sparkle 1.8s ease-in-out infinite;
}

.character-avatar[data-state="wondering"] .character-avatar__body {
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
  0%, 100% {
    transform: translateX(-50%) scaleY(calc(0.45 + var(--mouth-open) * 1.2));
  }
  50% {
    transform: translateX(-50%) scaleY(calc(1.1 + var(--mouth-open) * 3.1));
  }
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

@keyframes character-avatar-hair {
  0%, 100% { transform: skewX(0deg) translateX(0); }
  50% { transform: skewX(-1.2deg) translateX(1px); }
}

@keyframes character-avatar-shadow {
  0%, 100% { transform: scaleX(1); opacity: 0.65; }
  50% { transform: scaleX(0.86); opacity: 0.42; }
}

@keyframes character-avatar-blink {
  0%, 88%, 100% { transform: translateY(-42%); }
  91%, 94% { transform: translateY(0); }
}

@keyframes character-avatar-glance {
  0%, 100% { transform: translate(-50%, -50%); }
  30% { transform: translate(-78%, -40%); }
  62% { transform: translate(-26%, -62%); }
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

    const body = document.createElement('div')
    body.className = 'character-avatar__body'

    const shadow = document.createElement('span')
    shadow.className = 'character-avatar__shadow'

    this.img = document.createElement('img')
    this.img.className = 'character-avatar__portrait'
    this.img.src = new URL('../assets/fern-character.jpg', import.meta.url).href
    this.img.alt = 'Fern'

    body.appendChild(this.img)
    body.appendChild(this.createPart('span', 'character-avatar__eye character-avatar__eye--left'))
    body.appendChild(this.createPart('span', 'character-avatar__eye character-avatar__eye--right'))
    body.appendChild(this.createPart('span', 'character-avatar__mouth'))
    body.appendChild(this.createPart('span', 'character-avatar__blush character-avatar__blush--left'))
    body.appendChild(this.createPart('span', 'character-avatar__blush character-avatar__blush--right'))
    body.appendChild(this.createPart('span', 'character-avatar__spark character-avatar__spark--left'))
    body.appendChild(this.createPart('span', 'character-avatar__spark character-avatar__spark--right'))

    this.container.appendChild(shadow)
    this.container.appendChild(body)
    host.appendChild(this.container)
    this.setState('idle')
  }

  setState(state: CharacterAvatarState): void {
    if (this.currentState === state && this.container.dataset.state === state) return
    this.container.dataset.state = state
    this.currentState = state
  }

  setMouthOpen(value: number): void {
    const clamped = Math.max(0, Math.min(1, value))
    this.container.style.setProperty('--mouth-open', clamped.toFixed(3))
  }

  destroy(): void {
    this.container.remove()
  }

  private createPart<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    className: string
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName)
    element.className = className
    return element
  }
}
