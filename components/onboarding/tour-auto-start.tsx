'use client'

import { useEffect, useRef } from 'react'
import { Profile } from '@/types'
import { startTour, isTourCompleted } from './product-tour'

interface TourAutoStartProps {
  profile: Profile
}

/**
 * Auto-starts the product tour for first-time users.
 * Runs only when:
 *  1. Onboarding modal has already been completed (onboarding_completed === true)
 *  2. The tour has not been completed yet (checked via localStorage)
 *
 * Completely independent of the onboarding flow.
 */
export function TourAutoStart({ profile }: TourAutoStartProps) {
  const started = useRef(false)

  useEffect(() => {
    // Don't start while the onboarding modal is still showing
    if (!profile.onboarding_completed) return
    // Don't start if the user has already done the tour
    if (isTourCompleted(profile.role)) return
    // Guard against double-fire in strict mode
    if (started.current) return
    started.current = true

    // Delay long enough for the sidebar nav items to be painted
    const timer = setTimeout(() => {
      startTour(profile.role)
    }, 800)

    return () => clearTimeout(timer)
  }, [profile.onboarding_completed, profile.role])

  return null
}
