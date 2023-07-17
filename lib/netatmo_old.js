const HTTP_GET = 'GET'

class NetatmoClient {
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
}

module.exports = NetatmoClient
