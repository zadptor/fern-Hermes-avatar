import { Application } from '@pixi/app'
import '@pixi/core'
import '@pixi/display'
import '@pixi/sprite'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { getExpressionParameters } from './expressionMapper'
import type { HermesEmotion } from '../bridge/messageTypes'
import type { AvatarDefinition } from './avatarCatalog'

type Live2DInternalModel = {
  coreModel?: {
    setParameterValueById?: (id: string, value: number) => void
    getParameterValueById?: (id: string) => number
  }
  motionManager?: {
    update?: (model: unknown, now: number) => boolean
    state?: { currentGroup?: string }
    groups?: Record<string, string | number>
  }
  focusController?: {
    focus?: (x: number, y: number, instant?: boolean) => void
    update?: (delta: number) => void
  }
  eyeBlink?: {
    updateParameters?: (model: unknown, delta: number) => void
  }
}

type Live2DDisplayModel = {
  anchor: { set(x: number, y?: number): void }
  width: number
  height: number
  scale: { x: number; y: number; set(x: number, y?: number): void }
  position: { set(x: number, y?: number): void }
  internalModel?: Live2DInternalModel
  motion?: (group: string, index?: number) => void
  expression?: (name: string) => void
  destroy?: () => void
}

type CubismCoreGlobal = {
  Memory?: {
    initializeAmountOfMemory?: (size: number) => void
  }
}

const PARAMETER_ALIASES: Record<string, string[]> = {
  ParamAngleX: ['PARAM_ANGLE_X'],
  ParamAngleY: ['PARAM_ANGLE_Y'],
  ParamAngleZ: ['PARAM_ANGLE_Z'],
  ParamBodyAngleX: ['PARAM_BODY_ANGLE_X'],
  ParamBodyAngleY: ['PARAM_BODY_ANGLE_Y'],
  ParamBodyAngleZ: ['PARAM_BODY_ANGLE_Z'],
  ParamBreath: ['PARAM_BREATH'],
  ParamEyeBallX: ['PARAM_EYE_BALL_X'],
  ParamEyeBallY: ['PARAM_EYE_BALL_Y'],
  ParamEyeLOpen: ['PARAM_EYE_L_OPEN'],
  ParamEyeROpen: ['PARAM_EYE_R_OPEN'],
  ParamMouthOpenY: ['PARAM_MOUTH_OPEN_Y']
}

declare global {
  interface Window {
    Live2DCubismCore?: CubismCoreGlobal
  }
}

export class Live2DRenderer {
  private app: Application<HTMLCanvasElement> | null = null
  private model: Live2DDisplayModel | null = null
  private idleFrame = 0
  private live2dFrame = 0
  private gpuFailed = false
  private isSpeaking = false
  private mouthTarget = 0
  private mouthCurrent = 0
  private expressionTargets: Record<string, number> = getExpressionParameters('neutral')
  private expressionCurrent: Record<string, number> = {}
  private modelNaturalWidth = 0
  private modelNaturalHeight = 0
  private lastFrameAt = 0
  private startedAt = 0
  private destroyed = false
  private gaze = { x: 0, y: 0, targetX: 0, targetY: 0, nextAt: 0 }
  private blink = {
    phase: 'idle' as 'idle' | 'closing' | 'opening',
    progress: 0,
    nextIn: 1800
  }

  constructor(private readonly host: HTMLElement) {
    try {
      extensions.add(TickerPlugin)
      this.app = new Application<HTMLCanvasElement>({
        resizeTo: host,
        backgroundAlpha: 0,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio, 2)
      })
      this.host.appendChild(this.app.view)
      this.app.view.className = 'live2d-canvas'
    } catch {
      this.gpuFailed = true
      this.app = null
    }
  }

  async load(avatar: AvatarDefinition): Promise<void> {
    const modelUrl = new URL(avatar.modelPath, window.location.href).href
    if (this.destroyed) return

    if (this.gpuFailed || !this.app) {
      throw new Error('WebGL renderer could not be initialized.')
    }

    try {
      const response = await fetch(modelUrl, { method: 'HEAD' })
      if (this.destroyed) return
      if (!response.ok) throw new Error(`Model file was not found: ${avatar.modelPath}`)
    } catch (err) {
      if (err instanceof Error) throw err
      throw new Error(`Model file was not found: ${avatar.modelPath}`)
    }

    try {
      window.Live2DCubismCore?.Memory?.initializeAmountOfMemory?.(256 * 1024 * 1024)
      const { Live2DFactory, Live2DModel } = await import('pixi-live2d-display/cubism4')
      Live2DModel.registerTicker(Ticker)
      void Live2DFactory

      const raw = await Live2DModel.from(modelUrl, { autoInteract: false })
      if (this.destroyed) {
        raw.destroy()
        return
      }
      this.model = raw as unknown as Live2DDisplayModel
      this.model.anchor.set(0.5, 0.5)
      this.model.scale.set(1)
      this.modelNaturalWidth = this.model.width
      this.modelNaturalHeight = this.model.height
      this.fitModelToStage()
      this.app.stage.addChild(this.model as any)
      this.tryMotion(['Idle', 'idle'])
      this.startIdleMotion()
    } catch (err) {
      console.warn('[Live2D] Could not load Live2D model:', err)
      if (err instanceof Error && err.message === 'Unknown error') {
        throw new Error(
          `Could not create the Live2D core model for ${avatar.name}. The bundled renderer may not support this model's Cubism features.`
        )
      }
      if (err instanceof Error) throw err
      throw new Error(`Could not load ${avatar.name}.`)
    }
  }

  resize(): void {
    if (!this.model) return
    this.fitModelToStage()
  }

  setExpression(name: HermesEmotion): void {
    this.expressionTargets = getExpressionParameters(name)
    if (!this.model) {
      this.host.dataset.emotion = name
      return
    }
    this.tryEmotionMotion(name)
    const expression = this.model.expression
    if (expression) {
      try {
        expression.call(this.model, name)
      } catch {
        this.applyParameters(getExpressionParameters(name))
      }
      return
    }
    this.applyParameters(getExpressionParameters(name))
  }

  setCharacterState(emotion: HermesEmotion, isSpeaking = false): void {
    this.isSpeaking = isSpeaking
    if (!isSpeaking) this.mouthTarget = 0
    void emotion
  }

  setMouthOpen(value: number): void {
    this.mouthTarget = Math.max(0, Math.min(1, value))
  }

  playMotion(name: string): void {
    this.model?.motion?.(name)
  }

  destroy(): void {
    this.destroyed = true
    cancelAnimationFrame(this.idleFrame)
    cancelAnimationFrame(this.live2dFrame)
    this.app?.destroy(true, { children: true, texture: true, baseTexture: true })
  }

  private fitModelToStage(): void {
    if (!this.model) return

    const modelWidth = this.modelNaturalWidth || this.model.width / Math.max(this.model.scale.x, 0.001)
    const modelHeight = this.modelNaturalHeight || this.model.height / Math.max(this.model.scale.y, 0.001)
    const horizontalPadding = 0.92
    const verticalPadding = 0.94
    const scale = Math.min(
      (this.host.clientWidth * horizontalPadding) / modelWidth,
      (this.host.clientHeight * verticalPadding) / modelHeight
    )

    this.model.scale.set(scale)
    this.model.position.set(this.host.clientWidth / 2, this.host.clientHeight / 2)
  }

  private applyParameters(parameters: Record<string, number>): void {
    for (const [id, value] of Object.entries(parameters)) {
      this.setParameter(id, value)
    }
  }

  private setParameter(id: string, value: number): void {
    this.model?.internalModel?.coreModel?.setParameterValueById?.(id, value)
    for (const alias of PARAMETER_ALIASES[id] ?? []) {
      this.model?.internalModel?.coreModel?.setParameterValueById?.(alias, value)
    }
  }

  private startIdleMotion(): void {
    this.startedAt = performance.now()
    this.lastFrameAt = this.startedAt

    const motionManager = this.model?.internalModel?.motionManager
    const originalUpdate = motionManager?.update
    if (motionManager && originalUpdate) {
      motionManager.update = (model: unknown, now: number): boolean => {
        const handled = originalUpdate.call(motionManager, model, now)
        this.applyLive2DFrame(this.normalizeTimestamp(now))
        return handled
      }
      return
    }

    const animate = (): void => {
      this.applyLive2DFrame(performance.now())
      this.live2dFrame = requestAnimationFrame(animate)
    }
    this.live2dFrame = requestAnimationFrame(animate)
  }

  private normalizeTimestamp(now: number): number {
    return now < 100000 ? now * 1000 : now
  }

  private applyLive2DFrame(now: number): void {
    const coreModel = this.model?.internalModel?.coreModel
    if (!coreModel) return

    const deltaMs = this.lastFrameAt ? Math.min(80, Math.max(0, now - this.lastFrameAt)) : 16
    this.lastFrameAt = now
    const dt = deltaMs / 1000
    const seconds = (now - this.startedAt) / 1000

    this.updateGaze(now)
    this.updateExpression(dt)
    const blink = this.updateBlink(deltaMs)

    const speechEnergy = this.isSpeaking ? this.mouthCurrent : this.mouthCurrent * 0.5
    const idleX = Math.sin(seconds * 0.72) * 3.6 + Math.sin(seconds * 1.37) * 1.2
    const idleY = Math.sin(seconds * 0.57) * 2.4
    const idleZ = Math.sin(seconds * 0.48) * 2.2
    const talkPulse = Math.sin(seconds * 14) * speechEnergy

    this.setParameter('ParamBreath', 0.58 + Math.sin(seconds * 2.05) * 0.26)
    this.setParameter('ParamAngleX', idleX + this.gaze.x * 9 + talkPulse * 1.6)
    this.setParameter('ParamAngleY', idleY + this.gaze.y * 6)
    this.setParameter('ParamAngleZ', idleZ + talkPulse * 1.2)
    this.setParameter('ParamBodyAngleX', Math.sin(seconds * 0.66) * 2.8 + this.gaze.x * 3)
    this.setParameter('ParamBodyAngleY', Math.sin(seconds * 0.52) * 1.8)
    this.setParameter('ParamBodyAngleZ', Math.sin(seconds * 0.44) * 2.2 + talkPulse * 1.4)
    this.setParameter('ParamEyeBallX', this.gaze.x)
    this.setParameter('ParamEyeBallY', this.gaze.y)

    for (const [id, value] of Object.entries(this.expressionCurrent)) {
      if (id === 'ParamMouthOpenY' || id === 'ParamEyeLOpen' || id === 'ParamEyeROpen') continue
      this.setParameter(id, value)
    }

    const baseLeftEye = this.expressionCurrent.ParamEyeLOpen ?? 1
    const baseRightEye = this.expressionCurrent.ParamEyeROpen ?? 1
    this.setParameter('ParamEyeLOpen', Math.max(0, Math.min(1.2, baseLeftEye * blink)))
    this.setParameter('ParamEyeROpen', Math.max(0, Math.min(1.2, baseRightEye * blink)))

    const mouthBase = this.expressionCurrent.ParamMouthOpenY ?? 0
    this.mouthCurrent += (this.mouthTarget - this.mouthCurrent) * (this.isSpeaking ? 0.42 : 0.18)
    this.setParameter('ParamMouthOpenY', Math.max(mouthBase, this.mouthCurrent))
  }

  private updateGaze(now: number): void {
    if (now >= this.gaze.nextAt) {
      this.gaze.targetX = Math.random() * 1.7 - 0.85
      this.gaze.targetY = Math.random() * 1.2 - 0.35
      this.gaze.nextAt = now + 900 + Math.random() * 2600
      this.model?.internalModel?.focusController?.focus?.(this.gaze.targetX * 0.45, this.gaze.targetY * 0.35, false)
    }

    this.gaze.x += (this.gaze.targetX - this.gaze.x) * 0.08
    this.gaze.y += (this.gaze.targetY - this.gaze.y) * 0.08
    this.model?.internalModel?.focusController?.update?.(16)
  }

  private updateExpression(dt: number): void {
    const speed = Math.min(1, dt * 7.5)
    const keys = new Set([...Object.keys(this.expressionCurrent), ...Object.keys(this.expressionTargets)])
    for (const key of keys) {
      const target = this.expressionTargets[key] ?? 0
      const current = this.expressionCurrent[key] ?? target
      this.expressionCurrent[key] = current + (target - current) * speed
    }
  }

  private updateBlink(deltaMs: number): number {
    if (this.blink.phase === 'idle') {
      this.blink.nextIn -= deltaMs
      if (this.blink.nextIn > 0) return 1
      this.blink.phase = 'closing'
      this.blink.progress = 0
    }

    if (this.blink.phase === 'closing') {
      this.blink.progress = Math.min(1, this.blink.progress + deltaMs / 72)
      if (this.blink.progress >= 1) {
        this.blink.phase = 'opening'
        this.blink.progress = 0
      }
      return 1 - this.easeOutQuad(this.blink.progress)
    }

    this.blink.progress = Math.min(1, this.blink.progress + deltaMs / 160)
    if (this.blink.progress >= 1) {
      this.blink.phase = 'idle'
      this.blink.progress = 0
      this.blink.nextIn = 2400 + Math.random() * 4800
    }
    return this.easeInQuad(this.blink.progress)
  }

  private easeOutQuad(value: number): number {
    return 1 - (1 - value) * (1 - value)
  }

  private easeInQuad(value: number): number {
    return value * value
  }

  private tryEmotionMotion(emotion: HermesEmotion): void {
    const motionNames: Record<HermesEmotion, string[]> = {
      neutral: ['Idle', 'idle'],
      happy: ['Happy', 'happy', 'Idle', 'idle'],
      thinking: ['Think', 'Thinking', 'think', 'idle'],
      annoyed: ['Angry', 'Annoyed', 'angry', 'idle'],
      sad: ['Sad', 'sad', 'idle']
    }

    this.tryMotion(motionNames[emotion] ?? motionNames.neutral)
  }

  private tryMotion(groups: string[]): void {
    for (const group of groups) {
      try {
        this.model?.motion?.(group, 0)
        return
      } catch {
        // Try the next common Cubism motion group name.
      }
    }
  }
}
