'use client'

import { motion } from 'framer-motion'
import {
  Bot,
  Plus,
  Play,
  Pause,
  Trash2,
  Zap,
  Globe,
  Code2,
  FileSearch,
  Mail,
  Calendar,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

interface Agent {
  id: string
  name: string
  description: string
  icon: React.ElementType
  status: 'active' | 'idle' | 'error'
  tasksRun: number
  lastRun?: string
  gradient: string
}

const DEMO_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Web Researcher',
    description: 'Browses the web, summarizes articles, and compiles research reports.',
    icon: Globe,
    status: 'active',
    tasksRun: 42,
    lastRun: '2 min ago',
    gradient: 'from-blue-500 to-cyan-500',
  },
  {
    id: '2',
    name: 'Code Assistant',
    description: 'Reviews code, fixes bugs, writes tests, and refactors on demand.',
    icon: Code2,
    status: 'idle',
    tasksRun: 128,
    lastRun: '1 hour ago',
    gradient: 'from-prime-500 to-violet-500',
  },
  {
    id: '3',
    name: 'Document Analyzer',
    description: 'Extracts key info, summaries, and insights from uploaded files.',
    icon: FileSearch,
    status: 'idle',
    tasksRun: 17,
    lastRun: '3 days ago',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    id: '4',
    name: 'Email Drafter',
    description: 'Composes, proofreads, and schedules professional emails.',
    icon: Mail,
    status: 'idle',
    tasksRun: 8,
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    id: '5',
    name: 'Calendar Planner',
    description: 'Analyzes your schedule, suggests optimal time blocks, and avoids conflicts.',
    icon: Calendar,
    status: 'error',
    tasksRun: 3,
    lastRun: '5 min ago',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    id: '6',
    name: 'Automation Hub',
    description: 'Connects apps and automates repetitive workflows without code.',
    icon: Zap,
    status: 'idle',
    tasksRun: 0,
    gradient: 'from-yellow-500 to-amber-500',
  },
]

const statusConfig = {
  active: { label: 'Active',  variant: 'success' as const },
  idle:   { label: 'Idle',    variant: 'default' as const },
  error:  { label: 'Error',   variant: 'error'   as const },
}

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
}
const itemVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1] } },
}

export default function AgentsPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Deploy autonomous agents to handle complex tasks
          </p>
        </div>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          New Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Agents',   value: '6',   color: 'text-prime-400' },
          { label: 'Active Now',     value: '1',   color: 'text-emerald-400' },
          { label: 'Tasks Completed', value: '198', color: 'text-blue-400' },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-4 text-center">
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Agent Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
      >
        {DEMO_AGENTS.map((agent) => {
          const Icon = agent.icon
          const status = statusConfig[agent.status]
          return (
            <motion.div
              key={agent.id}
              variants={itemVariants}
              className="glass rounded-2xl p-5 group hover:-translate-y-0.5 transition-all duration-200 hover:border-white/10"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className={cn(
                    'w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow',
                    agent.gradient
                  )}
                >
                  <Icon className="w-5 h-5 text-white" strokeWidth={1.8} />
                </div>
                <Badge variant={status.variant} size="sm">{status.label}</Badge>
              </div>

              <h3 className="font-semibold text-[var(--text-primary)] mb-1.5">
                {agent.name}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4">
                {agent.description}
              </p>

              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-4">
                <span>{agent.tasksRun} tasks run</span>
                {agent.lastRun && <span>Last: {agent.lastRun}</span>}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {agent.status === 'active' ? (
                    <><Pause className="w-3.5 h-3.5 mr-1.5" />Pause</>
                  ) : (
                    <><Play className="w-3.5 h-3.5 mr-1.5" />Run</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="px-2.5 text-[var(--text-muted)] hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          )
        })}

        {/* Add new agent card */}
        <motion.button
          variants={itemVariants}
          className={cn(
            'glass rounded-2xl p-5 border-dashed flex flex-col items-center justify-center gap-3',
            'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            'hover:border-prime-500/30 hover:bg-prime-500/5',
            'transition-all duration-200 cursor-pointer min-h-[200px]'
          )}
        >
          <div className="w-10 h-10 rounded-xl border border-dashed border-[var(--border)] flex items-center justify-center">
            <Plus className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium">Create Custom Agent</span>
          <span className="text-xs text-center max-w-[160px] text-[var(--text-muted)]">
            Define capabilities, tools, and automation rules
          </span>
        </motion.button>
      </motion.div>
    </div>
  )
}
