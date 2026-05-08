'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Trash2, Pin, MoreHorizontal } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn, truncate, formatDate } from '@/lib/utils'
import type { Conversation } from '@/types/chat'

interface ConversationListProps {
  conversations: Conversation[]
  onDelete?: (id: string) => void
  compact?: boolean
}

export function ConversationList({
  conversations,
  onDelete,
  compact = false,
}: ConversationListProps) {
  const pathname = usePathname()

  if (conversations.length === 0) {
    return (
      <div className="px-3 py-4 text-center">
        <MessageSquare className="w-8 h-8 text-[var(--text-muted)] mx-auto mb-2 opacity-50" />
        <p className="text-xs text-[var(--text-muted)]">No conversations yet</p>
      </div>
    )
  }

  const pinned   = conversations.filter((c) => c.isPinned)
  const unpinned = conversations.filter((c) => !c.isPinned)

  function renderItem(conv: Conversation) {
    const isActive = pathname === `/chat/${conv.id}`
    return (
      <ConversationItem
        key={conv.id}
        conversation={conv}
        isActive={isActive}
        onDelete={onDelete}
        compact={compact}
      />
    )
  }

  return (
    <div className="space-y-0.5">
      {pinned.length > 0 && (
        <div className="mb-1">
          <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-1">
            Pinned
          </p>
          {pinned.map(renderItem)}
        </div>
      )}
      {unpinned.map(renderItem)}
    </div>
  )
}

function ConversationItem({
  conversation: conv,
  isActive,
  onDelete,
  compact,
}: {
  conversation: Conversation
  isActive: boolean
  onDelete?: (id: string) => void
  compact: boolean
}) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (compact) {
    return (
      <Link
        href={`/chat/${conv.id}`}
        title={conv.title}
        className={cn(
          'flex items-center justify-center w-full p-2.5 rounded-xl transition-all',
          isActive
            ? 'bg-prime-500/15 text-prime-400'
            : 'text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
        )}
      >
        <MessageSquare className="w-4 h-4" />
      </Link>
    )
  }

  return (
    <div className="relative group">
      <Link
        href={`/chat/${conv.id}`}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all w-full',
          isActive
            ? 'bg-prime-500/12 border border-prime-500/15 text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
        )}
      >
        <MessageSquare
          className={cn('w-3.5 h-3.5 shrink-0', isActive ? 'text-prime-400' : 'text-[var(--text-muted)]')}
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate leading-tight">
            {truncate(conv.title, 36)}
          </p>
          {conv.lastMessage && (
            <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5">
              {truncate(conv.lastMessage, 40)}
            </p>
          )}
        </div>
        <span className="text-[10px] text-[var(--text-muted)] shrink-0">
          {conv.lastMessageAt ? formatDate(conv.lastMessageAt) : ''}
        </span>
      </Link>

      {/* Context menu trigger */}
      <div
        ref={menuRef}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2',
          showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          'transition-opacity'
        )}
      >
        <button
          onClick={(e) => {
            e.preventDefault()
            setShowMenu((s) => !s)
          }}
          className="p-1 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 w-36 glass-strong rounded-xl border border-[var(--border)] overflow-hidden z-30 shadow-xl"
            >
              <button
                onClick={() => { setShowMenu(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-3)] transition-colors"
              >
                <Pin className="w-3.5 h-3.5" />
                {conv.isPinned ? 'Unpin' : 'Pin'}
              </button>
              {onDelete && (
                <button
                  onClick={() => { onDelete(conv.id); setShowMenu(false) }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
