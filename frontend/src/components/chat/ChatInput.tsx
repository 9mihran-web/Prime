'use client'

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  KeyboardEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ChevronDown, Check } from 'lucide-react'
import { VoiceButton } from '@/components/voice/VoiceButton'
import { cn } from '@/lib/utils'
import { MODEL_OPTIONS, type ModelId } from '@/types/chat'
import { useChatStore } from '@/store/chatStore'

interface ChatInputProps {
  onSend: (content: string, model: ModelId) => void | Promise<void>
  model: ModelId
  onModelChange: (model: ModelId) => void
  placeholder?: string
  disabled?: boolean
}

export function ChatInput({
  onSend,
  model,
  onModelChange,
  placeholder = 'Message Prime…',
  disabled = false,
}: ChatInputProps) {
  const [value, setValue]             = useState('')
  const [isSending, setIsSending]     = useState(false)
  const [showModels, setShowModels]   = useState(false)
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)
  const modelDropdownRef              = useRef<HTMLDivElement>(null)
  const isStreaming                   = useChatStore((s) => s.isStreaming)

  const selectedModel = MODEL_OPTIONS.find((m) => m.id === model) ?? MODEL_OPTIONS[0]
  const canSend       = value.trim().length > 0 && !isSending && !isStreaming && !disabled

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const max = 200
    el.style.height = `${Math.min(el.scrollHeight, max)}px`
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  // Close model dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        modelDropdownRef.current &&
        !modelDropdownRef.current.contains(e.target as Node)
      ) {
        setShowModels(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSend() {
    const content = value.trim()
    if (!content || isSending || isStreaming) return
    setValue('')
    setIsSending(true)
    try {
      await onSend(content, model)
    } finally {
      setIsSending(false)
      // Refocus after send
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleVoiceTranscript(text: string) {
    setValue((prev) => (prev ? `${prev} ${text}` : text))
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  return (
    <div className="glass rounded-2xl border border-[var(--border)] shadow-glass overflow-hidden">
      {/* Textarea */}
      <div className="px-4 pt-3 pb-1">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          rows={1}
          className={cn(
            'w-full resize-none bg-transparent text-sm text-[var(--text-primary)]',
            'placeholder:text-[var(--text-muted)] outline-none border-none',
            'leading-relaxed font-sans py-1 max-h-[200px]',
            'disabled:opacity-60 disabled:cursor-not-allowed'
          )}
          style={{ minHeight: '40px' }}
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-2">
        {/* Left: model selector + voice */}
        <div className="flex items-center gap-2">
          {/* Model picker */}
          <div ref={modelDropdownRef} className="relative">
            <button
              onClick={() => setShowModels((s) => !s)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium',
                'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                'hover:bg-[var(--surface-3)] transition-colors'
              )}
            >
              <span>{selectedModel.name}</span>
              <ChevronDown className={cn('w-3 h-3 transition-transform', showModels && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showModels && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 w-64 glass-strong rounded-xl shadow-xl border border-[var(--border)] overflow-hidden z-20"
                >
                  {MODEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        onModelChange(opt.id)
                        setShowModels(false)
                      }}
                      className={cn(
                        'w-full flex items-start gap-3 px-3.5 py-3 text-left',
                        'hover:bg-[var(--surface-3)] transition-colors',
                        opt.id === model && 'bg-prime-500/10'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {opt.name}
                          </span>
                          {opt.id === model && (
                            <Check className="w-3 h-3 text-prime-400 shrink-0" />
                          )}
                        </div>
                        <span className="text-xs text-[var(--text-muted)] line-clamp-1">
                          {opt.description}
                        </span>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Voice button */}
          <VoiceButton onTranscript={handleVoiceTranscript} />
        </div>

        {/* Right: char count + send */}
        <div className="flex items-center gap-2">
          {value.length > 400 && (
            <span
              className={cn(
                'text-xs',
                value.length > 3500 ? 'text-red-400' : 'text-[var(--text-muted)]'
              )}
            >
              {value.length.toLocaleString()}
            </span>
          )}
          <motion.button
            onClick={handleSend}
            disabled={!canSend}
            whileTap={canSend ? { scale: 0.92 } : {}}
            className={cn(
              'w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200',
              canSend
                ? 'prime-gradient text-white shadow-glow-sm hover:shadow-glow-md'
                : 'bg-[var(--surface-3)] text-[var(--text-muted)] cursor-not-allowed'
            )}
          >
            <Send className="w-4 h-4" strokeWidth={2} />
          </motion.button>
        </div>
      </div>
    </div>
  )
}
