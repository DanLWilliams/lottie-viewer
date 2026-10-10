export type LottieAnimationData = Record<string, unknown>

export type LottieFile = {
  id: string
  name: string
  size: number
  originalData: LottieAnimationData
  data: LottieAnimationData
  frameCount: number | null
  dataVersion: number
  isDirty: boolean
}
