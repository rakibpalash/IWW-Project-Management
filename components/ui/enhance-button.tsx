'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'

interface EnhanceButtonProps {
  value: string
  onEnhanced: (enhanced: string) => void
  context?: string
  className?: string
}

export function EnhanceButton({ value, onEnhanced, context, className }: EnhanceButtonProps) {
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  async function handleEnhance() {
    if (!value.trim()) {
      toast({ title: 'Nothing to enhance', description: 'Write something in the description first.', variant: 'destructive' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/ai/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: value, context }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast({ title: 'Enhancement failed', description: data.error ?? 'Something went wrong.', variant: 'destructive' })
        return
      }
      onEnhanced(data.enhanced)
      toast({ title: 'Description enhanced' })
    } catch {
      toast({ title: 'Enhancement failed', description: 'Could not reach AI service.', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleEnhance}
      disabled={loading || !value.trim()}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm',
        'transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {loading
        ? <Loader2 className="h-3 w-3 animate-spin" />
        : <Sparkles className="h-3 w-3" />
      }
      {loading ? 'Enhancing…' : 'Enhance prompt'}
    </button>
  )
}
