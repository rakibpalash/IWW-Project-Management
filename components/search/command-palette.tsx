'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUIStore } from '@/store/ui-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { FolderKanban, CheckSquare, Building2, Loader2 } from 'lucide-react'

interface SearchResult {
  id: string
  label: string
  type: 'list' | 'task' | 'space'
  href: string
  sub?: string
}

export function CommandPalette() {
  const router = useRouter()
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)

  // ── Keyboard shortcut ───────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPaletteOpen(!commandPaletteOpen)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [commandPaletteOpen, setCommandPaletteOpen])

  // ── Search ──────────────────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    const supabase = createClient()
    const term = `%${q}%`

    const [
      { data: lists },
      { data: tasks },
      { data: spaces },
    ] = await Promise.all([
      supabase
        .from('lists')
        .select('id, name, status')
        .ilike('name', term)
        .limit(5),
      supabase
        .from('tasks')
        .select('id, title, status, list:lists(id, name)')
        .ilike('title', term)
        .limit(5),
      supabase
        .from('spaces')
        .select('id, name')
        .ilike('name', term)
        .limit(5),
    ])

    const combined: SearchResult[] = [
      ...(spaces ?? []).map((w) => ({
        id: w.id,
        label: w.name,
        type: 'space' as const,
        href: `/spaces/${w.id}`,
      })),
      ...(lists ?? []).map((p) => ({
        id: p.id,
        label: p.name,
        type: 'list' as const,
        href: `/lists/${p.id}`,
        sub: p.status.replace(/_/g, ' '),
      })),
      ...(tasks ?? []).map((t) => ({
        id: t.id,
        label: t.title,
        type: 'task' as const,
        href: `/tasks/${t.id}`,
        sub: (t.list as { name?: string } | null)?.name,
      })),
    ]

    setResults(combined)
    setLoading(false)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200)
    return () => clearTimeout(timer)
  }, [query, search])

  function handleSelect(href: string) {
    setCommandPaletteOpen(false)
    setQuery('')
    setResults([])
    router.push(href)
  }

  function handleOpenChange(open: boolean) {
    setCommandPaletteOpen(open)
    if (!open) {
      setQuery('')
      setResults([])
    }
  }

  const listResults = results.filter((r) => r.type === 'list')
  const taskResults = results.filter((r) => r.type === 'task')
  const spaceResults = results.filter((r) => r.type === 'space')

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search lists, tasks, spaces…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching…
          </div>
        )}

        {!loading && query && results.length === 0 && (
          <CommandEmpty>No results found for "{query}".</CommandEmpty>
        )}

        {!loading && !query && (
          <CommandEmpty>Start typing to search…</CommandEmpty>
        )}

        {spaceResults.length > 0 && (
          <>
            <CommandGroup heading="Spaces">
              {spaceResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`space-${r.id}-${r.label}`}
                  onSelect={() => handleSelect(r.href)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {(listResults.length > 0 || taskResults.length > 0) && (
              <CommandSeparator />
            )}
          </>
        )}

        {listResults.length > 0 && (
          <>
            <CommandGroup heading="Lists">
              {listResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`list-${r.id}-${r.label}`}
                  onSelect={() => handleSelect(r.href)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate">{r.label}</span>
                  {r.sub && (
                    <span className="text-xs text-muted-foreground capitalize">
                      {r.sub}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {taskResults.length > 0 && <CommandSeparator />}
          </>
        )}

        {taskResults.length > 0 && (
          <CommandGroup heading="Tasks">
            {taskResults.map((r) => (
              <CommandItem
                key={r.id}
                value={`task-${r.id}-${r.label}`}
                onSelect={() => handleSelect(r.href)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{r.label}</span>
                {r.sub && (
                  <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                    {r.sub}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  )
}
