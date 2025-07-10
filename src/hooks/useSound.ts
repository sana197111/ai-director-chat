'use client'

import { useEffect, useRef, useCallback } from 'react'

export const useSound = (src: string, { volume = 1, loop = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      audioRef.current = new Audio(src)
      audioRef.current.volume = volume
      audioRef.current.loop = loop
    }
  }, [src, volume, loop])

  const play = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.error('Audio play failed:', err)
      })
    }
  }, [])

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [])

  return { play, pause, stop }
}
