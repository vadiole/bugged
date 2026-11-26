package vadiole.bugged.ui

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Insets
import android.os.Build
import android.view.View
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.view.WindowInsets
import android.widget.LinearLayout
import kotlin.math.roundToInt

internal val animatorDurationScale: Float
    get() = when {
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> ValueAnimator.getDurationScale()
        ValueAnimator.areAnimatorsEnabled() -> 1f
        else -> 0f
    }

internal val animatorsEnabled: Boolean
    get() = ValueAnimator.areAnimatorsEnabled()

internal fun Context.dp(value: Float): Float = value * resources.displayMetrics.density

internal fun Context.dp(value: Int): Int = (value * resources.displayMetrics.density).roundToInt()

internal fun View.dp(value: Float): Float = context.dp(value)

internal fun View.dp(value: Int): Int = context.dp(value)

internal fun WindowInsets.bars(): Insets = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
    getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
} else {
    @Suppress("DEPRECATION")
    systemWindowInsets
}

internal fun View.onBars(apply: (Insets) -> Unit) {
    setOnApplyWindowInsetsListener { _, insets ->
        apply(insets.bars())
        insets
    }
    if (isAttachedToWindow) requestApplyInsets()
    addOnAttachStateChangeListener(object : View.OnAttachStateChangeListener {
        override fun onViewAttachedToWindow(view: View) = view.requestApplyInsets()

        override fun onViewDetachedFromWindow(view: View) = Unit
    })
}

internal fun linear(
    width: Int = MATCH_PARENT,
    height: Int = WRAP_CONTENT,
    weight: Float = 0f,
    gravity: Int = -1,
    start: Int = 0,
    top: Int = 0,
    end: Int = 0,
    bottom: Int = 0,
) = LinearLayout.LayoutParams(width, height, weight).apply {
    this.gravity = gravity
    marginStart = start
    marginEnd = end
    topMargin = top
    bottomMargin = bottom
}

internal fun lerp(from: Float, to: Float, fraction: Float) = from + (to - from) * fraction
