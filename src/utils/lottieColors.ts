import type { LottieAnimationData } from '../types'

const COLOR_EPSILON = 0.004

export type Rgba = [number, number, number, number]
export type ColorEncoding = 'unit' | 'byte'

export type ColorRef = {
  path: (string | number)[]
  rgba: Rgba
  layerPath: string
  kind: 'fill' | 'stroke' | 'text' | 'solid' | 'other'
  encoding: ColorEncoding
  /** Raw components length at path (3 or 4), or 0 for hex string solids */
  components: 0 | 3 | 4
  /** When set, RGB lives inside a larger array (gradient stops) starting at this index. */
  spanStart?: number
}

export type ColorSwatch = {
  id: string
  rgba: Rgba
  hex: string
  count: number
  refs: ColorRef[]
}

export type LottieLayerOption = {
  id: string
  name: string
  depth: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

function detectEncoding(values: number[]): ColorEncoding {
  return Math.max(...values.map((n) => Math.abs(n))) > 1.01 ? 'byte' : 'unit'
}

export function isColorArray(value: unknown): value is number[] {
  if (!Array.isArray(value)) return false
  if (value.length !== 3 && value.length !== 4) return false
  if (!value.every((n) => typeof n === 'number' && !Number.isNaN(n))) return false
  const max = Math.max(...value.map((n) => Math.abs(n)))
  if (max <= 1.01) {
    return value.every((n) => n >= -0.01 && n <= 1.01)
  }
  if (max <= 255.01) {
    return value.every((n) => n >= 0 && n <= 255.01)
  }
  return false
}

export function normalizeColor(value: number[]): Rgba {
  const encoding = detectEncoding(value)
  const [r, g, b, a = encoding === 'byte' ? 255 : 1] = value
  if (encoding === 'byte') {
    return [r / 255, g / 255, b / 255, clamp01(a / 255)]
  }
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)]
}

export function rgbaToHex([r, g, b]: Rgba): string {
  const toByte = (c: number) => Math.round(clamp01(c) * 255)
  return `#${[toByte(r), toByte(g), toByte(b)]
    .map((x) => x.toString(16).padStart(2, '0'))
    .join('')}`
    .toLowerCase()
}

export function normalizePickerHex(hex: string): string | null {
  let cleaned = hex.trim().toLowerCase()
  if (cleaned.startsWith('#')) cleaned = cleaned.slice(1)
  if (/^[0-9a-f]{8}$/.test(cleaned)) cleaned = cleaned.slice(0, 6)
  if (/^[0-9a-f]{6}$/.test(cleaned)) return `#${cleaned}`
  if (/^[0-9a-f]{3}$/.test(cleaned)) {
    return `#${cleaned[0]}${cleaned[0]}${cleaned[1]}${cleaned[1]}${cleaned[2]}${cleaned[2]}`
  }
  return null
}

export function hexToRgba(hex: string): Rgba | null {
  const normalized = normalizePickerHex(hex)
  if (!normalized) return null
  const cleaned = normalized.slice(1)
  const r = parseInt(cleaned.slice(0, 2), 16) / 255
  const g = parseInt(cleaned.slice(2, 4), 16) / 255
  const b = parseInt(cleaned.slice(4, 6), 16) / 255
  return [r, g, b, 1]
}

function parseSolidColorString(value: string): Rgba | null {
  return hexToRgba(value.startsWith('#') ? value : `#${value}`)
}

export function colorsMatch(a: Rgba, b: Rgba): boolean {
  return (
    Math.abs(a[0] - b[0]) < COLOR_EPSILON &&
    Math.abs(a[1] - b[1]) < COLOR_EPSILON &&
    Math.abs(a[2] - b[2]) < COLOR_EPSILON &&
    Math.abs(a[3] - b[3]) < COLOR_EPSILON
  )
}

function pushColorRef(
  refs: ColorRef[],
  path: (string | number)[],
  rgba: Rgba,
  layerPath: string,
  kind: ColorRef['kind'],
  raw: number[] | null,
) {
  const encoding =
    raw === null ? 'unit' : detectEncoding(raw)
  const components =
    raw === null ? 0 : (raw.length === 4 ? 4 : 3)
  refs.push({ path, rgba, layerPath, kind, encoding, components })
}

function walkColorProperty(
  value: unknown,
  path: (string | number)[],
  layerPath: string,
  kind: ColorRef['kind'],
  refs: ColorRef[],
) {
  if (isColorArray(value)) {
    pushColorRef(
      refs,
      path,
      normalizeColor(value),
      layerPath,
      kind,
      value,
    )
    return
  }
  if (!isRecord(value)) return

  const k = value.k
  if (isColorArray(k)) {
    pushColorRef(
      refs,
      [...path, 'k'],
      normalizeColor(k),
      layerPath,
      kind,
      k,
    )
    return
  }

  if (Array.isArray(k)) {
    k.forEach((frame, index) => {
      if (isRecord(frame)) {
        if (isColorArray(frame.s)) {
          pushColorRef(
            refs,
            [...path, 'k', index, 's'],
            normalizeColor(frame.s),
            layerPath,
            kind,
            frame.s,
          )
        }
        if (isColorArray(frame.e)) {
          pushColorRef(
            refs,
            [...path, 'k', index, 'e'],
            normalizeColor(frame.e),
            layerPath,
            kind,
            frame.e,
          )
        }
      }
    })
  }
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function pushGradientStops(
  values: number[],
  path: (string | number)[],
  stopCount: number,
  layerPath: string,
  kind: ColorRef['kind'],
  refs: ColorRef[],
) {
  const count = Math.min(stopCount, Math.floor(values.length / 4))
  for (let i = 0; i < count; i += 1) {
    const spanStart = i * 4 + 1
    const rgb = [values[spanStart], values[spanStart + 1], values[spanStart + 2]]
    if (!isColorArray(rgb)) continue
    pushColorRef(refs, path, normalizeColor(rgb), layerPath, kind, rgb)
    refs[refs.length - 1].spanStart = spanStart
    refs[refs.length - 1].components = 3
  }
}

function walkGradient(
  node: Record<string, unknown>,
  path: (string | number)[],
  layerPath: string,
  kind: ColorRef['kind'],
  refs: ColorRef[],
) {
  const gradient = node.g
  if (!isRecord(gradient) || typeof gradient.p !== 'number') return
  const stopCount = gradient.p
  const colorProp = gradient.k
  if (isNumberArray(colorProp)) {
    pushGradientStops(
      colorProp,
      [...path, 'g', 'k'],
      stopCount,
      layerPath,
      kind,
      refs,
    )
    return
  }
  if (!isRecord(colorProp)) return
  const keyframes = colorProp.k
  if (isNumberArray(keyframes)) {
    pushGradientStops(
      keyframes,
      [...path, 'g', 'k', 'k'],
      stopCount,
      layerPath,
      kind,
      refs,
    )
    return
  }
  if (!Array.isArray(keyframes)) return
  keyframes.forEach((frame, index) => {
    if (!isRecord(frame)) return
    if (isNumberArray(frame.s)) {
      pushGradientStops(
        frame.s,
        [...path, 'g', 'k', 'k', index, 's'],
        stopCount,
        layerPath,
        kind,
        refs,
      )
    }
    if (isNumberArray(frame.e)) {
      pushGradientStops(
        frame.e,
        [...path, 'g', 'k', 'k', index, 'e'],
        stopCount,
        layerPath,
        kind,
        refs,
      )
    }
  })
}

function layerLabel(layer: Record<string, unknown>, index: number): string {
  const name = layer.nm
  if (typeof name === 'string' && name.trim()) return name.trim()
  const ind = layer.ind
  if (typeof ind === 'number') return `Layer ${ind}`
  return `Layer ${index + 1}`
}

type WalkContext = {
  layerPath: string
  layers: LottieLayerOption[]
  refs: ColorRef[]
  seenLayerIds: Set<string>
}

function registerLayer(ctx: WalkContext, name: string, depth: number) {
  const id = ctx.layerPath || name
  if (ctx.seenLayerIds.has(id)) return
  ctx.seenLayerIds.add(id)
  ctx.layers.push({ id, name, depth })
}

function walkNode(
  node: unknown,
  path: (string | number)[],
  ctx: WalkContext,
  depth: number,
) {
  if (Array.isArray(node)) {
    const isLayersArray =
      path.length >= 1 && path[path.length - 1] === 'layers'

    node.forEach((item, index) => {
      if (isLayersArray && isRecord(item)) {
        const name = layerLabel(item, index)
        const nextPath = ctx.layerPath
          ? `${ctx.layerPath} / ${name}`
          : name
        const childCtx: WalkContext = {
          ...ctx,
          layerPath: nextPath,
        }
        registerLayer(childCtx, name, depth)
        walkNode(item, [...path, index], childCtx, depth + 1)
        return
      }
      walkNode(item, [...path, index], ctx, depth)
    })
    return
  }

  if (!isRecord(node)) return

  if (node.ty === 'fl' && node.c !== undefined) {
    walkColorProperty(node.c, [...path, 'c'], ctx.layerPath, 'fill', ctx.refs)
  }
  if (node.ty === 'st' && node.c !== undefined) {
    walkColorProperty(node.c, [...path, 'c'], ctx.layerPath, 'stroke', ctx.refs)
  }
  if (node.ty === 'gf' || node.ty === 'gs') {
    walkGradient(
      node,
      path,
      ctx.layerPath,
      node.ty === 'gf' ? 'fill' : 'stroke',
      ctx.refs,
    )
  }

  if (node.ty === 1 && typeof node.sc === 'string') {
    const rgba = parseSolidColorString(node.sc)
    if (rgba) {
      pushColorRef(
        ctx.refs,
        [...path, 'sc'],
        rgba,
        ctx.layerPath,
        'solid',
        null,
      )
    }
  }

  if (isColorArray(node.fc)) {
    pushColorRef(
      ctx.refs,
      [...path, 'fc'],
      normalizeColor(node.fc),
      ctx.layerPath,
      'text',
      node.fc,
    )
  } else if (isRecord(node.fc)) {
    walkColorProperty(node.fc, [...path, 'fc'], ctx.layerPath, 'text', ctx.refs)
  }

  if (isColorArray(node.sc)) {
    pushColorRef(
      ctx.refs,
      [...path, 'sc'],
      normalizeColor(node.sc),
      ctx.layerPath,
      'stroke',
      node.sc,
    )
  } else if (isRecord(node.sc)) {
    walkColorProperty(node.sc, [...path, 'sc'], ctx.layerPath, 'stroke', ctx.refs)
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'layers' && Array.isArray(value)) {
      walkNode(value, [...path, key], ctx, depth)
      continue
    }
    walkNode(value, [...path, key], ctx, depth)
  }
}

export function stableSwatchId(refs: ColorRef[]): string {
  return refs
    .map((ref) => ref.path.join('/'))
    .sort()
    .join('|')
}

export function analyzeLottieColors(data: LottieAnimationData): {
  swatches: ColorSwatch[]
  layers: LottieLayerOption[]
  refs: ColorRef[]
} {
  const refs: ColorRef[] = []
  const layers: LottieLayerOption[] = []
  const ctx: WalkContext = {
    layerPath: '',
    layers,
    refs,
    seenLayerIds: new Set(),
  }

  walkNode(data, [], ctx, 0)

  const swatchMap = new Map<string, ColorSwatch>()

  for (const ref of refs) {
    const hex = rgbaToHex(ref.rgba)
    const existing = swatchMap.get(hex)
    if (existing) {
      existing.count += 1
      existing.refs.push(ref)
      existing.id = stableSwatchId(existing.refs)
    } else {
      const refs = [ref]
      swatchMap.set(hex, {
        id: stableSwatchId(refs),
        rgba: ref.rgba,
        hex,
        count: 1,
        refs,
      })
    }
  }

  const swatches = [...swatchMap.values()].sort((a, b) => b.count - a.count)

  return { swatches, layers, refs }
}

function getAtPath(root: unknown, path: (string | number)[]): unknown {
  let current: unknown = root
  for (const segment of path) {
    if (!isRecord(current) && !Array.isArray(current)) return undefined
    if (Array.isArray(current)) {
      current = current[segment as number]
    } else {
      current = current[segment]
    }
  }
  return current
}

function encodeColorValue(ref: ColorRef, rgba: Rgba): number[] | string {
  if (ref.components === 0) {
    return rgbaToHex(rgba)
  }

  const existing = ref.encoding
  const withAlpha = ref.components === 4

  if (existing === 'byte') {
    const base = [
      Math.round(clamp01(rgba[0]) * 255),
      Math.round(clamp01(rgba[1]) * 255),
      Math.round(clamp01(rgba[2]) * 255),
    ]
    if (withAlpha) {
      return [...base, Math.round(clamp01(rgba[3]) * 255)]
    }
    return base
  }

  if (withAlpha) {
    return [rgba[0], rgba[1], rgba[2], rgba[3]]
  }
  return [rgba[0], rgba[1], rgba[2]]
}

function preserveAlphaFromExisting(
  ref: ColorRef,
  root: LottieAnimationData,
  rgba: Rgba,
): Rgba {
  if (ref.components !== 4) return rgba
  const existing = getAtPath(root, ref.path)
  if (!isColorArray(existing) || existing.length !== 4) return rgba
  const encoding = detectEncoding(existing)
  const alpha =
    encoding === 'byte' ? clamp01(existing[3] / 255) : clamp01(existing[3])
  return [rgba[0], rgba[1], rgba[2], alpha]
}

function getParentAtPath(
  root: unknown,
  path: (string | number)[],
): { parent: Record<string, unknown> | unknown[]; last: string | number } | null {
  if (path.length === 0) return null
  let current: unknown = root
  for (let i = 0; i < path.length - 1; i++) {
    const segment = path[i]
    if (Array.isArray(current)) {
      current = current[segment as number]
    } else if (isRecord(current)) {
      current = current[segment]
    } else {
      return null
    }
    if (current === undefined || current === null) return null
  }
  const last = path[path.length - 1]
  if (Array.isArray(current) || isRecord(current)) {
    return { parent: current, last }
  }
  return null
}

function setColorRefOnClone(
  clone: LottieAnimationData,
  ref: ColorRef,
  rgba: Rgba,
): boolean {
  const finalRgba = preserveAlphaFromExisting(ref, clone, rgba)
  const encoded = encodeColorValue(ref, finalRgba)

  if (ref.spanStart != null) {
    const gradient = getAtPath(clone, ref.path)
    if (!Array.isArray(gradient)) return false
    const start = ref.spanStart
    if (typeof encoded === 'string') return false
    gradient[start] = encoded[0]
    gradient[start + 1] = encoded[1]
    gradient[start + 2] = encoded[2]
    return true
  }

  const target = getParentAtPath(clone, ref.path)
  if (!target) return false

  const { parent, last } = target
  if (Array.isArray(parent)) {
    parent[last as number] = encoded
    return true
  }
  if (isRecord(parent)) {
    parent[last] = encoded
    return true
  }
  return false
}

export function applyColorToRefs(
  data: LottieAnimationData,
  refs: ColorRef[],
  hex: string,
): LottieAnimationData {
  const normalizedHex = normalizePickerHex(hex)
  const rgba = normalizedHex ? hexToRgba(normalizedHex) : null
  if (!rgba || refs.length === 0) return data

  const clone = structuredClone(data) as LottieAnimationData
  let writes = 0
  for (const ref of refs) {
    if (setColorRefOnClone(clone, ref, rgba)) writes += 1
  }
  if (writes === 0) return data
  return clone
}

export function replaceColorInData(
  data: LottieAnimationData,
  from: Rgba,
  to: Rgba,
  options?: { refs?: ColorRef[] },
): LottieAnimationData {
  const refs = options?.refs ?? analyzeLottieColors(data).refs
  const targets = refs.filter((ref) => colorsMatch(ref.rgba, from))
  return applyColorToRefs(
    data,
    targets,
    rgbaToHex(to),
  )
}

export function setSingleColorRef(
  data: LottieAnimationData,
  ref: ColorRef,
  hex: string,
): LottieAnimationData | null {
  const normalizedHex = normalizePickerHex(hex)
  const rgba = normalizedHex ? hexToRgba(normalizedHex) : null
  if (!rgba) return null
  const clone = structuredClone(data) as LottieAnimationData
  if (!setColorRefOnClone(clone, ref, rgba)) return null
  return clone
}

export function downloadLottieJson(data: LottieAnimationData, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.replace(/\.json$/i, '') + '-edited.json'
  anchor.click()
  URL.revokeObjectURL(url)
}
