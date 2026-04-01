'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { Profile, FootballRule } from '@/types'
import { getInitials } from '@/lib/utils'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  staffProfiles: Profile[]
  initialDate: string
  currentRule: FootballRule | null
  onSaved: (rule: FootballRule) => void
}

export function FootballRuleDialog({
  open,
  onOpenChange,
  staffProfiles,
  initialDate,
  currentRule,
  onSaved,
}: Props) {
  const [date, setDate] = useState(initialDate)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [fetchingRule, setFetchingRule] = useState(false)
  const { toast } = useToast()

  // When dialog opens or date changes, load the rule for that date
  useEffect(() => {
    if (!open) return

    if (date === initialDate && currentRule) {
      setSelectedIds(new Set(currentRule.user_ids))
      return
    }

    const fetchRule = async () => {
      setFetchingRule(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('football_rules')
        .select('*')
        .eq('date', date)
        .maybeSingle()
      if (data) {
        setSelectedIds(new Set((data as FootballRule).user_ids))
      } else {
        setSelectedIds(new Set())
      }
      setFetchingRule(false)
    }
    fetchRule()
  }, [open, date])

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === staffProfiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(staffProfiles.map((p) => p.id)))
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error('Not authenticated')

      // UPSERT: if a rule already exists for this date, update it; otherwise insert
      const { data: existing } = await supabase
        .from('football_rules')
        .select('id')
        .eq('date', date)
        .maybeSingle()

      let result
      if (existing) {
        const { data, error } = await supabase
          .from('football_rules')
          .update({ user_ids: Array.from(selectedIds), created_by: user.id })
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) throw error
        result = data
      } else {
        const { data, error } = await supabase
          .from('football_rules')
          .insert({
            date,
            user_ids: Array.from(selectedIds),
            created_by: user.id,
          })
          .select('*')
          .single()
        if (error) throw error
        result = data
      }

      onSaved(result as FootballRule)
      toast({
        title: 'Football rule saved',
        description: `${selectedIds.size} staff member(s) assigned for ${date}`,
      })
      onOpenChange(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      toast({ title: 'Failed to save', description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const allSelected = selectedIds.size === staffProfiles.length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>⚽</span> Set Football Rule
          </DialogTitle>
          <DialogDescription>
            Select the date and staff who will follow the football check-in schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Date picker */}
          <div className="space-y-1.5">
            <Label htmlFor="football-date">Date</Label>
            <Input
              id="football-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Staff list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Staff Members</Label>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={toggleAll}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {fetchingRule ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ScrollArea className="h-60 border rounded-md">
                <div className="p-2 space-y-1">
                  {staffProfiles.map((staff) => (
                    <label
                      key={staff.id}
                      className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.has(staff.id)}
                        onCheckedChange={() => toggle(staff.id)}
                        id={`football-staff-${staff.id}`}
                      />
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={staff.avatar_url ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(staff.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{staff.full_name}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            )}

            <p className="text-xs text-muted-foreground">
              {selectedIds.size} of {staffProfiles.length} selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || fetchingRule}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
