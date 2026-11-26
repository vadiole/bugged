package vadiole.bugged.ui

import android.annotation.SuppressLint
import android.content.Context
import android.view.Gravity
import android.view.MotionEvent
import android.view.VelocityTracker
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.animation.PathInterpolator
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import vadiole.bugged.R
import kotlin.math.abs
import kotlin.math.min

// https://m3.material.io/components/bottom-sheets/specs
abstract class Sheet(context: Context, protected val colors: Colors, title: Int) : Destination(context) {
    var dismiss: () -> Unit = {}

    protected val content = LinearLayout(context).apply { orientation = LinearLayout.VERTICAL }

    private val scrim = View(context).apply {
        setBackgroundColor(colors.scrim)
        contentDescription = context.getString(R.string.close)
        isFocusable = false
        accessibilityDelegate = ClickLabel(Button::class.java.name, null)
        setOnClickListener { if (alpha >= 0.5f) dismiss() }
    }

    private val scroll = object : ScrollView(context) {
        override fun shouldDelayChildPressedState() = false
    }.apply {
        id = R.id.scroll
        isVerticalScrollBarEnabled = false
        isNestedScrollingEnabled = true
        clipToPadding = false
        addView(content, MATCH_PARENT, WRAP_CONTENT)
    }

    private val handle = View(context).apply {
        background = RoundDrawable(colors.onSurfaceVariant, dp(2f)).apply {
            insetY = dp(HANDLE_GAP)
        }
    }

    private val panel = object : LinearLayout(context) {
        override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
            val limit = dp(MAX_WIDTH)
            val width = if (MeasureSpec.getSize(widthMeasureSpec) > limit) {
                MeasureSpec.makeMeasureSpec(limit, MeasureSpec.EXACTLY)
            } else {
                widthMeasureSpec
            }
            super.onMeasure(width, heightMeasureSpec)
        }
    }.apply {
        orientation = LinearLayout.VERTICAL
        isClickable = true
        accessibilityPaneTitle = context.getString(title)
        background = RoundDrawable(colors.surfaceContainerLow).apply {
            top = dp(28f)
            extendBottom = dp(OVERSHOOT)
        }
        addView(handle, linear(dp(32), dp(4 + 2 * HANDLE_GAP), gravity = Gravity.CENTER_HORIZONTAL))
        addView(scroll, linear())
    }

    private val gestureCurve = PathInterpolator(0.1f, 0.1f, 0f, 1f)
    private val slop = ViewConfiguration.get(context).scaledTouchSlop
    private var tracker: VelocityTracker? = null
    private var downX = 0f
    private var downY = 0f
    private var lastY = 0f
    private var grabbed = false
    private var dragging = false
    private var nested = false
    private var closing = false
    private var opening = false
    private var closed: (() -> Unit)? = null
    private var offset = 0f

    private val spring = Motion.spatialDefault.animator(1f) { value ->
        place(value)
        if (closing && value >= panel.height) finish()
    }

    init {
        clipChildren = false
        isClickable = true
        addView(scrim, MATCH_PARENT, MATCH_PARENT)
        addView(panel, LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL))
        onBars { bars ->
            (panel.layoutParams as LayoutParams).topMargin = bars.top + dp(TOP_GAP)
            panel.setPadding(bars.left, 0, bars.right, 0)
            scroll.setPadding(0, 0, 0, bars.bottom)
            panel.requestLayout()
        }
    }

    fun open() {
        scrim.alpha = 0f
        panel.visibility = INVISIBLE
        opening = true
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        if (!opening) return
        opening = false
        panel.visibility = VISIBLE
        if (closing) return
        spring.value = panel.height.toFloat()
        place(spring.value)
        spring.animateTo(0f)
    }

    fun close(onEnd: () -> Unit) {
        closing = true
        closed = onEnd
        if (panel.height == 0 || !isLaidOut) {
            finish()
            return
        }
        spring.value = offset
        spring.animateTo(panel.height.toFloat() + dp(1f))
    }

    fun backProgress(progress: Float) {
        val eased = gestureCurve.getInterpolation(progress)
        val width = panel.width.toFloat().coerceAtLeast(1f)
        val height = panel.height.toFloat().coerceAtLeast(1f)
        panel.animate().cancel()
        panel.pivotX = width / 2f
        panel.pivotY = height
        panel.scaleX = 1f - min(dp(BACK_SHRINK_X), width / 4f) * eased / width
        panel.scaleY = 1f - min(dp(BACK_SHRINK_Y), height / 4f) * eased / height
    }

    fun backCancel() {
        panel.animate().scaleX(1f).scaleY(1f).setDuration(200L).setInterpolator(Motion.emphasized).start()
    }

    private fun finish() {
        if (!closing) return
        val callback = closed
        closed = null
        spring.cancel()
        callback?.invoke()
    }

    private fun place(value: Float) {
        offset = value
        panel.translationY = value
        val height = panel.height
        scrim.alpha = if (height == 0) 1f else (1f - value / height).coerceIn(0f, 1f)
    }

    private fun dragBy(delta: Float) {
        spring.cancel()
        place((offset + delta).coerceAtLeast(0f))
    }

    private fun release(velocity: Float) {
        if (closing) return
        val fast = dp(VELOCITY_THRESHOLD)
        val away = velocity > fast || (velocity > -fast && offset > dp(POSITION_THRESHOLD))
        spring.value = offset
        spring.velocity = velocity
        if (away) dismiss() else spring.animateTo(0f)
    }

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (closing || isLeaving) return true
        return super.dispatchTouchEvent(ev)
    }

    override fun onInterceptTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.x
                downY = event.y
                lastY = event.y
                dragging = false
                grabbed = !closing && event.y >= panel.top + panel.translationY
                tracker?.recycle()
                tracker = VelocityTracker.obtain().also { it.addMovement(event) }
            }
            MotionEvent.ACTION_MOVE -> {
                tracker?.addMovement(event)
                val dy = event.y - downY
                val onHandle = downY < panel.top + panel.translationY + scroll.top
                if (grabbed && !nested && dy > slop && dy > abs(event.x - downX) && (onHandle || !scroll.canScrollVertically(-1))) {
                    dragging = true
                    lastY = event.y
                    parent?.requestDisallowInterceptTouchEvent(true)
                    return true
                }
            }
        }
        return false
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (!dragging) return super.onTouchEvent(event)
        tracker?.addMovement(event)
        when (event.actionMasked) {
            MotionEvent.ACTION_MOVE -> {
                dragBy(event.y - lastY)
                lastY = event.y
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                dragging = false
                val velocity = tracker?.run {
                    computeCurrentVelocity(1000)
                    yVelocity
                } ?: 0f
                tracker?.recycle()
                tracker = null
                release(if (event.actionMasked == MotionEvent.ACTION_UP) velocity else 0f)
            }
        }
        return true
    }

    override fun onStartNestedScroll(child: View, target: View, nestedScrollAxes: Int): Boolean {
        return !closing && nestedScrollAxes and SCROLL_AXIS_VERTICAL != 0
    }

    override fun onNestedScrollAccepted(child: View, target: View, axes: Int) {
        nested = false
    }

    override fun onNestedPreScroll(target: View, dx: Int, dy: Int, consumed: IntArray) {
        if (dragging || offset <= 0f || dy <= 0) return
        val take = min(dy.toFloat(), offset)
        nested = true
        dragBy(-take)
        consumed[1] = take.toInt()
    }

    override fun onNestedScroll(target: View, dxConsumed: Int, dyConsumed: Int, dxUnconsumed: Int, dyUnconsumed: Int) {
        if (dragging || dyUnconsumed >= 0) return
        nested = true
        dragBy(-dyUnconsumed.toFloat())
    }

    override fun onNestedPreFling(target: View, velocityX: Float, velocityY: Float): Boolean {
        if (!nested || offset <= 0f) return false
        nested = false
        release(-velocityY)
        return true
    }

    override fun onStopNestedScroll(target: View) {
        nested = false
        if (!dragging && !closing && offset > 0f && !spring.isRunning) release(0f)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        spring.cancel()
        tracker?.recycle()
        tracker = null
    }

    private companion object {
        const val MAX_WIDTH = 640
        const val TOP_GAP = 56
        const val HANDLE_GAP = 22
        const val OVERSHOOT = 160
        const val BACK_SHRINK_X = 48f
        const val BACK_SHRINK_Y = 24f
        const val VELOCITY_THRESHOLD = 125f
        const val POSITION_THRESHOLD = 56f
    }
}
