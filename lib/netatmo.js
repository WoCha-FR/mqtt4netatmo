import utils from './utils.js'
import axios from 'axios'
import _ from 'lodash'

import consoleLogLevel from 'console-log-level'
const logLevel = (process.env.NETATMO_LOGLVL) ? process.env.NETATMO_LOGLVL : 'info'
const log = consoleLogLevel({
  prefix: function (level) {
    return '[' + new Date().toISOString() + ' ' + level.toUpperCase() + ']'
  },
  level: logLevel
})

// private constants
const HTTP_POST = 'POST'
const HTTP_GET = 'GET'
const PATH_AUTH = '/oauth2/token'
const baseURL = 'https://api.netatmo.com'

export default new class NetatmoClient {
  constructor () {
    this.connected = false
    this.mqttConnected = false
    this.accessToken = null
    this.refreshToken = undefined
    this.expiresInTS = 0
    // setInterval ID
    this.intervalId = null

    // Configure event listeners
    utils.event.on('mqtt_state', async (state) => {
      if (state === 'connected') {
        this.mqttConnected = true
        log.info('MQTT connection established, processing Netatmo...')
        this.pollData()
      } else {
        this.mqttConnected = false
      }
    })
  }

  async init (state, generatedToken) {
    // Get token
    if (generatedToken) {
      this.accessToken = generatedToken.access_token
      this.refreshToken = generatedToken.refresh_token
      this.expiresInTS = Math.floor(Date.now() / 1000) + generatedToken.expires_in
      state.updateToken(generatedToken)
    } else {
      this.accessToken = state.data.access_token
      this.refreshToken = state.data.refresh_token
      this.expiresInTS = state.data.expires_ts
    }
    // Connect
    try {
      log.debug(`Attempting connection to Netatmo using ${generatedToken ? 'generated' : 'saved'} refresh token...`)
      this.connected = await this.connect()
      utils.event.emit('netatmo_api_state', 'connected')
    } catch (err) {
      this.connected = false
      log.error(err.message)
    }
    // Return
    return this.connected
  }

  async connect () {
    // 1. Access token present & TS valid
    if (this.checkAndSetAccesToken(this.accessToken, this.expiresInTS)) {
      return true
    }
    // 2. With refresh token
    if (this.refreshToken) {
      return await this.authenticateByRefreshToken(this.refreshToken)
    }
    return false
  }

  checkAndSetAccesToken (accessToken, expiresInTstamp) {
    if (accessToken && expiresInTstamp > (Date.now() / 1000)) {
      log.debug('accessToken valid')
      return true
    }
    log.info('accessToken expired')
    return false
  }

  async authenticateByRefreshToken (refreshToken) {
    log.debug('Request new Token')
    // Request new Token
    const newToken = await this.request(HTTP_POST, PATH_AUTH, null, {
      grant_type: 'refresh_token',
      client_id: utils.config().clientId,
      client_secret: utils.config().clientSecret,
      refresh_token: refreshToken
    })
    // Check Validity
    if (!newToken.access_token || !newToken.refresh_token || !newToken.expires_in) {
      throw new Error('Invalid Netatmo token')
    }
    this.accessToken = newToken.access_token
    this.refreshToken = newToken.refresh_token
    this.expiresInTS = Math.floor(Date.now() / 1000) + newToken.expires_in
    // Event store new token
    utils.event.emit('update_token', newToken)
    return true
  }

  async pollStop () {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }

  async pollData () {
    // AirCare
    const aircares = await this.getHomeCoachData()
    for (let a = 0, alen = aircares.length; a < alen; a++) {
      const aircare = aircares[a]
      log.debug('Aircare data: ' + JSON.stringify(aircare))
      await this.processAircare(aircare)
    }
    // Weather Station
    const stations = await this.getStationsData(null, utils.config().getFavorites)
    for (let s = 0, slen = stations.length; s < slen; s++) {
      const station = stations[s]
      log.debug('Station data: ' + JSON.stringify(station))
      await this.processStation(station)
    }
    // Loop if needed
    if (!this.intervalId) {
      this.intervalId = setInterval(this.pollData.bind(this), 60000)
    }
  }

  /**
   * Returns data from a user Weather Stations (measures and device specific data)
   *
   * @param {string} deviceId Weather station mac address
   * @param {boolean} getFavorites To retrieve user's favorite weather stations. Default is false
   * @return {object} Devices list (`devices`) and user information (`user`)
   */
  async getStationsData (deviceId, getFavorites = false) {
    const params = {
      device_id: deviceId,
      get_favorites: getFavorites
    }
    return (await this.request(HTTP_GET, '/api/getstationsdata', params, null)).body.devices
  }

  /**
   * Returns data from a user Healthy Home Coach (measures and device specific data)
   *
   * @param {string} deviceId Home coach station mac address
   * @return {object} Devices list (`devices`) and user information (`user`)
   */
  async getHomeCoachData (deviceId) {
    const params = {
      device_id: deviceId
    }
    return (await this.request(HTTP_GET, '/api/gethomecoachsdata', params, null)).body.devices
  }

  /**
   * Process Station data
   *
   * @param {object} station Data from a user Weather Station
   */
  async processStation (station) {
    // Station dashboard_data
    const measure = await this.processMeasure(station.dashboard_data)
    // Station information
    measure.id = station._id
    measure.name = station.station_name
    measure.type = station.type
    measure.online = (station.reachable) ? 1 : 0
    // Station Favorite
    if (!station.favorite) {
      measure.wifistatus = station.wifi_status
      measure.favorite = 0
    } else {
      measure.home = station.station_name
      measure.favorite = 1
    }
    // Publish to mqtt
    utils.event.emit('frame', measure)
    // Station Module
    const foundModules = station.modules
    if (_.isEmpty(foundModules)) {
      log.warn(`This station have no modules: ${station.station_name}`)
      return
    }
    // Module information
    for (let m = 0, mlen = foundModules.length; m < mlen; m++) {
      const module = foundModules[m]
      // Module dashboard_data
      const modmeasure = await this.processMeasure(module.dashboard_data)
      modmeasure.id = module._id
      modmeasure.type = module.type
      modmeasure.online = (module.reachable) ? 1 : 0
      // Station Favorite
      if (!station.favorite) {
        modmeasure.name = module.module_name
        modmeasure.home = station.home_name
        modmeasure.rfstatus = module.rf_status
        modmeasure.battery = module.battery_percent
        modmeasure.favorite = 0
      } else {
        modmeasure.name = module.type
        modmeasure.home = station.station_name
        modmeasure.favorite = 1
      }
      // Publish to mqtt
      utils.event.emit('frame', modmeasure)
    }
  }

  /**
   * Process AirCare data
   *
   * @param {object} aircare Data from a user Smart Indoor Air Quality Monitor
   */
  async processAircare (aircare) {
    // Aircare dashboard_data
    const measure = await this.processMeasure(aircare.dashboard_data)
    // Aircare information
    measure.id = aircare._id
    measure.name = aircare.station_name
    measure.type = aircare.type
    measure.module = aircare.module_name
    measure.online = (aircare.reachable) ? 1 : 0
    measure.wifistatus = aircare.wifi_status
    // Publish to mqtt
    utils.event.emit('frame', measure)
  }

  /**
   * Process measure of station and modules
   *
   * @param {object} measure Module dasboard_data
   * @returns {object} data Formated object with sensor values
   */
  async processMeasure (measure) {
    const data = {}
    // No dashboard data
    if (_.isUndefined(measure)) {
      return data
    }
    // Temperature
    if (Object.prototype.hasOwnProperty.call(measure, 'Temperature')) {
      data.temperature = measure.Temperature
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'temp_trend')) {
      data.temptrend = measure.temp_trend
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'min_temp')) {
      data.mintemp = measure.min_temp
      data.mintemputc = measure.date_min_temp
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'max_temp')) {
      data.maxtemp = measure.max_temp
      data.maxtemputc = measure.date_max_temp
    }
    // Pressure
    if (Object.prototype.hasOwnProperty.call(measure, 'Pressure')) {
      data.pressure = measure.Pressure
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'AbsolutePressure')) {
      data.pressureabs = measure.AbsolutePressure
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'pressure_trend')) {
      data.pressuretrend = measure.pressure_trend
    }
    // Humidity
    if (Object.prototype.hasOwnProperty.call(measure, 'Humidity')) {
      data.humidity = measure.Humidity
    }
    // CO2
    if (Object.prototype.hasOwnProperty.call(measure, 'CO2')) {
      data.co2 = measure.CO2
    }
    // Noise
    if (Object.prototype.hasOwnProperty.call(measure, 'Noise')) {
      data.noise = measure.Noise
    }
    // Rain
    if (Object.prototype.hasOwnProperty.call(measure, 'Rain')) {
      data.rain = measure.Rain
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'sum_rain_1')) {
      data.sumrain1 = measure.sum_rain_1
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'sum_rain_24')) {
      data.sumrain24 = measure.sum_rain_24
    }
    // Wind
    if (Object.prototype.hasOwnProperty.call(measure, 'WindStrength')) {
      data.windstrength = measure.WindStrength
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'WindAngle')) {
      data.windangle = measure.WindAngle
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'max_wind_str')) {
      data.windstrenghtmax = measure.max_wind_str
      data.windanglemax = measure.max_wind_angle
      data.windmaxutc = measure.date_max_wind_str
    }
    // Gust
    if (Object.prototype.hasOwnProperty.call(measure, 'GustStrength')) {
      data.guststrength = measure.GustStrength
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'GustAngle')) {
      data.gustangle = measure.GustAngle
    }
    // Air Care Index
    if (Object.prototype.hasOwnProperty.call(measure, 'health_idx')) {
      data.healthidx = measure.health_idx
    }
    // Time of measurement
    if (Object.prototype.hasOwnProperty.call(measure, 'time_utc')) {
      data.timeutc = measure.time_utc
    }
    return data
  }

  /**
   * Request Netatmo API
   *
   * @param {string} method HTTP method (`'GET'`, `'POST'`)
   * @param {string} path API path (example: `'/api/gethomedata'`)
   * @param {object} params Parameters send as query string
   * @param {object} data Data to post
   * @param {boolean} isRetry This is the second try for this request (default false)
   * @return {object|Array} Data in response
   */
  async request (method, path, params = null, data = null, isRetry = false) {
    const config = {
      ...this.requestConfig,
      method,
      baseURL,
      url: path,
      headers: {}
    }
    if (data) {
      // as POST method accept only `application/x-www-form-urlencoded` content-type, transform data object into query string
      config.data = new URLSearchParams(data).toString()
    }
    if (params) {
      config.params = params
    }

    if (path !== PATH_AUTH) {
      if (!this.accessToken) {
        throw new Error('Access token must be provided')
      }
      config.headers.Authorization = `Bearer ${this.accessToken}`
    }

    try {
      const result = await axios(config)
      return result.data
    } catch (e) {
      if (e.response && e.response.data) {
        if (!isRetry && (e.response.status === 403 || e.response.status === 401) && e.response.data.error && e.response.data.error.code && e.response.data.error.code === 3) {
          // expired access token error, remove it and try to get a new one before a retry
          this.accessToken = null
          await this.connect()
          return await this.request(method, path, params, data, true)
        }
        if (e.response.data.error_description) {
          // bad request error
          throw new Error(`HTTP request ${path} failed: ${e.response.data.error_description} (${e.response.status})`)
        }
        if (e.response.data.error && e.response.data.error.message) {
          // standard error
          throw new Error(`HTTP request ${path} failed: ${e.response.data.error.message} (${e.response.status})`)
        }
        if (e.response.data.error) {
          // other error
          throw new Error(`HTTP request ${path} failed: ${JSON.stringify(e.response.data.error)} (${e.response.status})`)
        }
      }
      // Axios error
      throw new Error(`HTTP request ${path} failed: ${e.message}`)
    }
  }
}()
