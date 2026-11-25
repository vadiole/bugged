package vadiole.bugged

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

class Browsers(private val context: Context) {
    class Browser(val packageName: String, val label: String)

    private val preferences = context.getSharedPreferences("browsers", Context.MODE_PRIVATE)

    fun all(): List<Browser> {
        val manager = context.packageManager
        return packages()
            .map { Browser(it, manager.getApplicationLabel(manager.getApplicationInfo(it, 0)).toString()) }
            .sortedBy { it.label.lowercase() }
    }

    fun selected(): Browser? {
        val all = all()
        val saved = preferences.getString(KEY, null)
        return all.firstOrNull { it.packageName == saved } ?: all.firstOrNull()
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
            .filter { it != context.packageName }
            .distinct()
    }

    private fun probe() = Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com"))
        .addCategory(Intent.CATEGORY_BROWSABLE)

    fun select(browser: Browser) {
        preferences.edit().putString(KEY, browser.packageName).apply()
    }

    private companion object {
        const val KEY = "package"
    }
}
