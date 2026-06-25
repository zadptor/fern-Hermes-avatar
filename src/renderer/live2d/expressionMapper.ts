import type { HermesEmotion } from '../bridge/messageTypes'

export type Live2DParameterSet = Record<string, number>

export const expressionParameters: Record<HermesEmotion, Live2DParameterSet> = {
  neutral: {
    ParamAngleZ: 0,
    ParamMouthForm: 0,
    ParamBrowLY: 0,
    ParamBrowRY: 0
  },
  happy: {
    ParamMouthOpenY: 0.25,
    ParamMouthForm: 0.65,
    ParamEyeLOpen: 1.1,
    ParamEyeROpen: 1.1
  },
  thinking: {
    ParamEyeLOpen: 0.75,
    ParamEyeROpen: 0.75,
    ParamAngleZ: -8,
    ParamBrowLY: 0.2,
    ParamBrowRY: 0.2
  },
  annoyed: {
    ParamBrowLY: -0.55,
    ParamBrowRY: -0.55,
    ParamMouthForm: -0.35,
    ParamAngleZ: 4
  },
  sad: {
    ParamEyeLOpen: 0.7,
    ParamEyeROpen: 0.7,
    ParamMouthForm: -0.65,
    ParamBrowLY: -0.25,
    ParamBrowRY: -0.25
  }
}

export function getExpressionParameters(emotion: HermesEmotion): Live2DParameterSet {
  return expressionParameters[emotion] ?? expressionParameters.neutral
}
