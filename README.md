# mqtt4netatmo

[![npm](https://img.shields.io/npm/v/mqtt4netatmo)](https://www.npmjs.com/package/mqtt4netatmo)
[![License](https://img.shields.io/github/license/WoCha-FR/mqtt4netatmo)](https://github.com/WoCha-FR/mqtt4netatmo/blob/main/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/WoCha-FR/mqtt4netatmo/node-js.yml?branch=main)](https://github.com/WoCha-FR/mqtt4netatmo/actions/workflows/node-js.yml)
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

### Example

```
mqtt4netatmo
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
  mintemp: 21.4,
  mintemputc: 1686883090,
  maxtemp: 22.9,
  maxtemputc: 1686866460,
  humidity: 51,
  co2: 588,
  noise: 32,
  id: '70:00:00:00:00:00',
  name: 'Home (Indoor)',
  type: 'NAMain',
  home: 'Home',
  online: 1,
  timeutc: 1672119606,
  wifistatus: 39,
  favorite: 0
}
```
### Wheather Outdoor Module

```
[netatmo/01:00:00:00:00:00] {
  temperature: 15.5,
  temptrend: 'up',
  mintemp: 18.5,
  mintemputc: 1671883057,
  maxtemp: 21.1,
  maxtemputc: 1671866446,
  humidity: 83,
  id: '01:00:00:00:00:00',
  name: 'Outdoor',
  type: 'NAModule1',
  home: 'Home',
  online: 1,
  rfstatus: 66,
  timeutc: 1672119606,
  battery: 75,
  favorite: 0
}
```

### Wheather Wind Module

```
[netatmo/02:00:00:00:00:00] {
  windstrength: 2,
  windangle: 75,
  guststrength: 3,
  gustangle: 75,
  windstrenghtmax: 20,
  windanglemax: 45,
  windmaxutc: 1672119306
  id: '02:00:00:00:00:00',
  name: 'Wind',
  type: 'NAModule2',
  home: 'Home',
  online: 1,
  rfstatus: 31,
  timeutc: 1672119606,
  battery: 58,
  favorite: 0
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
  battery: 58,
  favorite: 0
}
```

### Wheather Indoor Module

```
[netatmo/04:00:00:00:00:00] {
  temperature: 19.1,
  temptrend: 'stable',
  mintemp: 18.5,
  mintemputc: 1671883057,
  maxtemp: 21.1,
  maxtemputc: 1671866446,
  humidity: 57,
  co2: 544,
  id: '04:00:00:00:00:00',
  name: 'Upstairs',
  type: 'NAModule4',
  home: 'Home',
  online: 1,
  rfstatus: 69,
  timeutc: 1672119606,
  battery: 51,
  favorite: 0
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
  mintemp: 18.5,
  mintemputc: 1671883057,
  maxtemp: 21.1,
  maxtemputc: 1671866446,
  type: 'NHC',
  wifistatus: 22,
  favorite: 0
}
```

## Versioning

mqtt4apcaccess is maintained under the [semantic versioning](https://semver.org/) guidelines.

See the [releases](https://github.com/WoCha-FR/mqtt4netatmo/releases) on this repository for changelog.

## License

This project is licensed under MIT License - see the [LICENSE](LICENSE) file for details
