import { useRef, useState } from 'preact/hooks'
import { Sheet } from './bits'

const CHIPS = [5, 10, 15, 20, 30, 45, 60]

export function MinutesSheet({
  name,
  typical,
  isNew,
  onCancel,
  onConfirm,
}: {
  name: string
  typical: number | null
  isNew: boolean
  onCancel: () => void
  onConfirm: (minutes: number, origin: { x: number; y: number }) => void
}) {
  const [minutes, setMinutes] = useState<number>(typical ?? 15)
  const [customText, setCustomText] = useState<string>(String(typical ?? 15))
  const logBtnRef = useRef<HTMLButtonElement>(null)

  const setBoth = (n: number) => {
    setMinutes(n)
    setCustomText(String(n))
  }

  const onCustom = (e: Event) => {
    const raw = (e.target as HTMLInputElement).value
    setCustomText(raw)
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n)) setMinutes(n)
  }

  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 600

  const submit = () => {
    if (!valid) return
    // Confetti bursts from the Log button whether confirmed by tap or Return.
    const r = logBtnRef.current?.getBoundingClientRect()
    onConfirm(Math.floor(minutes), {
      x: r ? r.left + r.width / 2 : window.innerWidth / 2,
      y: r ? r.top : window.innerHeight - 80,
    })
  }

  return (
    <Sheet onClose={onCancel} labelledBy="minutes-title">
      <h2 id="minutes-title">{name}</h2>
      <p class="sub">
        {isNew ? 'New chore — how many minutes did it take?' : 'How many minutes?'}
        {typical !== null && ` Usually ~${typical}.`}
      </p>
      <div class="chip-row" role="listbox" aria-label="Quick minutes">
        {CHIPS.map((c) => (
          <button
            key={c}
            class={`chip ${minutes === c ? 'on' : ''}`}
            role="option"
            aria-selected={minutes === c}
            onClick={() => setBoth(c)}
          >
            {c} mins
          </button>
        ))}
      </div>
      <div class="minutes-row">
        <input
          class="field minutes-input"
          type="number"
          inputMode="numeric"
          min={1}
          max={600}
          value={customText}
          onInput={onCustom}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              submit()
            }
          }}
          enterkeyhint="done"
          aria-label="Custom minutes"
        />
        <span class="minutes-unit">minutes</span>
      </div>
      {!valid && <p class="error-text" style={{ marginTop: -8, marginBottom: 12 }}>Between 1 and 600 minutes.</p>}
      <div class="sheet-actions">
        <button class="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button ref={logBtnRef} class="btn btn-gold" disabled={!valid} onClick={submit}>
          Log it
        </button>
      </div>
    </Sheet>
  )
}
