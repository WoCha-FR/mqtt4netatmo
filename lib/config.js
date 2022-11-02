const yargs = require('yargs')

const config = yargs
  .usage('Usage: $0 [options]')
  .describe('a', 'Netatmo Dev username')
  .describe('b', 'Netatmo Dev password')
  .describe('c', 'Netatmo app Client ID')
  .describe('d', 'Netatmo app Client Secret')
  .describe('u', 'mqtt broker url')
  .describe('t', 'mqtt topic prefix')
  .describe('v', 'possible values: error, warn, info, debug')
  .describe('s', 'allow ssl connections with invalid certs')
  .alias({
    a: 'username',
    b: 'password',
    c: 'clientId',
    d: 'clientSecret',
    u: 'mqttUrl',
    t: 'mqttTopic',
    v: 'logVerbosity',
    s: 'sslVerify',
    h: 'help'
  })
  .demandOption(['username', 'password', 'clientId', 'clientSecret'])
  .boolean('ssl-verify')
  .default({
    u: 'mqtt://127.0.0.1',
    t: 'netatmo',
    v: 'warn'
  })
  .help('help')
  .version()
  .strictOptions(true)
  .parserConfiguration({
    'camel-case-expansion': false,
    'strip-dashed': true
  })
  .argv

module.exports = config
