'use client'

import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'

export function SearchButton() {
  const { setCommandPaletteOpen } = useUIStore()

  return (
    <Button
      variant="outline"
      size="sm"
      className="relative hidden md:flex items-center gap-2 text-muted-foreground pr-2 pl-3 h-8 w-48 lg:w-64 justify-start"
      onClick={() => setCommandPaletteOpen(true)}
    >
      <Search className="h-3.5 w-3.5 shrink-0" />
      <span className="text-sm flex-1 text-left">Search…</span>
      <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  )
}
