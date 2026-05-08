import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Sign In',
    template: '%s | Prime',
  },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -top-32 left-1/3 w-[600px] h-[600px] rounded-full opacity-15"
          style={{
            background:
              'radial-gradient(circle, rgba(109,70,245,0.7) 0%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(6,182,212,0.6) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 py-10">
        {children}
      </div>
    </div>
  )
}
