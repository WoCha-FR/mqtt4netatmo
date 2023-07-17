import utils from './utils.js'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { createHash, randomBytes } from 'crypto'
import express from 'express'
import tl from 'express-tl'
import bodyParser from 'body-parser'
import axios from 'axios'

import consoleLogLevel from 'console-log-level'
const logLevel = (process.env.NETATMO_LOGLVL) ? process.env.NETATMO_LOGLVL : 'info'
const log = consoleLogLevel({
  prefix: function (level) {
    return '[' + new Date().toISOString() + ' ' + level.toUpperCase() + ']'
  },
  level: logLevel
})

export default new class TokenApp {
  constructor () {
    this.app = express()
    this.app.engine('tl', tl)
    this.listener = false
    this.NetatmoConnected = false
    this.NetatmoState = (createHash('sha256').update(randomBytes(32)).digest('hex'))
    // Events state connected
    utils.event.on('netatmo_api_state', async (state) => {
      if (state === 'connected') {
        this.NetatmoConnected = true
        this.stop()
      } else {
        this.NetatmoConnected = false
      }
    })
  }

  // Super simple web service to acquire authentication tokens from Netatmo
  async start () {
    if (this.listener) {
      return
    }
    const webdir = dirname(fileURLToPath(new URL('.', import.meta.url))) + '/web'
    this.app.set('views', webdir)
    this.app.set('view engine', 'tl')

    this.listener = this.app.listen(55124, () => {
      log.info('Succesfully started the token generator web UI')
    })

    this.app.use(bodyParser.urlencoded({ extended: false }))

    this.app.get('/', (req, res) => {
      if (this.NetatmoConnected) {
        res.sendFile('connected.html', { root: webdir })
      } else {
        const data = {
          client_id: utils.config().clientId,
          response_type: 'code',
          redirect_uri: 'http://localhost:55124/result',
          state: this.NetatmoState,
          scope: 'read_station read_homecoach'
        }
        const params = '?' + new URLSearchParams(data).toString()
        res.redirect('https://api.netatmo.com/oauth2/authorize' + params)
      }
    })

    this.app.get(/.*result$/, async (req, res) => {
      // Result error
      if (req.query.error) {
        res.render('error', {
          message: req.query.error
        })
        return
      }
      // Result valid / Incorrect state
      if (req.query.state !== this.NetatmoState) {
        res.render('error', {
          message: 'Received state mismatch sending one'
        })
        return
      }
      // Result valid : Continue
      let generatedToken
      const config = {
        method: 'post',
        url: 'https://api.netatmo.com/oauth2/token',
        headers: {}
      }
      const data = {
        grant_type: 'authorization_code',
        client_id: utils.config().clientId,
        client_secret: utils.config().clientSecret,
        code: req.query.code,
        redirect_uri: 'http://localhost:55124/result',
        scope: 'read_station read_homecoach'
      }
      // as POST method accept only `application/x-www-form-urlencoded` content-type, transform data object into query string
      config.data = new URLSearchParams(data).toString()
      try {
        const result = await axios(config)
        generatedToken = result.data
        res.sendFile('success.html', { root: webdir })
      } catch (err) {
        res.render('error', {
          message: err.message
        })
        throw new Error(`HTTP request failed: ${err.message}`)
      }
      // On a un Token
      if (generatedToken) {
        utils.event.emit('generated_token', generatedToken)
      }
    })
  }

  async stop () {
    if (this.listener) {
      await this.listener.close()
      this.listener = false
    }
  }
}()
