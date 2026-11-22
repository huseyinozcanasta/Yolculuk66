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
 function buildContext(state,today=Core.dayKey(),turns=[]){
  // Facts, not pre-written answers. The on-device model composes the response.
  const app='Yolculuk 66, 66 gün süren çevrimdışı alışkanlık/RPG Android uygulamasıdır. '
    +'Bugün: görevleri planlama/tamamlama; Görevler: alışkanlık ekleme ve arşivleme; '
    +'Yolculuk: dünya, hikâye ve ilerleme; Analiz: XP, seviye ve başarı serisi; '
    +'AI Koç: isteğe bağlı cihaz üstünde GGUF dil modeli. '
    +'Görevler XP verir (kolay 10, orta 20, zor 35). En fazla üç ana görev seçilebilir. '
    +'Oyun kayıtları cihazın kendi alanında tutulur. Şifreli yedek ve kurtarma kodu vardır. '
    +'Yalnız kullanıcı istediğinde sürüm kontrolü GitHub ile iletişim kurar. '
    +'AI koç oyun kayıtlarını kendiliğinden değiştiremez; internette arama yapmaz.';
  const game=localContext(state,today);
  const history=Array.isArray(turns)?turns.filter(x=>x&&!x.pending&&(x.who==='user'||x.who==='bot')&&typeof x.text==='string')
   .slice(-6).map(x=>({role:x.who==='user'?'user':'assistant',content:x.text.slice(0,200)})):[];
  // Keep model prompt within Android bridge bounds and keep it entirely local.
  const result=JSON.stringify({app,game,history});
  return result.length<=4000?result:JSON.stringify({app,game:game.slice(0,600),history:history.slice(-3)});
 }
 function route(state,question,today=Core.dayKey(),ready=false){
  const q=String(question||'').trim();
  const context=buildContext(state,today,[]);
  if(!q)return {mode:'local',reply:'Bana bir soru yazabilirsin.',context};
  // No pattern-matched canned answers while real on-device LLM is ready.
  if(ready)return {mode:'model',reply:null,context};
  return {mode:'local',reply:localReply(state,q,today),context};
 }
 function acceptModelReply(_state,_question,text,_today=Core.dayKey()){
  const clean=String(text||'').replace(/<\|(?:im_start|im_end|endoftext|eot_id|start_header_id|end_header_id)\|>/g,' ')
    .replace(/^\s*(assistant|asistan)\s*[:：]\s*/i,'').trim().slice(0,2000);
  const generic=/yardımcı olama(?:m|yabilirim|yac[aı]ğım)|nasıl\s+yardımcı\s+olabilirim|başka\s+bir\s+konuda\s+yardımcı/i.test(clean);
  if(clean.length<18||generic)return {reply:null,needsRetry:true};
  return {reply:clean,needsRetry:false};
 }
 return {route,localContext,buildContext,acceptModelReply};
});
