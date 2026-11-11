import { app } from 'electron'

// Keep this entrypoint deliberately tiny. A second launch must notify the
// existing process before loading sharp, databases, ML runtimes, or SDKs.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./main')
}
