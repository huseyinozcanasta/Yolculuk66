'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const assets = path.join(__dirname, '../app/src/main/assets');
const javaPath = path.join(__dirname, '../app/src/main/java/com/ozgun/yolculuk66/MainActivity.java');
const app = () => fs.readFileSync(path.join(assets, 'app.js'), 'utf8');
const native = () => fs.readFileSync(javaPath, 'utf8');
const URL = 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';

test('AI Coach offers an explicit official Q4_K_M GGUF download action', () => {
  assert.match(app(), /data-action="downloadLocalModel"/);
  assert.match(app(), /Qwen2\.5-0\.5B-Instruct/);
  assert.match(app(), /491\s*MB/);
  assert.match(app(), /İndirilenler/);
  assert.match(app(), /data-action="importLocalModel"/);
  assert.match(app(), /data-action="loadLocalModel"/);
});

test('model download click opens an approved native external browser URL', () => {
  assert.match(app(), /if\(action==='downloadLocalModel'\)/);
  assert.match(app(), /window\.AndroidAI\.openModelDownload\(\)/);
  const java = native();
  assert.match(java, /private static final String GGUF_DOWNLOAD_URL=/);
  assert.ok(java.includes(URL), 'direct download URL must match official model file');
  assert.match(java, /@JavascriptInterface public void openModelDownload\(\)/);
  const section = java.split('@JavascriptInterface public void openModelDownload()')[1].split('@JavascriptInterface public void ')[0];
  assert.match(section, /Intent\.ACTION_VIEW/);
  assert.match(section, /GGUF_DOWNLOAD_URL/);
  assert.doesNotMatch(section, /HttpURLConnection|WebView\.loadUrl|downloadManager/i);
});

test('the model does not download automatically when UI is rendered', () => {
  const js = app();
  const coachUI = js.split('function coachView(')[1].split('async function checkUpdates(')[0];
  assert.doesNotMatch(coachUI, /openModelDownload\(|fetch\(|AndroidAI\.chooseModel\(/);
  const nativeBridge = native();
  const activityCreate = nativeBridge.split('void onCreate(')[1].split('private void callback(')[0];
  assert.doesNotMatch(activityCreate, /GGUF_DOWNLOAD_URL|openModelDownload\(/);
});

test('model download bridge is independent of the GitHub updater allowlist', () => {
  const java = native();
  const modelAction = java.split('@JavascriptInterface public void openModelDownload()')[1].split('@JavascriptInterface public void ')[0];
  assert.doesNotMatch(modelAction, /RELEASE_PREFIX/);
  assert.match(modelAction, /startActivity\(/);
});
