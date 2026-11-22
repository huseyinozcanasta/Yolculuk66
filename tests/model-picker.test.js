'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const java=()=>read('app/src/main/java/com/ozgun/yolculuk66/MainActivity.java');
const js=()=>read('app/src/main/assets/app.js');

test('imported GGUF must open native selection confirmation, never an unhandled JS confirm',()=>{
 const app=js();
 const start=app.indexOf("if(action==='importLocalModel'){");
 const end=app.indexOf("if(action==='loadLocalModel'){",start);
 assert.ok(start>=0&&end>start);
 const importClick=app.slice(start,end);
 assert.match(importClick,/window\.AndroidAI\.chooseModel\(replace\)/);
 assert.doesNotMatch(importClick,/window\.confirm\(/);
 const activity=java();
 assert.match(activity,/import android\.app\.AlertDialog;/);
 const native=activity.slice(activity.indexOf('@JavascriptInterface public void chooseModel('),activity.indexOf('  public final class FilesBridge'));
 assert.match(native,/new AlertDialog\.Builder\(/);
 assert.match(native,/setPositiveButton\(/);
 assert.match(native,/setNegativeButton\(/);
 assert.match(native,/openModelPicker\(true\)/);
 assert.match(native,/openModelPicker\(false\)/);
});
test('model file chooser uses SAF and reports cancellation to user',()=>{
 const activity=java();
 assert.match(activity,/Intent\.ACTION_OPEN_DOCUMENT/);
 assert.match(activity,/Intent\.CATEGORY_OPENABLE/);
 assert.match(activity,/startActivityForResult\(choose,IMPORT_MODEL\)/);
 assert.match(activity,/if\(requestCode==IMPORT_MODEL\)/);
 assert.match(activity,/Dosya seçimi iptal edildi/);
});
test('a stored GGUF remains intact until confirmed replacement and is still loadable',()=>{
 const code=read('app/src/main/java/com/ozgun/yolculuk66/OfflineAiHost.kt');
 assert.match(code,/modelFile\.exists\(\) && !allowReplace/);
 assert.match(code,/oldModel/);
 assert.match(code,/if \(!temporary\.renameTo\(modelFile\)\)/);
 assert.match(code,/fun loadModel\(\)/);
});
test('other JS confirmations remain functional via an explicit WebChromeClient handler',()=>{
 const activity=java();
 assert.match(activity,/setWebChromeClient/);
 assert.match(activity,/onJsConfirm\(/);
 assert.match(activity,/result\.confirm\(\)/);
 assert.match(activity,/result\.cancel\(\)/);
});

test('imported status is explained as saved, with the correct next action',()=>{
 const app=js();
 assert.match(app,/Kaydedildi[^'"]*açılmayı bekliyor/);
 assert.match(app,/Model zaten cihazına kaydedilmiş/);
 assert.match(app,/Kaydedilmiş yerel modeli aç/);
});
