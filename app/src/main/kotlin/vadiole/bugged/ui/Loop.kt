package vadiole.bugged.ui

import android.animation.ValueAnimator
import android.view.animation.LinearInterpolator

class Loop(millis: Long, private val onFrame: (Float) -> Unit) {
    private val animator = ValueAnimator.ofFloat(0f, 1f).apply {
        duration = millis
        interpolator = LinearInterpolator()
        repeatCount = ValueAnimator.INFINITE
        addUpdateListener { onFrame(it.animatedValue as Float) }
    }

    fun run(visible: Boolean) {
        if (!visible || !animatorsEnabled) {
            animator.cancel()
        } else if (!animator.isStarted) {
            animator.start()
        }
    }
}
