'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CalendarDays } from 'lucide-react'
import { AttendanceRecord } from '@/types'
import { getAttendanceColor, formatStatus } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { format, parseISO } from 'date-fns'

interface Props {
  monthRecords: AttendanceRecord[]
}

export function MonthlySummaryCard({ monthRecords }: Props) {
  const now = new Date()
  const monthName = format(now, 'MMMM yyyy')

  const summary = useMemo(() => {
    const counts = {
      on_time: 0,
      late_150: 0,
      late_250: 0,
      absent: 0,
      advance_absence: 0,
    }
    for (const r of monthRecords) {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts]++
      }
    }
    return counts
  }, [monthRecords])

  const rowClass = (status: string) => {
    const map: Record<string, string> = {
      on_time: 'bg-green-50/50 hover:bg-green-50',
      late_150: 'bg-yellow-50/50 hover:bg-yellow-50',
      late_250: 'bg-orange-50/50 hover:bg-orange-50',
      absent: 'bg-red-50/50 hover:bg-red-50',
      advance_absence: 'bg-purple-50/50 hover:bg-purple-50',
    }
    return map[status] ?? ''
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarDays className="h-4 w-4" />
          {monthName} — Detail
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-72 pr-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs w-24">Date</TableHead>
                <TableHead className="text-xs">Check In</TableHead>
                <TableHead className="text-xs">Check Out</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthRecords.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
                    No records this month
                  </TableCell>
                </TableRow>
              )}
              {monthRecords.map((record) => (
                <TableRow key={record.id} className={rowClass(record.status)}>
                  <TableCell className="text-xs font-medium">
                    {format(parseISO(record.date), 'EEE, MMM d')}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {record.check_in_time ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    {record.check_out_time ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs px-1.5 py-0', getAttendanceColor(record.status))}
                    >
                      {formatStatus(record.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Summary bar */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs">
          <span className="text-green-700 font-medium">
            On Time: <strong>{summary.on_time}</strong>
          </span>
          <span className="text-yellow-700 font-medium">
            Late 150%: <strong>{summary.late_150}</strong>
          </span>
          <span className="text-orange-700 font-medium">
            Late 250%: <strong>{summary.late_250}</strong>
          </span>
          <span className="text-red-700 font-medium">
            Absent: <strong>{summary.absent}</strong>
          </span>
          {summary.advance_absence > 0 && (
            <span className="text-purple-700 font-medium">
              Advance Absence: <strong>{summary.advance_absence}</strong>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
