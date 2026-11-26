package vadiole.bugged.ui

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.LinearLayout
import android.widget.Toast
import vadiole.bugged.BuildConfig
import vadiole.bugged.R

class AboutScreen(context: Context, private val host: Host) : Screen(context, host.colors, R.string.about) {
    private val version = "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

    init {
        val colors = host.colors
        val back = IconButton(context, colors, R.drawable.ic_arrow_back, R.string.back)
        back.setOnClickListener { host.back() }
        val bar = TopBar(context, colors, R.string.about, navigation = back)
        val column = Column(context)
        column.addView(AppIcon(context), linear(dp(96), dp(96), gravity = Gravity.CENTER_HORIZONTAL, top = dp(8), bottom = dp(28)))
        val app = ListGroup(context, colors)
        app.row(R.string.about_version, value = version, action = context.getString(R.string.about_copy)) {
            copy(info())
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
                Toast.makeText(context, R.string.about_copied, Toast.LENGTH_SHORT).show()
            }
        }
        app.row(R.string.privacy_policy) { visit(PRIVACY_URL) }
        column.addView(app, linear(start = dp(16), end = dp(16)))
        val contact = ListGroup(context, colors)
        contact.row(R.string.about_rate) { visit(PLAY_URL) }
        contact.row(R.string.about_feedback) { write() }
        column.addView(contact, linear(start = dp(16), end = dp(16), top = dp(16)))
        column.addView(
            text(context, Type.bodySmall, colors.onSurfaceVariant, R.string.about_feedback_note),
            linear(start = dp(32), end = dp(32), top = dp(8)),
        )
        val author = ListGroup(context, colors)
        author.row(R.string.about_author) { visit(AUTHOR_URL) }
        column.addView(author, linear(start = dp(16), end = dp(16), top = dp(16), bottom = dp(16)))
        val scroll = Scroller(context, column)
        scroll.setOnScrollChangeListener { _, _, y, _, _ -> bar.lift(y > 0) }
        val root = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        root.addView(bar, linear())
        root.addView(scroll, linear(height = 0, weight = 1f))
        addView(root, MATCH_PARENT, MATCH_PARENT)
        scroll.onBars { bars -> scroll.setPadding(bars.left, 0, bars.right, bars.bottom) }
    }

    private fun info(): String {
        val model = if (Build.MODEL.startsWith(Build.MANUFACTURER, ignoreCase = true)) Build.MODEL else "${Build.MANUFACTURER} ${Build.MODEL}"
        return listOf(
            "${context.getString(R.string.app_name)} $version",
            "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
            model,
        ).joinToString("\n")
    }

    private fun copy(text: String) {
        context.getSystemService(ClipboardManager::class.java)?.setPrimaryClip(ClipData.newPlainText(context.getString(R.string.app_name), text))
    }

    private fun visit(url: String) {
        val view = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        val handler = context.packageManager.resolveActivity(view, PackageManager.MATCH_DEFAULT_ONLY)?.activityInfo?.packageName
        if (handler == context.packageName && host.browsers.target() == null) {
            copy(url)
            return
        }
        try {
            context.startActivity(view)
        } catch (_: ActivityNotFoundException) {
            copy(url)
        }
    }

    private fun write() {
        val subject = Uri.encode(context.getString(R.string.about_feedback_subject))
        val body = Uri.encode("$DIVIDER\n${info()}\n$DIVIDER\n\n")
        try {
            context.startActivity(Intent(Intent.ACTION_SENDTO, Uri.parse("mailto:$EMAIL?subject=$subject&body=$body")))
        } catch (_: ActivityNotFoundException) {
            copy(EMAIL)
        }
    }

    private companion object {
        const val EMAIL = "bugged@vadiole.me"
        const val PLAY_URL = "https://play.google.com/store/apps/details?id=vadiole.bugged"
        const val PRIVACY_URL = "https://vadiole.me/bugged/privacy-policy"
        const val AUTHOR_URL = "https://vadiole.me"
        const val DIVIDER = "— — — — — — — —"
    }
}
