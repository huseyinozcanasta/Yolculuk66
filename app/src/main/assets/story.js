/* Original on-device story scenes. Every chapter is fixed content, never grants XP. */
(function(root,factory){
 const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;
 if(root)root.YolculukStory=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DAYS=[1,11,22,33,44,55,66];
 const STORIES={
  forest:[
   ['Uyanan Patika','Güneş doğarken Zümrüt Orman’ın toprağı usulca kıpırdar. Köklere asılı minik çanlar, kayıp bir tohumu arayan yolcuya ilk adımın önemini hatırlatır. Patika bugün senin için açılır.'],
   ['Yaprakların Yemini','On birinci gün, eski bir meşe ağacının altında aşınmış bir yemin bulursun: Orman, acele edenlere değil, tekrar gelenlere kapılarını açar. Bir avuç ışık, toprağın derinliklerine süzülür.'],
   ['Sisli Geçit','Birinci yürüyüşünün sonunda ormanı örten sis ikiye ayrılır. Ötede sessiz bir köprü ve onu yıllardır bekleyen bir fener vardır. Arkanda bıraktığın günler artık yolunun taşlarıdır.'],
   ['Köklerin Haritası','Kırkaya’nın altındaki kökler taşın üzerine bir harita işler. Harita, ormanı sahiplenen bir hükümdara değil; dönüş yolunu her gün yeniden bulan bir yolcuya ihtiyaç olduğunu fısıldar.'],
   ['Kırık Mevsim','İkinci uzun yolun sonunda yaprakların rengi değişir. Zamanın içinde açılmış küçük bir çatlak görürsün. Onu kapatacak olan güç ani bir zafer değil, biriken kararlılıktır.'],
   ['Koruyucunun Sesi','Ellinci günlerin sonunda ormanın koruyucusu nihayet konuşur: Kayıp tohum bir hazine değildir. Her gün iyi bakılan küçük bir sözün, dünyaya tutunmuş hâlidir.'],
   ['Zümrüt Şafak','Altmış altıncı günün sabahında tohum filiz verir. Ormanın kapıları artık kapanmaz; çünkü yol, onu yürüyenin içinde büyümeyi öğrenmiştir. Bu dünyanın hikâyesi sona erer, yolculuğunsa devam edebilir.']
  ],
  desert:[
   ['İlk Kum Saati','Kumların Mührü dünyasında gecenin serinliğiyle taş bir saat uyanır. Kumlar bir isim fısıldar; zamanın sahibi olmak isteyen değil, onu dikkatle kullanan biri aranıyordur.'],
   ['Kayıp İşaret','On birinci gün, rüzgâr kumdaki izleri siler ama her gün geri döndüğün adımları silemez. Küçük bir sütunun üzerinde mühür ustalarının ilk işaretini bulursun.'],
   ['Gölge Çarşısı','Birinci yolun sonunda boş çarşıya varırsın. Tezgâhlarda değerli taşlar değil, yarım bırakılmış sözler birikmiştir. Bir kapı yalnızca sabırla dokunan eline açılır.'],
   ['Yedi Kapı','İkinci yolun ortasında yedi kapılı bir avlu yükselir. Altısının ardında geçmişin yankıları, sonuncusunda ise henüz verilmemiş kararların sessizliği vardır.'],
   ['Mührün Bedeli','Dördüncü dönemeçte mührün gerçek sırrı ortaya çıkar: Güç, kusursuz geçen günlerden değil; vazgeçmediğin günlerden doğar. Çöl, her hatadan sonra yeniden yol çizilebildiğini öğretir.'],
   ['Zamanın Bahçesi','Kumların altında unutulmuş bir bahçe bulursun. Susuz sandığın toprağın derinlerinde kökler hâlâ canlıdır. Yavaş ve düzenli bir emek, eski çeşmeyi yeniden akıtır.'],
   ['Son Mühür','Altmış altıncı gün taş saat durmaz; tersine, ilk kez sana ayak uydurur. Mühür açılır ve içinden bir taç değil, kendi zamanını seçme hakkı çıkar. Çöldeki yolculuğun tamamlanmıştır.']
  ],
  sky:[
   ['Bulut Limanı','Gökyüzü Adaları’nın en alçak limanında küçük bir hava gemisi seni bekler. Herkes en yükseğe çıkmanın yollarını anlatır; yaşlı kaptan ise önce sağlam bir düğüm atmayı öğretir.'],
   ['Rüzgâr Defteri','On birinci gün seyir defterinde boş sayfalar görürsün. Kaptan, rüzgârın hiçbir zaman aynı esmediğini ama yönünü her sabah yeniden seçebileceğini söyler.'],
   ['İlk Köprü','İlk uzun yolun sonunda iki ada arasındaki köprü belirir. Köprü çelikten değildir; birbiri ardına yapılan küçük ve güvenilir işlerden örülmüş görünmez bağlardan oluşur.'],
   ['Sessiz Fırtına','Göğün ortasında fırtınasız bir karanlıkla karşılaşırsın. En zor sınav bazen dışarıda hiçbir şey olmuyorken rotanı korumaktır. Pusulan küçük bir ışıkla yeniden yanar.'],
   ['Kırk Dördüncü Ufuk','İkinci yol bitiminde yüksek adalar zinciri görünür. Eski haritaların hiçbiri oraya kadar ulaşmaz; çünkü bazı yollar yürünmeden çizilemez.'],
   ['Yıldızların İzi','Yolculuğun sonlarına yaklaşırken yıldızların arasındaki boşluklar bir desen oluşturur. O desenin adı cesaret değil, istikrardır. Her gece aynı noktaya dönen yıldızlar gibi.'],
   ['Açık Gökyüzü','Altmış altıncı gün geminin son halatını çözersin. En yüksek ada bir son durak değil, yeni ufukları görebileceğin bir seyir yeridir. Gökyüzündeki hikâyeni tamamladın.']
  ]
 };
 function getChapters(world){
  const items=STORIES[world];if(!items)throw new Error('Bilinmeyen dünya.');
  return items.map(([title,text],i)=>({id:world+'-'+DAYS[i],day:DAYS[i],title,text,arc:Math.min(3,Math.floor((DAYS[i]-1)/22)+1)}));
 }
 function forDay(world,day){
  const chapters=getChapters(world);const allowed=Number.isFinite(day)?Math.max(0,day):0;
  return {available:chapters.filter(c=>c.day<=allowed),locked:chapters.filter(c=>c.day>allowed).map(c=>({id:c.id,day:c.day}))};
 }
 return {getChapters,forDay};
});
