# mqtt4netatmo

[![npm](https://img.shields.io/npm/v/mqtt4netatmo)](https://www.npmjs.com/package/mqtt4netatmo)
[![License](https://img.shields.io/github/license/WoCha-FR/mqtt4netatmo)](https://github.com/WoCha-FR/mqtt4netatmo/blob/main/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/WoCha-FR/mqtt4netatmo/node-js.yml?branch=main)](https://github.com/WoCha-FR/mqtt4netatmo/actions/workflows/node-js.yml)
[![Coverage Status](https://coveralls.io/repos/github/WoCha-FR/mqtt4netatmo/badge.svg?branch=main)](https://coveralls.io/github/WoCha-FR/mqtt4netatmo?branch=main)
[![npm](https://img.shields.io/npm/dt/mqtt4netatmo)](https://www.npmjs.com/package/mqtt4netatmo)

Publish values from Netatmo Wethear & Homecoach to MQTT

## Prerequisites

You need to have a Netatmo weather station and/or an homecoach device **AND** a netatmo developper account to access the API.

* [Netatmo Weather](https://www.netatmo.com/weather) - Weather devices
* [Netatmo HomeCoach](https://www.netatmo.com/aircare/homecoach) - Homecoach
* [Netatmo Developper](https://dev.netatmo.com/) - Developper website
* [Netatmo APP](https://dev.netatmo.com/apps/createanapp) - Create Dev App

## Installing

Simply install the package over npm. This will install all the required dependencies.

```
npm install -g mqtt4netatmo
```

## Usage

```
Usage: mqtt4netatmo [options]

Options:
  -a, --username      Netatmo Dev username                            [required]
  -b, --password      Netatmo Dev password                            [required]
  -c, --clientId      Netatmo app Client ID                           [required]
  -d, --clientSecret  Netatmo app Client Secret                       [required]
  -u, --mqttUrl       mqtt broker url              [default: "mqtt://127.0.0.1"]
  -t, --mqttTopic     mqtt topic prefix                     [default: "netatmo"]
  -v, --logVerbosity  possible values: "error", "warn", "info", "debug" [default: "info"]
  -s, --sslVerify     allow ssl connections with invalid certs
  -z, --noColor       log with no color
      --version       Show version number                              [boolean]
  -h, --help          Show help                                        [boolean]
```

### Example

```
mqtt4netatmo -a user@email.address -b UserPwd -c 10acb39bc818e5789 -d 10dsfxyzbkzva
```

## MQTT Frame Output

### Weather Station

```
[netatmo/70:00:00:00:00:00] {
  temperature: 21.6,
  temptrend: 'up',
  pressure: 1013,
  pressureabs: 956.7,
  pressuretrend: 'stable',
  humidity: 51,
  co2: 588,
  noise: 32,
  id: '70:00:00:00:00:00',
  name: 'Home (Indoor)',
  type: 'NAMain',
  home: 'Home',
  online: 1,
  timeutc: 1672119606,
  wifistatus: 39
}
```
### Wheather Outdoor Module

```
[netatmo/01:00:00:00:00:00] {
  temperature: 15.5,
  temptrend: 'up',
  humidity: 83,
  id: '01:00:00:00:00:00',
  name: 'Outdoor',
  type: 'NAModule1',
  home: 'Home',
  online: 1,
  rfstatus: 66,
  timeutc: 1672119606,
  battery: 75
}
```

### Wheather Wind Module

```
[netatmo/02:00:00:00:00:00] {
  windstrength: 2,
  windangle: 75,
  guststrength: 3,
  gustangle: 75,
  id: '02:00:00:00:00:00',
  name: 'Wind',
  type: 'NAModule2',
  home: 'Home',
  online: 1,
  rfstatus: 31,
  timeutc: 1672119606,
  battery: 58
}
```

### Wheather Rain Module

```
[netatmo/03:00:00:00:00:00] {
  rain: 0,
  sumrain1: 0,
  sumrain24: 0,
  id: '03:00:00:00:00:00',
  name: 'Rain',
  type: 'NAModule3',
  home: 'Home',
  online: 1,
  rfstatus: 31,
  timeutc: 1672119606,
  battery: 58
}
```

### Wheather Indoor Module

```
[netatmo/04:00:00:00:00:00] {
  temperature: 19.1,
  temptrend: 'stable',
  humidity: 57,
  co2: 544,
  id: '04:00:00:00:00:00',
  name: 'Upstairs',
  type: 'NAModule4',
  home: 'Home',
  online: 1,
  rfstatus: 69,
  timeutc: 1672119606,
  battery: 51
}
```

### HomeCoach

```
[netatmo/70:00:00:00:00:00] {
  co2: 967,
  healthidx: 1,
  humidity: 41,
  id: '70:00:00:00:00:00',
  module: 'string',
  name: 'Bedroom',
  noise: 42,
  online: 1,
  pressure: 45,
  pressureabs: 1022.9,
  timeutc: 1672119606,
  temperature: 23.7,
  type: 'NHC',
  wifistatus: 22
}
```

## Versioning

mqtt4apcaccess is maintained under the [semantic versioning](https://semver.org/) guidelines.

See the [releases](https://github.com/WoCha-FR/mqtt4netatmo/releases) on this repository for changelog.

## License

This project is licensed under MIT License - see the [LICENSE](LICENSE) file for details
