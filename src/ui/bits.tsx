import type { ComponentChildren } from 'preact'
import type { Avatar } from '../lib/types'

/** Pastel avatar backgrounds (Alpenglow-tinted). Index stored on the profile. */
export const AVATAR_COLORS = [
  '#DDE1F0', // periwinkle mist
  '#DCE8DD', // moss
  '#F6E5BE', // gold
  '#F9DDD3', // coral
  '#EFD6CE', // clay
  '#E4E0EE', // dusk lilac
  '#E7E9D2', // sage
  '#EBDDE8', // plum
]

export const EMOJI_CHOICES = [
  '🦖', '🐙', '🦔', '🐸', '🦉', '🐝', '🦊', '🐋',
  '🌵', '🍄', '🌻', '🍑', '🍋', '🥑', '🥐', '🧀',
  '⚡', '🌈', '🎯', '🎸', '🚀', '🧦', '🧽', '🪴',
]

export function AvatarView({ avatar, size = 40 }: { avatar: Avatar; size?: number }) {
  if (avatar.kind === 'photo') {
    return (
      <img
        class="ava-img"
        src={avatar.value}
        alt=""
        style={{ width: size, height: size }}
        loading="lazy"
      />
    )
  }
  const bg = AVATAR_COLORS[avatar.color % AVATAR_COLORS.length]
  return (
    <span
      class="ava-emoji"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.52 }}
      aria-hidden="true"
    >
      {avatar.value}
    </span>
  )
}

export function Crown({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size * (15 / 22)}
      viewBox="0 0 24 16"
      fill="currentColor"
      aria-label="leader"
      role="img"
    >
      <path d="M2 14h20L20 4.5l-5 4L12 1 9 8.5l-5-4z" />
    </svg>
  )
}

export function IconLog() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  )
}

export function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <path d="M5 20V10M12 20V4M19 20v-7" />
    </svg>
  )
}

export function IconYou() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  )
}

export function IconGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.06-.4.1-.8.1-1.2Z" />
    </svg>
  )
}

export function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconCamera() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  )
}

export function IconBack() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

export function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0-.8 12.1A2 2 0 0 1 15.2 21H8.8a2 2 0 0 1-2-1.9L6 7" />
    </svg>
  )
}

/** Loading splash — the household cat, precached by the service worker. */
export function Splash() {
  return (
    <div class="splash">
      <img class="splash-icon" src="/icons/icon-192.png" alt="Choresies" width={96} height={96} />
    </div>
  )
}

/** Bottom sheet with backdrop. */
export function Sheet({
  onClose,
  children,
  labelledBy,
}: {
  onClose: () => void
  children: ComponentChildren
  labelledBy?: string
}) {
  return (
    <div class="sheet-backdrop" onClick={onClose}>
      <div
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
      >
        <div class="sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}
