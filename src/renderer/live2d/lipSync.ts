export interface LipSyncTarget {
  setMouthOpen(value: number): void
}

const phonemeBoost: Record<string, number> = {
  a: 0.18,
  e: 0.12,
  i: -0.05,
  o: 0.16,
  u: 0.08,
  m: -0.18,
  p: -0.15,
  b: -0.12
}

export class LipSyncController {
  private current = 0
  private target = 0
  private frame = 0

  constructor(private readonly targetModel: LipSyncTarget) {}

  setInput(volume: number, phoneme?: string): void {
    const normalized = Math.max(0, Math.min(1, volume))
    const boost = phoneme ? (phonemeBoost[phoneme.toLowerCase()] ?? 0) : 0
    this.target = Math.max(0, Math.min(1, normalized + boost))
    this.start()
  }

  stop(): void {
    this.target = 0
    this.start()
  }

  destroy(): void {
    cancelAnimationFrame(this.frame)
  }

  private start(): void {
    if (this.frame) return
    this.frame = requestAnimationFrame(this.tick)
  }

  private tick = (): void => {
    this.current += (this.target - this.current) * 0.28
    if (Math.abs(this.current - this.target) < 0.01) {
      this.current = this.target
    }

    this.targetModel.setMouthOpen(this.current)

    if (this.current === this.target && this.target === 0) {
      this.frame = 0
      return
    }

    this.frame = requestAnimationFrame(this.tick)
  }
}
