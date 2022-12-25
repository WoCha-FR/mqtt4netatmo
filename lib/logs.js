const { logVerbosity, noColor } = require('./config')
const logger = require('yalm')
logger.setLevel(logVerbosity)

if (noColor) {
  logger.setColor(false)
}

module.exports = logger
