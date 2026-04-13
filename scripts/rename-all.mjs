import { readFileSync, writeFileSync, readdirSync, renameSync, mkdirSync, existsSync } from 'fs'
import { join, extname } from 'path'

const ROOT = process.cwd()

// ── Protected DB enum values (must NOT be renamed) ────────────────────────────
const PROTECT = [
  ['project_manager',       '__PROTECT_PM__'],
  ['project_member_added',  '__PROTECT_PMA__'],
]

// ── Replacements (order matters — longer strings first) ───────────────────────
const REPLACEMENTS = [
  // Plural forms first (to avoid partial matches)
  ['workspaces',  'spaces'],
  ['Workspaces',  'Spaces'],
  ['WORKSPACES',  'SPACES'],
  ['projects',    'lists'],
  ['Projects',    'Lists'],
  ['PROJECTS',    'LISTS'],
  // Singular forms
  ['workspace',   'space'],
  ['Workspace',   'Space'],
  ['WORKSPACE',   'SPACE'],
  ['project',     'list'],
  ['Project',     'List'],
  ['PROJECT',     'LIST'],
]

// ── File/folder renames ───────────────────────────────────────────────────────
const FILE_RENAMES = [
  // Actions
  ['app/actions/workspaces.ts',               'app/actions/spaces.ts'],
  ['app/actions/projects.ts',                 'app/actions/lists.ts'],
  ['app/actions/project-members.ts',          'app/actions/list-members.ts'],
  // Components — workspace → space
  ['components/workspaces/create-workspace-dialog.tsx', 'components/spaces/create-space-dialog.tsx'],
  ['components/workspaces/rename-workspace-dialog.tsx', 'components/spaces/rename-space-dialog.tsx'],
  ['components/workspaces/workspace-card.tsx',          'components/spaces/space-card.tsx'],
  ['components/workspaces/workspace-detail-page.tsx',   'components/spaces/space-detail-page.tsx'],
  ['components/workspaces/workspaces-page.tsx',         'components/spaces/spaces-page.tsx'],
  ['components/workspaces/assign-staff-dialog.tsx',     'components/spaces/assign-staff-dialog.tsx'],
  // Components — project → list
  ['components/projects/create-project-dialog.tsx',     'components/lists/create-list-dialog.tsx'],
  ['components/projects/edit-project-dialog.tsx',       'components/lists/edit-list-dialog.tsx'],
  ['components/projects/project-card.tsx',              'components/lists/list-card.tsx'],
  ['components/projects/project-detail-page.tsx',       'components/lists/list-detail-page.tsx'],
  ['components/projects/project-header.tsx',            'components/lists/list-header.tsx'],
  ['components/projects/project-team-section.tsx',      'components/lists/list-team-section.tsx'],
  ['components/projects/projects-page.tsx',             'components/lists/lists-page.tsx'],
  ['components/projects/time-summary.tsx',              'components/lists/time-summary.tsx'],
  // Reports
  ['components/reports/project-progress-report.tsx',   'components/reports/list-progress-report.tsx'],
  ['components/reports/project-time-report.tsx',        'components/reports/list-time-report.tsx'],
]

// ── Import path renames (in all files after file rename) ──────────────────────
const IMPORT_RENAMES = [
  // Actions
  ["from '@/app/actions/workspaces'",           "from '@/app/actions/spaces'"],
  ["from '@/app/actions/projects'",             "from '@/app/actions/lists'"],
  ["from '@/app/actions/project-members'",      "from '@/app/actions/list-members'"],
  // Workspace components
  ["from '@/components/workspaces/create-workspace-dialog'", "from '@/components/spaces/create-space-dialog'"],
  ["from '@/components/workspaces/rename-workspace-dialog'", "from '@/components/spaces/rename-space-dialog'"],
  ["from '@/components/workspaces/workspace-card'",          "from '@/components/spaces/space-card'"],
  ["from '@/components/workspaces/workspace-detail-page'",   "from '@/components/spaces/space-detail-page'"],
  ["from '@/components/workspaces/workspaces-page'",         "from '@/components/spaces/spaces-page'"],
  ["from '@/components/workspaces/assign-staff-dialog'",     "from '@/components/spaces/assign-staff-dialog'"],
  // Project components → list
  ["from '@/components/projects/create-project-dialog'",     "from '@/components/lists/create-list-dialog'"],
  ["from '@/components/projects/edit-project-dialog'",       "from '@/components/lists/edit-list-dialog'"],
  ["from '@/components/projects/project-card'",              "from '@/components/lists/list-card'"],
  ["from '@/components/projects/project-detail-page'",       "from '@/components/lists/list-detail-page'"],
  ["from '@/components/projects/project-header'",            "from '@/components/lists/list-header'"],
  ["from '@/components/projects/project-team-section'",      "from '@/components/lists/list-team-section'"],
  ["from '@/components/projects/projects-page'",             "from '@/components/lists/lists-page'"],
  ["from '@/components/projects/time-summary'",              "from '@/components/lists/time-summary'"],
  // Reports
  ["from '@/components/reports/project-progress-report'",   "from '@/components/reports/list-progress-report'"],
  ["from '@/components/reports/project-time-report'",        "from '@/components/reports/list-time-report'"],
  // Relative imports inside components/workspaces → spaces
  ["from './create-workspace-dialog'",  "from './create-space-dialog'"],
  ["from './rename-workspace-dialog'",  "from './rename-space-dialog'"],
  ["from './workspace-card'",           "from './space-card'"],
  ["from './workspace-detail-page'",    "from './space-detail-page'"],
  ["from './workspaces-page'",          "from './spaces-page'"],
  ["from './assign-staff-dialog'",      "from './assign-staff-dialog'"],
  // Relative imports inside components/projects → lists
  ["from './create-project-dialog'",    "from './create-list-dialog'"],
  ["from './edit-project-dialog'",      "from './edit-list-dialog'"],
  ["from './project-card'",             "from './list-card'"],
  ["from './project-detail-page'",      "from './list-detail-page'"],
  ["from './project-header'",           "from './list-header'"],
  ["from './project-team-section'",     "from './list-team-section'"],
  ["from './projects-page'",            "from './lists-page'"],
  ["from './time-summary'",             "from './time-summary'"],
]

// ── Get all .ts/.tsx files recursively ────────────────────────────────────────
function getAllFiles(dir, exts = ['.ts', '.tsx']) {
  const skip = ['node_modules', '.next', '.git', 'scripts']
  let results = []
  try {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (skip.some(s => name.name === s)) continue
      const full = join(dir, name.name)
      if (name.isDirectory()) results = results.concat(getAllFiles(full, exts))
      else if (exts.includes(extname(name.name))) results.push(full)
    }
  } catch {}
  return results
}

function applyTextReplacements(content) {
  let out = content
  // 1. Protect DB enum values
  for (const [orig, placeholder] of PROTECT) {
    out = out.split(orig).join(placeholder)
  }
  // 2. Apply word replacements
  for (const [from, to] of REPLACEMENTS) {
    out = out.split(from).join(to)
  }
  // 3. Restore DB enum values
  for (const [orig, placeholder] of PROTECT) {
    out = out.split(placeholder).join(orig)
  }
  return out
}

function applyImportRenames(content) {
  let out = content
  for (const [from, to] of IMPORT_RENAMES) {
    out = out.split(from).join(to)
  }
  return out
}

// ── STEP 1: Text replacements in all files ────────────────────────────────────
console.log('\n=== STEP 1: Text replacements ===')
const allFiles = getAllFiles(ROOT)
let textUpdated = 0
for (const f of allFiles) {
  const orig = readFileSync(f, 'utf8')
  let updated = applyTextReplacements(orig)
  updated = applyImportRenames(updated)
  if (updated !== orig) {
    writeFileSync(f, updated, 'utf8')
    console.log('  Updated:', f.replace(ROOT + '/', ''))
    textUpdated++
  }
}
console.log(`  Total: ${textUpdated} files updated`)

// ── STEP 2: Create new folders and rename files ───────────────────────────────
console.log('\n=== STEP 2: File renames ===')
// Ensure target directories exist
const newDirs = ['components/spaces', 'components/lists']
for (const d of newDirs) {
  const full = join(ROOT, d)
  if (!existsSync(full)) { mkdirSync(full, { recursive: true }); console.log('  Created dir:', d) }
}

for (const [from, to] of FILE_RENAMES) {
  const src = join(ROOT, from)
  const dst = join(ROOT, to)
  if (existsSync(src)) {
    renameSync(src, dst)
    console.log(`  ${from} → ${to}`)
  } else {
    console.log(`  SKIP (not found): ${from}`)
  }
}

console.log('\nDone. Run: npx tsc --noEmit')
