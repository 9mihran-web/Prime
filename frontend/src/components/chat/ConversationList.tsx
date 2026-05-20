'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trash2, MoreHorizontal } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn, truncate } from '@/lib/utils'
import type { Conversation } from '@/types/chat'

interface ConversationListProps {
  conversations: Conversation[]
  onDelete?: (id: string) => void
}

function getDateGroup(dateStr: string | undefined): string {
  if (!dateStr) return 'Older'
  const date = new Date(dateStr)
  const now  = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return 'Last 7 days'
  if (diffDays <= 30) return 'Last 30 days'
  return 'Older'
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 days', 'Last 30 days', 'Older']

export function ConversationList({ conversations, onDelete }: ConversationListProps) {
  const pathname = usePathname()

  if (conversations.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-[var(--text-muted)]">No conversations yet</p>
      </div>
    )
  }

  const groups: Record<string, Conversation[]> = {}
  for (const conv of conversations) {
    const key = getDateGroup(conv.updatedAt || conv.createdAt)
    ;(groups[key] ??= []).push(conv)
  }

  return (
    <div className="space-y-4 py-1 pb-4">
      {GROUP_ORDER.filter((g) => groups[g]?.length > 0).map((group) => (
        <div key={group}>
          <p className="px-2 mb-1 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide">
            {group}
          </p>
          <div className="space-y-0.5">
            {groups[group].map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={pathname === `/chat/${conv.id}`}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ConversationItem({
  conversation: conv,
  isActive,
  onDelete,
}: {
  conversation: Conversation
  isActive: boolean
  onDelete?: (id: string) => void
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

  return (
    <div className="relative group">
      <Link
        href={`/chat/${conv.id}`}
        className={cn(
          'flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors w-full',
          isActive
            ? 'bg-[var(--surface-2)] text-[var(--text-primary)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]'
        )}
      >
        <span className="flex-1 truncate leading-snug">
          {truncate(conv.title || 'New Conversation', 38)}
        </span>
      </Link>

      {/* Context menu */}
      <div
        ref={menuRef}
        className={cn(
          'absolute right-1 top-1/2 -translate-y-1/2',
          showMenu ? 'flex' : 'hidden group-hover:flex',
          'items-center'
        )}
      >
        <button
          onClick={(e) => {
            e.preventDefault()
            setShowMenu((s) => !s)
          }}
          className="p-1 rounded-md hover:bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-32 bg-[var(--surface-2)] rounded-xl border border-[var(--border)] overflow-hidden z-30 shadow-xl">
            {onDelete && (
              <button
                onClick={() => { onDelete(conv.id); setShowMenu(false) }}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
