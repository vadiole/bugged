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
