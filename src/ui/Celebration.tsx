import { useEffect } from 'preact/hooks'
import type { Member } from '../lib/types'
import { weekRangeLabel } from '../lib/time'
import { rainConfetti } from '../lib/confetti'
import { AvatarView, Crown } from './bits'

export interface CelebrationData {
  memberId: string
  name: string
  minutes: number
  weekKey: string
}

/** New week, new board — one tasteful moment for last week's leader. */
export function Celebration({
  data,
  member,
  onClose,
}: {
  data: CelebrationData
  member: Member | undefined
  onClose: () => void
}) {
  useEffect(() => {
    rainConfetti()
  }, [])

  return (
    <div class="cele-backdrop" onClick={onClose}>
      <div class="cele-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cele-title">
        <div class="cele-crown">
          <Crown size={34} />
        </div>
        {member && <AvatarView avatar={member.avatar} size={64} />}
        <p class="cele-eyebrow">Last week’s leader</p>
        <h2 id="cele-title">{data.name}</h2>
        <p class="detail">
          <b>{data.minutes} minutes</b> · {weekRangeLabel(data.weekKey)}
        </p>
        <button class="btn btn-gold" style={{ width: '100%' }} onClick={onClose}>
          New week, fresh board
        </button>
      </div>
    </div>
  )
}
