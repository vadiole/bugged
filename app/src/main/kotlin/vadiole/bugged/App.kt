package vadiole.bugged

import android.app.Application
import android.content.ClipData
import android.content.ClipDescription
import android.content.ClipboardManager
import android.os.Build
import android.os.SystemClock
import android.view.textclassifier.TextClassifier
import java.io.InputStreamReader

class App : Application() {
    @Volatile
    private var cleanerOrNull: Cleaner? = null

    @Volatile
    private var browsersOrNull: Browsers? = null

    @Volatile
    private var setupOrNull: Setup? = null

    val cleaner: Cleaner
        get() = cleanerOrNull ?: synchronized(this) {
            cleanerOrNull ?: Cleaner(asset("rules.txt"), asset("redirects.txt")).also { cleanerOrNull = it }
        }

    val browsers: Browsers
        get() = browsersOrNull ?: synchronized(this) {
            browsersOrNull ?: Browsers(this).also { browsersOrNull = it }
        }

    val setup: Setup
        get() = setupOrNull ?: synchronized(this) {
            setupOrNull ?: Setup(this).also { setupOrNull = it }
        }

    private var lastCleaned = 0
    private var lastCleanedAt = 0L

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    fun warm() {
        cleaner
        setup
    }

    fun cleanClipboard(): String? {
        val clipboard = getSystemService(ClipboardManager::class.java)
        val description = clipboard.primaryClipDescription ?: return null
        if (!mayHoldLink(description)) return null
        val item = clipboard.primaryClip?.takeIf { it.itemCount == 1 }?.getItemAt(0) ?: return null
        val text = item.text?.toString() ?: return null
        val result = cleaner.cleanLinks(text)
        val cleaned = result.text
        if (cleaned == text) return null
        val label = getString(R.string.clip_label)
        val html = item.htmlText
        val clip = if (html == null) {
            ClipData.newPlainText(label, cleaned)
        } else {
            ClipData.newHtmlText(label, cleaned, cleaner.cleanHtml(html))
        }
        description.extras?.let { clip.description.extras = it }
        clipboard.setPrimaryClip(clip)
        count(cleaned, result.links)
        return cleaned
    }

    fun writeClipboard(text: String) {
        getSystemService(ClipboardManager::class.java)
            .setPrimaryClip(ClipData.newPlainText(getString(R.string.clip_label), text))
        count(text, 1)
    }

    private fun count(cleaned: String, links: Int) {
        val now = SystemClock.elapsedRealtime()
        val mark = cleaned.hashCode()
        if (mark == lastCleaned && now - lastCleanedAt < SAME_COPY) return
        lastCleaned = mark
        lastCleanedAt = now
        setup.count(links.coerceAtLeast(1))
    }

    private fun mayHoldLink(description: ClipDescription): Boolean {
        if (!description.hasMimeType("text/*")) return false
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
        if (description.classificationStatus != ClipDescription.CLASSIFICATION_COMPLETE) return true
        return description.getConfidenceScore(TextClassifier.TYPE_URL) > 0f
    }

    private fun asset(name: String): String {
        val reader = InputStreamReader(assets.open(name), "UTF-8")
        try {
            return reader.readText()
        } finally {
            reader.close()
        }
    }

    companion object {
        private const val SAME_COPY = 5000L

        lateinit var instance: App
            private set
    }
}
