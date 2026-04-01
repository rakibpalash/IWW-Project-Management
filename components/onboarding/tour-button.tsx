'use client'

import { Button } from '@/components/ui/button'
import { Map } from 'lucide-react'
import { startTour } from './product-tour'
import { Role } from '@/types'

interface TourButtonProps {
  role: Role
  variant?: 'default' | 'outline' | 'ghost' | 'secondary'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}

export function TourButton({
  role,
  variant = 'outline',
  size = 'sm',
  className,
}: TourButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => startTour(role)}
    >
      <Map className="h-4 w-4 mr-2" />
      Take a Tour
    </Button>
  )
}
