import { app } from 'electron'
import path from 'node:path'
import { PROFILE_NAME } from '../shared/branding'

app.setPath('userData', path.join(app.getPath('appData'), PROFILE_NAME))
app.setPath('sessionData', app.getPath('userData'))

// Keep this entrypoint deliberately tiny. A second launch must notify the
// existing process before loading sharp, databases, ML runtimes, or SDKs.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./services/profileMigration').migrateAppProfile(app.getPath('appData')).then(() => {
    require('./main')
  }).catch((error: Error) => {
    console.error('[AskCue] Could not migrate the existing profile:', error)
    app.exit(1)
  })
}
