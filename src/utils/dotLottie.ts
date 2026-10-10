import { strFromU8, unzipSync } from 'fflate'
import type { LottieAnimationData } from '../types'
import { parseLottieJson } from './lottie'

type ManifestAnimation = { id: string; name?: string }

type DotLottieManifest = {
  animations?: ManifestAnimation[]
  initial?: { animation?: string }
}

export type ParsedAnimation = {
  displayName: string
  data: LottieAnimationData
}

function normalizeZipPath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\/+/, '')
}

function findZipEntry(
  files: Record<string, Uint8Array>,
  path: string,
): Uint8Array | undefined {
  const normalized = normalizeZipPath(path)
  if (files[normalized]) return files[normalized]
  const lower = normalized.toLowerCase()
  const key = Object.keys(files).find(
    (k) => normalizeZipPath(k).toLowerCase() === lower,
  )
  return key ? files[key] : undefined
}

function readZipText(files: Record<string, Uint8Array>, path: string): string {
  const entry = findZipEntry(files, path)
  if (!entry) throw new Error(`Missing ${path} in .lottie archive.`)
  return strFromU8(entry)
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function inlineZipAssets(
  data: LottieAnimationData,
  files: Record<string, Uint8Array>,
): void {
  const assets = data.assets
  if (!Array.isArray(assets)) return

  for (const raw of assets) {
    if (typeof raw !== 'object' || raw === null) continue
    const asset = raw as Record<string, unknown>
    if (asset.e === 1) continue

    const u = String(asset.u ?? '')
    const p = String(asset.p ?? '')
    if (!p) continue

    const candidates = [
      normalizeZipPath(`${u}${p}`),
      `i/${p}`,
      `images/${p}`,
      `a/${p}`,
      `u/${p}`,
      p,
    ]

    let entry: Uint8Array | undefined
    for (const candidate of candidates) {
      entry = findZipEntry(files, candidate)
      if (entry) break
    }

    if (!entry) continue

    asset.p = bytesToBase64(entry)
    asset.e = 1
    asset.u = ''
  }
}

function animationJsonCandidates(id: string): string[] {
  return [
    `a/${id}.json`,
    `animations/${id}.json`,
    `a/${id}`,
    `animations/${id}`,
  ]
}

function loadAnimationFromZip(
  files: Record<string, Uint8Array>,
  id: string,
): LottieAnimationData {
  for (const path of animationJsonCandidates(id)) {
    const entry = findZipEntry(files, path)
    if (entry) {
      const data = parseLottieJson(strFromU8(entry))
      inlineZipAssets(data, files)
      return data
    }
  }
  throw new Error(`Animation "${id}" was listed in manifest but not found in archive.`)
}

function discoverAnimationIds(files: Record<string, Uint8Array>): string[] {
  const ids: string[] = []
  for (const path of Object.keys(files)) {
    const normalized = normalizeZipPath(path).toLowerCase()
    const match =
      normalized.match(/^a\/(.+)\.json$/) ??
      normalized.match(/^animations\/(.+)\.json$/)
    if (match?.[1]) ids.push(match[1])
  }
  return [...new Set(ids)]
}

function parseManifest(files: Record<string, Uint8Array>): DotLottieManifest {
  const text = readZipText(files, 'manifest.json')
  const parsed: unknown = JSON.parse(text)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid manifest.json in .lottie file.')
  }
  return parsed as DotLottieManifest
}

export async function readDotLottieFile(file: File): Promise<ParsedAnimation[]> {
  const buffer = new Uint8Array(await file.arrayBuffer())
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(buffer)
  } catch {
    throw new Error('This .lottie file could not be read as a ZIP archive.')
  }

  if (!findZipEntry(files, 'manifest.json')) {
    throw new Error('Not a valid .lottie file (missing manifest.json).')
  }

  const manifest = parseManifest(files)
  const baseName = file.name.replace(/\.lottie$/i, '')

  let animationIds: string[] = []
  if (manifest.animations?.length) {
    animationIds = manifest.animations.map((a) => a.id)
  } else {
    animationIds = discoverAnimationIds(files)
  }

  if (animationIds.length === 0) {
    throw new Error('No animations found inside this .lottie file.')
  }

  const initialId = manifest.initial?.animation
  if (initialId && animationIds.includes(initialId)) {
    animationIds = [
      initialId,
      ...animationIds.filter((id) => id !== initialId),
    ]
  }

  const nameById = new Map<string, string>()
  for (const anim of manifest.animations ?? []) {
    if (anim.name) nameById.set(anim.id, anim.name)
  }

  return animationIds.map((id) => {
    const data = loadAnimationFromZip(files, id)
    const label = nameById.get(id) ?? id
    const displayName =
      animationIds.length === 1
        ? file.name
        : `${baseName}.lottie · ${label}`
    return { displayName, data }
  })
}
