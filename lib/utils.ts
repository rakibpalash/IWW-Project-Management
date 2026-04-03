import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter, parseISO } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy')
}

export function formatDateTime(date: string | Date | null): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return formatDistanceToNow(d, { addSuffix: true })
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false
  return isAfter(new Date(), parseISO(dueDate))
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatHours(hours: number | null): string {
  if (hours === null) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    low: 'text-green-600 bg-green-50 border-green-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    urgent: 'text-red-600 bg-red-50 border-red-200',
  }
  return colors[priority] ?? 'text-gray-600 bg-gray-50 border-gray-200'
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planning: 'text-blue-600 bg-blue-50 border-blue-200',
    in_progress: 'text-purple-600 bg-purple-50 border-purple-200',
    on_hold: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    completed: 'text-green-600 bg-green-50 border-green-200',
    cancelled: 'text-gray-600 bg-gray-50 border-gray-200',
    todo: 'text-gray-600 bg-gray-50 border-gray-200',
    in_review: 'text-blue-600 bg-blue-50 border-blue-200',
    done: 'text-green-600 bg-green-50 border-green-200',
  }
  return colors[status] ?? 'text-gray-600 bg-gray-50 border-gray-200'
}

export function getAttendanceColor(status: string): string {
  const colors: Record<string, string> = {
    on_time: 'text-green-600 bg-green-50',
    late_150: 'text-yellow-600 bg-yellow-50',
    late_250: 'text-orange-600 bg-orange-50',
    absent: 'text-red-600 bg-red-50',
    advance_absence: 'text-purple-600 bg-purple-50',
  }
  return colors[status] ?? 'text-gray-600 bg-gray-50'
}

export function formatStatus(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$'
  let password = ''
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

export { computeStatusForRule as computeAttendanceStatus } from '@/lib/attendance-rules'
