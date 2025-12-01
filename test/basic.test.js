/**
 * Basic tests for MTCM Portal
 */
const { test } = require('node:test');
const assert = require('node:assert');

// Test config-store module
test('config-store exports required functions', async () => {
  const configStore = require('../server/config-store');
  
  assert.strictEqual(typeof configStore.getConfig, 'function');
  assert.strictEqual(typeof configStore.getPublicConfig, 'function');
  assert.strictEqual(typeof configStore.updateConfig, 'function');
  assert.strictEqual(typeof configStore.isReady, 'function');
});

test('config-store isReady returns true after init', async () => {
  const configStore = require('../server/config-store');
  assert.strictEqual(configStore.isReady(), true);
});

test('config-store getPublicConfig returns expected keys', async () => {
  const configStore = require('../server/config-store');
  const publicConfig = configStore.getPublicConfig();
  
  assert.ok('siteName' in publicConfig);
  assert.ok('weatherDefaultCity' in publicConfig);
  assert.ok('weatherDefaultUnits' in publicConfig);
});

// Test route modules load without errors
test('weather routes module loads', async () => {
  const weatherRouter = require('../server/routes/weather');
  assert.ok(weatherRouter);
});

test('admin routes module loads', async () => {
  const adminRouter = require('../server/routes/admin');
  assert.ok(adminRouter);
});

test('federal routes module loads', async () => {
  const federalRouter = require('../server/routes/federal');
  assert.ok(federalRouter);
});

test('forms routes module loads', async () => {
  const formsRouter = require('../server/routes/forms');
  assert.strictEqual(typeof formsRouter, 'function');
});
