import { useMemo, useState } from 'react'
import type { LottieAnimationData, LottieFile } from '../types'
import { SwatchRow } from './SwatchRow'
import {
  analyzeLottieColors,
  applyColorToRefs,
  downloadLottieJson,
  normalizePickerHex,
  rgbaToHex,
  setSingleColorRef,
  stableSwatchId,
  type ColorRef,
  type ColorSwatch,
} from '../utils/lottieColors'

type Props = {
  file: LottieFile
  onChange: (fileId: string, next: LottieAnimationData) => void
  onReset: (fileId: string) => void
}

type EditorTab = 'global' | 'palette' | 'layer'

function refSubtitle(ref: ColorRef): string {
  const layer = ref.layerPath || 'Document'
  const kind =
    ref.kind === 'fill'
      ? 'Fill'
      : ref.kind === 'stroke'
        ? 'Stroke'
        : ref.kind === 'text'
          ? 'Text'
          : ref.kind === 'solid'
            ? 'Solid'
            : 'Color'
  return `${layer} · ${kind}`
}

export function LottieColorEditor({ file, onChange, onReset }: Props) {
  const [tab, setTab] = useState<EditorTab>('palette')
  const analysis = useMemo(() => analyzeLottieColors(file.data), [file.data])

  const applySwatch = (swatch: ColorSwatch, hex: string) => {
    const normalized = normalizePickerHex(hex)
    if (!normalized || normalized === swatch.hex) return
    const next = applyColorToRefs(file.data, swatch.refs, normalized)
    if (next !== file.data) {
      onChange(file.id, next)
    }
  }

  const applySingleRef = (ref: ColorRef, hex: string) => {
    const normalized = normalizePickerHex(hex)
    if (!normalized) return
    const next = setSingleColorRef(file.data, ref, normalized)
    if (next) onChange(file.id, next)
  }

  const layerSwatches = (layerId: string): ColorSwatch[] => {
    const refs = analysis.refs.filter(
      (ref) =>
        ref.layerPath === layerId || ref.layerPath.startsWith(`${layerId} /`),
    )
    const map = new Map<string, ColorSwatch>()
    for (const ref of refs) {
      const hexKey = rgbaToHex(ref.rgba)
      const hit = map.get(hexKey)
      if (hit) {
        hit.count += 1
        hit.refs.push(ref)
        hit.id = `${layerId}:${stableSwatchId(hit.refs)}`
      } else {
        const refs = [ref]
        map.set(hexKey, {
          id: `${layerId}:${stableSwatchId(refs)}`,
          rgba: ref.rgba,
          hex: hexKey,
          count: 1,
          refs,
        })
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  }

  return (
    <div className="color-editor">
      <div className="color-editor-toolbar">
        <p className="color-editor-hint">
          Changes apply to the current animation only. Download JSON to save
          edits outside the browser.
        </p>
        <div className="color-editor-actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => onReset(file.id)}
            disabled={!file.isDirty}
          >
            Reset
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => downloadLottieJson(file.data, file.name)}
          >
            Download JSON
          </button>
        </div>
      </div>

      {analysis.swatches.length === 0 ? (
        <p className="color-editor-empty">
          No editable solid fill or stroke colors were found in this file.
          Gradients and image layers are not supported yet.
        </p>
      ) : (
        <>
          <div
            className="color-editor-tabs"
            role="tablist"
            aria-label="Color editing mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'global'}
              className={`color-editor-tab${tab === 'global' ? ' color-editor-tab--active' : ''}`}
              onClick={() => setTab('global')}
            >
              Global colors
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'palette'}
              className={`color-editor-tab${tab === 'palette' ? ' color-editor-tab--active' : ''}`}
              onClick={() => setTab('palette')}
            >
              Palette
            </button>
            {analysis.layers.length > 0 && (
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'layer'}
                className={`color-editor-tab${tab === 'layer' ? ' color-editor-tab--active' : ''}`}
                onClick={() => setTab('layer')}
              >
                By layer
              </button>
            )}
          </div>

          {tab === 'palette' && (
            <section className="color-editor-section" role="tabpanel">
              <p className="color-editor-sub">
                One swatch per hex value. Changing a color updates every matching
                fill and stroke in the file at once.
              </p>
              <ul className="swatch-list swatch-list--grid">
                {analysis.swatches.map((swatch) => (
                  <SwatchRow
                    key={swatch.id}
                    swatch={swatch}
                    compact
                    onPick={(hex) => applySwatch(swatch, hex)}
                  />
                ))}
              </ul>
            </section>
          )}

          {tab === 'global' && (
            <section className="color-editor-section" role="tabpanel">
              <p className="color-editor-sub">
                Each color instance in the file. Adjust one without changing other
                uses of the same hex.
              </p>
              <ul className="swatch-list swatch-list--grid swatch-list--wide">
                {analysis.refs.map((ref, index) => (
                  <SwatchRow
                    key={`${ref.path.map(String).join('/')}-${index}`}
                    swatch={{
                      id: stableSwatchId([ref]),
                      rgba: ref.rgba,
                      hex: rgbaToHex(ref.rgba),
                      count: 1,
                      refs: [ref],
                    }}
                    subtitle={refSubtitle(ref)}
                    onPick={(hex) => applySingleRef(ref, hex)}
                  />
                ))}
              </ul>
            </section>
          )}

          {tab === 'layer' && analysis.layers.length > 0 && (
            <section className="color-editor-section" role="tabpanel">
              <p className="color-editor-sub">
                Target colors inside a named layer (including nested precomps).
              </p>
              <ul className="layer-color-list">
                {analysis.layers.map((layer) => {
                  const swatches = layerSwatches(layer.id)
                  if (swatches.length === 0) return null
                  return (
                    <li key={layer.id} className="layer-color-block">
                      <p
                        className="layer-color-name"
                        style={{ paddingLeft: `${layer.depth * 0.65}rem` }}
                      >
                        {layer.name}
                      </p>
                      <ul className="swatch-list swatch-list--grid swatch-list--nested">
                        {swatches.map((swatch) => (
                          <SwatchRow
                            key={swatch.id}
                            swatch={swatch}
                            compact
                            onPick={(hex) => applySwatch(swatch, hex)}
                          />
                        ))}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
