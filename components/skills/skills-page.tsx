'use client'

import { useState, useMemo } from 'react'
import { Profile, Skill, ProfileSkill, ProficiencyLevel } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { cn, getInitials } from '@/lib/utils'
import {
  Plus, Search, Zap, Star, Trash2, Pencil, X, ChevronDown
} from 'lucide-react'
import {
  upsertProfileSkillAction,
  removeProfileSkillAction,
  createSkillAction,
  deleteSkillAction,
} from '@/app/actions/skills'

// ── Constants ────────────────────────────────────────────────────────────────

const PROFICIENCY_LABELS: Record<ProficiencyLevel, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
}

const PROFICIENCY_COLORS: Record<ProficiencyLevel, string> = {
  1: 'bg-slate-400',
  2: 'bg-blue-400',
  3: 'bg-violet-500',
  4: 'bg-amber-400',
}

const SKILL_CATEGORIES = [
  'Development', 'Design', 'Management', 'Marketing', 'Soft Skills', 'Other',
]

const SKILL_COLORS = [
  '#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6',
  '#8B5CF6', '#EF4444', '#06B6D4', '#F97316', '#14B8A6',
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function ProficiencyBar({ level }: { level: ProficiencyLevel }) {
  return (
    <div className="flex gap-1">
      {([1, 2, 3, 4] as ProficiencyLevel[]).map((l) => (
        <div
          key={l}
          className={cn(
            'h-1.5 flex-1 rounded-full transition-colors',
            l <= level ? PROFICIENCY_COLORS[level] : 'bg-muted'
          )}
        />
      ))}
    </div>
  )
}

function ProficiencyStars({ level }: { level: ProficiencyLevel }) {
  return (
    <div className="flex items-center gap-0.5">
      {([1, 2, 3, 4] as ProficiencyLevel[]).map((l) => (
        <Star
          key={l}
          className={cn(
            'h-3.5 w-3.5',
            l <= level ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

function MemberAvatars({ users }: { users: Profile[] }) {
  const visible = users.slice(0, 4)
  const extra = users.length - visible.length
  return (
    <div className="flex items-center -space-x-2">
      {visible.map((u) => (
        <Avatar key={u.id} className="h-6 w-6 ring-2 ring-background">
          <AvatarImage src={u.avatar_url ?? undefined} />
          <AvatarFallback className="text-[10px]">{getInitials(u.full_name)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-medium">
          +{extra}
        </div>
      )}
    </div>
  )
}

// ── Add/Edit My Skill Dialog ─────────────────────────────────────────────────

interface AddSkillDialogProps {
  open: boolean
  onClose: () => void
  skills: Skill[]
  mySkills: ProfileSkill[]
  editingSkill?: ProfileSkill | null
}

function AddSkillDialog({ open, onClose, skills, mySkills, editingSkill }: AddSkillDialogProps) {
  const { toast } = useToast()
  const [selectedSkillId, setSelectedSkillId] = useState(editingSkill?.skill_id ?? '')
  const [proficiency, setProficiency] = useState<ProficiencyLevel>(editingSkill?.proficiency ?? 1)
  const [loading, setLoading] = useState(false)

  const availableSkills = editingSkill
    ? skills
    : skills.filter((s) => !mySkills.find((ms) => ms.skill_id === s.id))

  async function handleSave() {
    if (!selectedSkillId) return
    setLoading(true)
    const result = await upsertProfileSkillAction({ skill_id: selectedSkillId, proficiency })
    setLoading(false)
    if (!result.success) {
      toast({ title: result.error ?? 'Failed', variant: 'destructive' })
      return
    }
    toast({ title: editingSkill ? 'Skill updated' : 'Skill added' })
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{editingSkill ? 'Edit Skill' : 'Add My Skill'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Skill</Label>
            <Select
              value={selectedSkillId}
              onValueChange={setSelectedSkillId}
              disabled={!!editingSkill}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a skill…" />
              </SelectTrigger>
              <SelectContent>
                {availableSkills.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      {s.name}
                      <span className="text-xs text-muted-foreground">({s.category})</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Proficiency</Label>
            <Select
              value={String(proficiency)}
              onValueChange={(v) => setProficiency(Number(v) as ProficiencyLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([1, 2, 3, 4] as ProficiencyLevel[]).map((l) => (
                  <SelectItem key={l} value={String(l)}>
                    <div className="flex items-center gap-2">
                      <ProficiencyStars level={l} />
                      <span>{PROFICIENCY_LABELS[l]}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ProficiencyBar level={proficiency} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={!selectedSkillId || loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Create New Skill Dialog (admin) ──────────────────────────────────────────

interface CreateSkillDialogProps {
  open: boolean
  onClose: () => void
}

function CreateSkillDialog({ open, onClose }: CreateSkillDialogProps) {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('General')
  const [color, setColor] = useState(SKILL_COLORS[0])
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setLoading(true)
    const result = await createSkillAction({ name: name.trim(), category, color })
    setLoading(false)
    if (!result.success) {
      toast({ title: result.error ?? 'Failed', variant: 'destructive' })
      return
    }
    toast({ title: 'Skill created' })
    setName('')
    setCategory('General')
    setColor(SKILL_COLORS[0])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create New Skill</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Skill Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Vue.js"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!name.trim() || loading}>
            {loading ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Skill Card ───────────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: Skill
  profileSkills: ProfileSkill[]
  mySkill: ProfileSkill | undefined
  isAdmin: boolean
  onAddMine: (skill: Skill) => void
  onEditMine: (ps: ProfileSkill) => void
  onDeleteSkill: (skillId: string) => void
}

function SkillCard({
  skill, profileSkills, mySkill, isAdmin, onAddMine, onEditMine, onDeleteSkill,
}: SkillCardProps) {
  const { toast } = useToast()
  const [removing, setRemoving] = useState(false)

  const users = profileSkills
    .filter((ps) => ps.skill_id === skill.id && ps.user)
    .map((ps) => ps.user as Profile)

  const avgProficiency = profileSkills.filter((ps) => ps.skill_id === skill.id).length > 0
    ? Math.round(
        profileSkills.filter((ps) => ps.skill_id === skill.id)
          .reduce((s, ps) => s + ps.proficiency, 0) /
        profileSkills.filter((ps) => ps.skill_id === skill.id).length
      ) as ProficiencyLevel
    : null

  async function handleRemoveMine() {
    if (!mySkill) return
    setRemoving(true)
    const result = await removeProfileSkillAction(mySkill.id)
    setRemoving(false)
    if (!result.success) toast({ title: result.error ?? 'Failed', variant: 'destructive' })
  }

  async function handleDeleteSkill() {
    const result = await deleteSkillAction(skill.id)
    if (!result.success) toast({ title: result.error ?? 'Failed', variant: 'destructive' })
  }

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start gap-2">
        <div
          className="mt-0.5 h-3 w-3 rounded-full shrink-0"
          style={{ backgroundColor: skill.color }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-tight truncate">{skill.name}</p>
          <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">
            {skill.category}
          </Badge>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {mySkill ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={() => onEditMine(mySkill)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={handleRemoveMine}
                disabled={removing}
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={() => onAddMine(skill)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}
          {isAdmin && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive"
              onClick={handleDeleteSkill}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* My proficiency */}
      {mySkill && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>My level</span>
            <span className="font-medium text-foreground">{PROFICIENCY_LABELS[mySkill.proficiency]}</span>
          </div>
          <ProficiencyBar level={mySkill.proficiency} />
        </div>
      )}

      {/* Team avg */}
      {avgProficiency && !mySkill && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Team avg</span>
            <span>{PROFICIENCY_LABELS[avgProficiency]}</span>
          </div>
          <ProficiencyBar level={avgProficiency} />
        </div>
      )}

      {/* Who has it */}
      <div className="flex items-center justify-between mt-auto pt-1">
        {users.length > 0 ? (
          <MemberAvatars users={users} />
        ) : (
          <span className="text-xs text-muted-foreground italic">No one yet</span>
        )}
        {users.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {users.length} {users.length === 1 ? 'person' : 'people'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────────────────────

interface SkillsPageProps {
  profile: Profile
  skills: Skill[]
  allProfileSkills: ProfileSkill[]
}

export function SkillsPage({ profile, skills, allProfileSkills }: SkillsPageProps) {
  const isAdmin = profile.role === 'super_admin'
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('browse')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<ProfileSkill | null>(null)
  const [addingSkill, setAddingSkill] = useState<Skill | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const mySkills = allProfileSkills.filter((ps) => ps.user_id === profile.id)

  const filteredSkills = useMemo(() => {
    const q = search.toLowerCase()
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    )
  }, [skills, search])

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, Skill[]>()
    for (const s of filteredSkills) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return map
  }, [filteredSkills])

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleAddMine(skill: Skill) {
    setAddingSkill(skill)
    setEditingSkill(null)
    setAddDialogOpen(true)
  }

  function handleEditMine(ps: ProfileSkill) {
    setEditingSkill(ps)
    setAddingSkill(null)
    setAddDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Skills
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Browse the team's skills and manage your own profile
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Skill
            </Button>
          )}
          <Button size="sm" onClick={() => { setEditingSkill(null); setAddingSkill(null); setAddDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add My Skill
          </Button>
        </div>
      </div>

      {/* Search + tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
          <TabsList className="h-9">
            <TabsTrigger value="browse" className="text-xs px-3">Browse All</TabsTrigger>
            <TabsTrigger value="mine" className="text-xs px-3">
              My Skills
              {mySkills.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] h-4 min-w-4 flex items-center justify-center px-1">
                  {mySkills.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="team" className="text-xs px-3">Team</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Tab content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* ── Browse All ── */}
        <TabsContent value="browse" className="mt-0 space-y-6">
          {grouped.size === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Zap className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No skills found</p>
            </div>
          )}
          {Array.from(grouped.entries()).map(([category, catSkills]) => {
            const isExpanded = expandedCategories.has(category)
            const displayed = isExpanded ? catSkills : catSkills.slice(0, 8)
            return (
              <div key={category}>
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-sm font-semibold">{category}</h2>
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {catSkills.length}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {displayed.map((skill) => (
                    <SkillCard
                      key={skill.id}
                      skill={skill}
                      profileSkills={allProfileSkills}
                      mySkill={mySkills.find((ms) => ms.skill_id === skill.id)}
                      isAdmin={isAdmin}
                      onAddMine={handleAddMine}
                      onEditMine={handleEditMine}
                      onDeleteSkill={deleteSkillAction}
                    />
                  ))}
                </div>
                {catSkills.length > 8 && (
                  <button
                    onClick={() => toggleCategory(category)}
                    className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isExpanded && 'rotate-180')} />
                    {isExpanded ? 'Show less' : `Show ${catSkills.length - 8} more`}
                  </button>
                )}
              </div>
            )
          })}
        </TabsContent>

        {/* ── My Skills ── */}
        <TabsContent value="mine" className="mt-0">
          {mySkills.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No skills added yet</p>
              <p className="text-sm mt-1">Click "Add My Skill" to showcase your expertise</p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => { setEditingSkill(null); setAddingSkill(null); setAddDialogOpen(true) }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add My Skill
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {mySkills.map((ps) => {
                const skill = skills.find((s) => s.id === ps.skill_id)
                if (!skill) return null
                return (
                  <SkillCard
                    key={ps.id}
                    skill={skill}
                    profileSkills={allProfileSkills}
                    mySkill={ps}
                    isAdmin={isAdmin}
                    onAddMine={handleAddMine}
                    onEditMine={handleEditMine}
                    onDeleteSkill={deleteSkillAction}
                  />
                )
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Team Overview ── */}
        <TabsContent value="team" className="mt-0">
          <div className="rounded-xl border overflow-hidden">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Skill</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Team Members</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Avg. Proficiency</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredSkills
                    .filter((s) => allProfileSkills.some((ps) => ps.skill_id === s.id))
                    .map((skill) => {
                      const ps = allProfileSkills.filter((p) => p.skill_id === skill.id)
                      const avg = Math.round(ps.reduce((s, p) => s + p.proficiency, 0) / ps.length) as ProficiencyLevel
                      const users = ps.map((p) => p.user).filter(Boolean) as Profile[]
                      return (
                        <tr key={skill.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: skill.color }} />
                              <span className="font-medium">{skill.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">{skill.category}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <MemberAvatars users={users} />
                              <span className="text-muted-foreground text-xs">{users.length}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <ProficiencyStars level={avg} />
                              <span className="text-xs text-muted-foreground">{PROFICIENCY_LABELS[avg]}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y">
              {filteredSkills
                .filter((s) => allProfileSkills.some((ps) => ps.skill_id === s.id))
                .map((skill) => {
                  const ps = allProfileSkills.filter((p) => p.skill_id === skill.id)
                  const avg = Math.round(ps.reduce((s, p) => s + p.proficiency, 0) / ps.length) as ProficiencyLevel
                  const users = ps.map((p) => p.user).filter(Boolean) as Profile[]
                  return (
                    <div key={skill.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: skill.color }} />
                          <span className="font-medium text-sm">{skill.name}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">{skill.category}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <MemberAvatars users={users} />
                        <ProficiencyStars level={avg} />
                      </div>
                    </div>
                  )
                })}
            </div>

            {filteredSkills.filter((s) => allProfileSkills.some((ps) => ps.skill_id === s.id)).length === 0 && (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No skills added by the team yet.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <AddSkillDialog
        open={addDialogOpen}
        onClose={() => { setAddDialogOpen(false); setEditingSkill(null); setAddingSkill(null) }}
        skills={addingSkill ? [addingSkill] : skills}
        mySkills={mySkills}
        editingSkill={editingSkill}
      />
      <CreateSkillDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </div>
  )
}
