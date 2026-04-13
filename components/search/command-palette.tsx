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
  type: 'project' | 'task' | 'workspace'
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
      { data: projects },
      { data: tasks },
      { data: workspaces },
    ] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, status')
        .ilike('name', term)
        .limit(5),
      supabase
        .from('tasks')
        .select('id, title, status, project:projects(id, name)')
        .ilike('title', term)
        .limit(5),
      supabase
        .from('workspaces')
        .select('id, name')
        .ilike('name', term)
        .limit(5),
    ])

    const combined: SearchResult[] = [
      ...(workspaces ?? []).map((w) => ({
        id: w.id,
        label: w.name,
        type: 'workspace' as const,
        href: `/spaces/${w.id}`,
      })),
      ...(projects ?? []).map((p) => ({
        id: p.id,
        label: p.name,
        type: 'project' as const,
        href: `/lists/${p.id}`,
        sub: p.status.replace(/_/g, ' '),
      })),
      ...(tasks ?? []).map((t) => ({
        id: t.id,
        label: t.title,
        type: 'task' as const,
        href: `/tasks/${t.id}`,
        sub: (t.project as { name?: string } | null)?.name,
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

  const projectResults = results.filter((r) => r.type === 'project')
  const taskResults = results.filter((r) => r.type === 'task')
  const workspaceResults = results.filter((r) => r.type === 'workspace')

  return (
    <CommandDialog open={commandPaletteOpen} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search projects, tasks, spaces…"
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

        {workspaceResults.length > 0 && (
          <>
            <CommandGroup heading="Spaces">
              {workspaceResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`workspace-${r.id}-${r.label}`}
                  onSelect={() => handleSelect(r.href)}
                  className="flex items-center gap-2 cursor-pointer"
                >
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span>{r.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {(projectResults.length > 0 || taskResults.length > 0) && (
              <CommandSeparator />
            )}
          </>
        )}

        {projectResults.length > 0 && (
          <>
            <CommandGroup heading="Projects">
              {projectResults.map((r) => (
                <CommandItem
                  key={r.id}
                  value={`project-${r.id}-${r.label}`}
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
