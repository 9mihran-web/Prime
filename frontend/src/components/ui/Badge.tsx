import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center font-medium rounded-full border',
  {
    variants: {
      variant: {
        default: 'bg-[var(--surface-3)] border-[var(--border)] text-[var(--text-secondary)]',
        primary: 'bg-prime-500/15 border-prime-500/30 text-prime-400',
        success: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
        warning: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
        error:   'bg-red-500/15 border-red-500/30 text-red-400',
        info:    'bg-blue-500/15 border-blue-500/30 text-blue-400',
      },
      size: {
        sm: 'text-[10px] px-2 py-0.5 gap-1',
        md: 'text-xs px-2.5 py-1 gap-1.5',
        lg: 'text-sm px-3 py-1.5 gap-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            variant === 'success' ? 'bg-emerald-400' :
            variant === 'warning' ? 'bg-amber-400'   :
            variant === 'error'   ? 'bg-red-400'     :
            variant === 'info'    ? 'bg-blue-400'    :
            variant === 'primary' ? 'bg-prime-400'   :
            'bg-[var(--text-muted)]'
          )}
        />
      )}
      {children}
    </span>
  )
}
