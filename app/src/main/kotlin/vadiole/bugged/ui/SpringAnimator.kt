package vadiole.bugged.ui

import android.view.Choreographer
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.sin
import kotlin.math.sqrt

class SpringAnimator(
    stiffness: Float,
    dampingRatio: Float = 1f,
    val minVisibleChange: Float = 1f,
    value: Float = 0f,
    var onUpdate: UpdateListener? = null,
    var onEnd: EndListener? = null,
) : Choreographer.FrameCallback {

    fun interface UpdateListener {
        fun onSpringUpdate(value: Float)
    }

    fun interface EndListener {
        fun onSpringEnd(canceled: Boolean)
    }

    var stiffness = stiffness
        set(value) {
            require(value > 0f)
            field = value
            prepared = false
        }
    var dampingRatio = dampingRatio
        set(value) {
            require(value > 0f)
            field = value
            prepared = false
        }
    var min = -Float.MAX_VALUE
    var max = Float.MAX_VALUE
    var target = value

    var value: Float
        get() = position.toFloat()
        set(value) {
            position = value.toDouble()
        }
    var velocity: Float
        get() = speed.toFloat()
        set(value) {
            speed = value.toDouble()
        }
    var isRunning = false
        private set

    private var position = value.toDouble()
    private var speed = 0.0
    private var run = 0
    private var lastFrameNanos = NO_FRAME
    private var framePending = false
    private var prepared = false
    private var omega = 0.0
    private var zeta = 0.0
    private var dampedOmega = 0.0
    private var gammaPlus = 0.0
    private var gammaMinus = 0.0

    init {
        require(stiffness > 0f)
        require(dampingRatio > 0f)
        require(minVisibleChange > 0f)
    }

    fun animateTo(target: Float) {
        this.target = target
        if (isRunning) return
        isRunning = true
        run++
        lastFrameNanos = NO_FRAME
        requestFrame()
    }

    fun snapTo(target: Float) {
        cancel()
        this.target = target
        position = target.toDouble()
        speed = 0.0
    }

    fun cancel() {
        if (!isRunning) return
        stop()
        speed = 0.0
        onEnd?.onSpringEnd(true)
    }

    override fun doFrame(frameTimeNanos: Long) {
        framePending = false
        if (!isRunning) return
        val last = lastFrameNanos
        lastFrameNanos = frameTimeNanos
        val durationScale = animatorDurationScale
        if (durationScale <= 0f) {
            position = target.toDouble()
            speed = 0.0
        } else if (last != NO_FRAME && frameTimeNanos > last) {
            advance(minOf((frameTimeNanos - last) / 1e9, MAX_STEP) / durationScale)
        }
        val run = run
        onUpdate?.onSpringUpdate(position.toFloat())
        if (run != this.run) return
        if (speed == 0.0 && position == target.toDouble()) {
            stop()
            onEnd?.onSpringEnd(false)
        } else {
            requestFrame()
        }
    }

    private fun advance(seconds: Double) {
        prepare()
        val end = target.toDouble()
        val x0 = position - end
        val v0 = speed
        val x: Double
        val v: Double
        if (zeta > 1.0) {
            val b = (gammaMinus * x0 - v0) / (gammaMinus - gammaPlus)
            val a = x0 - b
            val decayMinus = exp(gammaMinus * seconds)
            val decayPlus = exp(gammaPlus * seconds)
            x = a * decayMinus + b * decayPlus
            v = a * gammaMinus * decayMinus + b * gammaPlus * decayPlus
        } else if (zeta == 1.0) {
            val b = v0 + omega * x0
            val decay = exp(-omega * seconds)
            x = (x0 + b * seconds) * decay
            v = b * decay - omega * x
        } else {
            val b = (zeta * omega * x0 + v0) / dampedOmega
            val decay = exp(-zeta * omega * seconds)
            val c = cos(dampedOmega * seconds)
            val s = sin(dampedOmega * seconds)
            x = decay * (x0 * c + b * s)
            v = -zeta * omega * x + decay * dampedOmega * (b * c - x0 * s)
        }
        position = (x + end).coerceIn(min.toDouble(), max.toDouble())
        speed = v
        val valueThreshold = minVisibleChange * THRESHOLD_MULTIPLIER
        if (abs(speed) < valueThreshold * VELOCITY_THRESHOLD_MULTIPLIER && abs(position - end) < valueThreshold) {
            position = end
            speed = 0.0
        }
    }

    private fun prepare() {
        if (prepared) return
        omega = sqrt(stiffness.toDouble())
        zeta = dampingRatio.toDouble()
        if (zeta > 1.0) {
            val root = omega * sqrt(zeta * zeta - 1.0)
            gammaPlus = -zeta * omega + root
            gammaMinus = -zeta * omega - root
        } else if (zeta < 1.0) {
            dampedOmega = omega * sqrt(1.0 - zeta * zeta)
        }
        prepared = true
    }

    private fun requestFrame() {
        if (framePending) return
        framePending = true
        Choreographer.getInstance().postFrameCallback(this)
    }

    private fun stop() {
        isRunning = false
        run++
    }

    private companion object {
        const val NO_FRAME = Long.MIN_VALUE
        const val MAX_STEP = 1.0 / 30.0
        const val THRESHOLD_MULTIPLIER = 0.75
        const val VELOCITY_THRESHOLD_MULTIPLIER = 62.5
    }
}
