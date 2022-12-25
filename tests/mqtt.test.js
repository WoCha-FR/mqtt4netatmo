/* eslint-disable no-undef,no-new,camelcase */
process.argv = ['node', 'jest', '-a', '1', '-b', '2', '-c', '3', '-d', '4']
const MqttClient = require('../lib/mqtt')
const logger = require('../lib/logs')
const { eventEmitter } = require('../lib/utils')

jest.setTimeout(30000)

const mqttUrl = 'mqtt://127.0.0.1'
const mqttTop = 'netatmo'
const sslVerf = true

const sample = { rain: 0, sumrain1: 0, sumrain24: 0, id: '06:00:00:02:47:03', name: 'Rain gauge', type: 'NAModule3', home: 'Home', online: 1, rfstatus: 31, battery: 58 }
const badsample = { name: 'Rain gauge', type: 'NAModule3', home: 'Home', online: 1, rfstatus: 31, battery: 58 }

describe('Create mqttClient', () => {
  test('should throw error if no mqtt information is provided', () => {
    expect(() => { new MqttClient() }).toThrowError()
    expect(() => { new MqttClient(mqttUrl) }).toThrowError()
    expect(() => { new MqttClient(undefined, mqttTop) }).toThrowError()
  })
  test('should set user values when provided', () => {
    const client = new MqttClient(mqttUrl, mqttTop, sslVerf)
    expect(client.url).toStrictEqual(mqttUrl)
    expect(client.topic).toStrictEqual(mqttTop)
    expect(client.sslopt).toBeTruthy()
  })
  test('should return a new instance of MqttClient', () => {
    expect(new MqttClient(mqttUrl, mqttTop)).toBeInstanceOf(MqttClient)
  })
})

describe('MQTT broker connect and disconnect', () => {
  describe('Connection errors', () => {
    test('should throw an error on connection refused', async () => {
      const myclient = new MqttClient('mqtt://127.0.0.1:8585', mqttTop)
      await expect(async () => { await myclient.connect() }).rejects.toThrowError(new Error('MQTT connection error [connect ECONNREFUSED 127.0.0.1:8585]'))
    })
    test('should throw an error on connection refused', async () => {
      const myclient = new MqttClient('mqtt://10.20.30.50:1883', mqttTop)
      await expect(async () => { await myclient.connect() }).rejects.toThrowError(new Error('MQTT connection error [Couldn\'t connect to server]'))
    })
    test('should throw an error on malformed url', async () => {
      const myclient = new MqttClient('127.0.0.1:1883', mqttTop)
      await expect(async () => { await myclient.connect() }).rejects.toThrowError(new Error('MQTT connection error [Invalid URL] 127.0.0.1:1883'))
    })
  })

  describe('Connect & Disconnect', () => {
    let receivedTopic = null
    const aedes = require('aedes')()
    const net = require('net')
    const server = net.createServer(aedes.handle)

    beforeAll(() => {
      server.listen('1883', function () {
        console.log('[TEST1] aedes started')
      })
      aedes.on('publish', function (packet, client) {
        if (client) {
          receivedTopic = packet.topic
        }
      })
    })
    afterAll(() => {
      server.close()
      aedes.close()
    })

    test('connect should be called as expected', async () => {
      const myclient = new MqttClient(mqttUrl, mqttTop)
      await myclient.connect()
      expect(aedes.connectedClients).toBe(1)
      // Disconnect from broker
      await myclient.disconnect(true)
    })
    test('mqtt broker receive message at startup', async () => {
      const myclient = new MqttClient(mqttUrl, mqttTop)
      await myclient.connect()
      expect(receivedTopic).toStrictEqual(`${mqttTop}/connected`)
      // Disconnect from broker
      await myclient.disconnect(true)
    })
    test('disconnect from mqtt broker', async () => {
      const spy = jest.spyOn(logger, 'info')
      const myclient = new MqttClient(mqttUrl, mqttTop)
      await myclient.connect()
      await myclient.disconnect()
      expect(spy).toHaveBeenCalledWith('Disconnected from MQTT broker')
    })
    test('disconnect from mqtt broker on SIGTERM', async () => {
      const myclient = new MqttClient(mqttUrl, mqttTop)
      const spy = jest.spyOn(myclient, 'disconnect')
      await myclient.connect()
      process.emit('SIGTERM')
      expect(spy).toHaveBeenCalledWith()
    })
    test('force disconnect from mqtt broker on SIGINT', async () => {
      const myclient = new MqttClient(mqttUrl, mqttTop)
      const spy = jest.spyOn(myclient, 'disconnect')
      await myclient.connect()
      process.emit('SIGINT')
      expect(spy).toHaveBeenCalledWith(true)
    })
    test('should throw error on broker authentication error', async () => {
      aedes.authenticate = (client, username, password, callback) => {
        password = Buffer.from(password, 'base64').toString()
        if (username === 'username' && password === 'password') {
          return callback(null, true)
        }
        const error = new Error('Authentication Failed!! Invalid user credentials.')
        return callback(error, false)
      }
      const myclient = new MqttClient('mqtt://username:username@127.0.0.1', mqttTop)
      await expect(async () => { await myclient.connect() }).rejects.toThrowError(new Error('MQTT connection error [Connection refused: Not authorized]'))
    })
  })
})

describe('Define topic', () => {
  test('should return the good topic', () => {
    const client = new MqttClient(mqttUrl, mqttTop)
    const result = client.getFrameTopic('MyTopic')
    expect(result).toStrictEqual(`${mqttTop}/MyTopic`)
  })
})

describe('Publish frame to mqtt', () => {
  test('should show a warn if frame have no id', async () => {
    const spy = jest.spyOn(logger, 'warn')
    const client = new MqttClient(mqttUrl, mqttTop)
    await client.publishFrame(badsample)
    expect.assertions(1)
    expect(spy).toHaveBeenCalledWith('Cannot publish a frame without unique id property')
  })
  test('should show a warn if frame not published', async () => {
    const spy = jest.spyOn(logger, 'warn')
    const client = new MqttClient(mqttUrl, mqttTop)
    await client.publishFrame(sample)
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^Unable to publish frame to/))
  })
  test('call publishFrame on eventEmitter.on(frame)', async () => {
    const aedes = require('aedes')()
    const net = require('net')
    const server = net.createServer(aedes.handle)
    server.listen('1883', function () {
      console.log('[TEST2] aedes started')
    })

    const myclient = new MqttClient(mqttUrl, mqttTop)
    const spy = jest.spyOn(myclient, 'publishFrame')
    await myclient.connect()
    eventEmitter.emit('frame', sample)
    expect.assertions(1)
    expect(spy).toHaveBeenCalledWith(sample)
    // Disconnect from broker
    await myclient.disconnect(true)

    // Close aedes
    server.close()
    aedes.close()
  })
})
