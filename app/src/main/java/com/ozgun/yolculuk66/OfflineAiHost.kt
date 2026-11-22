package com.ozgun.yolculuk66

import android.content.Context
import android.net.Uri
import org.json.JSONArray
import org.json.JSONObject
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import org.codeshipping.llamakotlin.LlamaModel
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.atomic.AtomicBoolean

/** Optional GGUF-backed on-device LLM. No model or personal data is uploaded. */
class OfflineAiHost(private val context: Context, private val listener: Listener) {
    fun interface Listener { fun onEvent(kind: String, payload: String) }

    companion object {
        const val MAX_MODEL_BYTES: Long = 1_200_000_000L
        private const val MIN_MODEL_BYTES: Long = 20_000_000L
    }
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val busy = AtomicBoolean(false)
    private val modelDir = File(context.filesDir, "local-ai")
    private val modelFile = File(modelDir, "selected.gguf")
    private val oldModel = File(modelDir, "previous.gguf")
    @Volatile private var model: LlamaModel? = null
    @Volatile private var currentStatus: String = if (modelFile.exists()) "imported" else "none"

    fun status(): String = currentStatus
    private fun notify(kind: String, message: String) = listener.onEvent(kind, message)
    private fun statusUpdate(status: String, message: String) {
        currentStatus = status
        notify("status", status + "|" + message)
    }

    fun importModel(uri: Uri, allowReplace: Boolean) {
        if (!busy.compareAndSet(false, true)) {
            notify("error", "Yerel AI şu anda başka bir işlem yapıyor.")
            return
        }
        scope.launch {
            var success = false
            val temporary = File(modelDir, "incoming.gguf.part")
            try {
                if (!modelDir.isDirectory && !modelDir.mkdirs())
                    throw IllegalStateException("Özel model dizini oluşturulamadı.")
                if (modelFile.exists() && !allowReplace)
                    throw IllegalStateException("Model zaten var. Değiştirmeden önce onay verilmeli.")
                if (modelFile.exists() && oldModel.exists())
                    throw IllegalStateException("Önceki modelin koruma kopyası saklı. Üzerine yazma engellendi.")
                statusUpdate("importing", "GGUF modeli cihazın özel alanına kopyalanıyor…")
                var total = 0L
                context.contentResolver.openInputStream(uri)?.use { input ->
                    FileOutputStream(temporary).use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buffer)
                            if (n < 0) break
                            total += n
                            if (total > MAX_MODEL_BYTES)
                                throw IllegalStateException("Model 1,2 GB üst sınırını aşıyor.")
                            output.write(buffer, 0, n)
                        }
                        output.fd.sync()
                    }
                } ?: throw IllegalStateException("Seçilen model dosyası açılamadı.")
                if (total < MIN_MODEL_BYTES)
                    throw IllegalStateException("Model dosyası beklenenden küçük veya eksik.")
                val magic = ByteArray(4)
                FileInputStream(temporary).use { if (it.read(magic) != 4) throw IllegalStateException("Eksik GGUF dosyası.") }
                if (!magic.contentEquals(byteArrayOf(71, 71, 85, 70)))
                    throw IllegalStateException("Seçilen dosya GGUF biçiminde değil.")
                model?.close()
                model = null
                if (modelFile.exists() && !modelFile.renameTo(oldModel))
                    throw IllegalStateException("Eski model koruma kopyasına taşınamadı.")
                if (!temporary.renameTo(modelFile)) {
                    if (!modelFile.exists() && oldModel.exists()) oldModel.renameTo(modelFile)
                    throw IllegalStateException("Model kaydı tamamlanamadı.")
                }
                statusUpdate("imported", "Model yerel olarak kaydedildi.")
                success = true
            } catch (e: Exception) {
                currentStatus = if (modelFile.exists()) "imported" else "none"
                notify("error", e.message ?: "Model içe aktarılamadı.")
            } finally {
                if (temporary.exists()) temporary.delete()
                busy.set(false)
            }
            if (success) loadModel()
        }
    }

    fun loadModel() {
        if (!busy.compareAndSet(false, true)) {
            notify("error", "Yerel AI şu anda başka bir işlem yapıyor.")
            return
        }
        scope.launch {
            try {
                if (!modelFile.isFile)
                    throw IllegalStateException("Önce GGUF modelini telefondan seç.")
                statusUpdate("loading", "Yerel dil modeli açılıyor…")
                val loaded = LlamaModel.load(modelFile.absolutePath) {
                    contextSize = 3072
                    threads = 4
                    maxTokens = 320
                    temperature = 0.6f
                    topP = 0.9f
                    repeatPenalty = 1.18f
                    stopSequences = listOf("<|im_end|>", "<|endoftext|>")
                    gpuLayers = 0
                    useMmap = true
                }
                model?.close()
                model = loaded
                statusUpdate("ready", "Yerel AI modeli hazır; internet gerekmez.")
            } catch (e: Exception) {
                currentStatus = if (modelFile.isFile) "imported" else "none"
                notify("error", e.message ?: "Yerel model yüklenemedi.")
            } finally { busy.set(false) }
        }
    }

    fun generate(question: String, localContext: String) {
        val active = model
        if (currentStatus != "ready" || active == null) {
            notify("error", "Yerel model hazır değil. Önce model seç veya yükle.")
            return
        }
        if (!busy.compareAndSet(false, true)) {
            notify("error", "Önceki yanıt henüz hazırlanıyor.")
            return
        }
        scope.launch {
            try {
                val data = JSONObject(localContext)
                val facts = data.optString("app").take(900)
                val game = data.optString("game").take(1500)
                val messages = JSONArray()
                val systemInstruction = buildString {
                    append("Sen Yolculuk 66 Android uygulamasında cihazda çalışan Türkçe bir sohbet modelisin. ")
                    append("Kullanıcının sorusuna doğrudan, anlaşılır ve konuyla ilgili cevap ver. ")
                    append("Hazır selamlama, konu dışı eğitim/iş bilgisi, kendini tekrar ve genel yardım teklifi üretme. ")
                    append("Yolculuk 66 hakkında sorulursa yalnız uygulama bilgilerini kullan. ")
                    append("Kullanıcının yerel oyun kayıtlarını ve sohbet geçmişini bağlam olarak kullanabilirsin; ")
                    append("bilinmeyen oyun kayıtlarını veya uygulama özelliklerini uydurma. ")
                    append("XP, görev ve kayıtları değiştiremezsin. Kişisel verileri cihaz dışına gönderme. ")
                    append("\nUYGULAMA HAKKINDA DOĞRULANMIŞ BİLGİLER:\n")
                    append(facts)
                    append("\nCİHAZDAKİ GÜNCEL OYUN DURUMU:\n")
                    append(game)
                }
                messages.put(JSONObject().put("role", "system").put("content", systemInstruction))
                val history = data.optJSONArray("history")
                if (history != null) {
                    val first = (history.length() - 6).coerceAtLeast(0)
                    for (i in first until history.length()) {
                        val item = history.optJSONObject(i) ?: continue
                        val role = item.optString("role")
                        if (role != "user" && role != "assistant") continue
                        val content = item.optString("content").take(220)
                        if (content.isNotBlank())
                            messages.put(JSONObject().put("role", role).put("content", content))
                    }
                }
                messages.put(JSONObject().put("role", "user").put("content", question.take(500)))
                // The actual model's embedded GGUF chat template determines token formatting.
                val prompt = active.applyChatTemplate(messages.toString(), true)
                val result = active.generate(prompt).trim().take(2500)
                notify("reply", if (result.isBlank()) "Model henüz yanıt üretemedi." else result)
            } catch (e: Exception) {
                notify("error", e.message ?: "Yerel AI yanıt oluşturamadı.")
            } finally { busy.set(false) }
        }
    }

    fun shutdown() {
        scope.cancel()
        model?.close()
        model = null
    }
}
