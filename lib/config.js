import { readFile } from 'fs/promises'
import { dirname } from 'path'
import { fileURLToPath } from 'url'

import consoleLogLevel from 'console-log-level'
const logLevel = (process.env.NETATMO_LOGLVL) ? process.env.NETATMO_LOGLVL : 'info'
const log = consoleLogLevel({
  prefix: function (level) {
    return '[' + new Date().toISOString() + ' ' + level.toUpperCase() + ']'
  },
  level: logLevel
})

export default new class Config {
  constructor () {
    this.data = {}
    this.init()
  }

  async init () {
    const configPath = dirname(fileURLToPath(new URL('.', import.meta.url))) + '/'
    this.file = configPath + 'config.json'
    await this.loadConfigFile()
  }

  async loadConfigFile () {
    try {
      this.data = JSON.parse(await readFile(this.file))
      log.debug('Config: ' + JSON.stringify(this.data))
    } catch (err) {
      log.warn(err.message)
      log.warn('Configuration file could not be read, check that it exist and is valid.')
      process.exit(1)
    }
  }
}()
