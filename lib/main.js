/* eslint-disable no-unused-vars */
import exithandler from './exithandler.js'
import MqttClient from './mqtt.js'
import state from './state.js'
import NetatmoClient from './netatmo.js'
import utils from './utils.js'
import tokenApp from './tokenapp.js'
import isOnline from 'is-online'

import consoleLogLevel from 'console-log-level'
const logLevel = (process.env.NETATMO_LOGLVL) ? process.env.NETATMO_LOGLVL : 'info'
const log = consoleLogLevel({
  prefix: function (level) {
    return '[' + new Date().toISOString() + ' ' + level.toUpperCase() + ']'
  },
  level: logLevel
})

export default new class Main {
  constructor () {
    // Event Listener
    utils.event.on('generated_token', (generatedToken) => {
      this.init(generatedToken)
    })
    // First Init
    this.init()
  }

  async init (generatedToken) {
    if (!state.valid) {
      await state.init()
    }
    // Is there any usable token?
    if (state.data.refresh_token || generatedToken) {
      // Wait for the network to be online and then attempt to connect to
      while (!(await isOnline())) {
        log.warn('Network is offline, waiting 10 seconds to check again...')
        await utils.sleep(10)
      }
      // Connect to netatmo
      if (!await NetatmoClient.init(state, generatedToken)) {
        log.warn('Failed to connect to Netatmo API using saved token, generate a new token using the Web UI')
        log.warn('or wait 30 seconds to automatically retry authentication using the existing token')
        tokenApp.start()
        await utils.sleep(30)
        if (!NetatmoClient.connected) {
          log.warn('Retrying authentication with existing saved token...')
          this.init()
        }
      }
    } else {
      tokenApp.start()
      log.info('No refresh token found, use the Web UI at http://<host_ip_address>:55124/ to generate a token.')
    }
  }
}()
