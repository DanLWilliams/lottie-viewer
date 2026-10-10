import { useEffect, useState } from 'react'
import { normalizePickerHex } from '../utils/lottieColors'
import type { ColorSwatch } from '../utils/lottieColors'

type Props = {
  swatch: ColorSwatch
  subtitle?: string
  compact?: boolean
  onPick: (hex: string) => void
}

export function SwatchRow({ swatch, subtitle, compact = false, onPick }: Props) {
  const [draftHex, setDraftHex] = useState(swatch.hex)

  useEffect(() => {
    setDraftHex(swatch.hex)
  }, [swatch.hex])

  const commitDraftHex = () => {
    const normalized = normalizePickerHex(draftHex)
    if (!normalized) {
      setDraftHex(swatch.hex)
      return
    }
    setDraftHex(normalized)
    if (normalized !== swatch.hex) onPick(normalized)
  }

  return (
    <li className={`swatch-row${compact ? ' swatch-row--compact' : ''}`}>
      <div className="swatch-row-label">
        <input
          type="color"
          className="swatch-color-input"
          value={swatch.hex}
          aria-label={`Visual color picker for ${swatch.hex}`}
          onChange={(event) => {
            const normalized = normalizePickerHex(event.currentTarget.value)
            if (normalized && normalized !== swatch.hex) onPick(normalized)
          }}
        />
        <span className="swatch-meta">
          <input
            type="text"
            className="swatch-hex-input"
            value={draftHex}
            onChange={(event) => setDraftHex(event.currentTarget.value)}
            onBlur={commitDraftHex}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            spellCheck={false}
            autoComplete="off"
            aria-label="Hex color code"
            placeholder="#000000"
          />
          {subtitle ? (
            <span className="swatch-subtitle">{subtitle}</span>
          ) : (
            <span className="swatch-count">
              {swatch.count} use{swatch.count === 1 ? '' : 's'}
            </span>
          )}
        </span>
      </div>
    </li>
  )
}
