package vadiole.bugged.ui

import android.content.Context
import android.graphics.Color
import android.os.Build
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import vadiole.bugged.R
import java.text.NumberFormat

class HomeScreen(context: Context, private val host: Host) : Screen(context, host.colors, R.string.app_name) {
    private val colors = host.colors
    private val headline = text(context, Type.displaySmall.emphasized(), colors.onSurface).apply { isAccessibilityHeading = true }
    private val status = text(context, Type.bodyLarge, colors.onSurfaceVariant)
    private val copy = FeatureCard(
        context,
        colors,
        R.drawable.ic_content_copy,
        R.string.copy_title,
        R.string.copy_description,
        { host.go(Route.Copy) },
        { host.turnOffCopy() },
    )
    private val open = FeatureCard(
        context,
        colors,
        R.drawable.ic_open_in_new,
        R.string.open_title,
        R.string.open_description,
        { host.go(Route.Open) },
        { host.openDefaultApps() },
    )

    init {
        val about = IconButton(context, colors, R.drawable.ic_info, R.string.about)
        about.setOnClickListener { host.go(Route.About) }
        val bar = TopBar(context, colors, R.string.app_name, action = about)
        val column = Column(context)
        column.addView(headline, linear(start = dp(24), end = dp(24), top = dp(12)))
        column.addView(status, linear(start = dp(24), end = dp(24), top = dp(8)))
        column.addView(copy, linear(start = dp(16), end = dp(16), top = dp(24)))
        column.addView(open, linear(start = dp(16), end = dp(16), top = dp(8), bottom = dp(16)))
        open.onChange = { host.go(Route.Browser) }
        val scroll = Scroller(context, column)
        scroll.setOnScrollChangeListener { _, _, y, _, _ -> bar.lift(y > 0) }
        val root = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        root.addView(bar, linear())
        root.addView(scroll, linear(height = 0, weight = 1f))
        addView(root, MATCH_PARENT, MATCH_PARENT)
        scroll.onBars { bars -> scroll.setPadding(bars.left, 0, bars.right, bars.bottom) }
    }

    override fun refresh() {
        val copying = host.setup.copyOn()
        val opening = host.setup.openOn()
        val state = when {
            copying && opening -> R.string.home_both
            copying -> R.string.home_copy
            opening -> R.string.home_open
            else -> R.string.home_choose
        }
        val cleaned = host.setup.cleaned
        if (cleaned > 0L && (copying || opening)) {
            val quantity = cleaned.coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
            headline.text = resources.getQuantityString(R.plurals.home_cleaned, quantity, NumberFormat.getIntegerInstance().format(cleaned))
            status.setText(state)
            status.visibility = View.VISIBLE
        } else {
            headline.setText(state)
            status.visibility = View.GONE
        }
        copy.bind(copying)
        open.bind(opening)
        val browsers = host.browsers.all()
        val selected = host.browsers.selected(browsers)
        open.browser(selected?.let { context.withBold(R.string.open_browser, it.label) }, browsers.size > 1)
    }
}

class FeatureCard(
    context: Context,
    private val colors: Colors,
    icon: Int,
    title: Int,
    description: Int,
    turnOn: () -> Unit,
    turnOff: () -> Unit,
) : LinearLayout(context) {
    var onChange: () -> Unit = {}

    private val shape = RoundDrawable(colors.surfaceContainer, dp(28f))
    private val badge = Badge(context, icon, colors.surfaceContainerHighest, colors.onSurfaceVariant)
    private val heading = text(context, Type.titleLarge.emphasized(), colors.onSurface, title)
    private val detail = text(context, Type.bodyMedium, colors.onSurfaceVariant, description)
    private val state = text(context, Type.labelLarge.emphasized(), colors.onSurfaceVariant)
    private val check = context.getDrawable(R.drawable.ic_check_circle)!!.mutate()
    private val on = ActionButton(context, colors, ActionButton.Kind.Filled, false, R.string.turn_on)
    private val off = ActionButton(context, colors, ActionButton.Kind.Text, false, R.string.turn_off)
    private val browserLabel = text(context, Type.bodyMedium, colors.onPrimaryContainer)
    private val change = ActionButton(context, colors, ActionButton.Kind.Tonal, false, R.string.change)
    private val browserRow = browserRow(
        browserLabel,
        change,
        Color.argb(140, Color.red(colors.surface), Color.green(colors.surface), Color.blue(colors.surface)),
    )
    private val browser = Reveal(context, browserRow, dp(14))
    private var active: Boolean? = null
    private var hasBrowser = false
    private var missing = false
    private val fade = Motion.effectsSlow.animator(0.01f) { paint(it) }

    init {
        orientation = VERTICAL
        background = shape
        setPadding(dp(20), dp(20), dp(20), dp(16))
        val name = context.getString(title)
        on.contentDescription = context.getString(R.string.turn_on_feature, name)
        off.contentDescription = context.getString(R.string.turn_off_feature, name)
        change.contentDescription = context.getString(R.string.change_browser)
        heading.isAccessibilityHeading = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) state.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
        on.setOnClickListener { turnOn() }
        off.setOnClickListener { turnOff() }
        off.tint(Color.TRANSPARENT, colors.onPrimaryContainer)
        change.setOnClickListener { onChange() }
        check.setTint(colors.onPrimaryContainer)
        check.setBounds(0, 0, dp(18), dp(18))
        state.compoundDrawablePadding = dp(6)
        state.gravity = Gravity.CENTER_VERTICAL

        val head = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(badge, linear(dp(48), dp(48), end = dp(14)))
            addView(heading, linear(0, WRAP_CONTENT, weight = 1f))
        }
        addView(head, linear())
        addView(detail, linear(top = dp(10)))

        addView(browser, linear())

        val buttons = FrameLayout(context).apply {
            addView(on, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.END))
            addView(off, FrameLayout.LayoutParams(WRAP_CONTENT, WRAP_CONTENT, Gravity.END))
        }
        addView(Split(context, state, buttons, dp(8)), linear(top = dp(12)))
    }

    fun bind(value: Boolean) {
        if (active == value) return
        val animate = active != null && isLaidOut && isShown
        active = value
        state.setText(if (value) R.string.on else R.string.off)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) heading.stateDescription = state.text
        state.setCompoundDrawablesRelative(if (value) check else null, null, null, null)
        browser.show(rowShown(), animate)
        if (animate) fade.animateTo(if (value) 1f else 0f) else {
            fade.snapTo(if (value) 1f else 0f)
            paint(if (value) 1f else 0f)
        }
    }

    private fun paint(mix: Float) {
        val muted = mixColor(colors.onSurfaceVariant, colors.onPrimaryContainer, mix)
        shape.color = mixColor(colors.surfaceContainer, colors.primaryContainer, mix)
        badge.tint(mixColor(colors.surfaceContainerHighest, colors.primary, mix), mixColor(colors.onSurfaceVariant, colors.onPrimary, mix))
        heading.setTextColor(mixColor(colors.onSurface, colors.onPrimaryContainer, mix))
        detail.setTextColor(muted)
        detail.alpha = lerp(1f, 0.8f, mix)
        state.setTextColor(muted)
        browserLabel.setTextColor(muted)
        on.alpha = 1f - mix
        off.alpha = mix
        on.isClickable = mix < 0.5f
        off.isClickable = mix >= 0.5f
        on.visibility = if (mix < 1f) View.VISIBLE else View.GONE
        off.visibility = if (mix > 0f) View.VISIBLE else View.GONE
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        val settled = if (active == true) 1f else 0f
        fade.snapTo(settled)
        paint(settled)
    }

    fun browser(label: CharSequence?, choice: Boolean) {
        hasBrowser = label != null
        missing = label == null
        if (missing) browserLabel.setText(R.string.browser_none) else browserLabel.text = label
        change.visibility = if (choice) View.VISIBLE else View.GONE
        on.isEnabled = !missing
        browser.show(rowShown(), isLaidOut && isShown)
    }

    private fun rowShown() = missing || active == true && hasBrowser
}
