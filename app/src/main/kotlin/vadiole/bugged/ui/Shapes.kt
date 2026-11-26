package vadiole.bugged.ui

import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Outline
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.drawable.Drawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

class RoundDrawable(color: Int = Color.WHITE, radius: Float = 0f, private val smooth: Boolean = false) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    private val rect = RectF()
    private val path = Path()
    private val radii = FloatArray(8)

    var color: Int
        get() = paint.color
        set(value) {
            if (paint.color == value) return
            paint.color = value
            invalidateSelf()
        }

    var top = radius
        set(value) {
            if (field == value) return
            field = value
            invalidateSelf()
        }

    var bottom = radius
        set(value) {
            if (field == value) return
            field = value
            invalidateSelf()
        }

    var radius: Float
        get() = top
        set(value) {
            top = value
            bottom = value
        }

    var insetX = 0
    var insetY = 0
    var extendBottom = 0

    override fun onBoundsChange(bounds: Rect) {
        rect.set(
            bounds.left + insetX.toFloat(),
            bounds.top + insetY.toFloat(),
            bounds.right - insetX.toFloat(),
            bounds.bottom - insetY.toFloat() + extendBottom,
        )
    }

    private fun squircle(): Path {
        path.rewind()
        path.addSquircle(rect, top, bottom)
        return path
    }

    override fun draw(canvas: Canvas) {
        if (smooth) {
            canvas.drawPath(squircle(), paint)
            return
        }
        val limit = min(rect.width(), rect.height()) / 2f
        val t = min(top, limit)
        val b = min(bottom, limit)
        if (t == b) {
            canvas.drawRoundRect(rect, t, t, paint)
            return
        }
        radii.fill(t, 0, 4)
        radii.fill(b, 4, 8)
        path.rewind()
        path.addRoundRect(rect, radii, Path.Direction.CW)
        canvas.drawPath(path, paint)
    }

    override fun getOutline(outline: Outline) {
        if (smooth && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            outline.setPath(squircle())
            return
        }
        val limit = min(rect.width(), rect.height()) / 2f
        outline.setRoundRect(rect.left.toInt(), rect.top.toInt(), rect.right.toInt(), rect.bottom.toInt(), min(min(top, bottom), limit))
    }

    override fun setAlpha(alpha: Int) = Unit

    override fun setColorFilter(colorFilter: ColorFilter?) = Unit

    @Deprecated("Deprecated in Java")
    override fun getOpacity() = PixelFormat.TRANSLUCENT
}

class CookieDrawable(color: Int) : Drawable() {
    private val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }
    private val path = Path()

    var color: Int
        get() = paint.color
        set(value) {
            if (paint.color == value) return
            paint.color = value
            invalidateSelf()
        }

    var rotation = 0f
        set(value) {
            field = value
            invalidateSelf()
        }

    override fun onBoundsChange(bounds: Rect) {
        val size = min(bounds.width(), bounds.height()) / 2f
        path.rewind()
        for (step in 0 until STEPS) {
            val angle = step.toFloat() / STEPS * 2f * PI.toFloat()
            val reach = size * (1f - DEPTH + DEPTH * cos(angle * POINTS))
            val x = bounds.exactCenterX() + reach * cos(angle)
            val y = bounds.exactCenterY() + reach * sin(angle)
            if (step == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        path.close()
    }

    override fun draw(canvas: Canvas) {
        if (rotation == 0f) {
            canvas.drawPath(path, paint)
            return
        }
        val save = canvas.save()
        canvas.rotate(rotation, bounds.exactCenterX(), bounds.exactCenterY())
        canvas.drawPath(path, paint)
        canvas.restoreToCount(save)
    }

    override fun setAlpha(alpha: Int) = Unit

    override fun setColorFilter(colorFilter: ColorFilter?) = Unit

    @Deprecated("Deprecated in Java")
    override fun getOpacity() = PixelFormat.TRANSLUCENT

    private companion object {
        const val STEPS = 360
        const val POINTS = 9
        const val DEPTH = 0.07f
    }
}

// https://m3.material.io/foundations/interaction/states/state-layers
fun ripple(content: Int, shape: Drawable?, mask: Drawable? = null) = RippleDrawable(
    ColorStateList.valueOf(Color.argb(0x1A, Color.red(content), Color.green(content), Color.blue(content))),
    shape,
    mask,
)

fun mixColor(from: Int, to: Int, fraction: Float): Int = Color.argb(
    lerp(Color.alpha(from).toFloat(), Color.alpha(to).toFloat(), fraction).toInt(),
    lerp(Color.red(from).toFloat(), Color.red(to).toFloat(), fraction).toInt(),
    lerp(Color.green(from).toFloat(), Color.green(to).toFloat(), fraction).toInt(),
    lerp(Color.blue(from).toFloat(), Color.blue(to).toFloat(), fraction).toInt(),
)
