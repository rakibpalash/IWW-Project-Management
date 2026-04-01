'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types'
import { OnboardingModal } from './onboarding-modal'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface OnboardingProviderProps {
  profile: Profile
  children: React.ReactNode
}

export function OnboardingProvider({ profile, children }: OnboardingProviderProps) {
  const router = useRouter()
  const supabase = createClient()

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)

  useEffect(() => {
    // Show onboarding modal if not yet completed
    if (!profile.onboarding_completed) {
      setShowOnboarding(true)
      return
    }

    // After onboarding, soft-prompt for password change if still on temp password
    if (profile.is_temp_password) {
      setShowPasswordPrompt(true)
    }
  }, [profile.onboarding_completed, profile.is_temp_password])

  async function markOnboardingComplete() {
    await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', profile.id)

    setShowOnboarding(false)

    // After dismissing onboarding, show password prompt if needed
    if (profile.is_temp_password) {
      setShowPasswordPrompt(true)
    }
  }

  function handleOnboardingSkip() {
    // Mark complete even on skip so we don't nag on every page load
    markOnboardingComplete()
  }

  function handleOnboardingFinish() {
    markOnboardingComplete()
  }

  function handlePasswordPromptConfirm() {
    setShowPasswordPrompt(false)
    router.push('/settings/profile')
  }

  function handlePasswordPromptDismiss() {
    setShowPasswordPrompt(false)
  }

  return (
    <>
      {children}

      {/* Multi-step onboarding modal */}
      <OnboardingModal
        open={showOnboarding}
        role={profile.role}
        fullName={profile.full_name}
        onSkip={handleOnboardingSkip}
        onFinish={handleOnboardingFinish}
      />

      {/* Soft password-change prompt */}
      <AlertDialog open={showPasswordPrompt} onOpenChange={setShowPasswordPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set a permanent password</AlertDialogTitle>
            <AlertDialogDescription>
              You are currently using a temporary password. We recommend setting a
              secure personal password now to protect your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handlePasswordPromptDismiss}>
              Maybe later
            </AlertDialogCancel>
            <AlertDialogAction onClick={handlePasswordPromptConfirm}>
              Change password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
