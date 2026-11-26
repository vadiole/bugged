package vadiole.bugged.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.res.Resources
import android.graphics.Typeface
import android.os.Build
import android.text.SpannableString
import android.text.Spanned
import android.text.style.TypefaceSpan
import android.util.TypedValue
import android.view.View
import android.widget.TextView
import kotlin.math.roundToInt

class TextStyle(val size: Float, val line: Float, val tracking: Float, val weight: Int, val brand: Boolean) {
    fun emphasized() = TextStyle(size, line, tracking, if (weight >= 500) 700 else 500, brand)

    fun typeface(): Typeface = Typeface.create(if (brand) Type.brand else Type.plain, weight, false)
}

object Type {
    val displaySmall = TextStyle(36f, 44f, 0f, 400, true)
    val headlineMedium = TextStyle(28f, 36f, 0f, 400, true)
    val titleLarge = TextStyle(22f, 28f, 0f, 400, true)
    val titleMedium = TextStyle(16f, 24f, 0.15f, 500, false)
    val bodyLarge = TextStyle(16f, 24f, 0.5f, 400, false)
    val bodyMedium = TextStyle(14f, 20f, 0.25f, 400, false)
    val bodySmall = TextStyle(12f, 16f, 0.4f, 400, false)
    val labelLarge = TextStyle(14f, 20f, 0.1f, 500, false)

    val brand: Typeface by lazy { system("config_headlineFontFamily") }
    val plain: Typeface by lazy { system("config_bodyFontFamily") }

    @SuppressLint("DiscouragedApi")
    private fun system(name: String): Typeface {
        val resources = Resources.getSystem()
        val id = resources.getIdentifier(name, "string", "android")
        val family = if (id != 0) resources.getString(id) else ""
        return if (family.isEmpty()) Typeface.DEFAULT else Typeface.create(family, Typeface.NORMAL)
    }
}

fun TextView.style(style: TextStyle) {
    includeFontPadding = false
    typeface = style.typeface()
    setTextSize(TypedValue.COMPLEX_UNIT_SP, style.size)
    letterSpacing = style.tracking / style.size
    textAlignment = View.TEXT_ALIGNMENT_VIEW_START
    val line = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        setLineHeight(TypedValue.COMPLEX_UNIT_SP, style.line)
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, style.line, resources.displayMetrics)
    } else {
        val pixels = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, style.line, resources.displayMetrics)
        lineHeight = pixels.roundToInt()
        pixels
    }
    val metrics = paint.fontMetricsInt
    val lead = (line.roundToInt() - (metrics.descent - metrics.ascent)) / 2
    if (lead > 0) {
        firstBaselineToTopHeight = -metrics.ascent + lead
        lastBaselineToBottomHeight = metrics.descent + lead
    }
}

fun text(context: Context, style: TextStyle, color: Int, resource: Int = 0) = TextView(context).apply {
    style(style)
    setTextColor(color)
    if (resource != 0) setText(resource)
}

fun Context.withBold(resource: Int, argument: String): CharSequence {
    val template = getString(resource)
    val token = if ("%1\$s" in template) "%1\$s" else "%s"
    val at = template.indexOf(token)
    if (at < 0) return template
    val result = SpannableString(template.replace(token, argument))
    result.setSpan(TypefaceSpan(Typeface.create(Type.plain, 700, false)), at, at + argument.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
    return result
}
