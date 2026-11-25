package vadiole.bugged

import android.app.Activity
import android.app.AlertDialog
import android.app.role.RoleManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowInsets
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var clipboardState: TextView
    private lateinit var linksState: TextView
    private lateinit var browserState: TextView
    private lateinit var browserRow: ViewGroup

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val content = object : LinearLayout(this) {
            override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                val max = dp(MAX_CONTENT_WIDTH)
                val capped = if (MeasureSpec.getSize(widthMeasureSpec) > max) {
                    MeasureSpec.makeMeasureSpec(max, MeasureSpec.EXACTLY)
                } else {
                    widthMeasureSpec
                }
                super.onMeasure(capped, heightMeasureSpec)
            }
        }.apply {
            orientation = LinearLayout.VERTICAL
        }
        val title = text(R.string.app_name, 34f, android.R.attr.textColorPrimary).apply {
            typeface = Typeface.DEFAULT_BOLD
            isAccessibilityHeading = true
        }
        content.addView(title, column(top = 40))
        content.addView(text(R.string.app_description, 16f, android.R.attr.textColorSecondary), column(top = 8, bottom = 24))
        clipboardState = state()
        linksState = state()
        browserState = state()
        content.row(R.string.clipboard_title, clipboardState, R.string.clipboard_description, R.string.clipboard_action) {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }
        content.row(R.string.links_title, linksState, R.string.links_description, R.string.links_action, ::askForLinks)
        browserRow = content.row(R.string.browser_title, browserState, R.string.browser_description, R.string.browser_action, ::pickBrowser)

        val scroll = object : ScrollView(this) {
            override fun shouldDelayChildPressedState() = false
        }.apply {
            id = R.id.scroll
            isVerticalScrollBarEnabled = false
            isFocusable = false
            addView(content, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
            setOnApplyWindowInsetsListener { view, insets ->
                val bars = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                } else {
                    @Suppress("DEPRECATION")
                    insets.systemWindowInsets
                }
                view.setPadding(bars.left, bars.top, bars.right, 0)
                content.setPadding(0, 0, 0, bars.bottom + dp(16))
                insets
            }
        }
        setContentView(scroll)
    }

    override fun onResume() {
        super.onResume()
        refresh()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) App.instance.cleanClipboard()
    }

    private fun refresh() {
        clipboardState.setText(if (clipboardEnabled()) R.string.on else R.string.off)
        linksState.setText(if (linksEnabled()) R.string.on else R.string.off)
        val browsers = App.instance.browsers
        val selected = browsers.selected()
        browserState.text = selected?.label ?: getString(R.string.browser_none)
        browserRow.enable(selected != null)
    }

    private fun clipboardEnabled(): Boolean {
        val enabled = Settings.Secure.getString(contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        val service = ComponentName(this, ClipboardService::class.java)
        return enabled.orEmpty().split(':').any { ComponentName.unflattenFromString(it) == service }
    }

    private fun linksEnabled() = getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_BROWSER)

    private fun askForLinks() {
        val roles = getSystemService(RoleManager::class.java)
        if (roles.isRoleAvailable(RoleManager.ROLE_BROWSER) && !roles.isRoleHeld(RoleManager.ROLE_BROWSER)) {
            @Suppress("DEPRECATION")
            startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_BROWSER), 0)
        } else {
            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        }
    }

    private fun pickBrowser() {
        val browsers = App.instance.browsers
        val all = browsers.all()
        if (all.isEmpty()) return
        val current = all.indexOfFirst { it.packageName == browsers.selected()?.packageName }
        AlertDialog.Builder(this)
            .setTitle(R.string.browser_title)
            .setSingleChoiceItems(all.map { it.label }.toTypedArray(), current) { dialog, which ->
                browsers.select(all[which])
                refresh()
                dialog.dismiss()
            }
            .show()
    }

    private fun LinearLayout.row(title: Int, state: TextView, description: Int, action: Int, onClick: () -> Unit): ViewGroup {
        val row = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPaddingRelative(dp(24), dp(14), dp(24), dp(14))
            minimumHeight = dp(56)
            gravity = Gravity.CENTER_VERTICAL
            addView(TitleLine(context, text(title, 18f, android.R.attr.textColorPrimary), state, dp(16)), MATCH_PARENT, WRAP_CONTENT)
            addView(
                text(description, 14f, android.R.attr.textColorSecondary),
                LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply { topMargin = dp(4) },
            )
            setBackgroundResource(resolve(android.R.attr.selectableItemBackground))
            setOnClickListener { onClick() }
            accessibilityDelegate = object : View.AccessibilityDelegate() {
                override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
                    super.onInitializeAccessibilityNodeInfo(host, info)
                    if (host.isEnabled) info.addAction(AccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, getString(action)))
                }
            }
        }
        addView(row, MATCH_PARENT, WRAP_CONTENT)
        return row
    }

    private fun View.enable(enabled: Boolean) {
        isEnabled = enabled
        if (this is ViewGroup) for (index in 0 until childCount) getChildAt(index).enable(enabled)
    }

    private fun state() = text(0, 16f, android.R.attr.textColorSecondary)

    private fun text(resource: Int, size: Float, color: Int) = TextView(this).apply {
        if (resource != 0) setText(resource)
        textSize = size
        setTextColor(getColorStateList(resolve(color)))
    }

    private fun column(top: Int = 0, bottom: Int = 0) = LinearLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT).apply {
        marginStart = dp(24)
        marginEnd = dp(24)
        topMargin = dp(top)
        bottomMargin = dp(bottom)
    }

    private fun resolve(attribute: Int) = TypedValue().also { theme.resolveAttribute(attribute, it, true) }.resourceId

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()

    private class TitleLine(context: Context, private val title: TextView, private val value: TextView, private val gap: Int) : ViewGroup(context) {
        private var stacked = false

        init {
            addView(title)
            addView(value)
        }

        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val width = MeasureSpec.getSize(widthMeasureSpec)
            val unbounded = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
            title.measure(unbounded, unbounded)
            value.measure(unbounded, unbounded)
            stacked = title.measuredWidth + gap + value.measuredWidth > width
            val height = if (stacked) {
                val loose = MeasureSpec.makeMeasureSpec(width, MeasureSpec.AT_MOST)
                title.measure(loose, unbounded)
                value.measure(loose, unbounded)
                title.measuredHeight + value.measuredHeight
            } else {
                val ascent = maxOf(title.baseline, value.baseline)
                maxOf(ascent - title.baseline + title.measuredHeight, ascent - value.baseline + value.measuredHeight)
            }
            setMeasuredDimension(width, height)
        }

        override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
            val width = r - l
            val rtl = layoutDirection == LAYOUT_DIRECTION_RTL
            if (stacked) {
                place(title, if (rtl) width - title.measuredWidth else 0, 0)
                place(value, if (rtl) width - value.measuredWidth else 0, title.measuredHeight)
            } else {
                val ascent = maxOf(title.baseline, value.baseline)
                place(title, if (rtl) width - title.measuredWidth else 0, ascent - title.baseline)
                place(value, if (rtl) 0 else width - value.measuredWidth, ascent - value.baseline)
            }
        }

        private fun place(view: View, x: Int, y: Int) = view.layout(x, y, x + view.measuredWidth, y + view.measuredHeight)
    }

    private companion object {
        const val MAX_CONTENT_WIDTH = 560
    }
}
