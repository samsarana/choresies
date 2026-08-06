import { useEffect, useRef, useState } from 'preact/hooks'
import type { Avatar, HouseholdPublic, Member } from '../lib/types'
import type { Store } from '../store/store'
import { resizeToDataUrl } from '../lib/image'
import { AVATAR_COLORS, AvatarView, EMOJI_CHOICES, IconBack, IconCamera } from './bits'

/** Emoji / colour / photo editor — shared by profile creation and settings. */
export function AvatarEditor({
  value,
  onChange,
}: {
  value: Avatar
  onChange: (a: Avatar) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState('')

  const pickPhoto = async (e: Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = '' // allow re-selecting the same file later
    if (!file) return
    setPhotoError('')
    try {
      const dataUrl = await resizeToDataUrl(file)
      onChange({ kind: 'photo', value: dataUrl, color: value.color })
    } catch {
      setPhotoError('Couldn’t read that image — try a different photo.')
    }
  }

  return (
    <div>
      <div class="emoji-grid" role="listbox" aria-label="Choose an emoji">
        {EMOJI_CHOICES.map((e) => (
          <button
            key={e}
            type="button"
            class={`emoji-cell ${value.kind === 'emoji' && value.value === e ? 'on' : ''}`}
            role="option"
            aria-selected={value.kind === 'emoji' && value.value === e}
            onClick={() => onChange({ kind: 'emoji', value: e, color: value.color })}
          >
            {e}
          </button>
        ))}
      </div>
      {value.kind === 'emoji' && (
        <div class="swatch-row" role="listbox" aria-label="Choose a colour">
          {AVATAR_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              class={`swatch ${value.color === i ? 'on' : ''}`}
              style={{ background: c }}
              role="option"
              aria-selected={value.color === i}
              aria-label={`Colour ${i + 1}`}
              onClick={() => onChange({ ...value, color: i })}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        class={`photo-tile ${value.kind === 'photo' ? 'on' : ''}`}
        onClick={() => fileRef.current?.click()}
      >
        {value.kind === 'photo' ? (
          <>
            <AvatarView avatar={value} size={28} />
            Change photo
          </>
        ) : (
          <>
            <IconCamera />
            …or use a photo
          </>
        )}
      </button>
      {photoError && <p class="error-text">{photoError}</p>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={pickPhoto}
        aria-label="Upload avatar photo"
      />
    </div>
  )
}

export function ProfilePicker({
  store,
  household,
  onPicked,
}: {
  store: Store
  household: HouseholdPublic
  onPicked: (memberId: string) => void
}) {
  const [members, setMembers] = useState<Member[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<Avatar>({
    kind: 'emoji',
    value: EMOJI_CHOICES[Math.floor(Math.random() * EMOJI_CHOICES.length)],
    color: Math.floor(Math.random() * AVATAR_COLORS.length),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => store.subscribeMembers(household.id, setMembers), [store, household.id])

  const pick = async (m: Member) => {
    try {
      await store.claimMember(household.id, m.id)
    } catch {
      /* claiming is best-effort bookkeeping */
    }
    onPicked(m.id)
  }

  const create = async (e: Event) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const mid = await store.createMember(household.id, { name: name.trim(), avatar })
      onPicked(mid)
    } catch (err) {
      console.error(err)
      setError('Couldn’t create the profile — try again.')
      setBusy(false)
    }
  }

  return (
    <div class="gate" style={{ justifyContent: 'flex-start', paddingTop: 48 }}>
      <span class="wordmark" style={{ fontSize: 28 }}>
        {household.name}
      </span>

      {!creating ? (
        <>
          <p class="gate-sub">Who’s this?</p>
          <div class="profile-grid">
            {(members ?? []).map((m) => (
              <button key={m.id} class="profile-cell" onClick={() => pick(m)}>
                <AvatarView avatar={m.avatar} size={56} />
                {m.name}
              </button>
            ))}
            <button class="profile-cell new" onClick={() => setCreating(true)}>
              <span class="plus-circle">+</span>
              New profile
            </button>
          </div>
          {members !== null && members.length === 0 && (
            <p class="hint-text" style={{ textAlign: 'center', marginTop: 18 }}>
              Nobody here yet — make the first profile.
            </p>
          )}
        </>
      ) : (
        <>
          <p class="gate-sub">What’s your name?</p>
          <form onSubmit={create}>
            <input
              class="field"
              placeholder="Your name"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              autocomplete="off"
              autocapitalize="words"
              maxLength={24}
            />
            <AvatarEditor value={avatar} onChange={setAvatar} />
            <button class="btn btn-primary" type="submit" disabled={!name.trim() || busy}>
              {busy ? 'Creating…' : 'That’s me'}
            </button>
            {error && <p class="error-text">{error}</p>}
            <button class="btn btn-ghost" type="button" onClick={() => setCreating(false)}>
              <IconBack /> Back
            </button>
          </form>
        </>
      )}
    </div>
  )
}
