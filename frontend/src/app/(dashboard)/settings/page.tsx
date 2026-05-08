'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User,
  Bell,
  Shield,
  Palette,
  Key,
  Trash2,
  Save,
  Camera,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/hooks/useAuth'
import { useUIStore } from '@/store/uiStore'
import { cn } from '@/lib/utils'
import type { Theme } from '@/types/common'

const SECTIONS = [
  { id: 'profile',       label: 'Profile',       icon: User    },
  { id: 'appearance',    label: 'Appearance',     icon: Palette },
  { id: 'notifications', label: 'Notifications',  icon: Bell    },
  { id: 'security',      label: 'Security',       icon: Shield  },
  { id: 'api',           label: 'API Keys',       icon: Key     },
]

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, setTheme } = useUIStore()
  const [activeSection, setActiveSection] = useState('profile')

  const [displayName, setDisplayName]   = useState(user?.displayName ?? user?.username ?? '')
  const [email, setEmail]               = useState(user?.email ?? '')
  const [saving, setSaving]             = useState(false)
  const [saved, setSaved]               = useState(false)

  async function handleSaveProfile() {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 800))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const themeOptions: { value: Theme; label: string; icon: React.ElementType }[] = [
    { value: 'dark',   label: 'Dark',   icon: Moon    },
    { value: 'light',  label: 'Light',  icon: Sun     },
    { value: 'system', label: 'System', icon: Monitor },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      {/* Section nav */}
      <nav className="w-52 shrink-0 border-r border-[var(--border)] p-4 flex flex-col gap-1 overflow-y-auto">
        {SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'nav-item text-left w-full',
                activeSection === section.id && 'active'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {section.label}
            </button>
          )
        })}
      </nav>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-xl"
        >
          {/* ── Profile ─────────────────────────────────────────────────── */}
          {activeSection === 'profile' && (
            <div>
              <h2 className="text-xl font-bold mb-1">Profile</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Manage your public profile and account details.
              </p>

              {/* Avatar */}
              <div className="flex items-center gap-5 mb-8">
                <div className="relative">
                  <Avatar
                    src={user?.avatarUrl}
                    name={user?.displayName ?? user?.username ?? 'U'}
                    size="xl"
                  />
                  <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full glass border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-3)] transition-colors">
                    <Camera className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  </button>
                </div>
                <div>
                  <p className="font-medium">{user?.displayName ?? user?.username}</p>
                  <p className="text-sm text-[var(--text-muted)]">{user?.email}</p>
                </div>
              </div>

              <div className="space-y-5">
                <Input
                  label="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                />
                <Input
                  type="email"
                  label="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <Button
                  onClick={handleSaveProfile}
                  isLoading={saving}
                  className="w-full sm:w-auto"
                >
                  {saved ? (
                    'Saved!'
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Save Changes</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ── Appearance ──────────────────────────────────────────────── */}
          {activeSection === 'appearance' && (
            <div>
              <h2 className="text-xl font-bold mb-1">Appearance</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Customize how Prime looks on your device.
              </p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-3">Theme</label>
                  <div className="grid grid-cols-3 gap-3">
                    {themeOptions.map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button
                          key={opt.value}
                          onClick={() => setTheme(opt.value)}
                          className={cn(
                            'flex flex-col items-center gap-2.5 py-4 px-3 rounded-xl border transition-all duration-200',
                            theme === opt.value
                              ? 'border-prime-500/60 bg-prime-500/10 text-prime-400'
                              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Notifications ────────────────────────────────────────────── */}
          {activeSection === 'notifications' && (
            <div>
              <h2 className="text-xl font-bold mb-1">Notifications</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Control what notifications you receive.
              </p>

              <div className="space-y-4">
                {[
                  { label: 'Agent task completed',    desc: 'Get notified when an agent finishes a task' },
                  { label: 'New model updates',        desc: 'Updates on new AI models available' },
                  { label: 'Usage alerts',             desc: 'Alerts when you approach usage limits' },
                  { label: 'Newsletter',               desc: 'Product news and tips' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-3 border-b border-[var(--border)]"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                    </div>
                    <Toggle defaultChecked={item.label !== 'Newsletter'} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Security ─────────────────────────────────────────────────── */}
          {activeSection === 'security' && (
            <div>
              <h2 className="text-xl font-bold mb-1">Security</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Manage your password and account security.
              </p>

              <div className="space-y-5">
                <Input
                  type="password"
                  label="Current Password"
                  placeholder="Enter current password"
                />
                <Input
                  type="password"
                  label="New Password"
                  placeholder="Enter new password"
                />
                <Input
                  type="password"
                  label="Confirm New Password"
                  placeholder="Confirm new password"
                />
                <Button>Update Password</Button>
              </div>

              <div className="mt-12 pt-8 border-t border-[var(--border)]">
                <h3 className="text-base font-semibold text-red-400 mb-1">Danger Zone</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">
                  Permanently delete your account and all associated data.
                </p>
                <Button variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Account
                </Button>
              </div>
            </div>
          )}

          {/* ── API Keys ─────────────────────────────────────────────────── */}
          {activeSection === 'api' && (
            <div>
              <h2 className="text-xl font-bold mb-1">API Keys</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-8">
                Manage API keys for programmatic access to Prime.
              </p>

              <div className="glass rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Personal Access Token</p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      Created Nov 5, 2024
                    </p>
                  </div>
                  <Badge variant="success" size="sm">Active</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-[var(--surface-3)] px-3 py-2 rounded-lg text-[var(--text-muted)] font-mono truncate">
                    pk_live_••••••••••••••••••••••••••••••••
                  </code>
                  <Button variant="outline" size="sm">Reveal</Button>
                </div>
              </div>

              <Button variant="outline" size="sm">
                <Key className="w-4 h-4 mr-2" />
                Generate New Key
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

// Simple toggle component
function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <button
      onClick={() => setChecked((c) => !c)}
      role="switch"
      aria-checked={checked}
      className={cn(
        'relative w-10 h-5.5 rounded-full transition-colors duration-200',
        checked ? 'bg-prime-500' : 'bg-[var(--surface-3)]'
      )}
      style={{ height: '22px' }}
    >
      <span
        className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          checked ? 'translate-x-5' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

// Badge import (used in API Keys section)
import { Badge } from '@/components/ui/Badge'
