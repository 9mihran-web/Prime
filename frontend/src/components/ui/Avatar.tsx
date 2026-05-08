import Image from 'next/image'
import { cn, getInitials } from '@/lib/utils'

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const sizeMap: Record<AvatarSize, { container: string; text: string; px: number }> = {
  xs: { container: 'w-6 h-6',   text: 'text-[10px]', px: 24  },
  sm: { container: 'w-8 h-8',   text: 'text-xs',     px: 32  },
  md: { container: 'w-10 h-10', text: 'text-sm',     px: 40  },
  lg: { container: 'w-12 h-12', text: 'text-base',   px: 48  },
  xl: { container: 'w-16 h-16', text: 'text-xl',     px: 64  },
}

// Generate a deterministic gradient from a name string
function nameToGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  const gradients = [
    'from-prime-500 to-violet-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-rose-500 to-pink-500',
    'from-indigo-500 to-blue-500',
  ]
  return gradients[Math.abs(hash) % gradients.length]
}

interface AvatarProps {
  src?: string | null
  name: string
  size?: AvatarSize
  className?: string
  online?: boolean
}

export function Avatar({ src, name, size = 'md', className, online }: AvatarProps) {
  const { container, text, px } = sizeMap[size]
  const gradient = nameToGradient(name)
  const initials  = getInitials(name)

  return (
    <div className={cn('relative shrink-0', container, className)}>
      {src ? (
        <Image
          src={src}
          alt={name}
          width={px}
          height={px}
          className="w-full h-full rounded-full object-cover"
          unoptimized
        />
      ) : (
        <div
          className={cn(
            'w-full h-full rounded-full flex items-center justify-center font-semibold text-white bg-gradient-to-br',
            gradient,
            text
          )}
          aria-label={name}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[var(--surface)]',
            online ? 'bg-emerald-400' : 'bg-[var(--text-muted)]'
          )}
        />
      )}
    </div>
  )
}
