import { useState } from 'preact/hooks'
import type { HouseholdPublic, Member, Avatar } from '../lib/types'
import type { Store } from '../store/store'
import { canPromptInstall, isIOS, isStandalone, promptInstall } from '../lib/install'
import { Sheet } from './bits'
import { AvatarEditor } from './ProfilePicker'

export function SettingsSheet({
  store,
  household,
  me,
  onClose,
  onToast,
  onSwitchProfile,
  onLeaveHousehold,
}: {
  store: Store
  household: HouseholdPublic
  me: Member
  onClose: () => void
  onToast: (msg: string) => void
  onSwitchProfile: () => void
  onLeaveHousehold: () => void
}) {
  const [thresholdText, setThresholdText] = useState(String(household.thresholdMinutes))
  const [nameText, setNameText] = useState(me.name)
  const [editingAvatar, setEditingAvatar] = useState(false)

  const thresholdNum = Math.floor(Number(thresholdText))
  const thresholdValid = Number.isFinite(thresholdNum) && thresholdNum >= 10 && thresholdNum <= 600
  const thresholdChanged = thresholdValid && thresholdNum !== household.thresholdMinutes

  const saveThreshold = async () => {
    try {
      await store.updateHousehold(household.id, { thresholdMinutes: thresholdNum })
      onToast(`Weekly target set to ${thresholdNum} mins`)
    } catch (e) {
      console.error(e)
      onToast('Couldn’t save — check your connection')
    }
  }

  const saveName = async () => {
    const clean = nameText.trim()
    if (!clean || clean === me.name) return
    try {
      await store.updateMember(household.id, me.id, { name: clean })
      onToast('Name updated')
    } catch (e) {
      console.error(e)
      onToast('Couldn’t save — check your connection')
    }
  }

  const saveAvatar = async (a: Avatar) => {
    try {
      await store.updateMember(household.id, me.id, { avatar: a })
    } catch (e) {
      console.error(e)
      onToast('Couldn’t save avatar')
    }
  }

  const leave = () => {
    if (
      window.confirm(
        'Leave this household on this device? Nothing is deleted — this device can rejoin any time.',
      )
    ) {
      onClose()
      onLeaveHousehold()
    }
  }

  const deleteProfile = async () => {
    if (
      !window.confirm(
        `Delete the profile “${me.name}”? Their bars disappear from the board and this can’t be undone.`,
      )
    )
      return
    try {
      await store.deleteMember(household.id, me.id)
      onClose()
      onSwitchProfile()
    } catch (e) {
      console.error(e)
      onToast('Couldn’t delete — check your connection')
    }
  }

  return (
    <Sheet onClose={onClose} labelledBy="settings-title">
      <h2 id="settings-title">Settings</h2>
      <p class="sub">
        {household.name}
        {store.mode === 'demo' ? ' · demo mode (data stays on this device)' : ''}
      </p>

      <div class="section-label">Household</div>
      <div class="settings-group">
        <div class="settings-row">
          <span class="k">Weekly “enough” target</span>
          <input
            type="number"
            inputMode="numeric"
            min={10}
            max={600}
            value={thresholdText}
            onInput={(e) => setThresholdText((e.target as HTMLInputElement).value)}
            aria-label="Weekly target minutes"
          />
          {thresholdChanged && (
            <button class="btn-ghost" style={{ fontWeight: 700, color: 'var(--acc)' }} onClick={saveThreshold}>
              Save
            </button>
          )}
        </div>
        <div class="settings-row">
          <span class="k">Weeks run</span>
          <span class="v">Mon–Sun · {household.tz.replaceAll('_', ' ')}</span>
        </div>
      </div>

      <div class="section-label">Your profile</div>
      <div class="settings-group">
        <div class="settings-row">
          <span class="k">Name</span>
          <input
            type="text"
            style={{ width: 130, textAlign: 'right' }}
            value={nameText}
            onInput={(e) => setNameText((e.target as HTMLInputElement).value)}
            onBlur={saveName}
            maxLength={24}
            aria-label="Your name"
          />
        </div>
        <button class="settings-row action" onClick={() => setEditingAvatar((v) => !v)}>
          <span class="k">Avatar</span>
          <span class="v">{editingAvatar ? 'Done' : 'Edit'}</span>
        </button>
        {editingAvatar && (
          <div style={{ padding: '4px 16px 12px' }}>
            <AvatarEditor value={me.avatar} onChange={saveAvatar} />
          </div>
        )}
        <button
          class="settings-row action"
          onClick={() => {
            onClose()
            onSwitchProfile()
          }}
        >
          <span class="k">Switch profile</span>
          <span class="v">›</span>
        </button>
      </div>

      {!isStandalone() && (
        <>
          <div class="section-label">Get the app feel</div>
          <div class="settings-group">
            {isIOS() ? (
              <div class="settings-row">
                <span class="k" style={{ fontWeight: 450 }}>
                  On iPhone: open in Safari, tap <b>Share</b>, then <b>Add to Home Screen</b>.
                  Choresies then opens full-screen like a normal app.
                </span>
              </div>
            ) : canPromptInstall() ? (
              <button
                class="settings-row action"
                onClick={async () => {
                  const ok = await promptInstall()
                  onToast(ok ? 'Installed 🎉' : 'Maybe later')
                }}
              >
                <span class="k">Install Choresies on this device</span>
                <span class="v">›</span>
              </button>
            ) : (
              <div class="settings-row">
                <span class="k" style={{ fontWeight: 450 }}>
                  On Android: open in Chrome and choose <b>Install app</b> (⋮ menu). On iPhone:
                  Safari → Share → <b>Add to Home Screen</b>.
                </span>
              </div>
            )}
          </div>
        </>
      )}

      <div class="settings-group">
        <button class="settings-row danger" onClick={deleteProfile}>
          <span class="k">Delete this profile</span>
        </button>
        <button class="settings-row danger" onClick={leave}>
          <span class="k">Leave household on this device</span>
        </button>
      </div>
    </Sheet>
  )
}
