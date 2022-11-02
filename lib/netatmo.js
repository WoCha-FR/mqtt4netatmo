const axios = require('axios')
const _ = require('lodash')
const logger = require('./logs')
const { eventEmitter } = require('./utils')

// private constants
const HTTP_POST = 'POST'
const HTTP_GET = 'GET'
const PATH_AUTH = '/oauth2/token'
const baseURL = 'https://api.netatmo.com'

class NetatmoClient {
  /**
   * Create an instance of Netatmo client
   *
   * @param {string} clientId Your app client_id
   * @param {string} clientSecret Your app client_secret
   * @param {string} username User address email
   * @param {string} password User password
   * @param {object} requestConfig HTTP request configuration (see https://axios-http.com/docs/req_config)
   * @return {NetatmoClient} A new instance of Netatmo client
   */
  constructor (clientId, clientSecret, username, password, requestConfig = {}) {
    if (!clientId || !clientSecret) {
      throw new Error('Client id and client secret must be provided, see https://dev.netatmo.com/apidocumentation/oauth#client-credential')
    }
    if (!username || !password) {
      throw new Error('Username and password must be provided')
    }
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.requestConfig = requestConfig
    // client credentials
    this.username = username
    this.password = password
    // token
    this.accessToken = null
    this.refreshToken = null
    this.expiresInTimestamp = 0
    // setInterval ID
    this.intervalId = null
  }

  /**
   * Connect with access token, refresh token or client credentials
   *
   * @param {string} accessToken Access token for your user
   * @param {string} refreshToken Refresh token to get a new access token
   * @param {number} expiresInTimestamp Validity timelaps as timestamp
   */
  async connect (accessToken = null, refreshToken = null, expiresInTimestamp = 0) {
    if (this.checkAndSetAccesToken(accessToken, expiresInTimestamp)) {
      if (refreshToken) {
        this.refreshToken = refreshToken
      }
      return
    }
    if (refreshToken) {
      await this.authenticateByRefreshToken(refreshToken)
      return
    }
    await this.authenticateByClientCredentials()
  }

  /**
   * Check is an access token is valid and use it
   *
   * @param {string} accessToken Access token for your user
   * @param {number} expiresInTimestamp Validity timelaps as timestamp
   * @return {boolean} Access token is valid
   */
  checkAndSetAccesToken (accessToken, expiresInTimestamp) {
    if (accessToken && expiresInTimestamp > (Date.now() / 1000)) {
      this.accessToken = accessToken
      this.expiresInTimestamp = expiresInTimestamp
      return true
    }
    return false
  }

  /**
   * Authenticate with an existing refresh token
   *
   * @param {string} refreshToken Refresh token to get a new access token
   */
  async authenticateByRefreshToken (refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token must be provided')
    }
    this.refreshToken = refreshToken
    const authentication = await this.request(HTTP_POST, PATH_AUTH, null, {
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken
    })
    this.setToken(authentication)
  }

  /**
   * Authenticate with client credentials
   *
   */
  async authenticateByClientCredentials () {
    const authentication = await this.request(HTTP_POST, PATH_AUTH, null, {
      grant_type: 'password',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      username: this.username,
      password: this.password,
      scope: 'read_station read_homecoach'
    })
    this.setToken(authentication)
  }

  /**
   * Store access and refresh tokens (you should not have to use this method)
   *
   * @param {object} netatmoAuthentication Netatmo API authentication result (with `access_token`, `refresh_token` and `expires_in` attributes)
   */
  setToken (netatmoAuthentication) {
    if (!netatmoAuthentication.access_token || !netatmoAuthentication.refresh_token || !netatmoAuthentication.expires_in) {
      throw new Error('Invalid Netatmo token')
    }
    this.accessToken = netatmoAuthentication.access_token
    this.refreshToken = netatmoAuthentication.refresh_token
    this.expiresInTimestamp = Math.floor(Date.now() / 1000) + netatmoAuthentication.expires_in
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
          await this.connect(null, this.refreshToken, this.expiresInTimestamp)
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

  /**
   * Retrieve user homes and their topology
   *
   * @param {string} homeId Filter by Home ID
   * @param {array} gatewayTypes Filter by Gateway Type {BNS, NLG, OTH, NBG}
   * @return {object} Homes static information and topology (`homes`)
   */
  async getHomesData (homeId, gatewayTypes = {}) {
    const params = {
      home_id: homeId,
      gateway_types: gatewayTypes
    }
    return (await this.request(HTTP_GET, '/api/homesdata', params, null)).body.homes
  }

  /**
   * Retrieve current status of a home and the associated devices
   *
   * @param {string} homeId Home ID to get status
   * @param {array} gatewayTypes Filter by Gateway Type {BNS, NLG, OTH, NBG}
   * @return {object} Actual status of all devices present (`homes`) and user information (`user`)
   */
  async getHomeStatus (homeId, gatewayTypes = {}) {
    if (!homeId) {
      throw new Error('Home id must be provided')
    }
    const params = {
      home_id: homeId,
      gateway_types: gatewayTypes
    }
    return (await this.request(HTTP_GET, '/api/homestatus', params, null)).body.home
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
   * Returns data from a device or module
   *
   * @param {string} deviceId Weather station mac address
   * @param {string} moduleId Module mac address
   * @param {string} mScale Timeframe between two measurements {30min, 1hour, 3hours, 1day, 1week, 1month}
   * @param {array} mType Type of data to be returned
   * @param {number} dBegin Timestamp of the first measure to retrieve (Local Unix Time in seconds)
   * @param {number} dEnd Timestamp of the last measure to retrieve (Local Unix Time in seconds)
   * @param {number} mLimit Maximum number of measurements (default and max are 1024)
   * @param {boolean} rOptimize Optimized format of the answer. Default is true
   * @param {boolean} rTime If scale different than max, timestamps are by default offset + scale/2. To get exact timestamps, use true. Default is false.
   * @return {object} Devices list (`devices`) and user information (`user`)
   */
  async getMeasure (deviceId, moduleId, mScale, mType, dBegin, dEnd, mLimit, rOptimize = true, rTime = false) {
    if (!deviceId || !mScale || !mType) {
      throw new Error('Device id, Scale and Type must be provided')
    }
    const params = {
      device_id: deviceId,
      module_id: moduleId,
      scale: mScale,
      type: mType,
      date_begin: dBegin,
      date_end: dEnd,
      limit: mLimit,
      optimize: rOptimize,
      real_time: rTime
    }
    return (await this.request(HTTP_GET, '/api/getmeasure', params, null)).body
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
   * Start polling Data
   */
  async startPolling () {
    // Connect to Netatmo
    await this.connect()
    // Poll Data
    await this.pollData()
    // Set interval polling
    this.intervalId = setInterval(this.pollData.bind(this), 60000)
    process.on('SIGTERM', () => clearInterval(this.intervalId))
    process.on('SIGINT', () => clearInterval(this.intervalId))
  }

  /**
   * Polling function
   */
  async pollData () {
    // Weather Station
    const stations = await this.getStationsData()
    for (let s = 0, slen = stations.length; s < slen; s++) {
      const station = stations[s]
      logger.debug('Station data: ' + JSON.stringify(station))
      await this.processStation(station)
    }
    // AirCare
    const aircares = await this.getHomeCoachData()
    for (let a = 0, alen = aircares.length; a < alen; a++) {
      const aircare = aircares[a]
      logger.debug('Aircare data: ' + JSON.stringify(aircare))
      await this.processAircare(aircare)
    }
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
    measure.home = station.home_name
    measure.online = (station.reachable) ? 1 : 0
    measure.wifistatus = station.wifi_status
    // Publish to mqtt
    eventEmitter.emit('frame', measure)
    // Station Module
    const foundModules = station.modules
    if (_.isEmpty(foundModules)) {
      logger.warn(`This station have no modules: ${station.station_name}`)
      return
    }
    // Module information
    for (let m = 0, mlen = foundModules.length; m < mlen; m++) {
      const module = foundModules[m]
      // Module dashboard_data
      const modmeasure = await this.processMeasure(module.dashboard_data)
      modmeasure.id = module._id
      modmeasure.name = module.module_name
      modmeasure.type = module.type
      modmeasure.home = station.home_name
      modmeasure.online = (module.reachable) ? 1 : 0
      modmeasure.rfstatus = module.rf_status
      modmeasure.battery = module.battery_percent
      // Publish to mqtt
      eventEmitter.emit('frame', modmeasure)
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
    eventEmitter.emit('frame', measure)
  }

  /**
   * Process measure of station and modules
   *
   * @param {object} measure Module dasboard_data
   * @returns {object} data Formated object with sensor values
   */
  async processMeasure (measure) {
    const data = {}
    // Temperature
    if (Object.prototype.hasOwnProperty.call(measure, 'Temperature')) {
      data.temperature = measure.Temperature
    }
    if (Object.prototype.hasOwnProperty.call(measure, 'temp_trend')) {
      data.temptrend = measure.temp_trend
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
    return data
  }
}

module.exports = NetatmoClient
