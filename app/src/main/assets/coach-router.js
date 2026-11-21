/* Yolculuk 66: deterministic local coaching for factual game questions. */
(function(root,factory){
 const deps=typeof module==='object'&&module.exports
   ?{Core:require('./core.js'),Coach:require('./coach-analytics.js')}
   :{Core:root.HabitCore,Coach:root.YolculukCoach};
 const value=factory(deps.Core,deps.Coach);
 if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.YolculukCoachRouter=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core,Coach){
 'use strict';
 function isGreeting(q){
  return /^(merhaba|selam|selamlar|hey|heyy|sa|günaydın|iyi akşamlar)[!.?\s]*$/i.test(q);
 }
 function isFactualGameQuestion(q){
  return /bugün ne|bugün için|bugün ne yap|ne yapayım|yarın ne|günlük plan|görev|alışkanlığım|hafta|son 7|zorlandım|aksattım|istatistik|ilerlemem|xp|puanım|seviye|serim|serim kaç|kaç gün üst üste|motivasyon lazım|moralim bozuk|çok yorgunum/i.test(q);
 }
 function localReply(state,question,today){
  const q=String(question||'').trim();
  const active=Core.activeTasks(state);
  if(isGreeting(q)){
   return active.length
    ?'Merhaba! Bugün kayıtlı '+active.length+' alışkanlığın var. “Bugün ne yapayım?” diye sorarsan öncelikli görevini birlikte seçebiliriz.'
    :'Merhaba! Henüz kayıtlı bir alışkanlığın yok. Bugün bir küçük görevle başlayabilirsin: Görevler → Yeni görev ekle.';
  }
  const answer=Coach.answer(state,q,today);
  if(!active.length&&/bugün|plan|ne yapayım|yarın/i.test(q))
   return 'Henüz kayıtlı bir alışkanlığın yok. Bugün tek bir küçük adım belirle: örneğin 10 dakika kitap oku. Görevler → Yeni görev ekle bölümünden kaydedebilirsin.';
  return answer;
 }
 function localContext(state,today){
  const tasks=Core.activeTasks(state);
  const summary=Core.daySummary(state,today);
  const history=Coach.insights(state,today);
  const lines=[
   'Tarih: '+today,
   'Toplam XP: '+Core.totalXp(state)+'. Başarı serisi: '+Core.streak(state,today)+' gün.',
   'Bugünkü tamamlanma: '+summary.completedCount+'/'+summary.plannedCount+'.',
   'Son 7 günde kayıtlı plan günü: '+history.observedDays+'.'
  ];
  if(!tasks.length){
   lines.push('Henüz hiç aktif alışkanlık yok. Kullanıcının görev veya ilerleme geçmişi olduğunu uydurma.');
  } else {
   lines.push('Cihazda gerçekten kayıtlı alışkanlıklar:');
   const completed=state.days?.[today]?.completed||{};
   tasks.slice(0,9).forEach(t=>{
    lines.push('- '+t.name.slice(0,52)+(t.core?' [ANA GÖREV]':'')+
      (completed[t.id]?' [BUGÜN TAMAMLANDI]':' [BUGÜN TAMAMLANMADI]'));
   });
  }
  return lines.join('\n').slice(0,760);
 }
 function route(state,question,today=Core.dayKey(),ready=false){
  const q=String(question||'').trim();
  const context=localContext(state,today);
  if(!q)return {mode:'local',reply:'Bana bir soru yazabilirsin.',context};
  if(!ready||isGreeting(q)||isFactualGameQuestion(q))
   return {mode:'local',reply:localReply(state,q,today),context};
  return {mode:'model',reply:null,context};
 }
 function acceptModelReply(state,question,text,today=Core.dayKey()){
  const raw=String(text||'');
  const clean=raw.replace(/<\|(?:im_start|im_end|endoftext|eot_id|start_header_id|end_header_id)\|>/g,' ')
    .replace(/^\s*(assistant|asistan)\s*[:：]\s*/i,'').trim().slice(0,1400);
  const generic=/yardımcı olama(?:m|yabilirim|yac[aı]ğım)|(?:size|sana|nasıl|ne konuda)\s+nasıl\s+yardımcı\s+olabilirim|nasıl\s+yardımcı\s+olabilirim|başka\s+bir\s+konuda\s+yardımcı/i.test(clean);
  const boilerplate=/^merhaba[!. ]*\s*(size|sana)?\s*nasıl\s+yardımcı/i.test(clean);
  if(clean.length<18||generic||boilerplate||!clean){
    return {usedFallback:true,reply:localReply(state,question,today)};
  }
  return {usedFallback:false,reply:clean};
 }
 return {route,localContext,acceptModelReply};
});
