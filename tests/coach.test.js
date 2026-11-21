'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../app/src/main/assets/core.js');
const Coach=require('../app/src/main/assets/coach-analytics.js');
const TODAY='2026-11-22';
function task(id,name,core=false,difficulty='medium'){
  return {id,name,core,difficulty,archived:false,createdDay:'2026-11-01'};
}
function planned(t){return {id:t.id,name:t.name,core:t.core,baseXp:Core.XP[t.difficulty]};}
function completion(t){return {name:t.name,baseXp:Core.XP[t.difficulty],bonusXp:0,xp:Core.XP[t.difficulty],completedAt:1};}
function fixture(){
 const reading=task('t1','Kitap oku',true,'easy');
 const exercise=task('t2','Hareket et',false,'hard');
 const s=Core.initialState();s.tasks=[reading,exercise];s.seasonStart='2026-11-01';
 s.days[TODAY]={planned:[planned(reading),planned(exercise)],completed:{}};
 for(let daysAgo=1;daysAgo<=4;daysAgo++){
  const key=Core.shiftDay(TODAY,-daysAgo);
  s.days[key]={planned:[planned(reading),planned(exercise)],completed:
    daysAgo===1?{t2:completion(exercise)}:
    daysAgo===2?{t1:completion(reading),t2:completion(exercise)}:
    daysAgo===3?{t2:completion(exercise)}:{}};
 }
 return s;
}
test('weekly rates are based only on actual saved plans, not missing dates',()=>{
 const s=fixture(), snapshot=Coach.insights(s,TODAY);
 assert.equal(snapshot.observedDays,4);
 assert.equal(snapshot.successfulDays,1);
 assert.equal(snapshot.tasks.find(x=>x.id==='t1').planned,4);
 assert.equal(snapshot.tasks.find(x=>x.id==='t1').completed,1);
 assert.equal(snapshot.tasks.find(x=>x.id==='t1').rate,25);
 assert.equal(snapshot.tasks.find(x=>x.id==='t2').rate,75);
});
test('daily plan prioritizes an unfinished core task',()=>{
 const s=fixture(), next=Coach.chooseNext(s,TODAY);
 assert.equal(next.id,'t1');
 assert.match(Coach.answer(s,'Bugün ne yapayım?',TODAY),/Kitap oku/);
});
test('weekly analysis points to actual difficult routine without inventing future data',()=>{
 const s=fixture();
 assert.match(Coach.answer(s,'Bu hafta hangi görevde zorlandım?',TODAY),/Kitap oku/);
 assert.match(Coach.answer(s,'Son 7 gün analiz',TODAY),/4 gün/);
});
test('empty history and no tasks have a transparent fallback',()=>{
 const s=Core.initialState();
 assert.equal(Coach.insights(s,TODAY).observedDays,0);
 assert.match(Coach.answer(s,'Plan öner',TODAY),/alışkanlık/);
 assert.match(Coach.answer(s,'Bu hafta nasıldım?',TODAY),/yeterli kayıt/);
});
test('complete day returns rest-oriented recommendation, does not mutate saved state',()=>{
 const s=fixture();
 s.days[TODAY].completed={t1:completion(s.tasks[0]),t2:completion(s.tasks[1])};
 const before=JSON.stringify(s);
 assert.equal(Coach.chooseNext(s,TODAY),null);
 assert.match(Coach.answer(s,'Bugün ne yapayım?',TODAY),/tamamladın/);
 assert.equal(JSON.stringify(s),before);
});
test('arşivli görevler aktif önerilerin dışında kalır',()=>{
 const s=fixture();s.tasks[0].archived=true;
 assert.equal(Coach.chooseNext(s,TODAY).id,'t2');
});
