package vadiole.bugged

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent

class ClipboardService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val read = Runnable(::takeFocus)
    private val release = Runnable(::dropFocus)
    private val unwatch = Runnable { watch(false) }
    private var probe: View? = null
    private var preview: String? = null

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val handled = when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> event.packageName == SYSTEM_UI && onPreviewShown(event)
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> event.packageName == SYSTEM_UI && onPreviewChanged(event)
            AccessibilityEvent.TYPE_VIEW_CLICKED -> isCopyClick(event) && readSoon(SETTLE)
            AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED -> isCopyToast(event) && readSoon(0)
            else -> false
        }
        if (BuildConfig.DEBUG) {
            Log.d(TAG, "handled=$handled ${AccessibilityEvent.eventTypeToString(event.eventType)} " +
                "${event.packageName} ${event.className}")
        }
    }

    override fun onInterrupt() = Unit

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onUnbind(intent: Intent?): Boolean {
        if (instance === this) instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        dropFocus()
        super.onDestroy()
    }

    private fun onPreviewShown(event: AccessibilityEvent): Boolean {
        val text = event.text.firstOrNull()?.toString() ?: return false
        if (!previewVisible()) return false
        watch(true)
        return onPreview(text)
    }

    private fun previewVisible() = windows.any { window ->
        val root = window.root
        root?.packageName == SYSTEM_UI && root.findAccessibilityNodeInfosByViewId(PREVIEW_TEXT).isNotEmpty()
    }

    private fun onPreviewChanged(event: AccessibilityEvent): Boolean {
        val source = event.source ?: return false
        if (source.viewIdResourceName?.startsWith(PREVIEW_PREFIX) != true) return false
        watch(true)
        val root = source.window?.root ?: source
        val text = root.findAccessibilityNodeInfosByViewId(PREVIEW_TEXT).firstOrNull()?.text?.toString() ?: return false
        return onPreview(text)
    }

    private fun onPreview(text: String): Boolean {
        if (text == preview) return false
        preview = text
        if (text.length >= PREVIEW_LIMIT) return readSoon(0)
        handler.removeCallbacks(read)
        val cleaned = App.instance.cleaner.cleanText(text)
        if (cleaned == text) return false
        if (text.any(Char::isWhitespace)) return readSoon(0)
        App.instance.writeClipboard(cleaned)
        return true
    }

    private fun watch(enabled: Boolean) {
        handler.removeCallbacks(unwatch)
        val types = if (enabled) EVENTS or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED else EVENTS
        if (serviceInfo.eventTypes != types) serviceInfo = serviceInfo.apply { eventTypes = types }
        if (enabled) handler.postDelayed(unwatch, WATCH) else preview = null
    }

    private fun isCopyClick(event: AccessibilityEvent): Boolean {
        val copy = getString(android.R.string.copy)
        return (event.text + event.contentDescription).any {
            it != null && it.length <= LABEL_LIMIT && it.startsWith(copy, ignoreCase = true)
        }
    }

    private fun isCopyToast(event: AccessibilityEvent) = Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU &&
        event.className?.contains("Toast") == true

    private fun readSoon(delay: Long): Boolean {
        handler.removeCallbacks(read)
        handler.postDelayed(read, delay)
        return true
    }

    private fun takeFocus() {
        if (probe != null) return
        val view = object : View(this) {
            override fun onWindowFocusChanged(hasWindowFocus: Boolean) {
                super.onWindowFocusChanged(hasWindowFocus)
                if (!hasWindowFocus) return
                try {
                    val cleaned = App.instance.cleanClipboard()
                    if (BuildConfig.DEBUG) Log.d(TAG, "read cleaned=$cleaned")
                } finally {
                    handler.removeCallbacks(release)
                    handler.post(release)
                }
            }
        }
        val params = WindowManager.LayoutParams(
            1,
            1,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT,
        )
        getSystemService(WindowManager::class.java).addView(view, params)
        probe = view
        handler.postDelayed(release, TIMEOUT)
    }

    private fun dropFocus() {
        val view = probe ?: return
        probe = null
        getSystemService(WindowManager::class.java).removeView(view)
    }

    companion object {
        var instance: ClipboardService? = null
            private set

        private const val TAG = "Bugged"
        private const val SYSTEM_UI = "com.android.systemui"
        private const val PREVIEW_PREFIX = "com.android.systemui:id/clipboard"
        private const val PREVIEW_TEXT = "com.android.systemui:id/text_preview"
        private const val PREVIEW_LIMIT = 500
        private const val LABEL_LIMIT = 24
        private const val WATCH = 10_000L
        private const val EVENTS = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
            AccessibilityEvent.TYPE_VIEW_CLICKED or
            AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED
        private const val SETTLE = 150L
        private const val TIMEOUT = 3000L
    }
}
