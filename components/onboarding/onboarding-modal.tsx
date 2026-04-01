'use client'

import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Role } from '@/types'
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Users,
  FolderKanban,
  CalendarCheck,
  BarChart3,
  ShieldCheck,
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'

interface OnboardingModalProps {
  open: boolean
  role: Role
  fullName: string
  onSkip: () => void
  onFinish: () => void
}

// ── Role-specific copy ────────────────────────────────────────────────────────

const ROLE_GREETING: Record<Role, { headline: string; sub: string }> = {
  super_admin: {
    headline: 'Welcome, Admin!',
    sub: 'You can manage workspaces, projects, and your entire team from one place.',
  },
  staff: {
    headline: 'Welcome aboard!',
    sub: "You'll manage tasks and track your time right here. Let's get you set up.",
  },
  client: {
    headline: 'Welcome!',
    sub: 'Track your project progress, view task statuses, and stay in the loop — all here.',
  },
}

const ROLE_FEATURES: Record<
  Role,
  { icon: React.ReactNode; title: string; description: string }[]
> = {
  super_admin: [
    {
      icon: <FolderKanban className="h-6 w-6 text-blue-500" />,
      title: 'Workspaces & Projects',
      description: 'Organise work into workspaces and create projects for each client or initiative.',
    },
    {
      icon: <Users className="h-6 w-6 text-purple-500" />,
      title: 'Team Management',
      description: 'Invite staff, assign roles, and manage permissions across your organisation.',
    },
    {
      icon: <CalendarCheck className="h-6 w-6 text-green-500" />,
      title: 'Attendance & Leave',
      description: 'Monitor daily check-ins, configure attendance rules, and approve leave requests.',
    },
  ],
  staff: [
    {
      icon: <CheckSquare className="h-6 w-6 text-blue-500" />,
      title: 'My Tasks',
      description: 'See all tasks assigned to you, update statuses, and add comments in real time.',
    },
    {
      icon: <Clock className="h-6 w-6 text-orange-500" />,
      title: 'Time Tracker',
      description: 'Log time against tasks effortlessly and keep your timesheets accurate.',
    },
    {
      icon: <CalendarCheck className="h-6 w-6 text-green-500" />,
      title: 'Attendance & Leave',
      description: 'Check in each morning, request leave, and view your remaining balance.',
    },
  ],
  client: [
    {
      icon: <FolderKanban className="h-6 w-6 text-blue-500" />,
      title: 'Your Projects',
      description: "Get a bird's-eye view of every project we are running for you.",
    },
    {
      icon: <BarChart3 className="h-6 w-6 text-purple-500" />,
      title: 'Progress Tracking',
      description: 'Live progress bars and status updates keep you informed at all times.',
    },
    {
      icon: <Eye className="h-6 w-6 text-green-500" />,
      title: 'Task Visibility',
      description: 'Drill into individual tasks and milestones to see exactly where things stand.',
    },
  ],
}

const ROLE_TIPS: Record<Role, { title: string; body: string }[]> = {
  super_admin: [
    {
      title: 'Create your first workspace',
      body: 'Head to the Workspaces section to create a workspace and start adding projects.',
    },
    {
      title: 'Invite your team',
      body: 'Go to Settings → Team to invite staff members and assign them to workspaces.',
    },
    {
      title: 'Configure attendance rules',
      body: 'Visit Attendance → Settings to set check-in windows and late-arrival thresholds.',
    },
  ],
  staff: [
    {
      title: 'Check in every morning',
      body: 'Open Attendance and hit Check In as soon as you start work to keep your record clean.',
    },
    {
      title: 'Update your task statuses',
      body: 'Move tasks through Todo → In Progress → In Review → Done as you work.',
    },
    {
      title: 'Log time as you go',
      body: 'Use the Time Tracker on each task to keep accurate records of your work hours.',
    },
  ],
  client: [
    {
      title: 'Bookmark your dashboard',
      body: 'Your dashboard gives you a real-time summary of all active projects at a glance.',
    },
    {
      title: 'Explore task details',
      body: 'Click any task to see its description, assignees, and the latest activity.',
    },
    {
      title: 'Reach out if you need help',
      body: 'Use the comments section on tasks to ask questions directly to the team.',
    },
  ],
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardingModal({
  open,
  role,
  fullName,
  onSkip,
  onFinish,
}: OnboardingModalProps) {
  const [step, setStep] = useState(0)
  const totalSteps = 3

  const firstName = fullName.split(' ')[0] || fullName
  const greeting = ROLE_GREETING[role]
  const features = ROLE_FEATURES[role]
  const tips = ROLE_TIPS[role]

  const progressPct = ((step + 1) / totalSteps) * 100

  function handleNext() {
    if (step < totalSteps - 1) setStep((s) => s + 1)
    else onFinish()
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onSkip() }}>
      <DialogContent
        className="max-w-lg p-0 overflow-hidden gap-0"
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header bar */}
        <div className="relative bg-gradient-to-br from-blue-600 to-indigo-700 px-8 pt-8 pb-6 text-white">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 rounded-full p-1 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-7 w-7 opacity-90" />
            <span className="text-sm font-medium uppercase tracking-wider opacity-80">
              IWW Project Manager
            </span>
          </div>

          {step === 0 && (
            <div
              className="transition-all duration-300 ease-in-out"
              key="step-0-header"
            >
              <h2 className="text-2xl font-bold mb-1">
                {greeting.headline.replace('!', `, ${firstName}!`)}
              </h2>
              <p className="text-sm text-white/80">{greeting.sub}</p>
            </div>
          )}

          {step === 1 && (
            <div key="step-1-header" className="transition-all duration-300">
              <h2 className="text-2xl font-bold mb-1">Key Features</h2>
              <p className="text-sm text-white/80">
                Here's what you can do with IWW PM.
              </p>
            </div>
          )}

          {step === 2 && (
            <div key="step-2-header" className="transition-all duration-300">
              <h2 className="text-2xl font-bold mb-1">Quick-Start Tips</h2>
              <p className="text-sm text-white/80">
                A few things to get you going right away.
              </p>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-5">
            <Progress
              value={progressPct}
              className="h-1 bg-white/20 [&>div]:bg-white"
            />
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 min-h-[220px]">
          {/* Step 1 – Welcome */}
          {step === 0 && (
            <div
              key="step-0-body"
              className="flex flex-col items-center text-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <LayoutDashboard className="h-16 w-16 text-indigo-500 mt-2" />
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                This short guide will help you understand the platform and
                configure it for your needs. You can always replay this tour
                from the Settings page.
              </p>
            </div>
          )}

          {/* Step 2 – Features */}
          {step === 1 && (
            <div
              key="step-1-body"
              className="grid gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">{f.icon}</div>
                  <div>
                    <p className="font-medium text-sm">{f.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                      {f.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Step 3 – Tips */}
          {step === 2 && (
            <ol
              key="step-2-body"
              className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              {tips.map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-medium text-sm">{t.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                      {t.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-4 border-t bg-muted/30">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2 rounded-full transition-all duration-200 ${
                  i === step
                    ? 'w-5 bg-indigo-600'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            )}

            {step < totalSteps - 1 ? (
              <>
                <Button variant="ghost" size="sm" onClick={onSkip}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleNext}>
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={onFinish}>
                Get Started
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
