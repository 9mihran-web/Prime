'use client'

import { useState, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Message } from '@/types/chat'

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-[#0d1117] border-b border-[var(--border)]">
        <span className="text-xs text-[var(--text-muted)] font-mono">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          {copied
            ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied</>
            : <><Copy className="w-3.5 h-3.5" />Copy</>
          }
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, padding: '1rem', background: '#0d1117', fontSize: '0.8rem', lineHeight: '1.6' }}
        showLineNumbers={value.split('\n').length > 4}
        lineNumberStyle={{ color: '#3a3a5c', fontSize: '0.75rem' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}

function ActionBtn({
  onClick, title, children, active,
}: {
  onClick: () => void
  title: string
  children: React.ReactNode
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-lg transition-colors',
        active
          ? 'text-prime-400'
          : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-2)]'
      )}
    >
      {children}
    </button>
  )
}

export const MessageBubble = memo(function MessageBubble({
  message,
  userName,
  userAvatar: _userAvatar,
  onRetry,
}: {
  message: Message
  userName?: string
  userAvatar?: string
  onRetry?: (messageId: string) => void
}) {
  const isUser      = message.role === 'user'
  const isStreaming = message.status === 'streaming'
  const isError     = message.status === 'error'

  const [copied, setCopied]   = useState(false)
  const [thumbUp, setThumbUp] = useState<boolean | null>(null)

  async function handleCopyMessage() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── User message — right-aligned bubble ───────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end px-4 sm:px-6 lg:px-8 py-1">
        <div className="max-w-[78%] sm:max-w-[65%]">
          <div className="bg-[var(--surface-3)] rounded-2xl rounded-br-sm px-4 py-3 text-sm text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // ── AI message — ChatGPT-style: flat, full width, avatar on left ──────────
  return (
    <div className="group px-4 sm:px-6 lg:px-8 py-2">
      <div className="flex gap-3 max-w-3xl mx-auto">
        {/* Prime icon */}
        <div className="w-7 h-7 rounded-lg prime-gradient flex items-center justify-center shadow-glow-sm shrink-0 mt-0.5">
          <Sparkles className="w-3.5 h-3.5 text-white" strokeWidth={2} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Typing dots while empty + streaming */}
          {message.content === '' && isStreaming ? (
            <span className="inline-flex gap-1 items-center h-5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-muted)] animate-bounce [animation-delay:300ms]" />
            </span>
          ) : (
            <div className={cn('prose-prime text-sm', isError && 'text-red-300')}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...rest }) {
                    const match   = /language-(\w+)/.exec(className ?? '')
                    const isBlock = match !== null || String(children).includes('\n')
                    const value   = String(children).replace(/\n$/, '')
                    if (isBlock) {
                      return <CodeBlock language={match?.[1] ?? ''} value={value} />
                    }
                    return <code className={className} {...rest}>{children}</code>
                  },
                  p({ children }) {
                    return <p className="mb-3 last:mb-0">{children}</p>
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
              {isStreaming && message.content && (
                <span className="inline-block w-0.5 h-4 bg-prime-400 animate-[blink-cursor_1s_step-end_infinite] ml-0.5 translate-y-0.5" />
              )}
            </div>
          )}

          {isError && (
            <p className="text-xs text-red-400 mt-2">
              Failed to respond.{' '}
              {onRetry && (
                <button onClick={() => onRetry(message.id)} className="underline hover:no-underline">
                  Retry
                </button>
              )}
            </p>
          )}

          {/* Action buttons — shown on hover */}
          {!isStreaming && (
            <div className="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <ActionBtn onClick={handleCopyMessage} title="Copy">
                {copied
                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                  : <Copy className="w-3.5 h-3.5" />
                }
              </ActionBtn>
              {onRetry && (
                <ActionBtn onClick={() => onRetry(message.id)} title="Retry">
                  <RefreshCw className="w-3.5 h-3.5" />
                </ActionBtn>
              )}
              <ActionBtn
                onClick={() => setThumbUp(t => t === true ? null : true)}
                title="Good response"
                active={thumbUp === true}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </ActionBtn>
              <ActionBtn
                onClick={() => setThumbUp(t => t === false ? null : false)}
                title="Bad response"
                active={thumbUp === false}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </ActionBtn>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
