'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const asset = name => fs.readFileSync(path.join(__dirname, '../app/src/main/assets', name),'utf8');

test('existing app keeps the same local storage key', () => {
  assert.match(asset('app.js'), /yolculuk66\.offline\.mvp\.v1/);
});

test('update checker is loaded before main app and button is visible in analysis', () => {
  const html = asset('index.html'), app = asset('app.js');
  assert.match(html, /<script src="updates\.js"><\/script>/);
  assert.ok(html.indexOf('updates.js') < html.indexOf('app.js'));
  assert.match(app, /data-action="checkUpdates"/);
  assert.match(app, /if\(action==='checkUpdates'\)/);
});

test('no update request is performed during initial render', () => {
  const app = asset('app.js');
  assert.match(app, /async function checkUpdates/);
  const renderFunction = app.split('function render(){')[1].split('function ask(')[0];
  assert.doesNotMatch(renderFunction,/checkForUpdates|checkUpdates\(/);
});
