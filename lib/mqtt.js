const mqtt = require('async-mqtt')
const logger = require('./logs')
const { eventEmitter } = require('./utils')

class MqttClient {
  #client
  /**
   * Create an instance of mqtt client
   */
  constructor (mqttUrl, mqttTopic, sslVerify = false) {
    if (!mqttUrl || !mqttTopic) {
      throw new Error('mqttURL and mqttTopic must be provided')
    }
    this.url = mqttUrl
    this.topic = mqttTopic
    this.sslopt = sslVerify
    this.#client = null
    this.debugURL = null
  }

  /**
   * Connect to Broker
   */
  async connect (userOptions = {}) {
    /* MQTT URL */
    try {
      const mqttURL = new URL(this.url)
      mqttURL.username = ''
      mqttURL.password = ''
      this.debugURL = mqttURL.href
    } catch (e) {
      throw new Error(`MQTT connection error [${e.message}] ${this.url}`)
    }
    /* MQTT Options */
    const mqttOptions = {
      clientId: this.topic + '_' + Math.random().toString(16).slice(3),
      connectTimeout: 5000,
      will: { topic: this.topic + '/connected', payload: '0', retain: true },
      rejectUnauthorized: !this.sslopt
    }
    const allOptions = Object.assign({}, userOptions, mqttOptions)
    try {
      this.#client = await mqtt.connectAsync(this.url, allOptions, false)
    } catch (e) {
      if (!e.message) {
        throw new Error(`MQTT connection error [${e}]`)
      } else {
        throw new Error(`MQTT connection error [${e.message}]`)
      }
    }
    // Connected
    logger.info(`Connected to MQTT broker [${this.debugURL}]`)
    // Set as connected
    try {
      await this.#client.publish(`${this.topic}/connected`, '1', { retain: true })
    } catch (e) {
      throw new Error(`MQTT publish error [${e.message}]`)
    }
    // Events
    this.#client.on('connect', () => {
      // Workaround to avoid reconnect issue (see https://github.com/mqttjs/MQTT.js/issues/1213)
      // eslint-disable-next-line no-underscore-dangle
      this.#client._client.options.properties = {}
      logger.debug('Reconnected to MQTT broker')
    })
    process.on('SIGTERM', async () => {
      logger.debug('SIGTERM received')
      await this.disconnect()
    })
    process.on('SIGINT', async () => {
      logger.debug('SIGINT received')
      await this.disconnect(true)
    })
    // Events listener
    eventEmitter.on('frame', (frame) => {
      this.publishFrame(frame)
    })
  }

  /**
   * Disconnect from MQTT broker
   */
  async disconnect (force = false) {
    if (this.#client) {
      await this.#client.end(force)
      logger.info('Disconnected from MQTT broker')
    }
  }

  /**
   * Get frame topic.
   * @param subtopic
   * @returns {string}
   */
  getFrameTopic (subtopic) {
    return `${this.topic}/${subtopic}`
  }

  /**
   * Publish frame to MQTT broker.
   * @param frame
   */
  async publishFrame (frame) {
    const id = frame.id ? frame.id : undefined
    if (!id) {
      logger.warn('Cannot publish a frame without unique id property')
      logger.debug(frame)
    } else {
      const frameTopic = this.getFrameTopic(id)
      logger.debug(`Publish frame to topic [${frameTopic}]`)
      logger.debug(frame)
      try {
        await this.#client.publish(frameTopic, JSON.stringify(frame))
      } catch (e) {
        logger.warn(`Unable to publish frame to ${frameTopic} (${e.message})`)
      }
    }
  }
}

module.exports = MqttClient
