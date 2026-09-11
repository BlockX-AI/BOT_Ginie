"use client";

import { useEffect, useState } from 'react'

interface LoaderProps {
  isLoading?: boolean
  onFinish?: () => void
}

export default function Loader({ isLoading = true, onFinish }: LoaderProps): JSX.Element | null {
  const [progress, setProgress] = useState(0)
  const [logoGlow, setLogoGlow] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Glow logo on load
  useEffect(() => {
    if (!isLoading) return
    setLogoGlow(true)
  }, [isLoading])

  // If provided, call onFinish after the letter animation sequence completes
  useEffect(() => {
    if (!isLoading) return

  const letters = ['E', 'v', 'i']
  const perStep = 30 // ms per-letter step (faster, left-to-right)
  const animDuration = 300 // must match CSS animation-duration (shortened)

    // compute max delay based on left-to-right index (E, then v, then i)
    const delays = letters.map((_, i) => i * perStep)
    const maxDelay = Math.max(...delays)
  const total = maxDelay + animDuration + 60 // small buffer

    let t: number | null = null
    if (typeof window !== 'undefined') {
      // after letters complete, start the finishing animation
      t = window.setTimeout(() => {
        setFinishing(true)
      }, total)
    }

    return () => {
      if (t) clearTimeout(t)
    }
  }, [isLoading, onFinish])

  // Simulate fast progress
  useEffect(() => {
    if (!isLoading) return

    const interval = setInterval(() => {
      setProgress((prev) => {
        const nextProgress = prev + Math.random() * 50
        return nextProgress > 90 ? 90 : nextProgress
      })
    }, 80)

    return () => clearInterval(interval)
  }, [isLoading])

  // Complete progress when loading finishes
  useEffect(() => {
    if (!isLoading) {
      setProgress(100)
      const timer = setTimeout(() => setProgress(0), 500)
      return () => clearTimeout(timer)
    }
  }, [isLoading])

  // when finishing starts, advance progress to 100 and call onFinish after exit animation
  useEffect(() => {
    if (!finishing) return
    // ensure progress is full for visual
    setProgress(100)
    const exitDuration = 300 // matches CSS exit animation (faster)
    const t = window.setTimeout(() => {
      if (typeof onFinish === 'function') onFinish()
    }, exitDuration)
    return () => clearTimeout(t)
  }, [finishing, onFinish])

  if (!isLoading && progress === 0) return null

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black backdrop-blur-md ${finishing ? 'loader-exit' : ''}`}>
      {/* Glowing Logo */}
      

       
          <div className="w-72 h-72 flex items-center justify-center shadow-2xl">
            <span className="font-playfair italic font-light text-8xl select-none leading-none loader-text" aria-hidden>
              {['G', 'i', 'n', 'i', 'e', '.'].map((ch, i) => {
                const delayMs = i * 30 // left-to-right stagger (E then v then i)
                return (
                  <span key={i} className="inline-block loader-letter" style={{ animationDelay: `${delayMs}ms` }}>
                    {ch}
                  </span>
                )
              })}
            </span>
          </div>
        </div>
    

      
    
  )
}
