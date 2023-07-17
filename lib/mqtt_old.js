const mqtt = require('async-mqtt')
const logger = require('./logs')

class MqttClient {
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
}

module.exports = MqttClient
