'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Profile } from '@/types'
import { OnboardingModal } from './onboarding-modal'
import { completeOnboardingAction } from '@/app/actions/user'
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

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)

  useEffect(() => {
    // Show onboarding modal if not yet completed
    if (!profile.onboarding_completed) {
      setShowOnboarding(true)
      return
    }

    // Soft-prompt for password change — only once per session
    if (profile.is_temp_password) {
      const dismissed = sessionStorage.getItem('pwd_prompt_dismissed')
      if (!dismissed) {
        setShowPasswordPrompt(true)
      }
    }
  }, [profile.onboarding_completed, profile.is_temp_password])

  async function markOnboardingComplete() {
    // Use server action so admin client writes the DB and busts the profile cache
    await completeOnboardingAction()

    setShowOnboarding(false)

    // Refresh server components so the new onboarding_completed=true is picked up
    router.refresh()

    // After dismissing onboarding, show password prompt if needed (only if not yet dismissed this session)
    if (profile.is_temp_password && !sessionStorage.getItem('pwd_prompt_dismissed')) {
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
    sessionStorage.setItem('pwd_prompt_dismissed', '1')
    setShowPasswordPrompt(false)
    router.push('/settings/profile')
  }

  function handlePasswordPromptDismiss() {
    sessionStorage.setItem('pwd_prompt_dismissed', '1')
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
