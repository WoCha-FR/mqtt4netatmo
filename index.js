#!/usr/bin/env node
const config = require('./lib/config')
const logger = require('./lib/logs')
const MqttClient = require('./lib/mqtt')
const NetatmoClient = require('./lib/netatmo')

/**
 * Main function.
 */
async function main () {
  logger.info('Starting netatmo API')
  logger.debug(JSON.stringify(config))
  try {
    // mqtt Client
    const mqtt = new MqttClient(config.mqttUrl, config.mqttTopic, config.sslVerify)
    await mqtt.connect()
    // Netatmo Client
    const netatmo = new NetatmoClient(config.clientId, config.clientSecret, config.username, config.password)
    await netatmo.startPolling()
  } catch (e) {
    logger.error('Unable to run => See errors below')
    logger.error(e)
    process.exit(1)
  }
}
// Call the main code
main()
