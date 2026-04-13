'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'
import { renameSpaceAction } from '@/app/actions/spaces'
import { Space } from '@/types'

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Space name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  description: z.string().max(500, 'Description must be 500 characters or less').optional(),
})

type FormValues = z.infer<typeof formSchema>

interface RenameSpaceDialogProps {
  space: Space | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (id: string, name: string, description: string | null) => void
}

export function RenameSpaceDialog({
  space,
  open,
  onOpenChange,
  onSuccess,
}: RenameSpaceDialogProps) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', description: '' },
  })

  // Populate form when space changes
  useEffect(() => {
    if (space) {
      form.reset({
        name: space.name,
        description: space.description ?? '',
      })
    }
  }, [space, form])

  async function onSubmit(values: FormValues) {
    if (!space) return
    setSaving(true)
    try {
      const result = await renameSpaceAction(
        space.id,
        values.name,
        values.description
      )

      if (!result.success) {
        toast({ title: 'Failed to rename', description: result.error, variant: 'destructive' })
        return
      }

      toast({ title: 'Space renamed', description: `Renamed to "${values.name}"` })
      onOpenChange(false)
      onSuccess(space.id, values.name, values.description?.trim() || null)
    } finally {
      setSaving(false)
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) form.reset()
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename Space</DialogTitle>
          <DialogDescription>
            Update the name and description for this space.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Marketing Team" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What is this space for?"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
