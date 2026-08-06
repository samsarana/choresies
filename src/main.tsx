import { render } from 'preact'
import { registerSW } from 'virtual:pwa-register'
import { App } from './app'
import './lib/install' // capture beforeinstallprompt before first render
import './styles.css'

// Auto-update: new deploys are fetched in the background and applied on the
// next launch — nobody re-installs anything.
registerSW({ immediate: true })

render(<App />, document.getElementById('app')!)
