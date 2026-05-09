'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Sparkles, Mail, Lock, User, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/hooks/useAuth'
import { isValidEmail } from '@/lib/utils'

const PASSWORD_RULES = [
  { label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { label: 'Contains a number',            test: (p: string) => /\d/.test(p) },
  { label: 'Contains an uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
]

export default function RegisterPage() {
  const router = useRouter()
  const { register, isLoading } = useAuth()

  const [username, setUsername]   = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [showPass, setShowPass]    = useState(false)
  const [error, setError]          = useState<string | null>(null)
  const [touched, setTouched]      = useState(false)

  const passwordStrength = PASSWORD_RULES.filter((r) => r.test(password)).length

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setTouched(true)

    if (!username.trim()) {
      setError('Please enter a username.')
      return
    }
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }
    if (passwordStrength < PASSWORD_RULES.length) {
      setError('Please choose a stronger password.')
      return
    }

    const result = await register(email.trim(), password, username.trim())
    if (result.success) {
      router.push('/chat')
    } else {
      setError(result.error ?? 'Registration failed. Please try again.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-12 h-12 rounded-2xl prime-gradient flex items-center justify-center shadow-glow-md mb-4">
          <Sparkles className="w-6 h-6 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Join Prime and start your AI journey
        </p>
      </div>

      {/* Card */}
      <div className="glass rounded-2xl p-8">
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <Input
            type="text"
            label="Username"
            placeholder="yourname"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            leftIcon={<User className="w-4 h-4" />}
            autoComplete="username"
            required
          />

          <Input
            type="email"
            label="Email address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail className="w-4 h-4" />}
            autoComplete="email"
            required
          />

          <div className="space-y-2">
            <Input
              type={showPass ? 'text' : 'password'}
              label="Password"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              rightElement={
                <button
                  type="button"
                  onClick={() => setShowPass((p) => !p)}
                  className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              autoComplete="new-password"
              required
            />

            {/* Password strength */}
            {(password.length > 0 || touched) && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                {/* Bar */}
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-all duration-300"
                      style={{
                        background:
                          i < passwordStrength
                            ? passwordStrength === 1
                              ? '#ef4444'
                              : passwordStrength === 2
                              ? '#f59e0b'
                              : '#22c55e'
                            : 'var(--surface-3)',
                      }}
                    />
                  ))}
                </div>
                {/* Rules */}
                <div className="space-y-1">
                  {PASSWORD_RULES.map((rule) => (
                    <div
                      key={rule.label}
                      className="flex items-center gap-1.5 text-xs"
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 transition-colors ${
                          rule.test(password)
                            ? 'text-emerald-400'
                            : 'text-[var(--text-muted)]'
                        }`}
                      />
                      <span
                        className={
                          rule.test(password)
                            ? 'text-[var(--text-secondary)]'
                            : 'text-[var(--text-muted)]'
                        }
                      >
                        {rule.label}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isLoading}
            disabled={isLoading}
          >
            Create Account
          </Button>

          <p className="text-xs text-center text-[var(--text-muted)]">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-[var(--accent)] hover:underline">Terms</a>
            {' '}and{' '}
            <a href="#" className="text-[var(--accent)] hover:underline">Privacy Policy</a>.
          </p>
        </form>
      </div>

      <p className="text-center text-sm text-[var(--text-muted)] mt-6">
        Already have an account?{' '}
        <Link
          href="/login"
          className="text-[var(--accent)] hover:text-prime-400 transition-colors font-medium"
        >
          Sign in
        </Link>
      </p>
    </motion.div>
  )
}
