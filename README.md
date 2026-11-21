# Yolculuk 66 — Android

66 günlük çevrimdışı alışkanlık/RPG deneyimi. Bu depo, mevcut **v0.3.1 Android APK'sından çıkarılmış orijinal HTML/CSS/JS uygulama dosyalarını** koruyarak oluşturulan **v0.3.2 geliştirme kaynağıdır**. Orijinal Android/Gradle proje klasörü bulunamadığı için yerel Android WebView kabuğu yeniden yazılmıştır.

## Durum
- Mevcut görevler, XP, dünyalar, hikâye, şifreli yedek ve kurtarma kodu modülleri korunur.
- Yerel kayıt anahtarı değişmedi: `yolculuk66.offline.mvp.v1`.
- Analiz ekranından **isteğe bağlı GitHub güncelleme kontrolü** eklendi. Uygulama açılırken otomatik sorgu veya analiz verisi gönderimi yapılmaz.
- Yerel dosya seçme/kaydetme Android Storage Access Framework üzerinden yapılır.
- **AI Koç hâlâ kural tabanlıdır; gerçek çevrimdışı dil modeli henüz eklenmedi.**
- Otomatik yerel anlık görüntüler ve topluluk maceraları için onaylanan ileri tasarım kararları henüz uygulanmadı.

## Test / derleme
`node --test tests/*.test.js`

Android SDK 35 + JDK 17 ve Gradle 8.9 ile:
`gradle :app:assembleDebug`

GitHub Actions, her push için test ve **deneme amaçlı debug APK** üretir.

## ÖNEMLİ: Mevcut cihaz verilerini koruyun
Bu deponun derleme imzasının daha önce dağıtılan v0.3.1 APK imzasıyla **eşleştiği henüz kanıtlanmadı**. İmzalar farklıysa Android doğrudan güncellemeyi reddeder. **Eski uygulamayı silmeyin.** Önce eski uygulamadan şifreli yedek alıp parola ve kurtarma kodunu güvenli tutun. Doğrulanmış imza/migrasyon süreci olmadan debug derlemeyi üretim sürümü diye sunmayın.

Uygulama verileri cihazda tutulur; GitHub deposuna kullanıcı kayıtları, yedekler, imza anahtarları veya kimlik bilgileri yüklenmemelidir.
