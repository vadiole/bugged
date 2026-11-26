package vadiole.bugged.ui

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.TimeInterpolator
import android.animation.ValueAnimator
import android.graphics.Color
import android.graphics.Outline
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.os.Parcelable
import android.util.SparseArray
import android.view.RoundedCorner
import android.view.View
import android.view.ViewGroup
import android.view.ViewOutlineProvider
import android.view.animation.DecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.view.animation.PathInterpolator
import android.widget.FrameLayout
import kotlin.math.abs

class Nav(private val container: FrameLayout, private val provide: (Route) -> Destination) {

    var onChange: () -> Unit = {}

    private val stack = ArrayList<Destination>()

    private var transition: ValueAnimator? = null

    private var backProgress = -1f

    private var backFromLeft = true

    private var backStartY = 0f

    private var backSheet: Sheet? = null

    private var scrim: ColorDrawable? = null

    private var scrimView: View? = null

    private var leaving: Destination? = null

    private var entering: Destination? = null

    private var cachedCornerRadius = -1f

    private val emphasized = Motion.emphasized

    private val gestureCurve = PathInterpolator(0.1f, 0.1f, 0f, 1f)

    private val settleCurve = PathInterpolator(0.05f, 0.7f, 0.1f, 1f)

    private val verticalCurve = DecelerateInterpolator()

    private val linear = LinearInterpolator()

    private val cornerClip = object : ViewOutlineProvider() {
        override fun getOutline(view: View, outline: Outline) {
            val scale = view.scaleX.coerceAtLeast(0.01f)
            outline.setRoundRect(0, 0, view.width, view.height, cornerRadius() / scale)
        }
    }

    private fun fadeGate(t: Long): Float = when {
        t < 50L -> 0f
        t <= 133L -> (t - 50f) / 83f
        else -> 1f
    }

    fun setRoot(route: Route) {
        container.removeAllViews()
        stack.clear()
        val screen = create(route)
        stack.add(screen)
        container.addView(screen, matchParent())
        changed()
    }

    fun save(): Bundle {
        val bundle = Bundle()
        bundle.putStringArrayList(KEY_ROUTES, ArrayList(stack.map { it.route.name }))
        stack.forEachIndexed { index, destination ->
            val state = SparseArray<Parcelable>()
            destination.saveHierarchyState(state)
            bundle.putSparseParcelableArray(KEY_STATE + index, state)
        }
        return bundle
    }

    fun restore(bundle: Bundle): Boolean {
        val names = bundle.getStringArrayList(KEY_ROUTES)
        val routes = names?.mapNotNull { name -> Route.entries.firstOrNull { it.name == name } }
        if (routes.isNullOrEmpty() || routes.size != names.size) return false
        container.removeAllViews()
        stack.clear()
        routes.forEachIndexed { index, route ->
            val destination = create(route)
            stack.add(destination)
            container.addView(destination, matchParent())
            @Suppress("DEPRECATION")
            bundle.getSparseParcelableArray<Parcelable>(KEY_STATE + index)?.let(destination::restoreHierarchyState)
        }
        var covered = false
        for (index in stack.indices.reversed()) {
            val destination = stack[index]
            destination.visibility = if (covered) View.INVISIBLE else View.VISIBLE
            if (destination !is Sheet) covered = true
        }
        changed()
        return true
    }

    fun push(route: Route, clear: Boolean = false) {
        clearBackState()
        if (stack.lastOrNull()?.route == route) return
        val screen = create(route)
        if (screen is Sheet) {
            transition?.end()
            stack.add(screen)
            container.addView(screen, matchParent())
            screen.open()
            changed()
            return
        }
        while (stack.lastOrNull() is Sheet) dropSheet()
        val exiting = leaving
        if (exiting != null && exiting !is Sheet) {
            transition?.cancel()
            leaving = null
            prune(exiting)
            pushFromExit(screen, exiting)
            settle(screen, clear)
            return
        }
        val inFlight = entering
        if (inFlight != null) {
            transition?.cancel()
            entering = null
            inFlight.isEntering = false
            stack.remove(inFlight)
            prune(inFlight)
            pushFromExit(screen, inFlight)
            settle(screen, clear)
            return
        }
        val previous = stack.lastOrNull()
        stack.add(screen)
        container.addView(screen, matchParent())

        transition?.end()
        val offset = offset()
        screen.alpha = 0f
        screen.translationX = offset
        previous?.translationX = 0f
        previous?.alpha = 1f

        entering = screen
        screen.isEntering = true
        runTransition(
            onUpdate = { f ->
                val t = (f * DURATION).toLong()
                screen.translationX = offset * (1f - f)
                screen.alpha = fadeGate(t)
                previous?.translationX = -offset * f
            },
            onEnd = {
                screen.translationX = 0f
                screen.alpha = 1f
                screen.isEntering = false
                previous?.let {
                    it.translationX = 0f
                    if (it !in stack) container.removeView(it) else it.visibility = View.INVISIBLE
                }
                entering = null
            },
        )
        settle(screen, clear)
    }

    private fun settle(screen: Destination, clear: Boolean) {
        if (clear) {
            val removed = stack.filter { it !== screen }
            stack.retainAll { it === screen }
            removed.filter { it.visibility != View.VISIBLE }.forEach(container::removeView)
        }
        changed()
    }

    private fun prune(keep: Destination) {
        for (index in container.childCount - 1 downTo 0) {
            val child = container.getChildAt(index)
            if (child is Screen && child !== keep && child !in stack) {
                resetScreen(child)
                container.removeView(child)
            }
        }
    }

    private fun pushFromExit(screen: Destination, exiting: Destination) {
        val previous = stack.lastOrNull()
        stack.add(screen)
        container.addView(screen, matchParent())
        screen.translationX = exiting.translationX
        screen.translationY = exiting.translationY
        screen.alpha = exiting.alpha
        screen.scaleX = exiting.scaleX
        screen.scaleY = exiting.scaleY
        if (exiting.clipToOutline) {
            screen.outlineProvider = cornerClip
            screen.clipToOutline = true
        }
        container.removeView(exiting)
        resetScreen(exiting)

        val fromTx = screen.translationX
        val fromTy = screen.translationY
        val fromAlpha = screen.alpha
        val fromScale = screen.scaleX
        val prevFromTx = previous?.translationX ?: 0f
        val prevFromTy = previous?.translationY ?: 0f
        val prevFromScale = previous?.scaleX ?: 1f
        val offset = offset()
        val dim = scrim
        val dimFrom = dim?.alpha ?: 0

        entering = screen
        screen.isEntering = true
        runTransition(
            onUpdate = { f ->
                val scale = fromScale + (1f - fromScale) * f
                screen.scaleX = scale
                screen.scaleY = scale
                screen.invalidateOutline()
                screen.translationX = fromTx * (1f - f)
                screen.translationY = fromTy * (1f - f)
                screen.alpha = fromAlpha + (1f - fromAlpha) * f
                val prevScale = prevFromScale + (1f - prevFromScale) * f
                previous?.scaleX = prevScale
                previous?.scaleY = prevScale
                previous?.translationX = prevFromTx + (-offset - prevFromTx) * f
                previous?.translationY = prevFromTy * (1f - f)
                dim?.alpha = (dimFrom * (1f - f)).toInt()
            },
            onEnd = {
                resetScreen(screen)
                if (previous != null) {
                    resetScreen(previous)
                    if (previous in stack) previous.visibility = View.INVISIBLE else container.removeView(previous)
                }
                removeScrim()
                entering = null
            },
        )
    }

    fun pop(): Boolean {
        if (stack.size <= 1) return false
        if (stack.last() is Sheet) {
            dropSheet()
            changed()
            return true
        }
        if (backProgress >= 0f) {
            commitBack()
            changed()
            return true
        }
        transition?.end()
        val top = stack.removeAt(stack.lastIndex)
        val previous = stack.last()
        previous.visibility = View.VISIBLE
        previous.refresh()

        val offset = offset()
        top.translationX = 0f
        top.alpha = 1f
        top.isLeaving = true
        leaving = top
        previous.translationX = -offset
        previous.alpha = 1f

        runTransition(
            onUpdate = { f ->
                top.translationX = offset * f
                top.alpha = 1f - f
                previous.translationX = -offset * (1f - f)
            },
            onEnd = {
                previous.translationX = 0f
                previous.alpha = 1f
                if (top !in stack) container.removeView(top)
                resetScreen(top)
                leaving = null
            },
        )
        changed()
        return true
    }

    fun dismiss(sheet: Sheet) {
        if (stack.lastOrNull() === sheet) pop()
    }

    private fun dropSheet() {
        val sheet = stack.removeAt(stack.lastIndex) as Sheet
        backSheet = null
        sheet.isLeaving = true
        sheet.close { container.removeView(sheet) }
        stack.lastOrNull()?.refresh()
    }

    fun startBack(fromLeft: Boolean = true, touchY: Float = 0f) {
        if (stack.size <= 1) return
        val top = stack.last()
        if (top is Sheet) {
            backSheet = top
            return
        }
        transition?.end()
        clearBackState()
        val previous = stack[stack.size - 2]
        previous.visibility = View.VISIBLE
        previous.refresh()
        previous.alpha = 1f
        top.translationX = 0f
        top.alpha = 1f
        top.outlineProvider = cornerClip
        top.clipToOutline = true
        top.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        previous.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        val dim = ColorDrawable(Color.BLACK).apply { alpha = SCRIM_ALPHA }
        scrim = dim
        val dimView = View(container.context).apply { background = dim }
        scrimView = dimView
        container.addView(dimView, container.indexOfChild(top), matchParent())
        backFromLeft = fromLeft
        backStartY = touchY
        seekBack(0f, touchY)
    }

    fun progressBack(progress: Float, touchY: Float) {
        backSheet?.let {
            it.backProgress(progress)
            return
        }
        if (backProgress < 0f) return
        seekBack(progress, touchY)
    }

    fun cancelBack() {
        backSheet?.let {
            it.backCancel()
            backSheet = null
            return
        }
        if (backProgress < 0f) return
        backProgress = -1f
        val top = stack.last()
        val previous = stack[stack.size - 2]
        val fromScale = top.scaleX
        val fromTx = top.translationX
        val fromTy = top.translationY

        runTransition(
            duration = CANCEL_DURATION,
            interpolator = settleCurve,
            onUpdate = { f ->
                val scale = fromScale + (1f - fromScale) * f
                top.scaleX = scale
                top.scaleY = scale
                top.invalidateOutline()
                top.translationX = fromTx * (1f - f)
                top.translationY = fromTy * (1f - f)
                previous.scaleX = scale
                previous.scaleY = scale
                previous.translationY = fromTy * (1f - f)
            },
            onEnd = {
                clearBackVisuals(top, previous)
                previous.visibility = View.INVISIBLE
            },
        )
    }

    private fun commitBack() {
        backProgress = -1f
        val top = stack.removeAt(stack.lastIndex)
        val previous = stack.last()
        top.isLeaving = true
        leaving = top
        val fromScale = top.scaleX
        val fromTopTx = top.translationX
        val fromTy = top.translationY
        val fromTx = previous.translationX
        val offset = offset()

        runTransition(
            interpolator = linear,
            onUpdate = { f ->
                val e = emphasized.getInterpolation(f)
                val scale = fromScale + (1f - fromScale) * e
                top.scaleX = scale
                top.scaleY = scale
                top.invalidateOutline()
                top.translationX = fromTopTx + offset * e
                top.translationY = fromTy * (1f - e)
                top.alpha = (1f - f / FADE_OUT).coerceIn(0f, 1f)
                previous.scaleX = scale
                previous.scaleY = scale
                previous.translationX = fromTx * (1f - e)
                previous.translationY = fromTy * (1f - e)
                scrim?.alpha = (SCRIM_ALPHA * (1f - f / SCRIM_FADE)).toInt().coerceAtLeast(0)
            },
            onEnd = {
                clearBackVisuals(top, previous)
                if (top !in stack) container.removeView(top)
                leaving = null
            },
        )
    }

    private fun seekBack(progress: Float, touchY: Float) {
        backProgress = progress
        val p = gestureCurve.getInterpolation(progress)
        val scale = 1f - (1f - MIN_SCALE) * p
        val top = stack.last()
        val previous = stack[stack.size - 2]
        val w = container.width.toFloat()
        val h = container.height.toFloat()
        val margin = container.dp(EDGE_MARGIN)
        val maxDx = ((w - scale * w) / 2f - margin).coerceAtLeast(0f)
        val deltaY = touchY - backStartY
        val dyCap = ((h - scale * h) / 2f - margin).coerceAtLeast(0f)
        val ySign = if (deltaY >= 0f) 1f else -1f
        val yNorm = (abs(deltaY) / (h / 2f)).coerceIn(0f, 1f)
        val ty = ySign * dyCap * verticalCurve.getInterpolation(yNorm)
        top.scaleX = scale
        top.scaleY = scale
        top.invalidateOutline()
        top.translationX = if (backFromLeft) maxDx * p else 0f
        top.translationY = ty
        previous.scaleX = scale
        previous.scaleY = scale
        previous.translationX = -offset()
        previous.translationY = ty
    }

    private fun clearBackState() {
        backSheet?.backCancel()
        backSheet = null
        if (backProgress < 0f) return
        backProgress = -1f
        val previous = stack[stack.size - 2]
        clearBackVisuals(stack.last(), previous)
        previous.visibility = View.INVISIBLE
    }

    private fun clearBackVisuals(top: Destination, previous: Destination) {
        resetScreen(top)
        resetScreen(previous)
        removeScrim()
    }

    private fun removeScrim() {
        scrimView?.let { container.removeView(it) }
        scrimView = null
        scrim = null
    }

    private fun resetScreen(screen: Destination) {
        screen.scaleX = 1f
        screen.scaleY = 1f
        screen.translationX = 0f
        screen.translationY = 0f
        screen.alpha = 1f
        screen.clipToOutline = false
        screen.outlineProvider = ViewOutlineProvider.BACKGROUND
        screen.setLayerType(View.LAYER_TYPE_NONE, null)
        screen.isLeaving = false
        screen.isEntering = false
    }

    private fun cornerRadius(): Float {
        var radius = cachedCornerRadius
        if (radius < 0f) {
            val insets = container.rootWindowInsets
            val corner = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                insets?.getRoundedCorner(RoundedCorner.POSITION_TOP_LEFT)?.radius?.toFloat()
            } else {
                null
            }
            radius = corner ?: container.dp(24f)
            if (insets != null) cachedCornerRadius = radius
        }
        return radius
    }

    fun refresh() = stack.forEach { it.refresh() }

    fun current(): Destination? = stack.lastOrNull()

    fun canPop(): Boolean = stack.size > 1

    private fun create(route: Route): Destination {
        val destination = provide(route)
        destination.route = route
        if (destination is Sheet) destination.dismiss = { dismiss(destination) }
        destination.refresh()
        return destination
    }

    private fun changed() {
        val top = stack.lastOrNull()
        val focused = container.findFocus()
        if (focused != null && top != null) {
            var parent: View? = focused
            while (parent != null && parent !== top) parent = parent.parent as? View
            if (parent == null) focused.clearFocus()
        }
        for (index in 0 until container.childCount) {
            val destination = container.getChildAt(index) as? Destination ?: continue
            val active = destination === top
            destination.importantForAccessibility = if (active) {
                View.IMPORTANT_FOR_ACCESSIBILITY_AUTO
            } else {
                View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
            }
            destination.descendantFocusability = if (active) {
                ViewGroup.FOCUS_AFTER_DESCENDANTS
            } else {
                ViewGroup.FOCUS_BLOCK_DESCENDANTS
            }
        }
        onChange()
    }

    private fun offset(): Float = container.dp(if (container.layoutDirection == View.LAYOUT_DIRECTION_RTL) -96f else 96f)

    private fun runTransition(
        duration: Long = DURATION,
        interpolator: TimeInterpolator = emphasized,
        onUpdate: (Float) -> Unit,
        onEnd: () -> Unit,
    ) {
        val anim = ValueAnimator.ofFloat(0f, 1f)
        anim.duration = duration
        anim.interpolator = interpolator
        anim.addUpdateListener { onUpdate(it.animatedValue as Float) }
        anim.addListener(object : AnimatorListenerAdapter() {
            private var cancelled = false

            override fun onAnimationCancel(animation: Animator) {
                cancelled = true
            }

            override fun onAnimationEnd(animation: Animator) {
                if (!cancelled) onEnd()
                if (transition === anim) transition = null
            }
        })
        transition = anim
        anim.start()
    }

    private fun matchParent() = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT,
    )

    private companion object {
        const val KEY_ROUTES = "routes"
        const val KEY_STATE = "state"
        const val DURATION = 450L
        const val CANCEL_DURATION = 200L
        const val MIN_SCALE = 0.9f
        const val EDGE_MARGIN = 16f
        const val SCRIM_ALPHA = 77
        const val FADE_OUT = 0.2f
        const val SCRIM_FADE = 0.5f
    }
}
