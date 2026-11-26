package vadiole.bugged.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import vadiole.bugged.R
import kotlin.math.min

class WelcomeScreen(context: Context, host: Host) : Screen(context, host.colors, R.string.welcome_title) {
    init {
        val colors = host.colors
        val content = Column(context)
        content.addView(Hero(context, colors), linear(dp(172), dp(172), start = dp(18), top = dp(12)))
        val title = text(context, Type.displaySmall.emphasized(), colors.onSurface, R.string.welcome_title)
        title.isAccessibilityHeading = true
        content.addView(title, linear(start = dp(24), end = dp(24), top = dp(24)))
        content.addView(
            text(context, Type.bodyLarge, colors.onSurfaceVariant, R.string.welcome_body),
            linear(start = dp(24), end = dp(24), top = dp(12)),
        )
        content.addView(LinkDemo(context, colors), linear(start = dp(24), end = dp(24), top = dp(24)))
        content.addView(fact(colors, R.drawable.ic_wifi_off, R.string.welcome_offline), linear(start = dp(24), end = dp(24), top = dp(20)))
        content.addView(
            fact(colors, R.drawable.ic_toggle_on, R.string.welcome_access),
            linear(start = dp(24), end = dp(24), top = dp(14), bottom = dp(16)),
        )
        val scroll = Scroller(context, content)
        val action = ActionButton(context, colors, ActionButton.Kind.Filled, true, R.string.welcome_action)
        action.setOnClickListener { host.start() }
        val column = Column(context)
        column.addView(action, linear(start = dp(24), end = dp(24), top = dp(8), bottom = dp(16)))
        val fill = ColorDrawable(colors.surface)
        val lift = Motion.effectsDefault.animator(0.01f) { fill.color = mixColor(colors.surface, colors.surfaceContainer, it) }
        val footer = FrameLayout(context).apply {
            background = fill
            addView(column, LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
        }
        val root = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }
        root.addView(scroll, linear(height = 0, weight = 1f))
        root.addView(footer, linear())
        addView(root, MATCH_PARENT, MATCH_PARENT)
        var lifted = false
        scroll.setOnScrollChangeListener { _, _, _, _, _ ->
            lifted = scroll.canScrollVertically(1)
            lift.animateTo(if (lifted) 1f else 0f)
        }
        scroll.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            if (lifted == scroll.canScrollVertically(1)) return@addOnLayoutChangeListener
            lifted = !lifted
            lift.snapTo(if (lifted) 1f else 0f)
            fill.color = if (lifted) colors.surfaceContainer else colors.surface
        }
        onBars { bars ->
            scroll.setPadding(bars.left, 0, bars.right, 0)
            root.setPadding(0, bars.top, 0, 0)
            footer.setPadding(bars.left, 0, bars.right, bars.bottom)
        }
    }

    private fun fact(colors: Colors, icon: Int, label: Int) = LinearLayout(context).apply {
        orientation = LinearLayout.HORIZONTAL
        addView(Icon(context, icon, colors.primary), linear(dp(24), dp(24), end = dp(14)))
        addView(text(context, Type.bodyMedium, colors.onSurface, label), linear(0, WRAP_CONTENT, weight = 1f, top = dp(2)))
    }
}

private class Hero(context: Context, colors: Colors) : FrameLayout(context) {
    private val cookie = View(context).apply {
        background = CookieDrawable(colors.primaryContainer)
        setLayerType(LAYER_TYPE_HARDWARE, null)
    }
    private val spin = Loop(40_000L) { cookie.rotation = it * 360f }

    init {
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        addView(cookie, MATCH_PARENT, MATCH_PARENT)
        addView(AppIcon(context), LayoutParams(dp(104), dp(104), Gravity.CENTER))
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        spin.run(isVisible)
    }
}

private class LinkDemo(context: Context, private val colors: Colors) : View(context) {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        typeface = Typeface.create(Typeface.MONOSPACE, 500, false)
        textSize = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 12f, resources.displayMetrics)
    }
    private val line = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, 20f, resources.displayMetrics)
    private val pill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = colors.errorContainer }
    private val rect = RectF()
    private var shown = 1f
    private val cut = Loop(5_000L) { time ->
        val next = when {
            time < 0.35f -> 1f
            time < 0.5f -> 1f - Motion.emphasized.getInterpolation((time - 0.35f) / 0.15f)
            time < 0.9f -> 0f
            else -> Motion.emphasized.getInterpolation((time - 0.9f) / 0.1f)
        }
        if (next != shown) {
            shown = next
            invalidate()
        }
    }

    init {
        background = RoundDrawable(colors.surfaceContainer, dp(20f))
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(getDefaultSize(suggestedMinimumWidth, widthMeasureSpec), (line + dp(28f)).toInt())
    }

    override fun onDraw(canvas: Canvas) {
        val side = dp(16f)
        val cleanWidth = paint.measureText(CLEAN)
        val junkWidth = paint.measureText(JUNK)
        val scale = min(1f, (width - 2f * side) / (cleanWidth + junkWidth))
        val middle = height / 2f
        val baseline = middle - (paint.descent() + paint.ascent()) / 2f
        val save = canvas.save()
        canvas.translate(side, 0f)
        canvas.scale(scale, scale, 0f, middle)
        paint.color = colors.onSurface
        paint.alpha = 255
        canvas.drawText(CLEAN, 0f, baseline, paint)
        if (shown > 0f) {
            rect.set(cleanWidth, middle - line / 2f, cleanWidth + junkWidth * shown, middle + line / 2f)
            canvas.clipRect(rect)
            pill.alpha = (255 * shown).toInt()
            canvas.drawRoundRect(rect, dp(6f), dp(6f), pill)
            paint.color = colors.onErrorContainer
            paint.alpha = (255 * shown).toInt()
            canvas.drawText(JUNK, cleanWidth, baseline, paint)
        }
        canvas.restoreToCount(save)
    }

    override fun onVisibilityAggregated(isVisible: Boolean) {
        super.onVisibilityAggregated(isVisible)
        cut.run(isVisible)
    }

    private companion object {
        const val CLEAN = "example.com/article"
        const val JUNK = "?utm_source=mail&fbclid=Iw4"
    }
}
