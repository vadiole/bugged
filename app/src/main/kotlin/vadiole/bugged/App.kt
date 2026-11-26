package vadiole.bugged

import android.app.Application
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.os.Build
import android.os.SystemClock
import android.view.textclassifier.TextClassifier

class App : Application() {
    val cleaner by lazy { Cleaner(asset("rules.txt"), asset("redirects.txt")) }
    val browsers by lazy { Browsers(this) }
    val setup by lazy { Setup(this) }
    private var lastCleaned: String? = null
    private var lastCleanedAt = 0L

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    fun cleanClipboard(): Boolean {
        val clipboard = getSystemService(ClipboardManager::class.java)
        val description = clipboard.primaryClipDescription ?: return false
        if (!mayHoldLink(description)) return false
        val item = clipboard.primaryClip?.takeIf { it.itemCount == 1 }?.getItemAt(0) ?: return false
        val text = item.text?.toString() ?: return false
        val cleaned = cleaner.cleanText(text)
        if (cleaned == text) return false
        val label = getString(R.string.clip_label)
        val html = item.htmlText
        val clip = if (html == null) {
            ClipData.newPlainText(label, cleaned)
        } else {
            ClipData.newHtmlText(label, cleaned, cleaner.cleanHtml(html))
        }
        description.extras?.let { clip.description.extras = it }
        clipboard.setPrimaryClip(clip)
        count(cleaned)
        return true
    }

    fun writeClipboard(text: String) {
        getSystemService(ClipboardManager::class.java)
            .setPrimaryClip(ClipData.newPlainText(getString(R.string.clip_label), text))
        count(text)
    }

    private fun count(cleaned: String) {
        val now = SystemClock.elapsedRealtime()
        if (cleaned == lastCleaned && now - lastCleanedAt < SAME_COPY) return
        lastCleaned = cleaned
        lastCleanedAt = now
        setup.count()
    }

    private fun mayHoldLink(description: ClipDescription): Boolean {
        if (!description.hasMimeType("text/*")) return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        if (description.classificationStatus != ClipDescription.CLASSIFICATION_COMPLETE) return true
        return description.getConfidenceScore(TextClassifier.TYPE_URL) > 0f
    }

    private fun asset(name: String) = assets.open(name).bufferedReader().use { it.readText() }

    companion object {
        private const val SAME_COPY = 5000L

        lateinit var instance: App
            private set
    }
}
