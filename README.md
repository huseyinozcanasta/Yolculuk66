# Yolculuk 66 — Android

66 günlük, çevrimdışı alışkanlık ve RPG uygulaması. Mevcut v0.3.1 APK'sındaki HTML/CSS/JavaScript oyun motoru korunmuş; orijinal Gradle klasörü bulunamadığı için Android WebView kabuğu düzenlenebilir kaynak olarak yeniden oluşturulmuştur.

## Sürümler ve güvenlik
- **v0.3.3**: GitHub'da yayımlanan son test APK'sı; eski v0.3.1 ile aynı imza, paket kimliği `com.ozgun.yolculuk66`, versionCode 6. Telefon üzerinde veri koruma testi henüz yok.
- **v0.3.4 (geliştirme)**: Bozuk kayıt üzerinde sessiz veri kaybını önleyen güvenli yükleme, bozuk orijinal dosyayı koruyarak yedekten geri dönme ve kullanıcının seçtiği GGUF modelini cihazda çalıştırmak için isteğe bağlı `llama.cpp`/Kotlin altyapısı. Bu sürümün Android derleme, emülatör ve model üzerinde çıkarım kabulü tamamlanmadan üretim APK'sı olarak yayımlanması uygun değildir.
- Oyun verisi anahtarı: `yolculuk66.offline.mvp.v1`. Kullanıcının görev, XP, hikâye ve şifreli yedekleme mekanizmaları korunur.

## Gerçek çevrimdışı AI nasıl çalışır?

Kural tabanlı koç model olmadan çalışmaya devam eder. Kullanıcı **AI Koç > Cihazdan GGUF model seç** üzerinden yasal olarak edindiği uygun GGUF dosyasını bir kez seçerse Android, modeli uygulamanın kendi özel dosya alanına kopyalar. Cihazda yükleme tamamlanırsa `org.codeshipping:llama-kotlin-android:0.1.7` paketindeki `llama.cpp` CPU çıkarımıyla yanıt oluşturulur. İnternet kullanımı gerekmez; koçun konuşması ve oyun özeti yalnız cihaz içinde işlenir.

Düşük bellekli telefonlar için başlangıç önerisi: [Qwen2.5-0.5B-Instruct-GGUF / Q4_K_M](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF), yaklaşık 400 MB, Apache-2.0 lisanslı. Model ağırlıkları APK veya GitHub deposunda yoktur. Model uyumluluğu ve donanım performansı gerçek cihazda henüz doğrulanmadı. İlk aşama 1,2 GB dosya sınırı, 1024 token bağlamı, 2 CPU iş parçacığı ve 160 çıkış tokenı kullanır.

## Güncelleme ve yedekler

Analiz sekmesindeki GitHub güncelleme düğmesi yalnız kullanıcı tıklarsa internete bağlanır; taslak sürümler dikkate alınmaz, test sürümleri açıkça işaretlenir. APK kurulumunun Android onayı olmadan otomatik yapılması mümkün değildir. Kullanıcı verileri GitHub'a gönderilmez.

Şifreli dosya yedekleme ve kurtarma kodu desteği korunur. Bozuk kayıt algılanırsa otomatik sıfırlama/üzerine yazma yerine veri koruması devreye girer. Kullanıcı yedekten dönmeye onay verirse bozuk ham kayıt `.corruptOriginal` anahtarında tutulur. Eski onaylı C seçeneklerindeki otomatik anlık görüntü zamanı ve saklama sayısı ayrıntıları henüz tam doğrulanamadığı için otomatik silme/kota politikası varsayılmamıştır.

## Test ve derleme

```bash
node --test tests/*.test.js
gradle :app:assembleDebug
gradle :app:connectedDebugAndroidTest
```

CI: [GitHub Actions](https://github.com/huseyinozcanasta/Yolculuk66/actions). Android 15 emülatör smoke testleri ayrı iş akışındadır.

**Uyarı:** GitHub Actions'ın varsayılan debug APK'sı CI makinesinin anahtarıyla imzalanır ve eski sürüm üzerine kurulamaz. Kullanıcıya sunulan test güncellemesi eski v0.3.1 ile aynı imzaya sahip olacak şekilde ayrıca imzalanıp doğrulanmalıdır. Özel imza anahtarı hiçbir zaman depoya yüklenmez. Eski uygulamayı kaldırmadan önce şifreli yedek alın.

Üçüncü taraf kütüphane ve model lisansları sahiplerine aittir. Uygulamanın tüm kaynak kodu için ayrıca bir lisans beyanı yapılmış değildir.

## v0.3.5 ��� Resm+� GGUF model indirme ba��lant�-s�-
AI Ko+� ekran�-na Qwen2.5-0.5B-Instruct Q4_K_M i+�in yakla+��-k 491 MB'l�-k resm+� dosyan�-n indirme d+-��mesi eklendi: https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf . Yaln�-z t�-klan�-nca Android taray�-c�-s�- a+�-l�-r; otomatik indirme yoktur. �-ndirdikten sonra AI Ko+� > Cihazdan GGUF model se+� > �-ndirilenler klas+�r+-ndeki GGUF > Kaydedilmi+� yerel modeli a+�. Model, Hugging Face'den gelir; sohbet ve al�-+�kanl�-k kay�-tlar�- internete g+�nderilmez. Ger+�ek cihazda modelden yan�-t +-retme do��rulamas�- devam ediyor.


## v0.3.6 ��� AI Coach response grounding
Questions about today's plan, XP, tasks, streaks, and weekly progress are answered deterministically from the on-device game records. Greetings and empty-task states are handled locally. The user can add a first habit directly from the coach screen. Open-ended questions still use the optional GGUF model; generic or unhelpful model answers fall back to local coaching. The model prompt requests direct, grounded Turkish answers. No gameplay data is sent to a server.


## v0.3.7 - Generative local AI coaching
An imported GGUF model now responds to every question directly, using a model-specific chat template, verifiable app capabilities, current local game history and up to six recent chat turns. The model has a 3072-token context, 320-token response, temperature/top-p controls, repetition penalty, and 4 CPU threads. The old canned-answer routing is disabled when a model is ready. The optional official Qwen2.5-1.5B-Instruct Q4_K_M download link (about 1.07 GB) is available alongside the older 0.5B model. If model output is generic or invalid, the UI reports that transparently rather than pretending the answer was generated. All game and chat context stays on-device. No real-phone inference acceptance yet; keep this version as an experimental prerelease.

