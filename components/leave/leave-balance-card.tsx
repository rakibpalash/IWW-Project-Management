'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Calendar, Home, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LeaveBalanceCardProps {
  type: 'yearly' | 'work_from_home' | 'marriage'
  allocated: number
  used: number
}

const typeConfig = {
  yearly: {
    label: 'Annual Leave',
    icon: Calendar,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  work_from_home: {
    label: 'Work From Home',
    icon: Home,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-100',
  },
  marriage: {
    label: 'Marriage Leave',
    icon: Heart,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-100',
  },
}

export function LeaveBalanceCard({ type, allocated, used }: LeaveBalanceCardProps) {
  const config = typeConfig[type]
  const Icon = config.icon
  const remaining = Math.max(0, allocated - used)
  const percentage = allocated > 0 ? Math.min(100, (used / allocated) * 100) : 0

  const progressColor =
    allocated === 0
      ? 'bg-gray-200'
      : remaining === 0
        ? 'bg-red-500'
        : remaining / allocated > 0.5
          ? 'bg-green-500'
          : 'bg-yellow-500'

  const remainingTextColor =
    allocated === 0
      ? 'text-gray-500'
      : remaining === 0
        ? 'text-red-600'
        : remaining / allocated > 0.5
          ? 'text-green-600'
          : 'text-yellow-600'

  return (
    <Card className={cn('border', config.borderColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={cn('rounded-lg p-2', config.bgColor)}>
            <Icon className={cn('h-5 w-5', config.color)} />
          </div>
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {config.label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className={cn('text-3xl font-bold', remainingTextColor)}>{remaining}</p>
            <p className="text-xs text-muted-foreground">days remaining</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">{used}</span> used
            </p>
            <p>
              <span className="font-medium text-foreground">{allocated}</span> total
            </p>
          </div>
        </div>

        {allocated > 0 ? (
          <div className="space-y-1">
            <Progress value={percentage} className="h-2" indicatorClassName={progressColor} />
            <p className="text-xs text-muted-foreground text-right">
              {percentage.toFixed(0)}% used
            </p>
          </div>
        ) : (
          <div className="rounded-md bg-gray-50 p-2 text-center text-xs text-muted-foreground">
            No allocation — contact admin
          </div>
        )}
      </CardContent>
    </Card>
  )
}
