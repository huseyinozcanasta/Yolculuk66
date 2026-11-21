/* Yolculuk 66 — pure, offline domain engine. No network or platform APIs. */
(function(root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  if (root) root.HabitCore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const XP = Object.freeze({easy:10,medium:20,hard:35});
  const MS_PER_DAY = 86400000;
  function clone(x){ return JSON.parse(JSON.stringify(x)); }
  function dayKey(d=new Date()){
    const date=new Date(d.getTime()); date.setHours(date.getHours()-4);
    return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
  }
  function utcIndex(key){
    const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    if(!m) throw new Error('Geçersiz tarih');
    return Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/MS_PER_DAY);
  }
  function shiftDay(key,delta){
    const d=new Date((utcIndex(key)+delta)*MS_PER_DAY);
    return [d.getUTCFullYear(),String(d.getUTCMonth()+1).padStart(2,'0'),String(d.getUTCDate()).padStart(2,'0')].join('-');
  }
  function initialState(){return {version:1,createdAt:Date.now(),world:'forest',seasonStart:null,tasks:[],days:{}};}
  function makeId(){return 't'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  function activeTasks(s){return s.tasks.filter(t=>!t.archived);}
  function ensureDay(s,key){
    if(!s.days[key]) s.days[key]={planned:[],completed:{}};
    return s.days[key];
  }
  function syncPlan(s,key){
    const d=ensureDay(s,key);
    const current=activeTasks(s).map(t=>({id:t.id,name:t.name,baseXp:XP[t.difficulty],core:t.core}));
    // Keep already completed archived tasks in today's immutable accounting.
    const archivedCompleted=(d.planned||[]).filter(t=>d.completed[t.id]&&!current.some(x=>x.id===t.id));
    d.planned=current.concat(archivedCompleted);
    return s;
  }
  function addTask(state,data,key=dayKey()){
    const name=String(data.name||'').trim().replace(/\s+/g,' ');
    if(name.length<2||name.length>80) throw new Error('Görev adı 2–80 karakter olmalı.');
    if(!Object.hasOwn(XP,data.difficulty)) throw new Error('Geçersiz zorluk.');
    const core=!!data.core;
    if(core && activeTasks(state).filter(t=>t.core).length>=3) throw new Error('En fazla 3 ana görev seçebilirsin.');
    const s=clone(state);
    s.tasks.push({id:makeId(),name,difficulty:data.difficulty,core,archived:false,createdDay:key});
    if(!s.seasonStart) s.seasonStart=key;
    syncPlan(s,key);
    return s;
  }
  function archiveTask(state,id,key=dayKey()){
    const s=clone(state);const t=s.tasks.find(t=>t.id===id&&!t.archived);
    if(!t) throw new Error('Görev bulunamadı.');
    t.archived=true;syncPlan(s,key);return s;
  }
  function completeTask(state,id,key=dayKey(),focus30=false){
    const s=clone(state);const t=s.tasks.find(t=>t.id===id&&!t.archived);
    if(!t) throw new Error('Görev bulunamadı.');
    syncPlan(s,key);
    const d=ensureDay(s,key);
    if(d.completed[id]) throw new Error('Bu görev bugün zaten tamamlanmış.');
    const base=XP[t.difficulty],bonus=focus30?10:0;
    d.completed[id]={name:t.name,baseXp:base,bonusXp:bonus,xp:Math.min(50,base+bonus),completedAt:Date.now()};
    return s;
  }
  function undoCompletion(state,id,key=dayKey()){
    const s=clone(state);const d=ensureDay(s,key);
    if(!d.completed[id]) throw new Error('Tamamlanmış görev bulunamadı.');
    delete d.completed[id];syncPlan(s,key);return s;
  }
  function daySummary(state,key=dayKey()){
    const d=state.days[key]||{planned:[],completed:{}};
    const planned=d.planned||[];const entries=Object.values(d.completed||{});
    const plannedBaseXp=planned.reduce((sum,t)=>sum+t.baseXp,0);
    const earnedBaseXp=entries.reduce((sum,t)=>sum+t.baseXp,0);
    const earnedXp=entries.reduce((sum,t)=>sum+t.xp,0);
    const coreTasks=planned.filter(t=>t.core);
    const coreDone=coreTasks.filter(t=>!!d.completed[t.id]).length;
    const ratio=plannedBaseXp?Math.min(1,earnedBaseXp/plannedBaseXp):0;
    return {plannedCount:planned.length,completedCount:entries.length,plannedBaseXp,earnedBaseXp,
      earnedXp,coreCount:coreTasks.length,coreDone,ratio,
      successful:coreTasks.length>=1 && coreTasks.length<=3 && coreDone===coreTasks.length && ratio>=0.7};
  }
  function totalXp(s){return Object.values(s.days).reduce((sum,d)=>sum+Object.values(d.completed||{}).reduce((a,v)=>a+v.xp,0),0);}
  function levelForXp(amount){
    let remaining=Math.max(0,Math.floor(amount)||0),level=1,need=200;
    while(remaining>=need && level<10000){remaining-=need;level++;need=Math.min(500,200+(level-1)*50);}
    return {level,current:remaining,needed:need,percent:Math.round(remaining/need*100)};
  }
  function seasonDay(start,key=dayKey()){
    if(!start) return 0;
    return Math.max(1,Math.min(66,utcIndex(key)-utcIndex(start)+1));
  }
  function streak(s,today=dayKey()){
    let cursor=today,total=0;
    if(!daySummary(s,today).successful) cursor=shiftDay(cursor,-1);
    for(let i=0;i<66;i++){
      if(!s.days[cursor] || !daySummary(s,cursor).successful) break;
      total++;cursor=shiftDay(cursor,-1);
    }
    return total;
  }
  function lastDays(s,today=dayKey(),n=7){
    return Array.from({length:n},(_,i)=>{const key=shiftDay(today,i-n+1);return {key,...daySummary(s,key)};});
  }
  function successfulDays(s){return Object.keys(s.days).filter(k=>daySummary(s,k).successful).length;}
  function setWorld(state,world){
    if(!['forest','desert','sky'].includes(world)) throw new Error('Dünya bulunamadı.');
    if(state.seasonStart && world!==state.world) throw new Error('Sezon başladıktan sonra ana dünya değiştirilemez.');
    const s=clone(state);s.world=world;return s;
  }
  return {XP,initialState,dayKey,shiftDay,activeTasks,syncPlan,addTask,archiveTask,completeTask,
    undoCompletion,daySummary,totalXp,levelForXp,seasonDay,streak,lastDays,successfulDays,setWorld};
});
