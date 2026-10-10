import type { LottieAnimationData } from '../types'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function getFrameCount(data: LottieAnimationData): number | null {
  const ip = data.ip
  const op = data.op
  if (typeof ip === 'number' && typeof op === 'number') {
    return Math.max(0, Math.round(op - ip))
  }
  return null
}

export function parseLottieJson(text: string): LottieAnimationData {
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Lottie JSON must be an object.')
  }
  const data = parsed as LottieAnimationData
  if (!('v' in data) && !('layers' in data)) {
    throw new Error('This file does not look like a Lottie animation.')
  }
  return data
}

export async function readLottieFile(file: File): Promise<LottieAnimationData> {
  const text = await file.text()
  return parseLottieJson(text)
}
