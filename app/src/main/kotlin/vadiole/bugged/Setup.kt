package vadiole.bugged

import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageInstaller
import android.os.Build
import android.provider.Settings

class Setup(private val context: Context) {
    private val preferences = context.getSharedPreferences("setup", Context.MODE_PRIVATE)

    var welcomed: Boolean
        get() = preferences.getBoolean(KEY_WELCOMED, false)
        set(value) = preferences.edit().putBoolean(KEY_WELCOMED, value).apply()

    val cleaned: Long
        get() = preferences.getLong(KEY_CLEANED, 0L)

    fun count() {
        preferences.edit().putLong(KEY_CLEANED, cleaned + 1L).apply()
    }

    fun copyOn(): Boolean {
        val enabled = Settings.Secure.getString(context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        val service = ComponentName(context, ClipboardService::class.java)
        return enabled.orEmpty().split(':').any { ComponentName.unflattenFromString(it) == service }
    }

    fun openOn(): Boolean = context.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_BROWSER)

    // https://developer.android.com/about/versions/13/behavior-changes-13#restricted_settings
    fun restricted(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return false
        val source = try {
            context.packageManager.getInstallSourceInfo(context.packageName).packageSource
        } catch (_: Exception) {
            return false
        }
        return source == PackageInstaller.PACKAGE_SOURCE_LOCAL_FILE || source == PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE
    }

    private companion object {
        const val KEY_WELCOMED = "welcomed"
        const val KEY_CLEANED = "cleaned"
    }
}
