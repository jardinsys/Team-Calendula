module.exports = {
  testEnvironment: 'node',
  testEnvironmentOptions: {
    localStorageFile: 'tests/.jest-localstorage.json',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
};
