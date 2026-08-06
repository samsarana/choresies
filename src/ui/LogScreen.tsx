import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Member, Task } from '../lib/types'
import { typicalMinutes } from '../lib/types'
import { frequentTasks, nearDuplicate, normalize, searchTasks } from '../lib/search'
import { AvatarView, IconSearch } from './bits'
import { MinutesSheet } from './MinutesSheet'

interface Pending {
  taskId?: string
  name: string
  typical: number | null
}

export function LogScreen({
  tasks,
  me,
  onLog,
}: {
  tasks: Task[]
  me: Member
  onLog: (input: { taskId?: string; name: string; minutes: number }, origin: { x: number; y: number }) => void
}) {
  const [q, setQ] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Land with the cursor in the search box (SPEC §3). Some mobile browsers
  // won't raise the keyboard without a tap — accepted in the spec.
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  const query = q.trim()
  const results = useMemo(() => (query ? searchTasks(query, tasks) : frequentTasks(tasks)), [query, tasks])

  const dup = useMemo(() => (query ? nearDuplicate(query, tasks) : null), [query, tasks])
  const showNudge = dup !== null && !results.some((t) => t.id === dup.id)
  const exactMatch = query !== '' ? tasks.find((t) => t.nameLower === normalize(query)) : undefined
  // Names that normalise to nothing ("???") would be unsearchable forever.
  const addable = query !== '' && normalize(query) !== '' && !exactMatch

  const pickTask = (t: Task) => {
    setPending({ taskId: t.id, name: t.name, typical: typicalMinutes(t) })
  }

  /** Return = "log what I typed": same outcome as tapping the add-new row
   *  (or the existing chore, when the name matches one exactly). */
  const onSearchKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (exactMatch) pickTask(exactMatch)
    else if (addable) setPending({ name: query, typical: null })
  }

  const confirm = (minutes: number, origin: { x: number; y: number }) => {
    if (!pending) return
    onLog({ taskId: pending.taskId, name: pending.name, minutes }, origin)
    setPending(null)
    setQ('')
    inputRef.current?.focus({ preventScroll: true })
  }

  return (
    <>
      <div class="topbar">
        <span class="wordmark">Choresies</span>
        <AvatarView avatar={me.avatar} size={34} />
      </div>

      <div class="searchwrap">
        <IconSearch />
        <input
          ref={inputRef}
          class="search-input"
          placeholder="Search or add a chore…"
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          onKeyDown={onSearchKey}
          autocomplete="off"
          autocorrect="off"
          enterkeyhint="go"
          aria-label="Search or add a chore"
        />
        {q !== '' && (
          <button
            class="search-clear"
            onClick={() => {
              setQ('')
              inputRef.current?.focus({ preventScroll: true })
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {!query && results.length > 0 && <div class="section-label">Frequent</div>}
      {query && (results.length > 0 || showNudge) && <div class="section-label">Suggestions</div>}

      <div class="chorelist">
        {showNudge && dup && (
          <button class="chore-row nudge" onClick={() => pickTask(dup)}>
            <span class="nm">{dup.name}</span>
            <span class="nudge-tag">Did you mean?</span>
          </button>
        )}
        {results.map((t) => (
          <button key={t.id} class="chore-row" onClick={() => pickTask(t)}>
            <span class="nm">{t.name}</span>
          </button>
        ))}
        {addable && (
          <button class="chore-row add" onClick={() => setPending({ name: query, typical: null })}>
            <span class="nm">Log “{query}” as a new chore</span>
          </button>
        )}
      </div>

      {tasks.length === 0 && !query && (
        <p class="empty-note">
          <span class="big" aria-hidden="true">
            ✨
          </span>
          Log the flat’s first chore — type it in the box above. Anything logged twice sticks around
          as a quick pick.
        </p>
      )}
      {tasks.length > 0 && !query && results.length === 0 && (
        <p class="empty-note">Chores show up here once they’ve been logged twice.</p>
      )}

      {pending && (
        <MinutesSheet
          name={pending.name}
          typical={pending.typical}
          isNew={!pending.taskId}
          onCancel={() => setPending(null)}
          onConfirm={confirm}
        />
      )}
    </>
  )
}
