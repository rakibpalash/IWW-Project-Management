'use client'

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
  forwardRef,
  useImperativeHandle,
} from 'react'
import { Profile } from '@/types'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn, getInitials } from '@/lib/utils'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  members: Profile[]
  placeholder?: string
  rows?: number
  className?: string
  onMentionedUsers?: (userIds: string[]) => void
  disabled?: boolean
}

export interface MentionInputHandle {
  focus: () => void
}

// Characters that terminate a mention (not part of any name)
const MENTION_BREAKERS = /[\n,.()\[\]{}<>!?;:'"]/

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
  function MentionInput(
    {
      value,
      onChange,
      members,
      placeholder = 'Write a comment…',
      rows = 3,
      className,
      onMentionedUsers,
      disabled = false,
    },
    ref
  ) {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [showDropdown, setShowDropdown] = useState(false)
    const [mentionQuery, setMentionQuery] = useState('')
    const [mentionStart, setMentionStart] = useState<number | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)

    // Reliable set of user IDs that were actually selected from the dropdown
    // Key: full_name (as inserted), Value: user id
    const selectedMentionsRef = useRef<Map<string, string>>(new Map())

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }))

    // Filter members by current query — allow spaces for multi-word names
    const filteredMembers = members.filter((m) =>
      m.full_name.toLowerCase().includes(mentionQuery.toLowerCase().trim())
    )

    // Build the final list of mentioned user IDs:
    // 1. Start from dropdown-selected mentions (reliable)
    // 2. Supplement with regex scan for manually typed @Name patterns
    const extractMentions = useCallback(
      (text: string): string[] => {
        const ids = new Set<string>()

        // Add reliably tracked (dropdown-selected) mentions
        for (const [name, userId] of selectedMentionsRef.current.entries()) {
          if (text.includes(`@${name}`)) {
            ids.add(userId)
          }
        }

        // Also scan for manually typed mentions using a greedy regex
        // Pattern: @Word (one or more words, greedy, stops at punctuation/newline)
        const regex = /@([\w][\w ]*?)(?=[,.()\[\]{}<>!?;:'"@\n]|$)/g
        let match
        while ((match = regex.exec(text)) !== null) {
          const name = match[1].trimEnd()
          const member = members.find(
            (m) => m.full_name.toLowerCase() === name.toLowerCase()
          )
          if (member) {
            ids.add(member.id)
          }
        }

        return Array.from(ids)
      },
      [members]
    )

    // Notify parent whenever value or members change
    useEffect(() => {
      if (onMentionedUsers) {
        onMentionedUsers(extractMentions(value))
      }
    }, [value, extractMentions, onMentionedUsers])

    function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
      const text = e.target.value
      const cursor = e.target.selectionStart ?? 0
      onChange(text)

      // Find the last @ before the cursor
      const beforeCursor = text.slice(0, cursor)
      const atIndex = beforeCursor.lastIndexOf('@')

      if (atIndex !== -1) {
        const afterAt = beforeCursor.slice(atIndex + 1)

        // Close if user typed a mention-breaking character
        if (MENTION_BREAKERS.test(afterAt)) {
          setShowDropdown(false)
          setMentionStart(null)
          return
        }

        // Keep dropdown open — spaces are OK for multi-word names
        setMentionQuery(afterAt)
        setMentionStart(atIndex)
        setShowDropdown(true)
        setSelectedIndex(0)
        return
      }

      setShowDropdown(false)
      setMentionStart(null)
    }

    function selectMember(member: Profile) {
      if (mentionStart === null) return

      const before = value.slice(0, mentionStart)
      const after = value.slice(mentionStart + 1 + mentionQuery.length)
      const inserted = `@${member.full_name} `
      const newValue = `${before}${inserted}${after}`

      // Track this selection reliably
      selectedMentionsRef.current.set(member.full_name, member.id)

      onChange(newValue)
      setShowDropdown(false)
      setMentionStart(null)
      setMentionQuery('')

      // Restore focus and move cursor right after the inserted mention
      setTimeout(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.focus()
          const pos = before.length + inserted.length
          textarea.setSelectionRange(pos, pos)
        }
      }, 0)
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
      if (!showDropdown || filteredMembers.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredMembers.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length)
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        selectMember(filteredMembers[selectedIndex])
      } else if (e.key === 'Escape') {
        e.preventDefault()
        setShowDropdown(false)
      }
    }

    // Close dropdown on outside click
    useEffect(() => {
      function handleClick(e: MouseEvent) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node) &&
          textareaRef.current &&
          !textareaRef.current.contains(e.target as Node)
        ) {
          setShowDropdown(false)
        }
      }
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    // Reset selected mentions when value is cleared externally (e.g. after submit)
    useEffect(() => {
      if (!value) {
        selectedMentionsRef.current.clear()
      }
    }, [value])

    return (
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none',
            className
          )}
        />

        {/* Mention dropdown — renders BELOW the textarea to avoid clipping */}
        {showDropdown && filteredMembers.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border bg-popover shadow-lg py-1 max-h-48 overflow-y-auto"
          >
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Mention a person
            </p>
            {filteredMembers.map((member, idx) => (
              <button
                key={member.id}
                type="button"
                onMouseDown={(e) => {
                  // preventDefault keeps textarea focused
                  e.preventDefault()
                  selectMember(member)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-left',
                  idx === selectedIndex && 'bg-accent'
                )}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={member.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium text-xs">{member.full_name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{member.email}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results hint */}
        {showDropdown && filteredMembers.length === 0 && mentionQuery.length > 0 && (
          <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border bg-popover shadow-lg px-3 py-2">
            <p className="text-xs text-muted-foreground">No members match "{mentionQuery.trim()}"</p>
          </div>
        )}
      </div>
    )
  }
)
