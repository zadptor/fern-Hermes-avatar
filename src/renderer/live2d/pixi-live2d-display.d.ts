declare module 'pixi-live2d-display/cubism4' {
  import type { DisplayObject } from '@pixi/display'
  import type { Ticker } from '@pixi/ticker'

  export const Live2DFactory: unknown

  export class Live2DModel extends DisplayObject {
    static from(source: string, options?: Record<string, unknown>): Promise<Live2DModel>
    static registerTicker(ticker: typeof Ticker): void

    anchor: { set(x: number, y?: number): void }
    scale: { set(x: number, y?: number): void }
    position: { set(x: number, y?: number): void }
  }
}
