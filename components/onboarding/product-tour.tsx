'use client'

import { driver, DriveStep, Config } from 'driver.js'
import 'driver.js/dist/driver.css'
import { Role } from '@/types'

// ── Tour step definitions ─────────────────────────────────────────────────────

const SUPER_ADMIN_STEPS: DriveStep[] = [
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: 'Navigation Sidebar',
      description:
        'Use the sidebar to move between Spaces, Projects, Tasks, Attendance, and Settings.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: 'Dashboard Overview',
      description:
        "These cards give you a real-time snapshot of active projects, overdue tasks, and today's attendance.",
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-workspaces"]',
    popover: {
      title: 'Spaces',
      description:
        'Create and manage spaces to organise projects by client, department, or team.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-projects"]',
    popover: {
      title: 'Projects',
      description:
        'Browse all projects, filter by status or priority, and create new ones with a single click.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-attendance"]',
    popover: {
      title: 'Attendance',
      description:
        'View daily check-ins, set the Football Rule for match days, and configure cut-off times.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-reports"]',
    popover: {
      title: 'Reports',
      description:
        'Deep-dive into project time, task completion, member productivity, attendance, and leave usage across your whole organisation.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: 'Settings',
      description:
        'Manage team members, roles, attendance thresholds, task statuses, priorities, and your own profile here.',
      side: 'right',
      align: 'start',
    },
  },
]

const STAFF_STEPS: DriveStep[] = [
  {
    element: '[data-tour="nav-tasks"]',
    popover: {
      title: 'My Tasks',
      description:
        'All tasks assigned to you live here. Update statuses, log time, and leave comments.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-time-tracking"]',
    popover: {
      title: 'Time Tracker',
      description:
        'Start a timer or manually add time entries against any task to keep your timesheets up to date.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-attendance"]',
    popover: {
      title: 'Attendance Check-In',
      description:
        'Hit the Check In button each morning. The system will automatically calculate your status based on your arrival time.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="nav-leave"]',
    popover: {
      title: 'Leave Requests',
      description:
        'Apply for annual, work-from-home, or marriage leave and track your remaining balance.',
      side: 'right',
      align: 'start',
    },
  },
]

const CLIENT_STEPS: DriveStep[] = [
  {
    element: '[data-tour="nav-projects"]',
    popover: {
      title: 'Your Projects',
      description:
        'This section shows all projects the team is running on your behalf. Click any project to see details.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '[data-tour="dashboard-stats"]',
    popover: {
      title: 'Project Progress',
      description:
        'Progress bars and status badges give you an instant view of how each project is tracking.',
      side: 'bottom',
      align: 'start',
    },
  },
]

const TOUR_STEPS: Record<Role, DriveStep[]> = {
  super_admin: SUPER_ADMIN_STEPS,
  account_manager: STAFF_STEPS,
  project_manager: STAFF_STEPS,
  staff: STAFF_STEPS,
  client: CLIENT_STEPS,
  partner: CLIENT_STEPS,
}

const TOUR_COMPLETED_KEY = (role: Role) => `iww_tour_completed_${role}`

// ── Public API ────────────────────────────────────────────────────────────────

export function startTour(role: Role, onComplete?: () => void) {
  const steps = TOUR_STEPS[role]

  // Filter to only include steps whose target element actually exists in the DOM
  const availableSteps = steps.filter((s) => {
    if (!s.element || typeof s.element !== 'string') return true
    return !!document.querySelector(s.element)
  })

  if (availableSteps.length === 0) {
    console.warn('[ProductTour] No tour targets found in the DOM for role:', role)
    return
  }

  const config: Config = {
    animate: true,
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    steps: availableSteps,
    onDestroyStarted: () => {
      driverInstance.destroy()
    },
    onDestroyed: () => {
      localStorage.setItem(TOUR_COMPLETED_KEY(role), 'true')
      onComplete?.()
    },
  }

  const driverInstance = driver(config)
  driverInstance.drive()
}

export function isTourCompleted(role: Role): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(TOUR_COMPLETED_KEY(role)) === 'true'
}

export function resetTour(role: Role) {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOUR_COMPLETED_KEY(role))
}
