'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/core.js');
const Routing=require('../app/src/main/assets/coach-router.js');
const DAY='2026-11-22';
function withTask(){
 let state=Core.initialState();
 state=Core.addTask(state,{name:'20 dakika kitap oku',core:true,difficulty:'easy'},DAY);
 return state;
}
test('screenshot regression: ready LLM does not answer "Bugün ne yapayım?" with generic boilerplate',()=>{
 const initial=Core.initialState();
 const result=Routing.route(initial,'Bugün ne yapayım?',DAY,true);
 assert.equal(result.mode,'local');
 assert.match(result.reply,/alışkanlık|görev/i);
 assert.match(result.reply,/10 dakika|Yeni görev ekle/i);
 assert.doesNotMatch(result.reply,/Nasıl yardımcı olabilirim/i);
});
test('greetings respond to user without using the model and give a concrete start',()=>{
 const r=Routing.route(Core.initialState(),'Merhaba',DAY,true);
 assert.equal(r.mode,'local');
 assert.match(r.reply,/Merhaba/);
 assert.doesNotMatch(r.reply,/Size nasıl yardımcı olabilirim/);
 assert.match(r.reply,/görev|alışkanlık/i);
});
test('existing core task becomes actual suggestion, not made-up routine',()=>{
 const r=Routing.route(withTask(),'Bugün ne yapayım?',DAY,true);
 assert.equal(r.mode,'local');
 assert.match(r.reply,/20 dakika kitap oku/);
});
test('XP and seven-day progress always read local game state, not a language model',()=>{
 const s=withTask();
 assert.equal(Routing.route(s,'XP durumum',DAY,true).mode,'local');
 assert.equal(Routing.route(s,'Bu hafta nasıldım?',DAY,true).mode,'local');
});
test('open-ended questions can still use the on-device GGUF when ready',()=>{
 const r=Routing.route(withTask(),'Sence motivasyonumu kalıcı kılmak için hangi düşünce biçimini deneyeyim?',DAY,true);
 assert.equal(r.mode,'model');
 assert.match(r.context,/20 dakika kitap oku/);
 assert.match(r.context,/2026-11-22/);
 assert.doesNotMatch(r.context,/<\|im_start\|>/);
});
test('without LLM fallback works entirely offline',()=>{
 const r=Routing.route(withTask(),'Günlük disiplinimi geliştirmem için önerin var mı?',DAY,false);
 assert.equal(r.mode,'local');
 assert.ok(r.reply.length>15);
});
test('generic refusal and generic greetings from small model are rejected with grounded fallback',()=>{
 const s=Core.initialState();
 for(const answer of ['Merhaba! Size nasıl yardımcı olabilirim?', 'Daha fazla yardımcı olamayım. Size nasıl yardımcı olabilirim?', 'Nasıl yardımcı olabilirim?']){
  const result=Routing.acceptModelReply(s,'Bugün ne yapayım?',answer,DAY);
  assert.equal(result.usedFallback,true);
  assert.match(result.reply,/görev|alışkanlık/i);
 }
});
test('useful original model answers survive guard with trim and max length',()=>{
 const s=withTask();
 const r=Routing.acceptModelReply(s,'Sence düzenli kitap okumayı nasıl sürdürebilirim?','20 dakika kitap okumak için her akşam aynı saatten başlayabilirsin.',DAY);
 assert.equal(r.usedFallback,false);
 assert.match(r.reply,/20 dakika/);
});
test('routing helpers are included before app.js and used in the chat handler',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=path.join(__dirname,'../app/src/main/assets');
 const index=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
 assert.ok(index.indexOf('coach-router.js')>=0);
 assert.ok(index.indexOf('coach-router.js')<index.indexOf('app.js'));
 assert.match(app,/CoachRouter\.route\(/);
 assert.match(app,/CoachRouter\.acceptModelReply\(/);
});

test('Qwen system prompt asks for grounded and direct Turkish answers, no empty boilerplate',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const native=fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/ozgun/yolculuk66/OfflineAiHost.kt'),'utf8');
 assert.match(native,/doğrudan cevap ver/);
 assert.match(native,/Nasıl yardımcı olabilirim/);
 assert.match(native,/Kayıtlı görev yoksa/i);
});

test('AI Coach gives a one-tap create-task action when no habits exist',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../app/src/main/assets/app.js'),'utf8');
 assert.match(app,/İlk alışkanlığımı ekle/);
 assert.match(app,/Core\.activeTasks\(state\)\.length/);
});
