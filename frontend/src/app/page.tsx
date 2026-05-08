'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { motion, useInView } from 'framer-motion'
import {
  MessageSquare,
  Mic,
  Bot,
  Brain,
  Zap,
  Shield,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FEATURES } from '@/types/common'

const iconMap: Record<string, React.ElementType> = {
  MessageSquare,
  Mic,
  Bot,
  Brain,
  Zap,
  Shield,
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] } },
}

function FeatureCard({
  feature,
  index,
}: {
  feature: (typeof FEATURES)[number]
  index: number
}) {
  const Icon = iconMap[feature.icon] ?? Sparkles
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.25, 0.1, 0.25, 1] }}
      className="glass rounded-2xl p-6 group hover:border-white/10 transition-all duration-300 hover:-translate-y-1"
    >
      <div
        className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.gradient} p-2.5 mb-4 shadow-lg`}
      >
        <Icon className="w-full h-full text-white" strokeWidth={1.8} />
      </div>
      <h3 className="text-base font-semibold text-[var(--text-primary)] mb-2">
        {feature.title}
      </h3>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
        {feature.description}
      </p>
    </motion.div>
  )
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* ── Orb background ──────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full opacity-20"
          style={{
            background:
              'radial-gradient(circle, rgba(109,70,245,0.6) 0%, rgba(59,130,246,0.3) 40%, transparent 70%)',
            filter: 'blur(60px)',
          }}
          animate={{
            scale: [1, 1.08, 0.96, 1],
            opacity: [0.18, 0.25, 0.18, 0.22],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -left-40 w-[600px] h-[600px] rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(6,182,212,0.6) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-10"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.6) 0%, transparent 70%)',
            filter: 'blur(50px)',
          }}
          animate={{ x: [0, -20, 0], y: [0, 25, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-8 h-8 rounded-lg prime-gradient flex items-center justify-center shadow-glow-sm">
            <Sparkles className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <span className="text-lg font-bold tracking-tight">Prime</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="flex items-center gap-3"
        >
          <Link href="/login">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Get Started</Button>
          </Link>
        </motion.div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-32 max-w-5xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 glass rounded-full px-4 py-1.5 text-xs font-medium text-[var(--text-secondary)] mb-10 border border-white/[0.06]"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
          Now in public beta
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.1 }}
          className="text-7xl sm:text-8xl font-extrabold tracking-tighter leading-none mb-6"
        >
          <span className="prime-gradient-text">Prime</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className="text-2xl sm:text-3xl font-light text-[var(--text-secondary)] mb-4 tracking-tight"
        >
          Your AI operating system
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.3 }}
          className="text-base text-[var(--text-muted)] max-w-lg mb-12 leading-relaxed"
        >
          Intelligent conversations, voice control, autonomous agents, and persistent
          memory — all in one seamless interface.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 items-center"
        >
          <Link href="/register">
            <Button size="lg" className="min-w-[160px] shadow-glow-md">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="min-w-[140px]">
              Sign In
            </Button>
          </Link>
        </motion.div>

        {/* Hero gradient line */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-20 w-full max-w-lg h-px prime-gradient opacity-40"
        />
      </section>

      {/* ── Features ────────────────────────────────────────────────────── */}
      <section
        ref={featuresRef}
        className="relative z-10 px-6 pb-32 max-w-7xl mx-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={featuresInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Everything you need
          </h2>
          <p className="text-[var(--text-secondary)] text-lg max-w-xl mx-auto">
            Prime integrates the most powerful AI capabilities into a single, elegant experience.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard key={feature.id} feature={feature} index={i} />
          ))}
        </div>
      </section>

      {/* ── CTA Section ─────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 pb-32 max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6 }}
          className="glass rounded-3xl p-12 gradient-border"
        >
          <h2 className="text-3xl font-bold mb-4">
            Ready to experience the future?
          </h2>
          <p className="text-[var(--text-secondary)] mb-8 leading-relaxed">
            Join thousands of people already using Prime as their AI-powered
            command center.
          </p>
          <Link href="/register">
            <Button size="lg" className="shadow-glow-md">
              Start for free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-[var(--border)] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded prime-gradient flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-medium text-[var(--text-secondary)]">Prime</span>
          </div>
          <p>© {new Date().getFullYear()} Prime. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Privacy</a>
            <a href="#" className="hover:text-[var(--text-primary)] transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
