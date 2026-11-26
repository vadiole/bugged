package vadiole.bugged.ui

import android.content.Context
import android.graphics.Canvas
import android.graphics.Path
import android.graphics.RectF
import android.graphics.drawable.AdaptiveIconDrawable
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import vadiole.bugged.R

class Column(context: Context) : LinearLayout(context) {
    init {
        orientation = VERTICAL
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val limit = dp(MAX_WIDTH)
        val width = if (MeasureSpec.getSize(widthMeasureSpec) > limit) {
            MeasureSpec.makeMeasureSpec(limit, MeasureSpec.EXACTLY)
        } else {
            widthMeasureSpec
        }
        super.onMeasure(width, heightMeasureSpec)
    }

    private companion object {
        const val MAX_WIDTH = 560
    }
}

class Scroller(context: Context, child: View) : ScrollView(context) {
    init {
        id = R.id.scroll
        isVerticalScrollBarEnabled = false
        isFocusable = false
        clipToPadding = false
        addView(child, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.CENTER_HORIZONTAL))
    }

    override fun shouldDelayChildPressedState() = false
}

class AppIcon(context: Context) : View(context) {
    private val icon = context.getDrawable(R.mipmap.ic_launcher) as? AdaptiveIconDrawable
    private val path = Path()
    private val rect = RectF()

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        rect.set(0f, 0f, w.toFloat(), h.toFloat())
        path.rewind()
        path.addSquircle(rect, w * 0.25f)
        icon?.background?.setBounds(-w / 4, -h / 4, w * 5 / 4, h * 5 / 4)
        icon?.foreground?.setBounds(-w / 4, -h / 4, w * 5 / 4, h * 5 / 4)
    }

    override fun onDraw(canvas: Canvas) {
        val save = canvas.save()
        canvas.clipPath(path)
        icon?.background?.draw(canvas)
        icon?.foreground?.draw(canvas)
        canvas.restoreToCount(save)
    }
}

fun browserRow(label: View, change: View, fill: Int) = Split(label.context, label, change, label.dp(8)).apply {
    minimumHeight = dp(52)
    background = RoundDrawable(fill, dp(20f))
    setPaddingRelative(dp(16), dp(2), dp(6), dp(2))
}

class Split(context: Context, private val lead: View, private val trail: View, private val gap: Int) : android.view.ViewGroup(context) {
    private var stacked = false

    init {
        addView(lead)
        addView(trail)
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val width = MeasureSpec.getSize(widthMeasureSpec)
        val inner = width - paddingLeft - paddingRight
        val free = MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED)
        val most = MeasureSpec.makeMeasureSpec(inner, MeasureSpec.AT_MOST)
        val shown = trail.visibility != GONE
        if (shown) trail.measure(most, free)
        val trailWidth = if (shown) trail.measuredWidth + gap else 0
        lead.measure(free, free)
        stacked = shown && lead.measuredWidth + trailWidth > inner && trail.measuredWidth > inner / 2
        val room = if (stacked) inner else (inner - trailWidth).coerceAtLeast(0)
        lead.measure(MeasureSpec.makeMeasureSpec(room, MeasureSpec.AT_MOST), free)
        val content = when {
            !shown -> lead.measuredHeight
            stacked -> lead.measuredHeight + gap + trail.measuredHeight
            else -> maxOf(lead.measuredHeight, trail.measuredHeight)
        }
        setMeasuredDimension(width, maxOf(content + paddingTop + paddingBottom, suggestedMinimumHeight))
    }

    override fun onLayout(changed: Boolean, l: Int, t: Int, r: Int, b: Int) {
        val rtl = layoutDirection == LAYOUT_DIRECTION_RTL
        val left = paddingLeft
        val right = r - l - paddingRight
        val top = paddingTop
        val bottom = b - t - paddingBottom
        if (stacked) {
            val start = top + (bottom - top - lead.measuredHeight - gap - trail.measuredHeight) / 2
            place(lead, if (rtl) right - lead.measuredWidth else left, start)
            place(trail, if (rtl) left else right - trail.measuredWidth, start + lead.measuredHeight + gap)
        } else {
            place(lead, if (rtl) right - lead.measuredWidth else left, top + (bottom - top - lead.measuredHeight) / 2)
            if (trail.visibility != GONE) {
                place(trail, if (rtl) left else right - trail.measuredWidth, top + (bottom - top - trail.measuredHeight) / 2)
            }
        }
    }

    private fun place(view: View, x: Int, y: Int) = view.layout(x, y, x + view.measuredWidth, y + view.measuredHeight)
}
