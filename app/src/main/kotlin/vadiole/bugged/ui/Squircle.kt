package vadiole.bugged.ui

import android.graphics.Path
import android.graphics.RectF
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.tan

internal fun Path.addSquircle(rect: RectF, radius: Float) {
    addSquircle(rect, radius, radius)
}

internal fun Path.addSquircle(rect: RectF, top: Float, bottom: Float, smoothing: Float = 0.6f) {
    addSquircle(rect.left, rect.top, rect.right, rect.bottom, top, top, bottom, bottom, smoothing)
}

private fun Path.addSquircle(
    left: Float,
    top: Float,
    right: Float,
    bottom: Float,
    topLeft: Float,
    topRight: Float,
    bottomRight: Float,
    bottomLeft: Float,
    smoothing: Float,
) {
    require(smoothing in 0f..1f) { "smoothing must be from 0 to 1" }
    val width = right - left
    val height = bottom - top
    if (width <= 0f || height <= 0f) return
    val tl = topLeft.coerceAtLeast(0f)
    val tr = topRight.coerceAtLeast(0f)
    val br = bottomRight.coerceAtLeast(0f)
    val bl = bottomLeft.coerceAtLeast(0f)
    val scale = minOf(1f, fit(width, tl + tr), fit(height, tr + br), fit(width, br + bl), fit(height, bl + tl))
    val r0 = tl * scale
    val r1 = tr * scale
    val r2 = br * scale
    val r3 = bl * scale
    corner(0, left, top, r0, share(height, r0, r3), share(width, r0, r1), smoothing)
    corner(1, right, top, r1, share(width, r1, r0), share(height, r1, r2), smoothing)
    corner(2, right, bottom, r2, share(height, r2, r1), share(width, r2, r3), smoothing)
    corner(3, left, bottom, r3, share(width, r3, r2), share(height, r3, r0), smoothing)
    close()
}

private val IN_X = floatArrayOf(0f, 1f, 0f, -1f)
private val IN_Y = floatArrayOf(-1f, 0f, 1f, 0f)

private fun Path.corner(index: Int, cornerX: Float, cornerY: Float, radius: Float, startBudget: Float, endBudget: Float, smoothing: Float) {
    val ix = IN_X[index]
    val iy = IN_Y[index]
    val r = minOf(radius, startBudget, endBudget)
    if (r <= 0f) {
        if (index == 0) moveTo(cornerX, cornerY) else lineTo(cornerX, cornerY)
        return
    }
    val startSmoothing = min(smoothing, startBudget / r - 1f)
    val endSmoothing = min(smoothing, endBudget / r - 1f)
    val startReach = (1f + startSmoothing) * r
    val endReach = (1f + endSmoothing) * r
    val startAngle = (PI / 4).toFloat() * startSmoothing
    val endAngle = (PI / 4).toFloat() * endSmoothing
    val startX = cornerX - startReach * ix
    val startY = cornerY - startReach * iy
    val endX = cornerX - endReach * iy
    val endY = cornerY + endReach * ix
    if (index == 0) moveTo(startX, startY) else lineTo(startX, startY)
    if (startSmoothing > 0f) {
        val tangent = r * tan(startAngle / 2f)
        val c = tangent * cos(startAngle)
        val d = tangent * sin(startAngle)
        val b = (startReach - c - r + r * sin(startAngle)) / 3f
        val a = 2f * b
        cubicTo(startX + a * ix, startY + a * iy, startX + (a + b) * ix, startY + (a + b) * iy, startX + (a + b + c) * ix - d * iy, startY + (a + b + c) * iy + d * ix)
    }
    val degrees = 180f / PI.toFloat()
    val sweep = 90f - (startAngle + endAngle) * degrees
    if (sweep > 0f) {
        val centerX = cornerX - r * ix - r * iy
        val centerY = cornerY - r * iy + r * ix
        arcTo(centerX - r, centerY - r, centerX + r, centerY + r, 180f + 90f * index + startAngle * degrees, sweep, false)
    }
    if (endSmoothing > 0f) {
        val tangent = r * tan(endAngle / 2f)
        val c = tangent * cos(endAngle)
        val d = tangent * sin(endAngle)
        val b = (endReach - c - r + r * sin(endAngle)) / 3f
        val a = 2f * b
        cubicTo(endX + (a + b) * iy, endY - (a + b) * ix, endX + a * iy, endY - a * ix, endX, endY)
    }
}

private fun fit(side: Float, sum: Float) = if (sum > 0f) side / sum else 1f

private fun share(side: Float, radius: Float, other: Float) = if (radius > 0f) side * radius / (radius + other) else 0f
