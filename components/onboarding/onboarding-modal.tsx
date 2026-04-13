'use client'

import { useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Role } from '@/types'
import {
  CheckSquare, Clock, CalendarCheck, FolderKanban,
  Users, BarChart3, Eye, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface OnboardingModalProps {
  open: boolean
  role: Role
  fullName: string
  onSkip: () => void
  onFinish: () => void
}

// ── Role content ──────────────────────────────────────────────────────────────

const STAFF_FEATURES = [
  { icon: <CheckSquare className="h-5 w-5 text-blue-500" />,    title: 'My Tasks',         desc: 'See all tasks assigned to you and update statuses in real time.' },
  { icon: <Clock className="h-5 w-5 text-orange-500" />,        title: 'Time Tracker',     desc: 'Log time against tasks and keep your timesheets accurate.' },
  { icon: <CalendarCheck className="h-5 w-5 text-green-500" />, title: 'Attendance',       desc: 'Check in each morning and manage your leave requests.' },
]

const ROLE_FEATURES: Record<Role, typeof STAFF_FEATURES> = {
  super_admin: [
    { icon: <FolderKanban className="h-5 w-5 text-blue-500" />,   title: 'Workspaces & Projects', desc: 'Organise work into workspaces and create projects for each client.' },
    { icon: <Users className="h-5 w-5 text-purple-500" />,        title: 'Team Management',       desc: 'Invite staff, assign roles, and manage permissions.' },
    { icon: <CalendarCheck className="h-5 w-5 text-green-500" />, title: 'Attendance',            desc: 'Monitor daily check-ins and approve leave requests.' },
  ],
  account_manager: STAFF_FEATURES,
  project_manager: STAFF_FEATURES,
  staff:           STAFF_FEATURES,
  client: [
    { icon: <FolderKanban className="h-5 w-5 text-blue-500" />,  title: 'Your Projects',   desc: "Bird's-eye view of every project we're running for you." },
    { icon: <BarChart3 className="h-5 w-5 text-purple-500" />,   title: 'Progress',        desc: 'Live progress bars and status updates keep you informed.' },
    { icon: <Eye className="h-5 w-5 text-green-500" />,          title: 'Task Visibility', desc: 'Drill into tasks and milestones to see exactly where things stand.' },
  ],
  partner: [
    { icon: <FolderKanban className="h-5 w-5 text-blue-500" />,  title: 'Your Projects',   desc: "Bird's-eye view of every project we're running with you." },
    { icon: <BarChart3 className="h-5 w-5 text-purple-500" />,   title: 'Progress',        desc: 'Live progress bars and status updates keep you informed.' },
    { icon: <Eye className="h-5 w-5 text-green-500" />,          title: 'Task Visibility', desc: 'Drill into tasks to see exactly where things stand.' },
  ],
}

const STAFF_TIPS = [
  { title: 'Check in every morning',      body: 'Open Attendance and hit Check In as soon as you start work.' },
  { title: 'Update your task statuses',   body: 'Move tasks through Todo → In Progress → Done as you work.' },
  { title: 'Log time as you go',          body: 'Use the Time Tracker on each task for accurate hours.' },
]

const ROLE_TIPS: Record<Role, { title: string; body: string }[]> = {
  super_admin: [
    { title: 'Create your first space', body: 'Head to Spaces to create one and start adding projects.' },
    { title: 'Invite your team',            body: 'Go to Settings → Team to invite staff members.' },
    { title: 'Configure attendance rules',  body: 'Visit Attendance → Settings to set check-in windows.' },
  ],
  account_manager: STAFF_TIPS,
  project_manager: STAFF_TIPS,
  staff:           STAFF_TIPS,
  client: [
    { title: 'Bookmark your dashboard', body: 'Your dashboard gives a real-time summary of all active projects.' },
    { title: 'Explore task details',    body: 'Click any task to see its description, assignees, and activity.' },
    { title: 'Reach out if needed',     body: 'Use task comments to ask questions directly to the team.' },
  ],
  partner: [
    { title: 'Bookmark your dashboard', body: 'Your dashboard gives a real-time summary of all active projects.' },
    { title: 'Explore task details',    body: 'Click any task to see its description, assignees, and activity.' },
    { title: 'Reach out if needed',     body: 'Use task comments to ask questions directly to the team.' },
  ],
}

// ── Theme preview thumbnails ──────────────────────────────────────────────────

function LightPreview() {
  return (
    <div className="w-full h-full rounded bg-gray-100 p-2 flex flex-col gap-1.5">
      <div className="flex gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-gray-300" />
        <div className="h-1.5 w-8 rounded bg-gray-300" />
      </div>
      <div className="flex gap-1.5 flex-1">
        <div className="w-8 rounded bg-gray-200 flex flex-col gap-1 p-1">
          {[3,5,4].map((w,i) => <div key={i} className={`h-1 rounded bg-gray-300`} style={{width:`${w*6}px`}} />)}
        </div>
        <div className="flex-1 rounded bg-white flex flex-col gap-1 p-1">
          <div className="h-2 w-16 rounded bg-indigo-300" />
          {[8,6,7].map((w,i) => <div key={i} className="h-1 rounded bg-gray-200" style={{width:`${w*7}px`}} />)}
        </div>
      </div>
    </div>
  )
}

function DarkPreview() {
  return (
    <div className="w-full h-full rounded bg-gray-900 p-2 flex flex-col gap-1.5">
      <div className="flex gap-1">
        <div className="h-1.5 w-1.5 rounded-full bg-gray-600" />
        <div className="h-1.5 w-8 rounded bg-gray-600" />
      </div>
      <div className="flex gap-1.5 flex-1">
        <div className="w-8 rounded bg-gray-800 flex flex-col gap-1 p-1">
          {[3,5,4].map((w,i) => <div key={i} className="h-1 rounded bg-gray-700" style={{width:`${w*6}px`}} />)}
        </div>
        <div className="flex-1 rounded bg-gray-800 flex flex-col gap-1 p-1">
          <div className="h-2 w-16 rounded bg-indigo-500" />
          {[8,6,7].map((w,i) => <div key={i} className="h-1 rounded bg-gray-700" style={{width:`${w*7}px`}} />)}
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OnboardingModal({ open, role, fullName, onSkip, onFinish }: OnboardingModalProps) {
  const { setTheme, theme } = useTheme()
  const [step, setStep]             = useState(0)
  const [selectedTheme, setSelectedTheme] = useState<'light' | 'dark'>(theme === 'dark' ? 'dark' : 'light')

  const totalSteps = 4
  const firstName  = fullName.split(' ')[0] || fullName
  const features   = ROLE_FEATURES[role]
  const tips       = ROLE_TIPS[role]

  function handleNext() {
    if (step === 1) {
      setTheme(selectedTheme)
    }
    if (step < totalSteps - 1) setStep(s => s + 1)
    else onFinish()
  }

  function handleDotClick(i: number) {
    if (step === 1) setTheme(selectedTheme)
    setStep(i)
  }

  const isLast = step === totalSteps - 1

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-10">

      {/* Top spacer */}
      <div />

      {/* Content */}
      <div className="flex flex-col items-center text-center w-full max-w-md">

        {/* Step 1 — Welcome */}
        {step === 0 && (
          <div className="flex flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* App icon */}
            <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg">
              <FolderKanban className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Welcome to IWW PM</h1>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto">
                A purpose-built system for managing projects, teams, and client work — all in one place.
              </p>
            </div>
            <Button
              size="lg"
              className="w-64 mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleNext}
            >
              Get started
            </Button>
          </div>
        )}

        {/* Step 2 — Choose theme */}
        {step === 1 && (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Choose your style</h1>
              <p className="text-muted-foreground text-sm">Change your theme at any time via Settings.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              {([
                { value: 'light', label: 'Light', preview: <LightPreview /> },
                { value: 'dark',  label: 'Dark',  preview: <DarkPreview /> },
              ] as const).map(({ value, label, preview }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedTheme(value)}
                  className={cn(
                    'rounded-xl border-2 p-2 text-sm font-medium transition-all',
                    selectedTheme === value
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
                      : 'border-border hover:border-muted-foreground/40'
                  )}
                >
                  <div className="h-28 w-full mb-2 rounded overflow-hidden">
                    {preview}
                  </div>
                  {label}
                </button>
              ))}
            </div>

            <Button
              size="lg"
              className="w-64 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleNext}
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 3 — Key features */}
        {step === 2 && (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {role === 'super_admin' ? `Welcome, ${firstName}!` : `Hi ${firstName}!`}
              </h1>
              <p className="text-muted-foreground text-sm">Here's what you can do with IWW PM.</p>
            </div>

            <div className="w-full space-y-3 text-left">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-3.5">
                  <div className="mt-0.5 shrink-0">{f.icon}</div>
                  <div>
                    <p className="font-semibold text-sm">{f.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="w-64 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleNext}
            >
              Continue <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 4 — Tips */}
        {step === 3 && (
          <div className="flex flex-col items-center gap-6 w-full animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Quick-start tips</h1>
              <p className="text-muted-foreground text-sm">A few things to get you going right away.</p>
            </div>

            <div className="w-full space-y-3 text-left">
              {tips.map((t, i) => (
                <div key={i} className="flex gap-3 rounded-xl border border-border p-3.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-sm">{t.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">{t.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="w-64 bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={onFinish}
            >
              Let's go!
            </Button>
          </div>
        )}
      </div>

      {/* Bottom — dots + skip */}
      <div className="flex flex-col items-center gap-4">
        {/* Pagination dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleDotClick(i)}
              aria-label={`Step ${i + 1}`}
              className={cn(
                'h-2 rounded-full transition-all duration-200',
                i === step
                  ? 'w-5 bg-indigo-600'
                  : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>

    </div>
  )
}
