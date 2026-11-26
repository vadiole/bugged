package vadiole.bugged.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.InsetDrawable
import android.graphics.drawable.StateListDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.TextView
import vadiole.bugged.R

private fun Sheet.header(colors: Colors, into: LinearLayout, icon: Int, title: Int, vararg paragraphs: Int) {
    into.setPadding(dp(24), 0, dp(24), dp(16))
    into.addView(Badge(context, icon, colors.primaryContainer, colors.onPrimaryContainer), linear(dp(64), dp(64)))
    val heading = text(context, Type.headlineMedium.emphasized(), colors.onSurface, title)
    heading.isAccessibilityHeading = true
    into.addView(heading, linear(top = dp(16)))
    for (paragraph in paragraphs) {
        into.addView(text(context, Type.bodyMedium, colors.onSurfaceVariant, paragraph), linear(top = dp(12)))
    }
}

private fun Sheet.actions(colors: Colors, into: LinearLayout, label: Int, onClick: () -> Unit) {
    val primary = ActionButton(context, colors, ActionButton.Kind.Filled, true, label)
    primary.setOnClickListener { onClick() }
    into.addView(primary, linear(top = dp(24)))
    val later = ActionButton(context, colors, ActionButton.Kind.Text, true, R.string.not_now)
    later.setOnClickListener { dismiss() }
    into.addView(later, linear(top = dp(4)))
}

class CopySheet(context: Context, host: Host) : Sheet(context, host.colors, R.string.copy_sheet_title) {
    init {
        header(colors, content, R.drawable.ic_content_copy, R.string.copy_sheet_title, R.string.copy_sheet_what, R.string.copy_sheet_access)
        val name = context.getString(R.string.app_name)
        val steps = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = RoundDrawable(colors.surfaceContainerHigh, dp(20f))
            setPadding(dp(16), dp(14), dp(16), dp(14))
            addView(step(1, context.withBold(R.string.copy_sheet_step_1, name)), linear())
            addView(step(2, context.withBold(R.string.copy_sheet_step_2, context.getString(R.string.copy_sheet_switch, name))), linear(top = dp(8)))
        }
        content.addView(steps, linear(top = dp(16)))
        if (host.setup.restricted()) {
            val note = text(context, Type.bodySmall, colors.onSurfaceVariant)
            note.text = context.withBold(R.string.copy_sheet_restricted, context.getString(R.string.copy_sheet_allow))
            content.addView(note, linear(top = dp(12)))
        }
        actions(colors, content, R.string.copy_sheet_action) { host.openAccessibility() }
    }

    private fun step(number: Int, label: CharSequence) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        val index = text(context, Type.bodySmall.emphasized(), colors.onPrimary).apply {
            text = String.format(resources.configuration.locales[0], "%d", number)
            gravity = Gravity.CENTER
            textAlignment = View.TEXT_ALIGNMENT_CENTER
            setPadding(0, 0, 0, 0)
            background = RoundDrawable(colors.primary, dp(10f))
            importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val size = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 20f, resources.displayMetrics).toInt()
        (index.background as RoundDrawable).radius = size / 2f
        addView(index, linear(size, size, end = dp(12)))
        val line: TextView = text(context, Type.bodyMedium, colors.onSurface)
        line.text = label
        addView(line, linear(0, WRAP_CONTENT, weight = 1f))
    }
}

class OpenSheet(context: Context, private val host: Host) : Sheet(context, host.colors, R.string.open_sheet_title) {
    private val label = text(context, Type.bodyMedium, colors.onSurface)
    private val change = ActionButton(context, colors, ActionButton.Kind.Tonal, false, R.string.change)

    init {
        host.browsers.remember()
        header(colors, content, R.drawable.ic_open_in_new, R.string.open_sheet_title, R.string.open_sheet_what, R.string.open_sheet_never)
        change.setOnClickListener { host.go(Route.Browser) }
        change.contentDescription = context.getString(R.string.change_browser)
        content.addView(browserRow(label, change, colors.surfaceContainerHigh), linear(top = dp(20)))
        actions(colors, content, R.string.open_sheet_action) { host.requestBrowser() }
    }

    override fun refresh() {
        val all = host.browsers.all()
        val selected = host.browsers.selected(all)
        label.text = if (selected == null) {
            context.getString(R.string.browser_none)
        } else {
            context.withBold(R.string.open_sheet_browser, selected.label)
        }
        change.visibility = if (all.size > 1) View.VISIBLE else View.GONE
    }
}

class BrowserSheet(context: Context, host: Host) : Sheet(context, host.colors, R.string.browser_title) {
    init {
        val heading = text(context, Type.titleLarge.emphasized(), colors.onSurface, R.string.browser_title)
        heading.isAccessibilityHeading = true
        content.setPadding(0, 0, 0, dp(16))
        content.addView(heading, linear(start = dp(24), end = dp(24), bottom = dp(8)))
        val all = host.browsers.all()
        val selected = host.browsers.selected(all)?.packageName
        val rtl = resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL
        val side = dp(24)
        val marks = StateListDrawable().apply {
            addState(intArrayOf(android.R.attr.state_checked), context.getDrawable(R.drawable.ic_radio_button_checked))
            addState(intArrayOf(), context.getDrawable(R.drawable.ic_radio_button_unchecked))
        }
        val tints = ColorStateList(
            arrayOf(intArrayOf(android.R.attr.state_checked), intArrayOf()),
            intArrayOf(colors.primary, colors.onSurfaceVariant),
        )
        for (browser in all) {
            val option = RadioButton(context, null, 0).apply {
                style(Type.bodyLarge)
                setTextColor(colors.onSurface)
                text = browser.label
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
                buttonDrawable = InsetDrawable(marks.constantState!!.newDrawable().mutate(), if (rtl) 0 else side, 0, if (rtl) side else 0, 0)
                buttonTintList = tints
                gravity = Gravity.CENTER_VERTICAL
                minHeight = dp(56)
                minimumHeight = dp(56)
                setPaddingRelative(dp(16), 0, dp(24), 0)
                isChecked = browser.packageName == selected
                background = ripple(colors.onSurface, null, ColorDrawable(Color.WHITE))
                setOnClickListener {
                    host.browsers.select(browser)
                    dismiss()
                }
            }
            content.addView(option, linear())
        }
    }
}
