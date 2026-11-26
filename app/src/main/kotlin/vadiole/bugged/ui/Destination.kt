package vadiole.bugged.ui

import android.content.Context
import android.view.MotionEvent
import android.widget.FrameLayout

enum class Route { Welcome, Home, About, Copy, Open, Browser }

abstract class Destination(context: Context) : FrameLayout(context) {
    lateinit var route: Route

    var isLeaving = false

    var isEntering = false

    override fun dispatchTouchEvent(ev: MotionEvent): Boolean {
        if (isLeaving) return false
        if (isEntering) return true
        return super.dispatchTouchEvent(ev)
    }

    open fun refresh() = Unit
}

abstract class Screen(context: Context, colors: Colors, title: Int) : Destination(context) {
    init {
        accessibilityPaneTitle = context.getString(title)
        setBackgroundColor(colors.surface)
        isClickable = true
    }
}
