'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/core.js');
const Backup=require('../app/src/main/assets/backup.js');
const Safe=require('../app/src/main/assets/safe-storage.js');
const KEY='yolculuk66.offline.mvp.v1';
function storage(initial={}){
 const data=new Map(Object.entries(initial));
 return {getItem:k=>data.has(k)?data.get(k):null,
   setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
}
test('an absent save starts the game normally and preserves the existing key',()=>{
 const store=storage();
 const loaded=Safe.load(store,KEY,Core.initialState,Backup.validateState);
 assert.equal(loaded.locked,false);
 assert.equal(loaded.state.version,1);
 assert.equal(Safe.save(store,KEY,loaded.state,loaded.locked),true);
 assert.equal(JSON.parse(store.getItem(KEY)).version,1);
});
test('a malformed JSON save is never silently replaced',()=>{
 const corrupt='{invalid-json';
 const store=storage({[KEY]:corrupt});
 const result=Safe.load(store,KEY,Core.initialState,Backup.validateState);
 assert.equal(result.locked,true);
 assert.throws(()=>Safe.save(store,KEY,Core.initialState(),result.locked),/koruma|bozuk|kilit/i);
 assert.equal(store.getItem(KEY),corrupt);
});
test('a structurally invalid old save is also protected',()=>{
 const prior='{"version":1,"world":"forest","tasks":[{"id":"bad"}],"days":{},"seasonStart":null}';
 const store=storage({[KEY]:prior});
 const result=Safe.load(store,KEY,Core.initialState,Backup.validateState);
 assert.equal(result.locked,true);
 assert.equal(store.getItem(KEY),prior);
});
test('a valid v0.3.1 save is accepted without migration or re-keying',()=>{
 let old=Core.initialState();
 old=Core.addTask(old,{name:'Kitap oku',difficulty:'easy',core:true},'2026-11-20');
 const store=storage({[KEY]:JSON.stringify(old)});
 const result=Safe.load(store,KEY,Core.initialState,Backup.validateState);
 assert.equal(result.locked,false);
 assert.equal(result.state.tasks[0].name,'Kitap oku');
});
test('a failed save cannot claim success or overwrite the previous value',()=>{
 const prior=JSON.stringify(Core.initialState());
 const store=storage({[KEY]:prior});
 store.setItem=()=>{throw new Error('QuotaExceededError');};
 assert.throws(()=>Safe.save(store,KEY,Core.initialState(),false),/QuotaExceededError/);
 assert.equal(store.getItem(KEY),prior);
});
test('the app does not silently rewrite invalid on-device saves',()=>{
 const fs=require('node:fs');
 const app=fs.readFileSync(require('node:path').join(__dirname,'../app/src/main/assets/app.js'),'utf8');
 assert.match(app,/storageLocked/);
 assert.match(app,/SafeStore\.load\(/);
 assert.match(app,/SafeStore\.save\(/);
 const index=fs.readFileSync(require('node:path').join(__dirname,'../app/src/main/assets/index.html'),'utf8');
 assert.ok(index.indexOf('safe-storage.js')<index.indexOf('app.js'));
});

test('recovering a corrupt save requires an explicit operation and preserves original bytes',()=>{
 const bad='NOT-JSON-ORIGINAL-KEEP';
 const store=storage({[KEY]:bad});
 const next=Core.initialState();
 assert.equal(Safe.recoverCorrupt(store,KEY,next,Backup.validateState),true);
 assert.equal(store.getItem(KEY+'.corruptOriginal'),bad);
 assert.equal(JSON.parse(store.getItem(KEY)).version,1);
});
test('a second corrupt original cannot overwrite the preserved copy',()=>{
 const bad='!bad!',store=storage({[KEY]:bad,[KEY+'.corruptOriginal']:'older raw'});
 assert.throws(()=>Safe.recoverCorrupt(store,KEY,Core.initialState(),Backup.validateState),/koruma|zaten|kopya/i);
 assert.equal(store.getItem(KEY),bad);
 assert.equal(store.getItem(KEY+'.corruptOriginal'),'older raw');
});
test('safe restore never treats an intact save as corrupted',()=>{
 const intact=JSON.stringify(Core.initialState()),store=storage({[KEY]:intact});
 assert.throws(()=>Safe.recoverCorrupt(store,KEY,Core.initialState(),Backup.validateState),/geçerli|bozuk değil/i);
 assert.equal(store.getItem(KEY+'.corruptOriginal'),null);
});
