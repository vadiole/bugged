package vadiole.bugged.ui

import android.animation.TimeInterpolator
import android.graphics.Path
import android.view.animation.PathInterpolator

class SpringSpec(val stiffness: Float, val damping: Float) {
    fun animator(
        visible: Float,
        value: Float = 0f,
        onEnd: SpringAnimator.EndListener? = null,
        onUpdate: SpringAnimator.UpdateListener,
    ) = SpringAnimator(stiffness, damping, visible, value, onUpdate, onEnd)
}

// https://m3.material.io/styles/motion/overview/specs
object Motion {
    val spatialFast = SpringSpec(800f, 0.6f)
    val spatialDefault = SpringSpec(380f, 0.8f)
    val spatialSlow = SpringSpec(200f, 0.8f)
    val effectsFast = SpringSpec(3800f, 1f)
    val effectsDefault = SpringSpec(1600f, 1f)
    val effectsSlow = SpringSpec(800f, 1f)

    val emphasized: TimeInterpolator = PathInterpolator(
        Path().apply {
            moveTo(0f, 0f)
            cubicTo(0.05f, 0f, 0.133333f, 0.06f, 0.166666f, 0.4f)
            cubicTo(0.208333f, 0.82f, 0.25f, 1f, 1f, 1f)
        },
    )
}
