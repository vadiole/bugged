package vadiole.bugged

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

class Browsers(private val context: Context) {
    class Browser(val packageName: String, val label: String)

    private val preferences = context.getSharedPreferences("browsers", Context.MODE_PRIVATE)

    private var cached: List<Browser>? = null

    fun invalidate() {
        cached = null
    }

    fun all(): List<Browser> = cached ?: load().also { cached = it }

    private fun load(): List<Browser> {
        val manager = context.packageManager
        return packages()
            .map { Browser(it, manager.getApplicationLabel(manager.getApplicationInfo(it, 0)).toString()) }
            .sortedBy { it.label.lowercase() }
    }

    fun selected(all: List<Browser> = all()): Browser? {
        val saved = preferences.getString(KEY, null)
        all.firstOrNull { it.packageName == saved }?.let { return it }
        val default = default()
        return all.firstOrNull { it.packageName == default } ?: all.firstOrNull()
    }

    fun remember() {
        if (preferences.getBoolean(KEY_CHOSEN, false)) return
        val default = default() ?: return
        preferences.edit().putString(KEY, default).apply()
    }

    private fun default(): String? {
        val view = Intent(Intent.ACTION_VIEW, Uri.parse("http://")).addCategory(Intent.CATEGORY_BROWSABLE)
        val name = context.packageManager.resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
        return name?.takeIf { it != "android" && !it.startsWith(FAMILY) }
    }

    fun target(): String? {
        val saved = preferences.getString(KEY, null)
        if (saved != null && context.packageManager.resolveActivity(probe().setPackage(saved), 0) != null) return saved
        return selected()?.packageName
    }

    private fun packages(): List<String> {
        val flags = PackageManager.MATCH_ALL or PackageManager.GET_RESOLVED_FILTER
        return context.packageManager.queryIntentActivities(probe(), flags)
            .filter { it.filter?.hasCategory(Intent.CATEGORY_DEFAULT) != false }
            .map { it.activityInfo.packageName }
            .filter { !it.startsWith(FAMILY) }
            .distinct()
    }

    private fun probe() = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
        .addCategory(Intent.CATEGORY_BROWSABLE)

    fun select(browser: Browser) {
        preferences.edit().putString(KEY, browser.packageName).putBoolean(KEY_CHOSEN, true).apply()
    }

    private companion object {
        const val KEY = "package"
        const val KEY_CHOSEN = "chosen"
        const val FAMILY = "vadiole.bugged"
    }
}
