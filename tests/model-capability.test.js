'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../app/src/main/assets/core.js');
const Router=require('../app/src/main/assets/coach-router.js');
const src=n=>fs.readFileSync(path.join(__dirname,'../app/src/main',n),'utf8');
const today='2026-11-22';
test('ready model gets every user question, without rule-based or canned routing',()=>{
 for(const question of ['Merhaba','Bugün ne yapayım?','XP durumum','Bu uygulama hakkında neler biliyorsun?','Neden devam etmeliyim?']){
  const routed=Router.route(Core.initialState(),question,today,true);
  assert.equal(routed.mode,'model',question);
  assert.equal(routed.reply,null);
 }
});
test('model receives factual application capabilities and live data without fabricated tasks',()=>{
 const s=Core.initialState();
 const context=JSON.parse(Router.buildContext(s,today,[]));
 assert.match(context.app,/Yolculuk 66/);
 assert.match(context.app,/66 gün/);
 assert.match(context.app,/çevrimdışı/);
 assert.match(context.app,/GGUF/);
 assert.match(context.game,/Henüz (hiç )?aktif alışkanlık yok/);
 assert.equal(context.history.length,0);
});
test('saved habits and multi-turn conversation make it into dynamic model context',()=>{
 let s=Core.initialState();
 s=Core.addTask(s,{name:'Kitap oku',difficulty:'easy',core:true},today);
 const turns=[{who:'user',text:'Bana motivasyon ver'},{who:'bot',text:'Önce küçük başla.'},{who:'user',text:'Peki neden?'}];
 const context=JSON.parse(Router.buildContext(s,today,turns));
 assert.match(context.game,/Kitap oku/);
 assert.deepEqual(context.history.map(x=>x.role),['user','assistant','user']);
 assert.equal(context.history[2].content,'Peki neden?');
});
test('chat history drops pending, caps bytes and never includes raw game storage',()=>{
 const s=Core.initialState();
 const history=Array.from({length:40},(_,i)=>({who:i%2?'bot':'user',text:'x'.repeat(900),pending:i===39}));
 const context=Router.buildContext(s,today,history);
 const p=JSON.parse(context);
 assert.ok(context.length<=4000);
 assert.ok(p.history.length<=6);
 assert.ok(p.history.every(t=>t.content.length<=210));
 assert.ok(p.history.every(t=>!t.pending));
});
test('weak model replies never silently masquerade as canned AI answers',()=>{
 const s=Core.initialState();
 for(const text of ['Nasıl yardımcı olabilirim?','Daha fazla yardımcı olamayım. Size nasıl yardımcı olabilirim?','']){
  const r=Router.acceptModelReply(s,'Bu uygulama hakkında neler biliyorsun?',text,today);
  assert.equal(r.needsRetry,true);
  assert.equal(r.reply,null);
 }
});
test('LLM uses embedded GGUF chat template and contextual JSON conversation',()=>{
 const k=src('java/com/ozgun/yolculuk66/OfflineAiHost.kt');
 assert.match(k,/applyChatTemplate\(/);
 assert.match(k,/JSONObject\(localContext\)/);
 assert.match(k,/optJSONArray\("history"\)/);
 assert.match(k,/contextSize = 3072/);
 assert.match(k,/maxTokens = 320/);
 assert.match(k,/repeatPenalty = 1\.18f/);
 assert.doesNotMatch(k,/append\("<\|im_start\|>system/);
});
test('stronger official 1.5B option is offered while smaller existing model remains',()=>{
 const app=src('assets/app.js'),native=src('java/com/ozgun/yolculuk66/MainActivity.java');
 assert.match(app,/Qwen2\.5-1\.5B-Instruct/);
 assert.match(app,/downloadStrongModel/);
 assert.match(native,/openStrongerModelDownload/);
 assert.match(native,/qwen2\.5-1\.5b-instruct-q4_k_m\.gguf/);
 assert.match(app,/Qwen2\.5-0\.5B-Instruct/);
});
test('chat JS sends recent real dialog to local model without online calls',()=>{
 const app=src('assets/app.js');
 assert.match(app,/CoachRouter\.buildContext\(state,day,coachLog\)/);
 assert.match(app,/window\.AndroidAI\.generate\(question,context\)/);
 assert.doesNotMatch(app,/fetch\(.+coachLog/);
});
