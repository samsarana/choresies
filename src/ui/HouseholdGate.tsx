import { useState } from 'preact/hooks'
import type { HouseholdPublic } from '../lib/types'
import type { Store } from '../store/store'
import { deviceTz } from '../lib/time'
import { IconBack } from './bits'

type Step = { kind: 'name' } | { kind: 'join'; found: HouseholdPublic } | { kind: 'create' }

export function HouseholdGate({
  store,
  onEntered,
}: {
  store: Store
  onEntered: (h: HouseholdPublic) => void
}) {
  const [step, setStep] = useState<Step>({ kind: 'name' })
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const tz = deviceTz()

  const lookup = async (e: Event) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const found = await store.findHouseholdByName(name)
      setPassword('')
      setStep(found ? { kind: 'join', found } : { kind: 'create' })
    } catch (err) {
      console.error(err)
      setError('Couldn’t reach the server — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const join = async (e: Event) => {
    e.preventDefault()
    if (step.kind !== 'join' || busy) return
    setBusy(true)
    setError('')
    try {
      const ok = await store.joinHousehold(step.found, password)
      if (ok) {
        onEntered(step.found)
      } else {
        setError('Wrong password for this household.')
      }
    } catch (err) {
      console.error(err)
      setError('Couldn’t join — check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  const create = async (e: Event) => {
    e.preventDefault()
    if (busy) return
    if (password.length < 4) {
      setError('Password needs at least 4 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const h = await store.createHousehold(name, password, tz)
      onEntered(h)
    } catch (err) {
      if ((err as Error).message === 'household-exists') {
        // Someone created it between lookup and now — fall through to join.
        const found = await store.findHouseholdByName(name)
        if (found) {
          setStep({ kind: 'join', found })
          setError('')
          setBusy(false)
          return
        }
      }
      console.error(err)
      setError('Couldn’t create the household — try again.')
    } finally {
      setBusy(false)
    }
  }

  const back = () => {
    setStep({ kind: 'name' })
    setPassword('')
    setError('')
  }

  return (
    <div class="gate">
      <span class="wordmark">Choresies</span>

      {step.kind === 'name' && (
        <>
          <p class="gate-sub">What’s your whare?</p>
          <form onSubmit={lookup}>
            <input
              class="field"
              placeholder="Household name"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              autocomplete="off"
              autocapitalize="words"
              enterkeyhint="go"
            />
            <button class="btn btn-primary" type="submit" disabled={!name.trim() || busy}>
              {busy ? 'Looking…' : 'Continue'}
            </button>
            {error && <p class="error-text">{error}</p>}
            {store.mode === 'demo' && (
              <p class="hint-text">
                Demo mode: everything works, but data stays on this device until cloud sync is
                configured.
              </p>
            )}
          </form>
        </>
      )}

      {step.kind === 'join' && (
        <>
          <p class="gate-sub">
            Found <b>{step.found.name}</b>. Enter the household password to add this device — you
            only do this once.
          </p>
          <form onSubmit={join}>
            <input
              class="field"
              type="password"
              placeholder="Household password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              autocomplete="current-password"
              enterkeyhint="go"
            />
            <button class="btn btn-primary" type="submit" disabled={!password || busy}>
              {busy ? 'Joining…' : `Join ${step.found.name}`}
            </button>
            {error && <p class="error-text">{error}</p>}
            <button class="btn btn-ghost" type="button" onClick={back}>
              <IconBack /> Different household
            </button>
          </form>
        </>
      )}

      {step.kind === 'create' && (
        <>
          <p class="gate-sub">
            <b>{name.trim()}</b> doesn’t exist yet — set a password and it’s yours.
          </p>
          <form onSubmit={create}>
            <input
              class="field"
              type="password"
              placeholder="Choose a household password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
              autocomplete="new-password"
              enterkeyhint="go"
            />
            <button class="btn btn-primary" type="submit" disabled={!password || busy}>
              {busy ? 'Creating…' : `Create ${name.trim()}`}
            </button>
            {error && <p class="error-text">{error}</p>}
            <p class="hint-text">
              Flatmates enter this once per device. There’s no reset, so pick something the flat
              will remember. Weeks run Mon–Sun in {tz.replaceAll('_', ' ')}.
            </p>
            <button class="btn btn-ghost" type="button" onClick={back}>
              <IconBack /> Back
            </button>
          </form>
        </>
      )}
    </div>
  )
}
