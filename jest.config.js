/*
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: [ 'lcov', 'text' ],
  // A list of paths to directories that Jest should use to search for files in
  roots: [ './tests' ],
  // The paths to modules that run some code to configure or set up the testing environment before each test
  setupFiles: ['./tests/setup.js']
}
