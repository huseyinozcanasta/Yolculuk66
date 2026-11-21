/* Fail-closed local save protection: never silently overwrite malformed user data. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.YolculukSafeStore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function load(storage,key,initialState,validateState){
  const fresh=()=>typeof initialState==='function'?initialState():initialState;
  try{
   const raw=storage.getItem(key);
   if(raw===null)return {state:fresh(),locked:false};
   if(typeof raw!=='string'||!raw.trim())throw new Error('Boş kayıt');
   return {state:validateState(JSON.parse(raw)),locked:false};
  }catch(_){
   return {state:fresh(),locked:true,
    error:'Yerel kayıt doğrulanamadı; üzerine yazılması engellendi.'};
  }
 }
 function save(storage,key,state,locked){
  if(locked)throw new Error('Bozuk yerel kayıt koruma altında; üzerine yazılamaz.');
  const next=JSON.stringify(state);
  if(typeof next!=='string')throw new Error('Geçerli bir oyun kaydı bulunamadı.');
  const old=storage.getItem(key);
  storage.setItem(key,next);
  if(storage.getItem(key)!==next){
   try{if(old===null)storage.removeItem(key);else storage.setItem(key,old);}catch(_){}
   throw new Error('Oyun kaydı doğrulanamadı; kayıt durduruldu.');
  }
  return true;
 }
 function recoverCorrupt(storage,key,target,validateState){
  const raw=storage.getItem(key);
  if(typeof raw!=='string')throw new Error('Kurtarılacak bozuk kayıt bulunamadı.');
  let valid=false;
  try{validateState(JSON.parse(raw));valid=true;}catch(_){}
  if(valid)throw new Error('Mevcut oyun kaydı geçerli; bozuk değil.');
  const protection=key+'.corruptOriginal';
  if(storage.getItem(protection)!==null)
   throw new Error('Önceki koruma kopyası zaten mevcut; üzerine yazılmayacak.');
  const next=JSON.stringify(validateState(target));
  if(storage.getItem(key)!==raw)
   throw new Error('Kayıt değişmiş; güvenli geri yükleme durduruldu.');
  storage.setItem(protection,raw);
  if(storage.getItem(protection)!==raw)
   throw new Error('Koruma kopyası doğrulanamadı; geri yükleme durduruldu.');
  try{
   storage.setItem(key,next);
   if(storage.getItem(key)!==next)throw new Error('Geri yüklenen kayıt doğrulanamadı.');
  }catch(error){
   try{storage.setItem(key,raw);}catch(_){}
   throw error;
  }
  return true;
 }
 return {load,save,recoverCorrupt};
});
