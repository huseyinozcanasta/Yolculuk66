/* Yolculuk 66 — on-device descriptive coaching; not a generative AI model. */
(function(root,factory){
  const value=factory(typeof module==='object'&&module.exports?require('./core.js'):root.HabitCore);
  if(typeof module==='object'&&module.exports)module.exports=value;
  if(root)root.YolculukCoach=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(Core){
 'use strict';
 function insights(state,today=Core.dayKey()){
  const days=state.days||{};
  const tasks=Core.activeTasks(state);
  const observed=[];
  for(let delta=1;delta<=7;delta++){
   const key=Core.shiftDay(today,-delta);
   const record=days[key];
   if(record&&Array.isArray(record.planned)&&record.planned.length){
    observed.push({key,record,summary:Core.daySummary(state,key)});
   }
  }
  const activity=tasks.map(task=>{
   let planned=0,completed=0;
   for(const {record} of observed){
    if(record.planned.some(item=>item.id===task.id)){
     planned++;
     if(record.completed&&record.completed[task.id])completed++;
    }
   }
   return {id:task.id,name:task.name,core:task.core,difficulty:task.difficulty,
    planned,completed,rate:planned?Math.round(completed/planned*100):null};
  });
  const eligible=activity.filter(t=>t.planned>=2).sort((a,b)=>a.rate-b.rate||Number(b.core)-Number(a.core)||a.name.localeCompare(b.name,'tr'));
  return {observedDays:observed.length,
   successfulDays:observed.filter(x=>x.summary.successful).length,
   tasks:activity,weakest:eligible[0]||null};
 }
 function chooseNext(state,today=Core.dayKey()){
  const record=state.days&&state.days[today];
  const completed=record&&record.completed||{};
  const unfinished=Core.activeTasks(state).filter(t=>!completed[t.id]);
  if(!unfinished.length)return null;
  const stats=insights(state,today);
  const eligible=unfinished.map(task=>({task,history:stats.tasks.find(x=>x.id===task.id)}));
  eligible.sort((a,b)=>
    Number(b.task.core)-Number(a.task.core)||
    ((a.history?.rate??101)-(b.history?.rate??101))||
    (Core.XP[a.task.difficulty]-Core.XP[b.task.difficulty])||
    a.task.name.localeCompare(b.task.name,'tr'));
  return eligible[0].task;
 }
 function answer(state,question,today=Core.dayKey()){
  const q=String(question||'').trim().toLocaleLowerCase('tr-TR');
  const stats=insights(state,today);
  const active=Core.activeTasks(state);
  if(/hafta|son\s*7|analiz|istatistik|ilerleme/.test(q)){
   if(!stats.observedDays)return 'Geçmiş 7 gün için henüz yeterli kayıt yok. Görevlerini birkaç gün takip ettikten sonra daha anlamlı bir özet hazırlayabilirim.';
   const weak=stats.weakest?
     ' Daha tutarlı hâle getirebileceğin görev: “'+stats.weakest.name+'” ('+stats.weakest.completed+'/'+stats.weakest.planned+' kayıtlı gün).':
     ' Henüz görev bazında güvenilir bir karşılaştırma için en az iki planlı gün gerekli.';
   return 'Son 7 günde plan kaydı bulunan '+stats.observedDays+' gün var. Bunların '+stats.successfulDays+' tanesi başarılı gün koşullarını karşılıyor.'+weak;
  }
  if(/zorlan|aksat|hang(i|is)i\s+görev|en\s+zor/.test(q)){
   if(!stats.weakest)return 'Hangi alışkanlıkta daha çok zorlandığını söylemek için en az iki planlı günün kaydına ihtiyaç var.';
   return 'Son 7 günlük gerçek kayıtlara göre en az tamamlanan alışkanlığın “'+stats.weakest.name+'”: '+stats.weakest.completed+'/'+stats.weakest.planned+' gün. Hedefi küçültmek veya saatini değiştirmek işe yarayabilir.';
  }
  if(/xp|seviye|puan/.test(q)){
   const xp=Core.totalXp(state),lv=Core.levelForXp(xp);
   return 'Şu ana kadar '+xp+' XP kazandın. Seviyen '+lv.level+'. XP yalnız tamamladığın görevlerden kazanılıyor.';
  }
  if(/seri|kaç\s+gün/.test(q)){
   const streak=Core.streak(state,today);
   return 'Mevcut başarı serin '+streak+' gün. Başarılı gün için ana görevlerini ve temel XP hedefini tamamlamalısın.';
  }
  if(/moral|motivasyon|yorgun|çok zor/.test(q)){
   const next=chooseNext(state,today);
   return next?'Bugünü tek bir küçük adımla başlat: “'+next.name+'”. Gerekiyorsa hedefini gerçekçi biçimde küçült.':'Bazen dinlenme de planın parçasıdır. Bir sonraki gün için küçük ve uygulanabilir hedef belirle.';
  }
  if(/plan|bugün|yarın|öner|ne yap/.test(q)){
   if(!active.length)return 'Başlamak için küçük, somut bir alışkanlık ekle. Örneğin her gün 10 dakika kitap okumak iyi bir ilk adım olabilir.';
   const next=chooseNext(state,today);
   if(!next)return 'Bugün planladığın bütün aktif görevlerini tamamladın. Kalan zamanını dinlenmeye veya yarınki planını düzenlemeye ayırabilirsin.';
   const supporting=stats.weakest&&stats.weakest.id===next.id?' Son günlerde daha az tamamlanan bir görev olduğu için küçük bir parçasıyla başlamak faydalı olabilir.':'';
   return 'Önce “'+next.name+'” görevine odaklan. Ardından diğer görevlerini tamamla.'+supporting;
  }
  return 'Cihazındaki görev kayıtlarıyla çalışıyorum. “Bugün ne yapayım?”, “Bu hafta nasıldım?” veya “Hangi görevde zorlandım?” diye sorabilirsin. Bu sürümde gerçek dil modeli kullanılmıyor.';
 }
 return {insights,chooseNext,answer};
});
