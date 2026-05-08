'use client'

import { useState, memo } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn, formatTime } from '@/lib/utils'
import type { Message } from '@/types/chat'

interface MessageBubbleProps {
  message: Message
  userName?: string
  userAvatar?: string
  onRetry?: (messageId: string) => void
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] my-3">
      {/* Code toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-3)] border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)] font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {copied ? (
            <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied</>
          ) : (
            <><Copy className="w-3.5 h-3.5" />Copy</>
          )}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{
          margin: 0,
          padding: '1rem',
          background: '#0d0d14',
          fontSize: '0.8rem',
          lineHeight: '1.6',
        }}
        showLineNumbers={value.split('\n').length > 4}
        lineNumberStyle={{ color: '#3a3a5c', fontSize: '0.75rem' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  userName,
  userAvatar,
  onRetry,
}: MessageBubbleProps) {
  const isUser      = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError     = message.status === 'error'

  const [copied, setCopied]         = useState(false)
  const [thumbUp, setThumbUp]       = useState<boolean | null>(null)

  async function handleCopyMessage() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        'group flex gap-3 px-4',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        {isUser ? (
          <Avatar
            src={userAvatar}
            name={userName ?? 'You'}
            size="sm"
          />
        ) : (
          <div className="w-8 h-8 rounded-full prime-gradient flex items-center justify-center shadow-glow-sm shrink-0">
            <svg viewBox="0 0 20 20" fill="none" className="w-4 h-4">
              <path
                d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z"
                fill="white"
                strokeWidth="0"
              />
            </svg>
          </div>
        )}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-1 max-w-[75%]', isUser && 'items-end')}>
        {/* Author + time */}
        <div className={cn('flex items-center gap-2 text-xs text-[var(--text-muted)] px-1', isUser && 'flex-row-reverse')}>
          <span className="font-medium">
            {isUser ? (userName ?? 'You') : 'Prime'}
          </span>
          <span>{formatTime(message.createdAt)}</span>
        </div>

        {/* Content */}
        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-prime-600 text-white rounded-tr-sm shadow-glow-sm'
              : 'glass rounded-tl-sm',
            isError && 'border-red-500/30 bg-red-500/5'
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className={cn('prose-prime', isStreaming && message.content === '' && 'cursor-blink')}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...rest }) {
                    const match   = /language-(\w+)/.exec(className ?? '')
                    const isBlock = match !== null || String(children).includes('\n')
                    const value   = String(children).replace(/\n$/, '')
                    if (isBlock) {
                      return (
                        <CodeBlock
                          language={match?.[1] ?? ''}
                          value={value}
                        />
                      )
                    }
                    return (
                      <code className={className} {...rest}>
                        {children}
                      </code>
                    )
                  },
                  // Strip wrapping <p> from single-line code blocks
                  p({ children }) {
                    return <p className="mb-3 last:mb-0">{children}</p>
                  },
                }}
              >
                {message.content || (isStreaming ? '' : '​')}
              </ReactMarkdown>
              {isStreaming && message.content && (
                <span className="inline-block w-0.5 h-4 bg-prime-400 animate-[blink-cursor_1s_step-end_infinite] ml-0.5 translate-y-0.5" />
              )}
            </div>
          )}

          {isError && (
            <p className="text-xs text-red-400 mt-2">
              Failed to send. {' '}
              {onRetry && (
                <button
                  onClick={() => onRetry(message.id)}
                  className="underline hover:no-underline"
                >
                  Retry
                </button>
              )}
            </p>
          )}
        </div>

        {/* Action row (AI only) */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Button
              variant="ghost"
              size="xs"
              onClick={handleCopyMessage}
              className="h-6 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            </Button>
            {onRetry && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onRetry(message.id)}
                className="h-6 text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setThumbUp(true)}
              className={cn('h-6', thumbUp === true ? 'text-emerald-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]')}
            >
              <ThumbsUp className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setThumbUp(false)}
              className={cn('h-6', thumbUp === false ? 'text-red-400' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]')}
            >
              <ThumbsDown className="w-3 h-3" />
            </Button>
            {message.tokens && (
              <span className="text-[10px] text-[var(--text-muted)] ml-1">
                {message.tokens.total.toLocaleString()} tokens
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
})
