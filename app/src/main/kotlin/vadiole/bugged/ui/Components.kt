package vadiole.bugged.ui

import android.content.Context
import android.content.res.ColorStateList
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.graphics.drawable.Drawable
import android.text.TextUtils
import android.view.Gravity
import android.view.View
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.max

// https://m3.material.io/components/buttons/specs
class ActionButton(context: Context, colors: Colors, kind: Kind, large: Boolean, label: Int) : Button(context, null, 0) {
    enum class Kind { Filled, Tonal, Text }

    private val shape = RoundDrawable()
    private val rest = dp(if (large) 28f else 20f)
    private val squeezed = dp(if (large) 12f else 8f)
    private val morph = Motion.effectsDefault.animator(0.5f, rest) { shape.radius = it }
    private val filled = kind != Kind.Text
    private var ready = false

    init {
        ready = true
        val height = if (large) 56 else 40
        val side = dp(if (large) 24 else 16)
        style(if (large) Type.titleMedium else Type.labelLarge)
        setText(label)
        isAllCaps = false
        gravity = Gravity.CENTER
        textAlignment = View.TEXT_ALIGNMENT_CENTER
        maxLines = 1
        ellipsize = TextUtils.TruncateAt.END
        stateListAnimator = null
        minHeight = dp(max(height, TARGET))
        minimumHeight = minHeight
        minWidth = dp(TARGET)
        minimumWidth = minWidth
        setPadding(side, 0, side, 0)
        shape.radius = rest
        shape.insetY = dp((max(height, TARGET) - height) / 2)
        when (kind) {
            Kind.Filled -> tint(colors.primary, colors.onPrimary)
            Kind.Tonal -> tint(colors.secondaryContainer, colors.onSecondaryContainer)
            Kind.Text -> tint(Color.TRANSPARENT, colors.primary)
        }
    }

    fun tint(container: Int, content: Int) {
        setTextColor(content)
        shape.color = if (filled) container else Color.WHITE
        background = if (filled) ripple(content, shape) else ripple(content, null, shape)
    }

    override fun drawableStateChanged() {
        super.drawableStateChanged()
        if (!ready) return
        morph.animateTo(if (isPressed) squeezed else rest)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        morph.snapTo(rest)
        shape.radius = rest
    }

    private companion object {
        const val TARGET = 48
    }
}

// https://m3.material.io/components/icon-buttons/specs
class IconButton(context: Context, colors: Colors, icon: Int, label: Int) : ImageButton(context, null, 0) {
    private val shape = RoundDrawable()
    private val rest = dp(20f)
    private val squeezed = dp(8f)
    private val morph = Motion.effectsDefault.animator(0.5f, rest) { shape.radius = it }
    private var ready = false

    init {
        ready = true
        setImageResource(icon)
        imageTintList = ColorStateList.valueOf(colors.onSurfaceVariant)
        scaleType = ScaleType.CENTER
        contentDescription = context.getString(label)
        tooltipText = contentDescription
        shape.radius = rest
        shape.insetX = dp(4)
        shape.insetY = dp(4)
        background = ripple(colors.onSurfaceVariant, null, shape)
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        setMeasuredDimension(dp(48), dp(48))
    }

    override fun drawableStateChanged() {
        super.drawableStateChanged()
        if (!ready) return
        morph.animateTo(if (isPressed) squeezed else rest)
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        morph.snapTo(rest)
        shape.radius = rest
    }
}

// https://m3.material.io/components/app-bars/specs
class TopBar(context: Context, private val colors: Colors, title: Int, navigation: IconButton? = null, action: IconButton? = null) :
    LinearLayout(context) {
    private val fill = ColorDrawable(colors.surface)
    private var lifted = false
    private val lift = Motion.effectsDefault.animator(0.01f) { fill.color = mixColor(colors.surface, colors.surfaceContainer, it) }

    init {
        orientation = HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        background = fill
        if (navigation != null) addView(navigation, linear(WRAP_CONTENT, WRAP_CONTENT, start = dp(4), end = dp(4)))
        val heading = text(context, Type.titleLarge.emphasized(), colors.onSurface, title).apply {
            isAccessibilityHeading = true
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        addView(heading, linear(0, WRAP_CONTENT, weight = 1f, start = if (navigation == null) dp(16) else 0, end = dp(16)))
        if (action != null) addView(action, linear(WRAP_CONTENT, WRAP_CONTENT, end = dp(4)))
        onBars { bars ->
            setPadding(bars.left, bars.top, bars.right, 0)
            minimumHeight = dp(HEIGHT) + bars.top
        }
        minimumHeight = dp(HEIGHT)
    }

    fun lift(value: Boolean) {
        if (lifted == value) return
        lifted = value
        val target = if (value) 1f else 0f
        if (isLaidOut) lift.animateTo(target) else {
            lift.snapTo(target)
            fill.color = if (value) colors.surfaceContainer else colors.surface
        }
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        lift.snapTo(if (lifted) 1f else 0f)
        fill.color = if (lifted) colors.surfaceContainer else colors.surface
    }

    private companion object {
        const val HEIGHT = 64
    }
}

class Badge(context: Context, icon: Int, container: Int, content: Int) : View(context) {
    private val cookie = CookieDrawable(container)
    private val glyph: Drawable = context.getDrawable(icon)!!.mutate()

    init {
        glyph.setTint(content)
    }

    fun tint(container: Int, content: Int) {
        cookie.color = container
        glyph.setTint(content)
        invalidate()
    }

    override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
        cookie.setBounds(0, 0, w, h)
        val half = dp(12)
        glyph.setBounds(w / 2 - half, h / 2 - half, w / 2 + half, h / 2 + half)
    }

    override fun onDraw(canvas: Canvas) {
        cookie.draw(canvas)
        glyph.draw(canvas)
    }
}

class Icon(context: Context, icon: Int, tint: Int) : ImageView(context) {
    init {
        setImageResource(icon)
        imageTintList = ColorStateList.valueOf(tint)
    }
}

// https://m3.material.io/components/lists/specs
class ListGroup(context: Context, private val colors: Colors) : LinearLayout(context) {
    init {
        orientation = VERTICAL
    }

    fun row(title: Int, value: String? = null, action: String? = null, onClick: () -> Unit): View {
        val shape = RoundDrawable(colors.surfaceContainer)
        val row = LinearLayout(context).apply {
            orientation = HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            minimumHeight = dp(72)
            setPadding(dp(16), dp(12), dp(16), dp(12))
            background = ripple(colors.onSurface, shape)
            tag = shape
            accessibilityDelegate = ClickLabel(Button::class.java.name, action)
            setOnClickListener { onClick() }
        }
        row.addView(text(context, Type.titleMedium, colors.onSurface, title), linear(0, WRAP_CONTENT, weight = 1f, end = dp(16)))
        if (value != null) {
            val trailing: TextView = text(context, Type.bodyMedium, colors.onSurfaceVariant)
            trailing.text = value
            row.addView(trailing, linear(WRAP_CONTENT, WRAP_CONTENT))
        } else {
            row.addView(Icon(context, vadiole.bugged.R.drawable.ic_chevron_right, colors.onSurfaceVariant), linear(dp(24), dp(24)))
        }
        addView(row, linear(top = if (childCount == 0) 0 else dp(2)))
        for (index in 0 until childCount) {
            val each = getChildAt(index).tag as RoundDrawable
            each.top = dp(if (index == 0) OUTER else INNER)
            each.bottom = dp(if (index == childCount - 1) OUTER else INNER)
        }
        return row
    }

    private companion object {
        const val OUTER = 24f
        const val INNER = 4f
    }
}
