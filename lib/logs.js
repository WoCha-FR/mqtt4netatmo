const { logVerbosity } = require('./config')
const logger = require('yalm')
logger.setLevel(logVerbosity)

module.exports = logger
