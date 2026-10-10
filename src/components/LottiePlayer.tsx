import { useEffect, useRef } from 'react'
import lottie from 'lottie-web'
import type { LottieAnimationData } from '../types'

type Props = {
  data: LottieAnimationData
}

export function LottiePlayer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const animationData = JSON.parse(JSON.stringify(data)) as LottieAnimationData
    delete animationData.__complete

    const animation = lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })

    return () => {
      animation.destroy()
      container.replaceChildren()
    }
  }, [data])

  return <div ref={containerRef} className="lottie-player" />
}
