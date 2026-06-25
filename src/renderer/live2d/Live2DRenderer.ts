import { Application } from '@pixi/app'
import '@pixi/core'
import '@pixi/display'
import '@pixi/sprite'
import { extensions } from '@pixi/extensions'
import { Ticker, TickerPlugin } from '@pixi/ticker'
import { Live2DFactory, Live2DModel } from 'pixi-live2d-display/cubism4'
import { getExpressionParameters } from './expressionMapper'
import type { HermesEmotion } from '../bridge/messageTypes'

type Live2DInternalModel = {
  coreModel?: {
    setParameterValueById?: (id: string, value: number) => void
  }
}

type Live2DDisplayModel = InstanceType<typeof Live2DModel> & {
  internalModel?: Live2DInternalModel
  motion?: (group: string, index?: number) => void
  expression?: (name: string) => void
}

const MODEL_URL = new URL('model3.json', window.location.href).href

extensions.add(TickerPlugin)
Live2DModel.registerTicker(Ticker)
void Live2DFactory

export class Live2DRenderer {
  private app: Application<HTMLCanvasElement> | null = null
  private model: Live2DDisplayModel | null = null
  private fallback: HTMLDivElement | null = null
  private idleFrame = 0
  private gpuFailed = false

  constructor(private readonly host: HTMLElement) {
    try {
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
      this.showFallback()
    }
  }

  async load(): Promise<void> {
    if (this.gpuFailed) return
    try {
      const response = await fetch(MODEL_URL, { method: 'HEAD' })
      if (!response.ok) throw new Error('No Live2D model found.')

      const raw = await Live2DModel.from(MODEL_URL, { autoInteract: false })
      this.model = raw as unknown as Live2DDisplayModel
      this.model.anchor.set(0.5, 0.5)
      this.model.scale.set(this.computeModelScale())
      this.model.position.set(this.host.clientWidth / 2, this.host.clientHeight * 0.58)
      this.app?.stage.addChild(this.model as any)
      this.startIdleMotion()
    } catch {
      this.showFallback()
    }
  }

  resize(): void {
    if (!this.model) return

    this.model.scale.set(this.computeModelScale())
    this.model.position.set(this.host.clientWidth / 2, this.host.clientHeight * 0.58)
  }

  setExpression(name: HermesEmotion): void {
    if (!this.model) {
      this.host.dataset.emotion = name
      return
    }

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

  setMouthOpen(value: number): void {
    this.setParameter('ParamMouthOpenY', Math.max(0, Math.min(1, value)))
  }

  playMotion(name: string): void {
    this.model?.motion?.(name)
  }

  destroy(): void {
    cancelAnimationFrame(this.idleFrame)
    this.app?.destroy(true, { children: true, texture: true, baseTexture: true })
    this.fallback?.remove()
  }

  private computeModelScale(): number {
    return Math.min(this.host.clientWidth / 460, this.host.clientHeight / 700)
  }

  private applyParameters(parameters: Record<string, number>): void {
    for (const [id, value] of Object.entries(parameters)) {
      this.setParameter(id, value)
    }
  }

  private setParameter(id: string, value: number): void {
    this.model?.internalModel?.coreModel?.setParameterValueById?.(id, value)
  }

  private startIdleMotion(): void {
    const startedAt = performance.now()
    const animate = (): void => {
      const seconds = (performance.now() - startedAt) / 1000
      this.setParameter('ParamBodyAngleX', Math.sin(seconds * 1.4) * 2)
      this.setParameter('ParamBreath', 0.5 + Math.sin(seconds * 2.1) * 0.25)
      this.idleFrame = requestAnimationFrame(animate)
    }

    this.idleFrame = requestAnimationFrame(animate)
  }

  private showFallback(): void {
    this.fallback = document.createElement('div')
    this.fallback.className = 'fallback-avatar'
    this.fallback.textContent = '✦'
    this.host.appendChild(this.fallback)
  }
}
