/* eslint-disable no-undef,no-new,camelcase */
const axios = require('axios')
const MockAdapter = require('axios-mock-adapter')
const mock = new MockAdapter(axios)

const NetatmoClient = require('../lib/netatmo')
const { eventEmitter } = require('../lib/utils')
const logger = require('../lib/logs')

const clientId = 'clientId'
const clientSecret = 'clientSecret'
const username = 'user'
const password = 'password'
const requestConfig = { dummy: '1' }

const authResult = {
  access_token: '2YotnFZFEjr1zCsicMWpAA',
  expires_in: 10800,
  refresh_token: 'tGzv3JOkF0XG5Qx2TlKWIA'
}

describe('Create NetatmoClient', () => {
  test('should throw error if no application id is provided', () => {
    expect(() => { new NetatmoClient(null, null, null, null, {}) }).toThrowError(new Error('Client id and client secret must be provided, see https://dev.netatmo.com/apidocumentation/oauth#client-credential'))
    expect(() => { new NetatmoClient(clientId, null, null, null, {}) }).toThrowError(new Error('Client id and client secret must be provided, see https://dev.netatmo.com/apidocumentation/oauth#client-credential'))
    expect(() => { new NetatmoClient(null, clientSecret, null, null, {}) }).toThrowError(new Error('Client id and client secret must be provided, see https://dev.netatmo.com/apidocumentation/oauth#client-credential'))
  })
  test('should throw error if no credentials is provided', () => {
    expect(() => { new NetatmoClient(clientId, clientSecret, null, null, {}) }).toThrowError(new Error('Username and password must be provided'))
    expect(() => { new NetatmoClient(clientId, clientSecret, username, null, {}) }).toThrowError(new Error('Username and password must be provided'))
    expect(() => { new NetatmoClient(clientId, clientSecret, null, password, {}) }).toThrowError(new Error('Username and password must be provided'))
  })
  test('should return a new instance of NetatmoClient with valid parameters', () => {
    const client = new NetatmoClient(clientId, clientSecret, username, password, requestConfig)
    expect(client.clientId).toStrictEqual(clientId)
    expect(client.clientSecret).toStrictEqual(clientSecret)
    expect(client.requestConfig).toStrictEqual(requestConfig)
    expect(client.username).toStrictEqual(username)
    expect(client.password).toStrictEqual(password)
  })
  test('should return a new instance of NetatmoClient even without request config provided', () => {
    expect(new NetatmoClient(clientId, clientSecret, username, password)).toBeInstanceOf(NetatmoClient)
  })
})

describe('Request', () => {
  let client
  beforeAll(async () => {
    mock
      .onGet('/path', { params: { type: 'params' } }).reply(200, { body: [{ type: 'getpublicdata' }] })
      .onGet('/timeout').timeout()
      .onGet('/authError').reply(400, { error: 'invalid_request', error_description: 'Missing parameters, "username" and "password" are required' })
      .onGet('/appError').reply(400, { error: { code: 1, message: 'Access token is missing' } })
      .onGet('/tokenExpired401').replyOnce(401, { error: { code: 3, message: 'Access token expired' } })
      .onGet('/tokenExpired401').reply(200, { body: '401' })
      .onGet('/tokenExpired403').replyOnce(403, { error: { code: 3, message: 'Access token expired' } })
      .onGet('/tokenExpired403').reply(200, { body: '403' })
      .onPost('/oauth2/token').reply(200, authResult)
      .onGet('/noMessageError').reply(500, { error: { code: 99 } })
      .onAny().reply(404)
  })
  afterAll(() => {
    mock.reset()
  })
  beforeEach(() => {
    client = new NetatmoClient(clientId, clientSecret, username, password, {})
  })

  test('should throw error if access token is not set', async () => {
    await expect(async () => { await client.request('GET', '/path', { type: 'params' }, { type: 'data' }) }).rejects.toThrowError(new Error('Access token must be provided'))
  })
  test('should throw error in case of timeout', async () => {
    await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
    await expect(async () => { await client.request('GET', '/timeout') }).rejects.toThrowError(new Error('HTTP request /timeout failed: timeout of 0ms exceeded'))
  })
  test('should throw error in case of OAuth2 bad request', async () => {
    await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
    await expect(async () => { await client.request('GET', '/authError') }).rejects.toThrowError(new Error('HTTP request /authError failed: Missing parameters, "username" and "password" are required (400)'))
  })
  test('should throw error in case of application bad request', async () => {
    await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
    await expect(async () => { await client.request('GET', '/appError') }).rejects.toThrowError(new Error('HTTP request /appError failed: Access token is missing (400)'))
  })
  test('should throw error in case of application bad request', async () => {
    await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
    await expect(async () => { await client.request('GET', '/noMessageError') }).rejects.toThrowError(new Error('HTTP request /noMessageError failed: {"code":99} (500)'))
  })
  test('should retry in case of HTTP 401 expired token', async () => {
    await client.connect(authResult.access_token, authResult.refresh_token, 3600 + Date.now() / 1000)
    const result = await client.request('GET', '/tokenExpired401')
    expect(result).toStrictEqual({ body: '401' })
  })
  test('should retry in case of HTTP 403 expired token', async () => {
    await client.connect(authResult.access_token, authResult.refresh_token, 3600 + Date.now() / 1000)
    const result = await client.request('GET', '/tokenExpired403')
    expect(result).toStrictEqual({ body: '403' })
  })
})

describe('Authentication', () => {
  beforeAll(async () => {
    mock
      .onPost('/oauth2/token').reply(200, authResult)
      .onAny().reply(404)
  })
  afterAll(() => {
    mock.reset()
  })

  describe('User credentials grant type', () => {
    test('should obtain token with client credentials', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await client.authenticateByClientCredentials()
      expect(client.accessToken).toStrictEqual(authResult.access_token)
      expect(client.expiresInTimestamp > Date.now() / 1000).toBeTruthy()
      expect(client.refreshToken).toStrictEqual(authResult.refresh_token)
    })
  })

  describe('Refresh token', () => {
    test('should throw error if refresh token is not provided', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await expect(async () => { await client.authenticateByRefreshToken() }).rejects.toThrowError(new Error('Refresh token must be provided'))
    })
    test('should obtain token with refresh token', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await client.authenticateByRefreshToken(authResult.refresh_token)
      expect(client.accessToken).toStrictEqual(authResult.access_token)
      expect(client.expiresInTimestamp > Date.now() / 1000).toBeTruthy()
      expect(client.refreshToken).toStrictEqual(authResult.refresh_token)
    })
  })

  describe('Connect Wrapper', () => {
    test('should obtain token with client credentials', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await client.connect(undefined, undefined, 0)
      expect(client.accessToken).toStrictEqual(authResult.access_token)
      expect(client.expiresInTimestamp > Date.now() / 1000).toBeTruthy()
      expect(client.refreshToken).toStrictEqual(authResult.refresh_token)
    })
    test('should obtain token with with refresh token', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await client.connect(undefined, authResult.refresh_token)
      expect(client.accessToken).toStrictEqual(authResult.access_token)
      expect(client.expiresInTimestamp > Date.now() / 1000).toBeTruthy()
      expect(client.refreshToken).toStrictEqual(authResult.refresh_token)
    })
    test('should use provided valid access token', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
      expect(client.accessToken).toStrictEqual(authResult.access_token)
    })
  })

  describe('Invalid token', () => {
    beforeAll(() => {
      mock
        .onPost('/oauth2/token').reply(200, {})
        .onAny().reply(404)
    })
    afterAll(() => {
      mock.reset()
    })
    test('should throw error if received token is invalid', async () => {
      const client = new NetatmoClient(clientId, clientSecret, username, password, {})
      await expect(async () => { await client.authenticateByRefreshToken(authResult.refresh_token) }).rejects.toThrowError(new Error('Invalid Netatmo token'))
    })
  })
})

describe('Netatmo API', () => {
  const home_id = '1'
  const device_id = '01:02'
  const module_id = '03:04'
  const scale = 'max'
  const type = 'type'
  let client
  beforeAll(async () => {
    client = new NetatmoClient(clientId, clientSecret, username, password, {})
    await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
    mock
      .onGet('/api/homesdata', { params: { home_id, gateway_types: {} } }).reply(200, { body: { homes: [{ type: 'homesdata' }] } })
      .onGet('/api/homestatus', { params: { home_id, gateway_types: {} } }).reply(200, { body: { home: [{ type: 'homestatus' }] } })
      .onGet('/api/getstationsdata', { params: { device_id, get_favorites: false } }).reply(200, { body: { devices: [{ type: 'stationdata' }] } })
      .onGet('/api/getmeasure', { params: { device_id, module_id, scale, type, date_begin: 1, date_end: 2, limit: 5, optimize: true, real_time: false } }).reply(200, { body: [{ type: 'getmeasure' }] })
      .onGet('/api/gethomecoachsdata', { params: { device_id } }).reply(200, { body: { devices: [{ type: 'homecoachsdata' }] } })
      .onAny().reply(404)
  })
  afterAll(() => {
    mock.reset()
  })

  describe('Homes', () => {
    test('should return Homes Data', async () => {
      const result = await client.getHomesData(home_id)
      expect(result[0].type).toStrictEqual('homesdata')
    })
    test('should return Home Status', async () => {
      const result = await client.getHomeStatus(home_id)
      expect(result[0].type).toStrictEqual('homestatus')
    })
    test('should throw error if no homeId is provided', async () => {
      await expect(async () => { await client.getHomeStatus() }).rejects.toThrowError(new Error('Home id must be provided'))
    })
  })

  describe('Weather', () => {
    test('should return Stations Data', async () => {
      const result = await client.getStationsData(device_id)
      expect(result[0].type).toStrictEqual('stationdata')
    })
    test('should return device data', async () => {
      const result = await client.getMeasure(device_id, module_id, scale, type, 1, 2, 5, true, false)
      expect(result[0].type).toStrictEqual('getmeasure')
    })
    test('should throw error if deviceId is not provided', async () => {
      await expect(async () => { await client.getMeasure(undefined, undefined, scale, type, 1, 2, 5, true, false) }).rejects.toThrowError(new Error('Device id, Scale and Type must be provided'))
    })
  })

  describe('AirCare', () => {
    test('should return Healthy Home Coach data', async () => {
      const result = await client.getHomeCoachData(device_id)
      expect(result[0].type).toStrictEqual('homecoachsdata')
    })
  })
})

describe('Specific functions', () => {
  const stationData = { body: { devices: [{ _id: '70:ee:50:22:a3:00', type: 'NAMain', module_name: 'Indoor', firmware: 137, wifi_status: 55, reachable: true, co2_calibrating: false, station_name: 'Casa', home_id: '594xxxxxxxxxdb', home_name: 'Home', dashboard_data: { time_utc: 1555677739, Temperature: 23.7, CO2: 967, Humidity: 41, Noise: 42, Pressure: 997.6, AbsolutePressure: 1017.4, min_temp: 21.2, max_temp: 27.4, date_min_temp: 1555631374, date_max_temp: 1555662436, temp_trend: 'up', pressure_trend: 'up' }, modules: [{ _id: '06:00:00:02:47:04', type: 'NAModule4', module_name: 'Indoor Module', reachable: true, firmware: 19, rf_status: 31, battery_vp: 5148, battery_percent: 58, dashboard_data: { time_utc: 1555677739, Temperature: 23.7, CO2: 967, Humidity: 41, Pressure: 997.6, AbsolutePressure: 1017.4, min_temp: 21.2, max_temp: 27.4, date_min_temp: 1555631374, date_max_temp: 1555662436, temp_trend: 'up' } }, { _id: '06:00:00:02:47:01', type: 'NAModule1', module_name: 'Outdoor Module', reachable: true, firmware: 19, rf_status: 31, battery_vp: 5148, battery_percent: 58, dashboard_data: { time_utc: 1555677739, Temperature: 23.7, Humidity: 41, min_temp: 21.2, max_temp: 27.4, date_min_temp: 1555631374, date_max_temp: 1555662436, temp_trend: 'up' } }, { _id: '06:00:00:02:47:03', type: 'NAModule3', module_name: 'Rain gauge', reachable: true, firmware: 19, rf_status: 31, battery_vp: 5148, battery_percent: 58, dashboard_data: { time_utc: 1555677734, Rain: 0, sum_rain_24: 0, sum_rain_1: 0 } }, { _id: '06:00:00:02:47:02', type: 'NAModule2', module_name: 'Wind Module', battery_percent: 58, reachable: true, firmware: 19, rf_status: 31, battery_vp: 5148, dashboard_data: { time_utc: 1555677734, WindStrength: 2, WindAngle: 75, GustStrength: 3, GustAngle: 75, max_wind_str: 4, max_wind_angle: 100, date_max_wind_str: 1555673190 } }] }] } }
  const aircareData = { body: { devices: [{ _id: '70:ee:50:22:a3:00', date_setup: 1513707043, last_setup: 1513707043, type: 'NHC', last_status_store: 1555677748, module_name: 'string', firmware: 45, last_upgrade: 0, wifi_status: 22, reachable: true, co2_calibrating: false, station_name: 'Bedroom', data_type: ['Temperature, CO2, Humidity, Noise, Pressure, health_idx'], place: { altitude: 45, city: 'Boulogne-billancourt', country: 'string', timezone: 'Europe/Paris', location: ['30.89600807058707, 29.94281464724796'] }, dashboard_data: { time_utc: 1555677780, Temperature: 23.7, CO2: 967, Humidity: 41, Noise: 42, Pressure: 45, AbsolutePressure: 1022.9, health_idx: 1, min_temp: 21.2, max_temp: 27.4, date_max_temp: 1555662436, date_min_temp: 1555631374 }, name: 'Bedroom Baby', read_only: true }] } }
  let client

  beforeEach(async () => {
    client = new NetatmoClient(clientId, clientSecret, username, password, {})
    mock
      .onPost('/oauth2/token').reply(200, authResult)
      .onGet('/api/getstationsdata').reply(200, stationData)
      .onGet('/api/gethomecoachsdata').reply(200, aircareData)
      .onAny().reply(404)
  })

  describe('data cleaning', () => {
    test('process measure of station', async () => {
      const input = { body: { devices: [{ _id: '70:ee:50:22:a3:00', module_name: 'TestAllValues', dashboard_data: { time_utc: 1555677739, Temperature: 23.7, CO2: 967, Humidity: 41, Noise: 42, Pressure: 997.6, AbsolutePressure: 1017.4, min_temp: 21.2, max_temp: 27.4, date_min_temp: 1555631374, date_max_temp: 1555662436, temp_trend: 'up', pressure_trend: 'up', Rain: 0, sum_rain_24: 0, sum_rain_1: 0, WindStrength: 2, WindAngle: 75, GustStrength: 3, GustAngle: 75, max_wind_str: 4, max_wind_angle: 100, date_max_wind_str: 1555673190, co2: 967, health_idx: 1 }, reachable: true }] } }
      const output = { co2: 967, gustangle: 75, guststrength: 3, healthidx: 1, humidity: 41, maxtemp: 27.4, maxtemputc: 1555662436, mintemp: 21.2, mintemputc: 1555631374, noise: 42, pressure: 997.6, pressureabs: 1017.4, pressuretrend: 'up', rain: 0, sumrain1: 0, sumrain24: 0, temperature: 23.7, temptrend: 'up', timeutc: 1555677739, windangle: 75, windanglemax: 100, windstrenghtmax: 4, windmaxutc: 1555673190, windstrength: 2 }
      const data = await client.processMeasure(input.body.devices[0].dashboard_data)
      expect(data).toStrictEqual(output)
    })
  })

  describe('process data', () => {
    test('process Weather Station with no Modules', async () => {
      const noModules = { body: { devices: [{ _id: '70:ee:50:22:a3:00', type: 'NAMain', module_name: 'Indoor', firmware: 137, wifi_status: 55, reachable: true, co2_calibrating: false, station_name: 'Casa', home_id: '594xxxxxxxxxdb', home_name: 'Home', dashboard_data: { time_utc: 1555677739, Temperature: 23.7, CO2: 967, Humidity: 41, Noise: 42, Pressure: 997.6, AbsolutePressure: 1017.4, min_temp: 21.2, max_temp: 27.4, date_min_temp: 1555631374, date_max_temp: 1555662436, temp_trend: 'up', pressure_trend: 'up' }, modules: [] }] } }
      const spy = jest.spyOn(logger, 'warn')
      await client.processStation(noModules.body.devices[0])
      expect.assertions(1)
      expect(spy).toHaveBeenCalledWith('This station have no modules: Casa')
    })

    test('process Weather Station : Main', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      const spy2 = jest.spyOn(eventEmitter, 'emit').mockImplementation(() => {})
      await client.processStation(stationData.body.devices[0])
      expect.assertions(2)
      expect(spy1).toHaveBeenCalledWith(stationData.body.devices[0].dashboard_data)
      expect(spy2).toHaveBeenCalledWith('frame', { co2: 967, home: 'Home', humidity: 41, id: '70:ee:50:22:a3:00', maxtemp: 27.4, maxtemputc: 1555662436, mintemp: 21.2, mintemputc: 1555631374, name: 'Casa', noise: 42, online: 1, pressure: 997.6, pressureabs: 1017.4, pressuretrend: 'up', timeutc: 1555677739, temperature: 23.7, temptrend: 'up', type: 'NAMain', wifistatus: 55 })
    })

    test('process Weather Station : Indoor', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      const spy2 = jest.spyOn(eventEmitter, 'emit').mockImplementation(() => {})
      await client.processStation(stationData.body.devices[0])
      expect.assertions(2)
      expect(spy1).toHaveBeenCalledWith(stationData.body.devices[0].modules[0].dashboard_data)
      expect(spy2).toHaveBeenCalledWith('frame', { battery: 58, co2: 967, home: 'Home', humidity: 41, id: '06:00:00:02:47:04', maxtemp: 27.4, maxtemputc: 1555662436, mintemp: 21.2, mintemputc: 1555631374, name: 'Indoor Module', online: 1, pressure: 997.6, pressureabs: 1017.4, rfstatus: 31, temperature: 23.7, temptrend: 'up', timeutc: 1555677739, type: 'NAModule4' })
    })

    test('process Weather Station : Outdoor', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      const spy2 = jest.spyOn(eventEmitter, 'emit').mockImplementation(() => {})
      await client.processStation(stationData.body.devices[0])
      expect.assertions(2)
      expect(spy1).toHaveBeenCalledWith(stationData.body.devices[0].modules[1].dashboard_data)
      expect(spy2).toHaveBeenCalledWith('frame', { battery: 58, home: 'Home', humidity: 41, id: '06:00:00:02:47:01', maxtemp: 27.4, maxtemputc: 1555662436, mintemp: 21.2, mintemputc: 1555631374, name: 'Outdoor Module', online: 1, rfstatus: 31, timeutc: 1555677739, temperature: 23.7, temptrend: 'up', type: 'NAModule1' })
    })

    test('process Weather Station : Rain', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      await client.processStation(stationData.body.devices[0])
      expect.assertions(1)
      expect(spy1).toHaveBeenCalledWith(stationData.body.devices[0].modules[2].dashboard_data)
    })

    test('process Weather Station : Wind', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      await client.processStation(stationData.body.devices[0])
      expect.assertions(1)
      expect(spy1).toHaveBeenCalledWith(stationData.body.devices[0].modules[3].dashboard_data)
    })

    test('process Aircare', async () => {
      const spy1 = jest.spyOn(client, 'processMeasure')
      const spy2 = jest.spyOn(eventEmitter, 'emit').mockImplementation(() => {})
      await client.processAircare(aircareData.body.devices[0])
      expect(spy1).toHaveBeenCalledWith(aircareData.body.devices[0].dashboard_data)
      expect(spy2).toHaveBeenCalledWith('frame', { co2: 967, healthidx: 1, humidity: 41, id: '70:ee:50:22:a3:00', maxtemp: 27.4, maxtemputc: 1555662436, mintemp: 21.2, mintemputc: 1555631374, module: 'string', name: 'Bedroom', noise: 42, online: 1, pressure: 45, pressureabs: 1022.9, temperature: 23.7, timeutc: 1555677780, type: 'NHC', wifistatus: 22 })
    })
  })

  describe('Poller', () => {
    beforeEach(async () => {
      await client.connect(authResult.access_token, undefined, 3600 + Date.now() / 1000)
      jest.useFakeTimers()
    })

    test('pollData may run with no errors', async () => {
      await expect(async () => { await client.pollData() }).not.toThrow()
    })

    test('startPolling may start and stop correctly', async () => {
      const spy1 = jest.spyOn(global, 'setInterval')
      const spy2 = jest.spyOn(global, 'clearInterval')

      await client.startPolling()
      expect(spy1).toHaveBeenLastCalledWith(expect.any(Function), 60000)
      process.emit('SIGTERM')
      process.emit('SIGINT')
      expect(spy2).toHaveBeenCalledTimes(2)
    })
  })
})
