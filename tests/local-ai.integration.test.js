'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const file=p=>fs.readFileSync(path.join(root,p),'utf8');

test('real GGUF inference uses an on-device llama.cpp AAR, not a cloud service',()=>{
 const gradle=file('app/build.gradle');
 assert.match(gradle,/org\.codeshipping:llama-kotlin-android:0\.1\.7/);
 const host=file('app/src/main/java/com/ozgun/yolculuk66/OfflineAiHost.kt');
 assert.match(host,/LlamaModel\.load\(/);
 assert.match(host,/\.generate\(/);
 assert.doesNotMatch(host,/HttpURLConnection|https?:\/\//);
 assert.match(host,/context\.filesDir/);
});
test('model import is user-initiated with GGUF header and an upper size bound',()=>{
 const host=file('app/src/main/java/com/ozgun/yolculuk66/OfflineAiHost.kt');
 assert.match(host,/GGUF/);
 assert.match(host,/MAX_MODEL_BYTES/);
 const native=file('app/src/main/java/com/ozgun/yolculuk66/MainActivity.java');
 assert.match(native,/ACTION_OPEN_DOCUMENT/);
 assert.match(native,/AndroidAI/);
 assert.match(native,/importModel/);
});
test('coach can opt into real local inference but retains rule-based fallback',()=>{
 const app=file('app/src/main/assets/app.js');
 assert.match(app,/AndroidAI\.generate\(/);
 assert.match(app,/AndroidAI\.chooseModel\(/);
 assert.match(app,/coachReply\(/);
 assert.match(app,/onLocalAIEvent/);
 assert.match(app,/kural tabanlı/);
});
test('LLM model weights never get included in a public commit',()=>{
 const ignore=file('.gitignore');
 assert.match(ignore,/\*\.gguf/);
});
