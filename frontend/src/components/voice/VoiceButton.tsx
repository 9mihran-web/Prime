'use client'

import { useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, MicOff, Square } from 'lucide-react'
import { useVoice } from '@/hooks/useVoice'
import { cn } from '@/lib/utils'

interface VoiceButtonProps {
  onTranscript: (text: string) => void
  className?: string
}

export function VoiceButton({ onTranscript, className }: VoiceButtonProps) {
  const { isRecording, isTranscribing, error, startRecording, stopRecording } =
    useVoice({ onTranscript })

  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isHolding  = useRef(false)

  function handleMouseDown() {
    isHolding.current = false
    pressTimer.current = setTimeout(() => {
      isHolding.current = true
      startRecording()
    }, 150)
  }

  function handleMouseUp() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
    if (isHolding.current && isRecording) {
      stopRecording()
    }
  }

  function handleClick() {
    if (isHolding.current) return
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const busy = isRecording || isTranscribing

  return (
    <div className={cn('relative flex items-center justify-center', className)}>
      {/* Pulse rings while recording */}
      <AnimatePresence>
        {isRecording && (
          <>
            <motion.span
              className="absolute inset-0 rounded-xl border border-prime-500/40"
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.span
              className="absolute inset-0 rounded-xl border border-prime-500/20"
              initial={{ scale: 1, opacity: 0.6 }}
              animate={{ scale: 2.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.3, ease: 'easeOut' }}
            />
          </>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
        onClick={handleClick}
        disabled={isTranscribing}
        whileTap={{ scale: 0.9 }}
        title={
          isTranscribing ? 'Transcribing…' :
          isRecording    ? 'Stop recording (click or release)' :
                           'Hold or click to record voice'
        }
        className={cn(
          'relative z-10 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
          isRecording
            ? 'bg-red-500/20 text-red-400 border border-red-500/40'
            : isTranscribing
            ? 'bg-prime-500/20 text-prime-400 border border-prime-500/30'
            : error
            ? 'text-red-400 hover:bg-red-500/10'
            : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-3)]',
          'disabled:opacity-50 disabled:cursor-not-allowed'
        )}
      >
        {isTranscribing ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-4 h-4 rounded-full border-2 border-current border-t-transparent"
          />
        ) : isRecording ? (
          <Square className="w-3.5 h-3.5 fill-current" />
        ) : error ? (
          <MicOff className="w-4 h-4" />
        ) : (
          <Mic className="w-4 h-4" />
        )}
      </motion.button>

      {/* Error tooltip */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] text-center"
          >
            <div className="bg-[var(--surface-3)] border border-[var(--border)] rounded-lg px-2.5 py-1.5 text-xs text-red-400">
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
