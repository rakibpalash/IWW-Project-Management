'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Download, ChevronDown, Loader2 } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'

// ── Stat Card ──────────────────────────────────────────────────────────────────

export function StatCard({
  label, value, sub, color = 'bg-primary/10 text-primary',
}: {
  label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

// ── Bar Chart (CSS-only) ───────────────────────────────────────────────────────

export function BarChart({
  data, maxValue, height = 120,
}: {
  data: { label: string; value: number; color: string }[]
  maxValue?: number
  height?: number
}) {
  const max = maxValue ?? Math.max(...data.map(d => d.value), 1)
  return (
    <div className="flex items-end gap-2 w-full" style={{ height }}>
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center flex-1 gap-1">
          <span className="text-[10px] text-muted-foreground font-medium">{d.value}</span>
          <div
            className="w-full rounded-t-sm transition-all duration-500"
            style={{
              height: `${Math.max((d.value / max) * (height - 28), 2)}px`,
              backgroundColor: d.color,
            }}
          />
          <span className="text-[10px] text-muted-foreground text-center leading-tight truncate w-full text-center">
            {d.label}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Horizontal Bar ─────────────────────────────────────────────────────────────

export function HorizontalBar({
  label, value, max, color, suffix = '',
}: {
  label: string; value: number; max: number; color: string; suffix?: string
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground truncate max-w-[60%]">{label}</span>
        <span className="text-muted-foreground font-medium">{value}{suffix}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

// ── Progress Ring (mini) ───────────────────────────────────────────────────────

export function MiniProgress({ value, color = '#3b82f6' }: { value: number; color?: string }) {
  const clamp = Math.min(Math.max(value, 0), 100)
  const r = 14; const circ = 2 * Math.PI * r
  const offset = circ - (clamp / 100) * circ
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s' }} />
      </svg>
      <span className="absolute text-[9px] font-bold text-foreground">{clamp}%</span>
    </div>
  )
}

// ── Export Button ──────────────────────────────────────────────────────────────

export function ExportButton({
  title, buildRows, headers, filename,
}: {
  title: string
  headers: string[]
  filename: string
  buildRows: () => (string | number)[][]
}) {
  const slug = `${filename}-${format(new Date(), 'yyyy-MM-dd')}`

  function buildTableHtml() {
    const rows = buildRows()
    const thead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`
    const tbody = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')
    return `<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`
  }

  function exportCsv() {
    const rows = buildRows()
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${slug}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const html = `<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:Arial,sans-serif;font-size:11px;margin:24px}h2{margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:7px 10px;text-align:left;border:1px solid #d1d5db;font-size:10px}
      td{padding:6px 10px;border:1px solid #e5e7eb}tr:nth-child(even) td{background:#f9fafb}
    </style></head><body><h2>${title} — ${format(new Date(), 'MMM d, yyyy')}</h2>${buildTableHtml()}</body></html>`
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(html); win.document.close(); win.focus(); win.print()
  }

  function exportDoc() {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>${title}</title>
      <style>body{font-family:Arial;font-size:12pt}h2{margin-bottom:12pt}
      table{width:100%;border-collapse:collapse}
      th{background:#f3f4f6;padding:6pt 8pt;border:1pt solid #d1d5db;font-size:10pt}
      td{padding:5pt 8pt;border:1pt solid #e5e7eb}</style></head>
      <body><h2>${title} — ${format(new Date(), 'MMM d, yyyy')}</h2>${buildTableHtml()}</body></html>`
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `${slug}.doc`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
          <Download className="h-3.5 w-3.5" />Export<ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCsv}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf}>Export as PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={exportDoc}>Export as DOC</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Loading spinner ────────────────────────────────────────────────────────────

export function ReportLoading() {
  return (
    <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
      <span className="text-sm">Loading report…</span>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

export function ReportEmpty({ message = 'No data found for the selected filters.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground border border-dashed rounded-xl">
      <p className="text-sm">{message}</p>
    </div>
  )
}

// ── Badge color helpers ────────────────────────────────────────────────────────

export function statusColor(status: string) {
  const map: Record<string, string> = {
    todo: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-amber-100 text-amber-700',
    in_review: 'bg-blue-100 text-blue-700',
    done: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
    planning: 'bg-purple-100 text-purple-700',
    on_hold: 'bg-orange-100 text-orange-700',
    completed: 'bg-emerald-100 text-emerald-700',
  }
  return map[status] ?? 'bg-muted text-muted-foreground'
}

export function priorityColor(priority: string) {
  const map: Record<string, string> = {
    low: 'bg-blue-100 text-blue-700',
    medium: 'bg-yellow-100 text-yellow-700',
    high: 'bg-orange-100 text-orange-700',
    urgent: 'bg-red-100 text-red-700',
  }
  return map[priority] ?? 'bg-muted text-muted-foreground'
}

export function fmtHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
