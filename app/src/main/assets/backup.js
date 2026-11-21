/* Yolculuk 66 — encrypted offline export. No network or analytics. */
(function(root,factory){
  const value=factory();
  if(typeof module==='object'&&module.exports)module.exports=value;
  if(root)root.YolculukBackup=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MAGIC='YOLCULUK66-ENCRYPTED';
 const ITERATIONS=310000;
 const MAX_FILE=3*1024*1024;
 const AAD=new TextEncoder().encode('com.ozgun.yolculuk66:main-save:1');
 const encoder=new TextEncoder(), decoder=new TextDecoder('utf-8',{fatal:true});
 function webCrypto(){
  if(typeof crypto!=='undefined'&&crypto.subtle&&crypto.getRandomValues)return crypto;
  if(typeof require==='function')return require('node:crypto').webcrypto;
  throw new Error('Bu cihazda güvenli şifreleme kullanılamıyor. Yedek oluşturulmadı.');
 }
 function toB64(bytes){
  if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
  let text='';for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);return btoa(text);
 }
 function fromB64(text,maxBytes){
  if(typeof text!=='string'||text.length>Math.ceil(maxBytes*4/3)+8||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('Yedek dosyası bozuk.');
  try{const bytes=typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(text,'base64')):Uint8Array.from(atob(text),c=>c.charCodeAt(0));
    if(bytes.length>maxBytes||toB64(bytes)!==text)throw new Error('Yedek dosyası bozuk.');return bytes;
  }catch(e){throw new Error('Yedek dosyası bozuk.');}
 }
 function validPassword(password){if(typeof password!=='string'||password.length<10||password.length>256)throw new Error('Parola en az 10, en fazla 256 karakter olmalı.');}
 function validateState(s){
  if(!s||typeof s!=='object'||Array.isArray(s)||s.version!==1||!['forest','desert','sky'].includes(s.world)||!Array.isArray(s.tasks)||s.tasks.length>500||!s.days||typeof s.days!=='object'||Array.isArray(s.days))throw new Error('Oyun durumu geçersiz.');
  if(s.seasonStart!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(s.seasonStart))throw new Error('Sezon tarihi geçersiz.');
  if(s.seasonStart&&!(s.seasonStart in s.days)&&s.tasks.length===0)throw new Error('Oyun durumu geçersiz.');
  const ids=new Set();
  for(const t of s.tasks){
   if(!t||typeof t!=='object'||typeof t.id!=='string'||t.id.length>100||!/^[A-Za-z0-9_-]+$/.test(t.id)||ids.has(t.id)||typeof t.name!=='string'||t.name.trim().length<2||t.name.length>80||!['easy','medium','hard'].includes(t.difficulty)||typeof t.core!=='boolean'||typeof t.archived!=='boolean')throw new Error('Görev kaydı geçersiz.');
   ids.add(t.id);
  }
  const dates=Object.keys(s.days);
  if(dates.length>4000)throw new Error('Gün kaydı sınırı aşıldı.');
  for(const key of dates){
   const d=s.days[key];
   if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!d||typeof d!=='object'||!Array.isArray(d.planned)||d.planned.length>500||!d.completed||typeof d.completed!=='object'||Array.isArray(d.completed))throw new Error('Gün kaydı geçersiz.');
   for(const p of d.planned){if(!p||typeof p.id!=='string'||!ids.has(p.id)||typeof p.baseXp!=='number'||![10,20,35].includes(p.baseXp)||typeof p.core!=='boolean')throw new Error('Gün planı geçersiz.');}
   for(const [id,c] of Object.entries(d.completed)){
    if(!ids.has(id)||!c||![10,20,35].includes(c.baseXp)||!([0,10].includes(c.bonusXp))||c.xp!==Math.min(50,c.baseXp+c.bonusXp))throw new Error('Tamamlama kaydı geçersiz.');
   }
  }
  return s;
 }
 async function keyFor(pass,salt,iterations,usage){
  const c=webCrypto();const material=await c.subtle.importKey('raw',encoder.encode(pass),'PBKDF2',false,['deriveKey']);
  return c.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations},material,{name:'AES-GCM',length:256},false,[usage]);
 }
 async function encryptState(state,password){
  validPassword(password);validateState(state);
  const plain=encoder.encode(JSON.stringify(state));
  if(plain.byteLength>MAX_FILE)throw new Error('Oyun kaydı dışa aktarım sınırını aşıyor.');
  const c=webCrypto(),salt=c.getRandomValues(new Uint8Array(16)),iv=c.getRandomValues(new Uint8Array(12));
  const key=await keyFor(password,salt,ITERATIONS,'encrypt');
  const cipher=new Uint8Array(await c.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,plain));
  return {magic:MAGIC,format:1,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,algorithm:'AES-256-GCM',salt:toB64(salt),iv:toB64(iv),cipher:toB64(cipher),createdAt:new Date().toISOString()};
 }
 async function decryptState(file,password){
  validPassword(password);
  if(file&&file.format===2)return decryptV2(file,password,false);
  if(!file||typeof file!=='object'||file.magic!==MAGIC||file.format!==1||file.kdf!=='PBKDF2-SHA256'||file.algorithm!=='AES-256-GCM'||!Number.isSafeInteger(file.iterations)||file.iterations<ITERATIONS||file.iterations>600000)throw new Error('Yedek dosya biçimi desteklenmiyor.');
  const salt=fromB64(file.salt,16),iv=fromB64(file.iv,12),cipher=fromB64(file.cipher,MAX_FILE+32);
  if(salt.length!==16||iv.length!==12||cipher.length<16)throw new Error('Yedek dosyası bozuk.');
  try{
   const key=await keyFor(password,salt,file.iterations,'decrypt');
   const plain=await webCrypto().subtle.decrypt({name:'AES-GCM',iv,additionalData:AAD,tagLength:128},key,cipher);
   if(plain.byteLength>MAX_FILE)throw new Error('Dosya boyutu sınırı aşıldı.');
   return validateState(JSON.parse(decoder.decode(plain)));
  }catch(e){throw new Error('Yedek açılamadı: parola yanlış, dosya bozuk veya veri uyumsuz.');}
 }

 // Format 2: random 256-bit data key, wrapped separately under a password key
 // and an optional high-entropy, one-time, offline recovery code.
 const PAYLOAD_AAD=encoder.encode('com.ozgun.yolculuk66:main-save:2');
 const PASSWORD_AAD=encoder.encode('com.ozgun.yolculuk66:password-wrap:2');
 const RECOVERY_AAD=encoder.encode('com.ozgun.yolculuk66:recovery-wrap:2');
 const BASE32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
 function recoveryCodeFor(bytes){
  let carry=0,bits=0,chars='';
  for(const byte of bytes){carry=(carry<<8)|byte;bits+=8;while(bits>=5){bits-=5;chars+=BASE32[(carry>>bits)&31];}}
  if(bits)chars+=BASE32[(carry<<(5-bits))&31];
  return chars.match(/.{1,8}/g).join('-');
 }
 function normalizeRecoveryCode(code){
  if(typeof code!=='string')throw new Error('Kurtarma kodu geçersiz.');
  const clean=code.toUpperCase().replace(/[ -]/g,'');
  if(!/^[A-Z2-7]{32}$/.test(clean))throw new Error('Kurtarma kodu geçersiz.');
  return clean;
 }
 async function recoveryKey(code,usage){
  const c=webCrypto();
  const digest=await c.subtle.digest('SHA-256',encoder.encode('Yolculuk66:recovery-key:v2:'+normalizeRecoveryCode(code)));
  return c.subtle.importKey('raw',digest,{name:'AES-GCM'},false,[usage]);
 }
 function validateV2File(file){
  if(!file||typeof file!=='object'||file.magic!==MAGIC||file.format!==2||file.algorithm!=='AES-256-GCM'||file.kdf!=='PBKDF2-SHA256'||!Number.isSafeInteger(file.iterations)||file.iterations<ITERATIONS||file.iterations>600000)throw new Error('Yedek dosya biçimi desteklenmiyor.');
  const payloadIv=fromB64(file.iv,12),cipher=fromB64(file.cipher,MAX_FILE+32),salt=fromB64(file.salt,16),passwordIv=fromB64(file.passwordIv,12),passwordCipher=fromB64(file.passwordCipher,48);
  if(payloadIv.length!==12||cipher.length<16||salt.length!==16||passwordIv.length!==12||passwordCipher.length!==48)throw new Error('Yedek dosyası bozuk.');
  let recoveryIv=null,recoveryCipher=null;
  if(file.recovery!==null&&file.recovery!==undefined){
   if(typeof file.recovery!=='object')throw new Error('Kurtarma biçimi geçersiz.');
   recoveryIv=fromB64(file.recovery.iv,12);recoveryCipher=fromB64(file.recovery.cipher,48);
   if(recoveryIv.length!==12||recoveryCipher.length!==48)throw new Error('Kurtarma biçimi geçersiz.');
  }
  return {payloadIv,cipher,salt,passwordIv,passwordCipher,recoveryIv,recoveryCipher};
 }
 async function encryptWithRecovery(state,password){
  validPassword(password);validateState(state);
  const plain=encoder.encode(JSON.stringify(state));
  if(plain.byteLength>MAX_FILE)throw new Error('Oyun kaydı dışa aktarım sınırını aşıyor.');
  const c=webCrypto(),rawKey=c.getRandomValues(new Uint8Array(32)),salt=c.getRandomValues(new Uint8Array(16));
  const payloadIv=c.getRandomValues(new Uint8Array(12)),passwordIv=c.getRandomValues(new Uint8Array(12)),recoveryIv=c.getRandomValues(new Uint8Array(12));
  const recoveryCode=recoveryCodeFor(c.getRandomValues(new Uint8Array(20)));
  const dataKey=await c.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['encrypt']);
  const pwKey=await keyFor(password,salt,ITERATIONS,'encrypt');
  const recKey=await recoveryKey(recoveryCode,'encrypt');
  const cipher=await c.subtle.encrypt({name:'AES-GCM',iv:payloadIv,additionalData:PAYLOAD_AAD,tagLength:128},dataKey,plain);
  const passwordCipher=await c.subtle.encrypt({name:'AES-GCM',iv:passwordIv,additionalData:PASSWORD_AAD,tagLength:128},pwKey,rawKey);
  const recoveryCipher=await c.subtle.encrypt({name:'AES-GCM',iv:recoveryIv,additionalData:RECOVERY_AAD,tagLength:128},recKey,rawKey);
  rawKey.fill(0);
  return {file:{magic:MAGIC,format:2,kdf:'PBKDF2-SHA256',iterations:ITERATIONS,algorithm:'AES-256-GCM',salt:toB64(salt),iv:toB64(payloadIv),cipher:toB64(new Uint8Array(cipher)),passwordIv:toB64(passwordIv),passwordCipher:toB64(new Uint8Array(passwordCipher)),recovery:{iv:toB64(recoveryIv),cipher:toB64(new Uint8Array(recoveryCipher))},createdAt:new Date().toISOString()},recoveryCode};
 }
 async function decryptV2(file,credential,byRecovery){
  const f=validateV2File(file);
  if(byRecovery&&!f.recoveryCipher)throw new Error('Bu yedekte kurtarma kodu bulunmuyor.');
  try{
   const c=webCrypto();
   const wrapKey=byRecovery?await recoveryKey(credential,'decrypt'):await keyFor(credential,f.salt,file.iterations,'decrypt');
   const rawKey=new Uint8Array(await c.subtle.decrypt({name:'AES-GCM',iv:byRecovery?f.recoveryIv:f.passwordIv,additionalData:byRecovery?RECOVERY_AAD:PASSWORD_AAD,tagLength:128},wrapKey,byRecovery?f.recoveryCipher:f.passwordCipher));
   if(rawKey.length!==32)throw new Error('Anahtar uzunluğu geçersiz.');
   const key=await c.subtle.importKey('raw',rawKey,{name:'AES-GCM'},false,['decrypt']);rawKey.fill(0);
   const plain=await c.subtle.decrypt({name:'AES-GCM',iv:f.payloadIv,additionalData:PAYLOAD_AAD,tagLength:128},key,f.cipher);
   if(plain.byteLength>MAX_FILE)throw new Error('Dosya boyutu sınırı aşıldı.');
   return validateState(JSON.parse(decoder.decode(plain)));
  }catch(e){throw new Error('Yedek açılamadı: parola/kurtarma kodu yanlış, dosya bozuk veya veri uyumsuz.');}
 }
 async function decryptWithRecoveryCode(file,code){
  if(!file||file.format!==2)throw new Error('Bu yedekte kurtarma kodu desteği yok.');
  return decryptV2(file,code,true);
 }
 function commitRestore(storage,key,current,target){
  validateState(current);validateState(target);
  const protectionKey=key+'.preRestore';
  if(storage.getItem(protectionKey)!==null)throw new Error('Mevcut koruma kopyası saklı. Üzerine yazma işlemi durduruldu.');
  const old=JSON.stringify(current),next=JSON.stringify(target);
  if(storage.getItem(key)!==old)throw new Error('Cihazdaki kayıt bu sırada değişmiş. Geri yükleme durduruldu.');
  storage.setItem(protectionKey,old);
  if(storage.getItem(protectionKey)!==old)throw new Error('Koruma kopyası doğrulanamadı.');
  try{
   storage.setItem(key,next);
   if(storage.getItem(key)!==next)throw new Error('Yazılan kayıt doğrulanamadı.');
  }catch(err){
   try{storage.setItem(key,old);}catch(ignored){}
   throw err;
  }
  return true;
 }
 return {MAGIC,encryptState,encryptWithRecovery,decryptState,decryptWithRecoveryCode,normalizeRecoveryCode,validateState,commitRestore};
});
