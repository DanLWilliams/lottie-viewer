import { useCallback, useEffect } from 'react'
import { LottiePlayer } from './LottiePlayer'
import type { LottieFile } from '../types'

type Props = {
  files: LottieFile[]
  index: number
  onIndexChange: (index: number) => void
  compact?: boolean
}

export function LottieCarousel({ files, index, onIndexChange, compact }: Props) {
  const current = files[index]
  const count = files.length

  const goPrev = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index - 1 + count) % count)
  }, [count, index, onIndexChange])

  const goNext = useCallback(() => {
    if (count <= 1) return
    onIndexChange((index + 1) % count)
  }, [count, index, onIndexChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [goPrev, goNext])

  if (!current) {
    return (
      <div className="preview-empty">
        <p>Upload Lottie .json or .lottie files to preview them here.</p>
      </div>
    )
  }

  return (
    <div className="carousel">
      <div className="carousel-stage">
        {count > 1 && (
          <button
            type="button"
            className="carousel-nav carousel-nav--prev"
            onClick={goPrev}
            aria-label="Previous animation"
          >
            ‹
          </button>
        )}

        <div className="carousel-lottie">
          <LottiePlayer
            key={`${current.id}-${current.dataVersion}`}
            data={current.data}
          />
        </div>

        {count > 1 && (
          <button
            type="button"
            className="carousel-nav carousel-nav--next"
            onClick={goNext}
            aria-label="Next animation"
          >
            ›
          </button>
        )}
      </div>

      {count > 1 && (
        <div className="carousel-meta">
          <div className="carousel-dots" role="tablist" aria-label="Animations">
            {files.map((file, i) => (
              <button
                key={file.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show ${file.name}`}
                className={`carousel-dot${i === index ? ' carousel-dot--active' : ''}`}
                onClick={() => onIndexChange(i)}
              />
            ))}
          </div>
          <p className="carousel-counter">
            {index + 1} of {count} · {current.name}
          </p>
        </div>
      )}

      {!compact && count === 1 && (
        <p className="carousel-single-name">{current.name}</p>
      )}

      {!compact && (
        <p className="preview-status preview-status--ok">
          Lottie animation rendered successfully.
        </p>
      )}
    </div>
  )
}
