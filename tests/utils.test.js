/* eslint-disable no-undef,no-new,camelcase */
const { EventEmitter } = require('events')
const { eventEmitter } = require('../lib/utils')

describe('Utils', () => {
  test('eventEmitter is instance of EventEmitter', () => {
    expect(eventEmitter).toBeInstanceOf(EventEmitter)
  })
})
