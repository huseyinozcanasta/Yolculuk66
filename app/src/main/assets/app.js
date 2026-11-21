/* Yolculuk 66 — local-first UI. Network requests only after explicit update-check action. */
(function(){
'use strict';
const Core=window.HabitCore;
const Backup=window.YolculukBackup;
const Story=window.YolculukStory;
const Updates=window.YolculukUpdates;
const Coach=window.YolculukCoach;
const SafeStore=window.YolculukSafeStore;
const KEY='yolculuk66.offline.mvp.v1';
const WORLDS={
 forest:{name:'Zümrüt Orman',eyebrow:'BİRİNCİ DÜNYA',text:'Kadim ağaçların fısıltıları arasında kendi disiplinini keşfet.',icon:'🌿',css:'',chapter:'Kayıp Tohumlar'},
 desert:{name:'Kumların Mührü',eyebrow:'İKİNCİ DÜNYA',text:'Unutulan mühürlerin izinde yeni bir yol çiz.',icon:'☀',css:'desert',chapter:'Mührün Fısıltısı'},
 sky:{name:'Gökyüzü Adaları',eyebrow:'ÜÇÜNCÜ DÜNYA',text:'Bulutların üzerindeki adalara yüksel ve sınırlarını aş.',icon:'☁',css:'sky',chapter:'Bulutların Hafızası'}
};
const MILESTONES=[11,22,33,44,55,66];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storageWorks=true;
let storageLocked=false;
let state=load();
let tab='today';
let focusSelection=new Set();
let coachLog=[];
let localAiStatus='unavailable';
let localAiBusy=false;
try{if(window.AndroidAI&&typeof window.AndroidAI.status==='function')
 localAiStatus=window.AndroidAI.status();}catch(_){}

let toastTimer=null;
const view=document.getElementById('view');
const dialog=document.getElementById('taskDialog');
const backupDialog=document.getElementById('backupDialog');
const restoreDialog=document.getElementById('restoreDialog');
const recoveryDialog=document.getElementById('recoveryDialog');
const recoveryCodeOutput=document.getElementById('recoveryCodeOutput');
let pendingSave=null;
const fileInput=document.getElementById('backupFile');
let pendingRestoreText=null;

function load(){
 try{
  const result=SafeStore.load(localStorage,KEY,Core.initialState,Backup.validateState);
  storageLocked=result.locked;
  storageWorks=!result.locked;
  return result.state;
 }catch(err){
  storageLocked=true;
  storageWorks=false;
  return Core.initialState();
 }
}
function persist(){
 if(storageLocked){storageWorks=false;return false;}
 try{
  Backup.validateState(state);
  SafeStore.save(localStorage,KEY,state,false);
  storageWorks=true;
  return true;
 }catch(err){storageWorks=false;return false;}
}
window.showNativeMessage=function(message){toast(message);};
function toast(message){
 const el=document.getElementById('toast');el.textContent=message;el.classList.add('visible');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),2700);
}
function update(next,message){
 if(storageLocked)throw new Error('Yerel kayıt bozuk ve koruma altında; önce şifreli yedeğini geri yükle.');
 Backup.validateState(next);
 SafeStore.save(localStorage,KEY,next,false);
 state=next;
 storageWorks=true;
 render();
 if(message)toast(message);
}
function fmtDate(key){try{const parts=key.split('-').map(Number);return new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'long',year:'numeric'}).format(new Date(parts[0],parts[1]-1,parts[2]));}catch(e){return key;}}
function progress(percent,cls=''){return `<div class="progress ${cls}"><div style="width:${Math.max(0,Math.min(100,percent))}%"></div></div>`;}
function mountain(){return `<svg class="mountain" viewBox="0 0 360 190" preserveAspectRatio="none" aria-hidden="true"><path d="M0 139L38 102L66 119L115 56L174 118L211 80L253 112L309 31L360 113V190H0Z" fill="#a47aa6" opacity=".5"/><path d="M0 165L55 123L96 143L138 87L188 155L229 112L266 144L322 71L360 126V190H0Z" fill="#272c59"/><path d="M0 178L60 148L105 166L162 126L213 168L275 132L360 163V190H0Z" fill="#101c3e"/><path d="M0 188L22 174L29 155L37 174L60 188M293 190L309 164L318 184L331 149L344 179L360 189" fill="#0b182e"/></svg>`;}
function hero(world,overline,title,description){return `<div class="hero world-${esc(world==='forest'?'forest':world)}">${mountain()}<div class="hero-content"><div class="eyebrow">${esc(overline)}</div><h2>${esc(title)}</h2><p>${esc(description)}</p></div></div>`;}
function taskIcon(difficulty){return {easy:'📘',medium:'⚔',hard:'🔥'}[difficulty]||'✦';}
function taskCard(task,summaryKey,allowArchive){
 const record=state.days[summaryKey]||{completed:{}};
 const completed=!!record.completed?.[task.id];
 const focus=focusSelection.has(task.id);
 const reward=Core.XP[task.difficulty];
 return `<div class="task ${completed?'done':''}">
    <div class="task-icon">${completed?'✓':taskIcon(task.difficulty)}</div>
    <div class="task-body"><strong>${esc(task.name)}</strong><small>${reward} XP${completed&&record.completed[task.id].bonusXp?' + 10 odak XP':''} ${task.core?' · Ana alışkanlık':''}</small>${task.core?'<span class="label-chip core">★ ANA GÖREV</span>':''}</div>
    <div class="task-actions">${!completed?`<button class="focus-toggle ${focus?'on':''}" data-action="focus" data-id="${esc(task.id)}" title="Gerçekten 30 dk odaklandıysan işaretle">30dk</button>`:''}
      <button type="button" class="round-btn ${completed?'done':''}" aria-label="${completed?'Tamamlamayı geri al':'Görevi tamamla'}" data-action="${completed?'undo':'complete'}" data-id="${esc(task.id)}">${completed?'✓':'○'}</button>
    </div></div>${allowArchive?`<div style="text-align:right;margin-top:-3px;margin-bottom:9px"><button class="small-button" data-action="archive" data-id="${esc(task.id)}">Bu görevi arşivle</button></div>`:''}`;
}
function storageNotice(){if(storageLocked)return '<div class="notice error-notice">⚠ Cihazdaki kayıt doğrulanamadı. Orijinal kayıt korunuyor, üzerine yazılmayacak. Şifreli yedeğini geri yükleyebilirsin.</div>';return storageWorks?'':'<div class="notice error-notice">⚠ Yerel kayıt alanına erişilemiyor. Verilerin kalıcılığı garanti edilemiyor; özel gezinme modunu kontrol et.</div>';}
function todayView(key){
 const day=Core.seasonDay(state.seasonStart,key),world=WORLDS[state.world]||WORLDS.forest;
 const summary=Core.daySummary(state,key),xp=Core.totalXp(state),lv=Core.levelForXp(xp),st=Core.streak(state,key);
 const tasks=Core.activeTasks(state);
 const pct=summary.plannedCount?Math.round(summary.completedCount/summary.plannedCount*100):0;
 return `<div class="page-title">BUGÜN <span class="purple">✦</span></div><p class="page-subtitle">Kendine verdiğin sözü bugün de sürdür.</p>
   ${storageNotice()}${hero(state.world,day?`GÜN ${day} / 66 · ${world.name}`:'66 GÜNLÜK YENİ BİR MACERA',day?'Küçük adımlar, büyük bir yolculuk.':'Hikâyen bir alışkanlıkla başlar.',world.text)}
   <div class="card"><div class="row-between"><div><span class="eyebrow">SEVİYE ${lv.level}</span><h3 style="margin:3px 0 0">Gelişim Yolcusu</h3></div><b style="font-size:12px">${lv.current} / ${lv.needed} XP</b></div><div style="margin-top:10px">${progress(lv.percent)}</div></div>
   <div class="stat-grid"><div class="stat"><b>📅 ${day||'—'}<small>/66</small></b><small>Sezon günü</small></div><div class="stat"><b>🔥 ${st}</b><small>Günlük seri</small></div><div class="stat"><b>🎯 ${summary.completedCount}/${summary.plannedCount}</b><small>Bugünkü görev</small></div></div>
   <div class="card"><div class="card-header"><h3>Bugünkü Görevlerin</h3><span class="muted">${pct}% tamamlandı</span></div>${progress(pct,'mint')}
   <div style="height:13px"></div><div class="task-list">${tasks.length?tasks.map(t=>taskCard(t,key,false)).join(''):'<div class="empty"><div class="empty-icon">🗡️</div><h3>Yolculuğun başlamaya hazır</h3><p>İlk alışkanlığını ekleyerek 66 günlük sezonunu başlat.</p></div>'}</div>
   <div style="height:14px"></div><button class="button primary wide" data-action="newTask">+ Yeni alışkanlık ekle</button>${!tasks.length?'<div style="height:8px"></div><button class="button secondary wide" data-action="sample">3 örnek görevle başla</button>':''}
   </div>
   <div class="card"><div class="card-header"><h3>Başarılı gün kuralı</h3><span class="label-chip">70% + ana görevler</span></div>
   <p class="muted" style="font-size:12px;line-height:1.6">1–3 ana alışkanlığının hepsini tamamla ve planlanan temel XP'nin en az %70'ini kazan. Odak bonusları bu hesaplamaya katılmaz.</p>
   <div class="progress-row"><span>Ana alışkanlıklar: ${summary.coreDone}/${summary.coreCount}</span><span>Temel XP: ${summary.earnedBaseXp}/${summary.plannedBaseXp}</span></div>${progress(Math.round(summary.ratio*100),'mint')}
   <p style="font-size:12px;color:${summary.successful?'#77e9c6':'#b7b9d2'}">${summary.successful?'✦ Bugün başarıyla tamamlandı!':'◈ Henüz başarılı gün koşulları tamamlanmadı.'}</p></div>
   <div class="quote">“Büyük maceralar, her gün yeniden verilen küçük kararlarla başlar.”</div>`;
}
function tasksView(key){const active=Core.activeTasks(state),archived=state.tasks.filter(t=>t.archived);
 return `<div class="page-title">GÖREVLER</div><p class="page-subtitle">Gerçek hayattaki ilerlemen burada XP'ye dönüşür.</p>${storageNotice()}
   <div class="notice">★ En fazla 3 ana alışkanlık seçebilirsin. Tamamlanan görevler günlük yalnızca bir kez XP verir. “30dk” bonusunu gerçekten odaklandıysan seç.</div>
   <div class="card"><div class="card-header"><h3>Aktif alışkanlıkların</h3><span class="muted">${active.length} görev</span></div>${active.length?active.map(t=>taskCard(t,key,true)).join(''):'<div class="empty"><div class="empty-icon">📜</div><p>Henüz aktif bir görev yok.</p></div>'}
   <button data-action="newTask" class="button primary wide">+ Yeni görev ekle</button></div>
   <div class="card"><div class="card-header"><h3>Arşivlenen görevler</h3><span class="muted">${archived.length}</span></div><p class="muted">Arşivleme geçmiş XP'yi silmez. Bu ilk sürümde arşivlenen görevler yeniden etkinleştirilemez.</p>
   ${archived.length?archived.map(t=>`<div class="row-between" style="padding:7px 0;border-bottom:1px solid var(--line)"><span style="font-size:12px">${esc(t.name)}</span><span class="muted">Arşiv</span></div>`).join(''):''}</div>`;
}
function journeyView(key){
 const day=Core.seasonDay(state.seasonStart,key),world=WORLDS[state.world];
 let calendar='';
 for(let i=1;i<=66;i++){
  const k=state.seasonStart?Core.shiftDay(state.seasonStart,i-1):null;
  const kind=!k?'':i===day?'today':i<day?(Core.daySummary(state,k).successful?'success':'missed'):'';
  calendar+=`<span class="cal-day ${kind}" title="${k||''}">${i}</span>`;
 }
 return `<div class="page-title">YOLCULUK</div><p class="page-subtitle">Üç dünya. Bir karakter. 66 gün süren gerçek bir değişim.</p>${hero(state.world,world.eyebrow,world.name,world.text)}
  <div class="card"><div class="card-header"><h3>66 Günlük Yolculuk</h3><span class="muted">${day} / 66 gün</span></div>${progress(day/66*100)}<div class="progress-row"><span>Hikâye: ${esc(world.chapter)}</span><span>66 günlük sezon</span></div></div>
  <div class="section-kicker">Dönüm noktaları</div><div class="milestones">${MILESTONES.map(n=>`<div class="milestone ${day===n?'current':day>n?'past':''}">${n}<small>Gün</small></div>`).join('')}</div>
  <div class="card"><div class="card-header"><h3>Sezon takvimi</h3><span class="muted">Yeşil = başarılı gün</span></div><div class="calendar-grid">${calendar}</div><p class="muted" style="margin-bottom:0">Gün devri saat 04.00'te gerçekleşir. Başarısız günler kazanılmış XP'yi geri almaz.</p></div>
  <div class="section-kicker">Fantastik dünyalar</div>
  ${Object.entries(WORLDS).map(([id,w])=>`<div class="world-card ${esc(w.css)} ${state.world===id?'active':''}"><div class="row-between"><h3>${w.icon} ${esc(w.name)}</h3><span class="label-chip">${state.world===id?'Seçili':state.seasonStart?'Sonraki sezon':'Seçilebilir'}</span></div><p>${esc(w.text)}</p>${!state.seasonStart&&state.world!==id?`<button class="small-button" data-action="world" data-world="${id}" style="margin-top:9px;align-self:flex-start">Bu dünyayı seç</button>`:''}</div>`).join('')}
  <div class="card"><div class="card-header"><h3>📖 Dünya hikâyesi</h3><span class="muted">${Story.forDay(state.world,day).available.length} / 7 sahne</span></div>
  ${Story.forDay(state.world,day).available.map((scene,i)=>`<details class="story-scene" ${i===Story.forDay(state.world,day).available.length-1?'open':''}><summary><span class="story-number">${scene.day}</span> ${esc(scene.title)} <small>Gün ${scene.day}</small></summary><p>${esc(scene.text)}</p></details>`).join('')}
  ${Story.forDay(state.world,day).locked.map(scene=>`<div class="story-locked"><span>🔒</span> Kilitli hikâye sahnesi <small>Gün ${scene.day}</small></div>`).join('')}
  ${!day?'<p class="muted">İlk görevi ekleyince dünyana ait ilk sahne açılır.</p>':''}
  </div>
  <div class="notice">Bu sürümde dünya hikâyeleri okunabilir. Tam etkileşimli haritalar, altı gizli ipucu, bulmacalar ve Gizli Epilog henüz uygulanmadı; hikâye okumak XP vermez.</div>`;
}
function analysisView(key){const xp=Core.totalXp(state),lv=Core.levelForXp(xp),s=Core.daySummary(state,key),week=Core.lastDays(state,key),st=Core.streak(state,key);const successes=Core.successfulDays(state);
 const days=week.map(day=>{const date=day.key.split('-').map(Number);return new Intl.DateTimeFormat('tr-TR',{weekday:'short'}).format(new Date(date[0],date[1]-1,date[2]));});
 return `<div class="page-title">ANALİZ</div><p class="page-subtitle">Alışkanlıklarına verilerle bak. Her adım bir ilerleme.</p>
 <div class="metric-row"><div class="metric"><small>🏆 Toplam XP</small><strong class="purple">${xp}</strong><small>Seviye ${lv.level}</small></div><div class="metric"><small>🔥 Güncel seri</small><strong class="amber">${st} gün</strong><small>Üst üste başarılı gün</small></div><div class="metric"><small>✓ Başarılı günler</small><strong class="accent">${successes}</strong><small>Başarı kuralını karşılayan</small></div><div class="metric"><small>🎯 Bugünkü temel XP</small><strong>${s.earnedBaseXp}</strong><small>Planlanan: ${s.plannedBaseXp}</small></div></div>
 <div class="card"><div class="card-header"><h3>Son 7 günlük ilerleme</h3><span class="muted">Temel XP oranı</span></div>
 <div class="chart">${week.map((d,i)=>`<div class="bar-holder"><div class="bar" style="height:${Math.max(2,Math.round(d.ratio*100))}%" title="${d.key}: %${Math.round(d.ratio*100)}"></div><small>${esc(days[i])}</small></div>`).join('')}</div>
 <p class="muted" style="margin-bottom:0">Yeşil günlük başarı için bütün ana alışkanlıklar da tamamlanmalıdır. Grafikte yalnız temel XP oranı gösterilir.</p></div>
 <div class="card"><div class="card-header"><h3>Koruma ve yedekleme</h3><span class="label-chip">ÇEVRİMDIŞI</span></div>
 <p class="muted" style="line-height:1.7">Ana oyun ilerlemeni şifreli dosyaya kaydet veya başka cihazda aç. Şifreli yedeği parola veya isteğe bağlı bir kez gösterilen çevrimdışı kurtarma koduyla açabilirsin. Otomatik kurtarma anlık görüntüleri henüz geliştirilmedi.</p>
 <button class="button mint wide" data-action="backup" type="button">⬇ Şifreli yedek oluştur</button><div style="height:8px"></div>
 <button class="button secondary wide" data-action="restore" type="button">⬆ Yedekten geri yükle</button><div style="height:12px"></div>
 <button class="button secondary wide" type="button" data-action="checkUpdates">↻ Güncellemeleri kontrol et</button>
 <p class="muted" style="font-size:11px">Yalnız bu düğmeye bastığında GitHub'a bağlanır. Oyun kayıtları ve alışkanlıkların paylaşılmaz. Yükleme için onayın gerekir.</p>
 <p class="muted">Geri yükleme, veri kaybından kurtarma içindir; günlük seriyi veya XP'yi keyfî biçimde geri sarmak için kullanılmamalıdır.</p></div>
 <div class="card"><h3>Gelişim notu</h3><p class="muted" style="font-size:12px;line-height:1.7">${successes?'En az bir başarılı günü tamamladın. Tutarlı küçük adımlar uzun yolculukların temelidir.':'İlk başarılı günün için 1–3 ana alışkanlık belirle ve temel XP hedefini tamamla.'}</p></div>`;
}
function coachReply(question,key){
 if(Coach)return Coach.answer(state,question,key);
 const q=question.toLocaleLowerCase('tr-TR'),summary=Core.daySummary(state,key),st=Core.streak(state,key);
 if(/xp|seviye|puan/.test(q))return `Şu ana kadar ${Core.totalXp(state)} XP kazandın ve ${Core.levelForXp(Core.totalXp(state)).level}. seviyedesin. XP'yi yalnız gerçekten tamamladığın alışkanlıklardan alırsın.`;
 if(/seri|gün/.test(q))return `Mevcut başarı serin ${st} gün. Bugün ${summary.coreDone}/${summary.coreCount} ana alışkanlığı tamamladın. Serinin devamı için hepsini bitirmeyi hedefle.`;
 if(/moral|motivasyon|zor|yorgun/.test(q))return 'Yüksek hedef yerine bugün yapabileceğin küçük bir adım seç. Görevlerini kolaylaştırmak disiplininden vazgeçmek değildir. Gerekiyorsa yarınki planını daha gerçekçi kur.';
 if(/öner|ne yap|plan|yarın/.test(q)){
  const unfinished=Core.activeTasks(state).filter(t=>!state.days[key]?.completed?.[t.id]);
  return unfinished.length?`Bugün tek adımla başla: “${unfinished[0].name}”. Ardından kalan görevlere geç. Planlanan temel XP'nin %70'i ve bütün ana görevler başarı ölçütün.`:'Bugün tamamlanmamış aktif görevin görünmüyor. Yarın için 1–3 temel alışkanlığını gerçekçi tutmayı öneririm.';
 }
 return 'Seni çevrimdışı destekliyorum. “Bugün ne yapayım?”, “XP durumum” veya “Serim kaç gün?” gibi sorulara mevcut kayıtlarına göre yanıt verebilirim.';
}
function coachView(key){
 const suggestion=coachReply('bugün ne yapayım',key);
 return `<div class="page-title">AI KOÇ</div><p class="page-subtitle">Yolculuğunda sana eşlik eden kişisel ilerleme yardımcın.</p>
  <div class="card"><div class="coach-avatar">◕‿◕</div><div class="coach-label">● ÇEVRİMDIŞI · YEREL</div><p style="text-align:center;font-size:12px;line-height:1.7;color:#cbd1e9">Bu ilk sürümde koç, cihazındaki verilere dayanan <strong>kural tabanlı</strong> bir yardımcıdır. ${localAiStatus==='ready'?'İçe aktarılan GGUF dil modeli etkin. Yanıtlar cihazında üretilir.':'Gerçek dil modeli henüz etkin değil; hazır olduğunda cihazında çalışacaktır.'}</p></div>
  <div class="card"><h3>🧠 Gerçek çevrimdışı AI (isteğe bağlı)</h3>
  <p class="muted" style="line-height:1.6">Durum: <strong>${esc(localAiStatus)}</strong>.
  0,5B boyutunda GGUF bir model seçtiğinde sohbeti yalnız cihazında çalıştırabilirsin.
  Model içe aktarılmadığında eski kural tabanlı koç kullanılır.</p>
  <button class="button secondary wide" data-action="importLocalModel" type="button">Cihazdan GGUF model seç</button>
  <div style="height:7px"></div><button class="button secondary wide" data-action="loadLocalModel" type="button">Kaydedilmiş yerel modeli aç</button>
  <p class="muted" style="font-size:11px">Büyük model dosyaları RAM ve batarya tüketir. Model cihazın özel alanında saklanır; veriler internete gönderilmez.</p></div>
  <div class="card"><h3>✧ Bugünkü öneri</h3><div class="bubble">${esc(suggestion)}</div></div>
  <div class="card"><h3>Koçla konuş</h3><div class="chat" id="chatLog"><div class="bubble">Merhaba! Hangi alışkanlığında ilerlemek istiyorsun?</div>${coachLog.map(m=>`<div class="bubble ${m.who==='user'?'user':''}">${esc(m.text)}</div>`).join('')}</div>
  <div class="suggestions"><button data-action="ask" data-question="Bugün ne yapayım?">Bugün ne yapayım?</button><button data-action="ask" data-question="XP durumum">XP durumum</button><button data-action="ask" data-question="Motivasyon lazım">Motivasyon</button><button data-action="ask" data-question="Bu hafta nasıldım?">Son 7 gün</button><button data-action="ask" data-question="Hangi görevde zorlandım?">Zorlandığım görev</button></div>
  <form id="chatForm" class="chat-form" style="margin-top:11px"><input name="question" type="text" maxlength="250" placeholder="Koça bir şey sor..." required><button class="button primary" type="submit">Gönder</button></form></div>`;
}
async function checkUpdates(){
 if(!Updates){toast('Güncelleme modülü yüklenemedi.');return;}
 toast('GitHub üzerinden sürüm kontrol ediliyor…');
 try{
  const nativeFetch=(window.AndroidUpdates&&typeof window.AndroidUpdates.requestLatest==='function')?
    ()=>new Promise((resolve,reject)=>{
      let done=false;
      const finish=()=>{done=true;clearTimeout(timeout);window.onNativeReleaseData=null;window.onNativeReleaseFailure=null;};
      const timeout=setTimeout(()=>{if(!done){finish();reject(new Error('Güncelleme kontrolü zaman aşımına uğradı.'));}},20000);
      window.onNativeReleaseData=payload=>{
        if(done)return;
        finish();
        resolve({ok:true,json:async()=>JSON.parse(payload)});
      };
      window.onNativeReleaseFailure=message=>{
        if(done)return;
        finish();
        reject(new Error(message||'Bağlantı kurulamadı.'));
      };
      try{window.AndroidUpdates.requestLatest();}
      catch(err){finish();reject(err);}
    }):undefined;
  const result=await Updates.checkForUpdates(nativeFetch);
  if(result.status==='current'){
   toast('Uygulaman güncel: v'+result.currentVersion);
   return;
  }
  const destination=result.apkUrl||result.releaseUrl;
  if(window.confirm('Yeni sürüm: v'+result.latestVersion+(result.isPrerelease?' (TEST SÜRÜMÜ)':'')+'\nKurulum sayfasını açmak ister misin? Önce şifreli yedek almanı öneririz.')){
   if(window.AndroidUpdates&&typeof window.AndroidUpdates.openUrl==='function')window.AndroidUpdates.openUrl(destination);
   else window.open(destination,'_blank','noopener');
  }
 }catch(err){toast(err&&err.message?err.message:'Güncelleme kontrolü başarısız.');}
}
function render(){
 const key=Core.dayKey();Core.syncPlan(state,key);persist();
 if(tab==='today')view.innerHTML=todayView(key);
 else if(tab==='tasks')view.innerHTML=tasksView(key);
 else if(tab==='journey')view.innerHTML=journeyView(key);
 else if(tab==='analysis')view.innerHTML=analysisView(key);
 else view.innerHTML=coachView(key);
 document.querySelectorAll('.nav-item').forEach(btn=>{const sel=btn.dataset.tab===tab;btn.classList.toggle('selected',sel);btn.setAttribute('aria-current',sel?'page':'false');});
}
function ask(question){
 if(localAiBusy){toast('Yerel AI önceki yanıtı hazırlıyor.');return;}
 coachLog.push({who:'user',text:question});
 if(localAiStatus==='ready'&&window.AndroidAI&&typeof window.AndroidAI.generate==='function'){
  localAiBusy=true;
  coachLog.push({who:'bot',text:'Yerel dil modeli yanıt hazırlıyor…',pending:true});
  const key=Core.dayKey(),summary=Core.daySummary(state,key);
  const context=JSON.stringify({date:key,day:Core.seasonDay(state.seasonStart,key),
    xp:Core.totalXp(state),streak:Core.streak(state,key),
    completed:summary.completedCount,planned:summary.plannedCount,
    tasks:Core.activeTasks(state).slice(0,20).map(t=>({name:t.name,core:t.core,done:!!state.days[key]?.completed?.[t.id]}))});
  try{window.AndroidAI.generate(question,context);}
  catch(err){localAiBusy=false;coachLog.pop();coachLog.push({who:'bot',text:coachReply(question,key)});toast('Yerel model çalıştırılamadı.');}
 }else coachLog.push({who:'bot',text:coachReply(question,Core.dayKey())});
 if(coachLog.length>16)coachLog=coachLog.slice(-16);
 render();
 document.getElementById('chatLog')?.scrollIntoView({block:'end',behavior:'smooth'});
}
window.onLocalAIEvent=function(kind,payload){
 if(kind==='status'){
  const cut=String(payload).indexOf('|');
  localAiStatus=cut>=0?String(payload).slice(0,cut):String(payload);
  toast(cut>=0?String(payload).slice(cut+1):payload);
 }else if(kind==='reply'||kind==='error'){
  if(kind==='error')toast(payload||'Yerel AI işlemi başarısız.');
  if(localAiBusy){
   localAiBusy=false;
   const index=coachLog.findLastIndex(m=>m.pending);
   if(index>=0)coachLog[index]={who:'bot',text:kind==='reply'?String(payload):'Yerel modelden yanıt alınamadı. Kural tabanlı koçu kullanabilirsin.'};
  }
 }
 render();
};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{tab=btn.dataset.tab;render();window.scrollTo({top:0,behavior:'instant'});}));
document.addEventListener('click',ev=>{if(ev.target.closest('[data-close]')){dialog.close();backupDialog.close();restoreDialog.close();recoveryDialog.close();pendingSave=null;recoveryCodeOutput.textContent='';}});
recoveryDialog.addEventListener('cancel',()=>{pendingSave=null;recoveryCodeOutput.textContent='';document.getElementById('recoveryForm').reset();});
view.addEventListener('click',ev=>{
 const btn=ev.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,id=btn.dataset.id,key=Core.dayKey();
 try{
  if(action==='newTask'){dialog.showModal();document.getElementById('taskName').focus();}
  if(action==='backup'){if(storageLocked)throw new Error('Bozuk kayıt koruma altında; yeni boş yedek oluşturulamaz.');backupDialog.showModal();}
  if(action==='restore'){if(window.AndroidFiles&&window.AndroidFiles.openEncryptedBackup)window.AndroidFiles.openEncryptedBackup();else fileInput.click();}
  if(action==='focus'){if(focusSelection.has(id))focusSelection.delete(id);else focusSelection.add(id);render();}
  if(action==='complete'){
   const bonus=focusSelection.has(id);update(Core.completeTask(state,id,key,bonus),`Görev tamamlandı! +${Core.XP[state.tasks.find(t=>t.id===id).difficulty]+(bonus?10:0)} XP`);focusSelection.delete(id);
  }
  if(action==='undo'){
   if(window.confirm('Bu tamamlamayı geri alalım mı? Bu görevin bugünkü XP kaydı da düzeltilir.'))update(Core.undoCompletion(state,id,key),'Tamamlama geri alındı.');
  }
  if(action==='archive'){
   if(window.confirm('Bu alışkanlığı arşivlemek istiyor musun? Önceki XP korunacak.'))update(Core.archiveTask(state,id,key),'Görev arşivlendi.');
  }
  if(action==='sample'){
   if(!Core.activeTasks(state).length&&window.confirm('Örnek 3 görev eklensin ve 66 günlük sezonun bugün başlasın mı?')){
    let s=state;s=Core.addTask(s,{name:'15 dakika kitap oku',difficulty:'easy',core:true},key);
    s=Core.addTask(s,{name:'20 dakika hareket et',difficulty:'medium',core:true},key);
    s=Core.addTask(s,{name:'30 dakika odaklan',difficulty:'hard',core:false},key);update(s,'66 günlük yolculuğun başladı!');
   }
  }
  if(action==='world')update(Core.setWorld(state,btn.dataset.world),'Dünya seçildi.');
  if(action==='ask')ask(btn.dataset.question);
  if(action==='importLocalModel'){
   if(!window.AndroidAI)throw new Error('Bu Android sürümünde yerel AI desteği bulunmuyor.');
   const replace=localAiStatus!=='none'&&localAiStatus!=='unavailable';
   if(!replace||window.confirm('Önceki GGUF modelini değiştirmek istiyor musun? Koruma kopyası saklanır.'))
    window.AndroidAI.chooseModel(replace);
  }
  if(action==='loadLocalModel'){
   if(!window.AndroidAI)throw new Error('Yerel AI köprüsü bulunmuyor.');
   window.AndroidAI.loadModel();
  }
  if(action==='checkUpdates')checkUpdates();
 }catch(e){toast(e.message||'İşlem tamamlanamadı.');}
});
async function saveEncryptedFile(text){
 if(window.AndroidFiles&&window.AndroidFiles.saveEncryptedBackup){window.AndroidFiles.saveEncryptedBackup(text);return;}
 const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
 const link=document.createElement('a');link.href=url;link.download='Yolculuk66-'+Core.dayKey()+'.y66backup';
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
window.receiveEncryptedBackup=function(text){
 if(typeof text!=='string'||text.length>4*1024*1024){toast('Yedek dosyası boyut sınırını aşıyor.');return;}
 pendingRestoreText=text;restoreDialog.showModal();
};
fileInput.addEventListener('change',async function(){
 const file=this.files&&this.files[0];if(!file)return;
 try{if(file.size>4*1024*1024)throw new Error('Yedek dosyası çok büyük.');window.receiveEncryptedBackup(await file.text());}
 catch(e){toast(e.message||'Dosya okunamadı.');}finally{this.value='';}
});
document.getElementById('backupForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,button=form.querySelector('[type=submit]');
 const pw=form.elements.namedItem('password').value,repeat=form.elements.namedItem('repeat').value;
 if(pw!==repeat){toast('Parolalar eşleşmiyor.');return;}
 button.disabled=true;
 try{
  const wantsRecovery=form.elements.namedItem('recovery').checked;
  const created=wantsRecovery?await Backup.encryptWithRecovery(state,pw):{file:await Backup.encryptState(state,pw),recoveryCode:null};
  // Test encrypted output with the real decryption path before allowing download.
  const roundtrip=await Backup.decryptState(created.file,pw);
  if(JSON.stringify(roundtrip)!==JSON.stringify(state))throw new Error('Yedek doğrulaması başarısız.');
  if(wantsRecovery){
   const recovered=await Backup.decryptWithRecoveryCode(created.file,created.recoveryCode);
   if(JSON.stringify(recovered)!==JSON.stringify(state))throw new Error('Kurtarma kodu testi başarısız.');
   pendingSave={file:created.file,recoveryCode:created.recoveryCode,serialized:JSON.stringify(state)};
   backupDialog.close();form.reset();recoveryCodeOutput.textContent=created.recoveryCode;
   recoveryDialog.showModal();
  }else{
   await saveEncryptedFile(JSON.stringify(created.file));backupDialog.close();form.reset();
   toast(window.AndroidFiles?'Dosya kaydetme penceresi açıldı.':'Şifreli dosya indirmesi başlatıldı.');
  }
 }catch(e){toast(e.message||'Yedek oluşturulamadı.');}
 finally{button.disabled=false;}
});
document.getElementById('recoveryForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,button=form.querySelector('[type=submit]');
 if(!pendingSave){toast('Kurtarma kodu oturumu bulunamadı.');return;}
 button.disabled=true;
 try{
  const entered=form.elements.namedItem('confirmationCode').value;
  if(Backup.normalizeRecoveryCode(entered)!==Backup.normalizeRecoveryCode(pendingSave.recoveryCode))throw new Error('Kurtarma kodu eşleşmedi. Güvenli yere kaydettiğin kodu tekrar kontrol et.');
  const restored=await Backup.decryptWithRecoveryCode(pendingSave.file,entered);
  if(JSON.stringify(restored)!==pendingSave.serialized)throw new Error('Kurtarma kodu doğrulaması başarısız.');
  await saveEncryptedFile(JSON.stringify(pendingSave.file));
  pendingSave=null;recoveryCodeOutput.textContent='';form.reset();recoveryDialog.close();
  toast(window.AndroidFiles?'Dosya kaydetme penceresi açıldı.':'Şifreli dosya indirmesi başlatıldı.');
 }catch(e){toast(e.message||'Kurtarma kodu doğrulanamadı.');}
 finally{button.disabled=false;}
});
document.getElementById('restoreForm').addEventListener('submit',async ev=>{
 ev.preventDefault();const form=ev.target,button=form.querySelector('[type=submit]');
 if(!pendingRestoreText){toast('Önce yedek dosyası seç.');return;}
 button.disabled=true;
 try{
  const file=JSON.parse(pendingRestoreText);
  const credential=form.elements.namedItem('password').value;
  const method=form.elements.namedItem('method').value;
  const target=method==='recovery'?await Backup.decryptWithRecoveryCode(file,credential):await Backup.decryptState(file,credential);
  const xp=Core.totalXp(target),currentXP=Core.totalXp(state);
  const prompt='Yedek: '+target.tasks.length+' görev, '+xp+' XP, başlangıç: '+(target.seasonStart||'yok')+'\nBu cihaz: '+state.tasks.length+' görev, '+currentXP+' XP.\n\n'+
   'Geri yükleme bu cihazın ana kayıtlarını değiştirebilir.\n'+
   'Önce yerel koruma kopyası alınacak. Devam edilsin mi?';
  if(!window.confirm(prompt))return;
  if(storageLocked)SafeStore.recoverCorrupt(localStorage,KEY,target,Backup.validateState);
  else Backup.commitRestore(localStorage,KEY,state,target);
  storageLocked=false;state=target;storageWorks=true;pendingRestoreText=null;restoreDialog.close();form.reset();tab='analysis';render();toast('Yedek geri yüklendi; koruma kopyası saklandı.');
 }catch(e){toast(e.message||'Yedek geri yüklenemedi.');}
 finally{button.disabled=false;}
});
document.getElementById('taskForm').addEventListener('submit',ev=>{
 ev.preventDefault();const form=ev.target;
 try{
  const data={name:form.elements.namedItem('name').value,difficulty:form.elements.namedItem('difficulty').value,core:form.elements.namedItem('core').checked};
  update(Core.addTask(state,data,Core.dayKey()),'Yeni görev eklendi!');form.reset();form.elements.namedItem('difficulty').value='medium';dialog.close();
 }catch(e){toast(e.message||'Görev eklenemedi.');}
});
view.addEventListener('submit',ev=>{
 if(ev.target.id!=='chatForm')return;ev.preventDefault();const value=String(new FormData(ev.target).get('question')||'').trim();if(value)ask(value);
});
render();
})();
