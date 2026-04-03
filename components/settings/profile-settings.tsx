'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Profile } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Upload, CheckCircle2, User, Mail, Camera } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateUserProfileAction } from '@/app/actions/user'

interface ProfileSettingsPageProps {
  profile: Profile
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function ProfileSettingsPage({ profile }: ProfileSettingsPageProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fullName, setFullName] = useState(profile.full_name)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const supabase = createClient()
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) {
        setError(uploadError.message)
        return
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath)
      setAvatarUrl(urlData.publicUrl + '?t=' + Date.now())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(false)

    const result = await updateUserProfileAction({
      full_name: fullName.trim(),
      avatar_url: avatarUrl,
    })

    setSaving(false)

    if (!result.success) {
      setError(result.error ?? 'Failed to save')
      return
    }

    setSuccess(true)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  const hasChanges = fullName !== profile.full_name || avatarUrl !== profile.avatar_url

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Update your personal information
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">
            Profile updated successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Avatar Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avatar</CardTitle>
          <CardDescription>Upload a profile photo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="text-xl bg-primary/10 text-primary">
                  {getInitials(fullName || profile.full_name)}
                </AvatarFallback>
              </Avatar>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || saving}
              >
                <Camera className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              <p className="text-xs text-muted-foreground">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Full Name
            </Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Email Address
            </Label>
            <Input
              value={profile.email}
              disabled
              className="bg-gray-50 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Email cannot be changed. Contact admin if needed.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => {
            setFullName(profile.full_name)
            setAvatarUrl(profile.avatar_url)
          }}
          disabled={!hasChanges || saving}
        >
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving || !hasChanges || uploading}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
