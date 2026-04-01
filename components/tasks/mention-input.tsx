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

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
    }))

    const filteredMembers = members.filter((m) =>
      m.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
    )

    // Extract mentioned user IDs from content
    const extractMentions = useCallback(
      (text: string): string[] => {
        const regex = /@(\w[\w\s]*?)(?=\s|$|[^a-zA-Z\s])/g
        const ids: string[] = []
        let match
        while ((match = regex.exec(text)) !== null) {
          const name = match[1].trim()
          const member = members.find(
            (m) => m.full_name.toLowerCase() === name.toLowerCase()
          )
          if (member && !ids.includes(member.id)) {
            ids.push(member.id)
          }
        }
        return ids
      },
      [members]
    )

    useEffect(() => {
      if (onMentionedUsers) {
        onMentionedUsers(extractMentions(value))
      }
    }, [value, extractMentions, onMentionedUsers])

    function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
      const text = e.target.value
      const cursor = e.target.selectionStart ?? 0
      onChange(text)

      // Find @ trigger
      const beforeCursor = text.slice(0, cursor)
      const atIndex = beforeCursor.lastIndexOf('@')

      if (atIndex !== -1) {
        const afterAt = beforeCursor.slice(atIndex + 1)
        // Only trigger if no space before cursor (still in mention)
        if (!afterAt.includes(' ') || afterAt.length === 0) {
          setMentionQuery(afterAt)
          setMentionStart(atIndex)
          setShowDropdown(true)
          setSelectedIndex(0)
          return
        }
      }

      setShowDropdown(false)
      setMentionStart(null)
    }

    function selectMember(member: Profile) {
      if (mentionStart === null) return

      const before = value.slice(0, mentionStart)
      const after = value.slice(mentionStart + 1 + mentionQuery.length)
      const newValue = `${before}@${member.full_name} ${after}`
      onChange(newValue)
      setShowDropdown(false)
      setMentionStart(null)

      // Restore focus + move cursor
      setTimeout(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.focus()
          const pos = before.length + member.full_name.length + 2
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

        {/* Mention dropdown */}
        {showDropdown && filteredMembers.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-md border bg-popover shadow-lg py-1 max-h-48 overflow-y-auto"
          >
            {filteredMembers.map((member, idx) => (
              <button
                key={member.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectMember(member)
                }}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                  idx === selectedIndex && 'bg-accent'
                )}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={member.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {getInitials(member.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate">{member.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }
)
