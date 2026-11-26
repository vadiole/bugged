package vadiole.bugged

import android.accessibilityservice.AccessibilityService
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import android.view.View
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import kotlin.concurrent.thread

class ClipboardService : AccessibilityService() {
    private val handler = Handler(Looper.getMainLooper())
    private val read = Runnable(::takeFocus)
    private val fallback = Runnable(::takeFocus)
    private val release = Runnable(::dropFocus)
    private val unwatch = Runnable { watch(false) }
    private val writeAhead = Runnable(::writeSelection)
    private val readStaying = Runnable(::readIfStaying)
    private val previews = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
    private var probe: View? = null
    private var probed = false
    private var preview: String? = null
    private var selection: String? = null
    private var hidden: AccessibilityNodeInfo? = null
    private var watching = false
    private var previewSeen = previews && App.instance.setup.previews
    private var wroteAt = 0L

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        val handled = when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> event.packageName == SYSTEM_UI && onWindowShown(event)
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> event.packageName == SYSTEM_UI && onWindowChanged(event)
            AccessibilityEvent.TYPE_VIEW_CLICKED -> isCopyClick(event) && onCopyClick(event)
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
        if (!previews) {
            serviceInfo = serviceInfo.apply {
                eventTypes = AccessibilityEvent.TYPE_VIEW_CLICKED or AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED
            }
        }
        thread { App.instance.warm() }
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

    private fun onWindowShown(event: AccessibilityEvent): Boolean {
        val root = event.source ?: return false
        return onOverlay(root, root.findAccessibilityNodeInfosByViewId(PREVIEW_TEXT).firstOrNull(), shown = true)
    }

    private fun onWindowChanged(event: AccessibilityEvent): Boolean {
        if (SystemClock.uptimeMillis() - wroteAt < ECHO) return false
        val source = event.source ?: return false
        val id = source.viewIdResourceName
        if (id?.startsWith(PREVIEW_PREFIX) != true) return false
        if (id == PREVIEW_TEXT) return onOverlay(source, source, shown = false)
        val root = source.window?.root ?: source
        return onOverlay(root, root.findAccessibilityNodeInfosByViewId(PREVIEW_TEXT).firstOrNull(), shown = false)
    }

    private fun onOverlay(root: AccessibilityNodeInfo, node: AccessibilityNodeInfo?, shown: Boolean): Boolean {
        val text = node?.text?.toString()
        if (text == null && root.findAccessibilityNodeInfosByViewId(OVERLAY).isEmpty()) return false
        if (!previewSeen) {
            previewSeen = true
            App.instance.setup.previews = true
        }
        handler.removeCallbacks(fallback)
        if (text != null) selection = null
        val handled = when {
            text == null -> SystemClock.uptimeMillis() - wroteAt > ECHO && readHidden(root, shown)
            text == preview -> false
            else -> onPreview(text)
        }
        watch(true)
        if (BuildConfig.DEBUG) Log.d(TAG, "overlay text=$text handled=$handled")
        return handled
    }

    private fun readHidden(root: AccessibilityNodeInfo, shown: Boolean): Boolean {
        handler.removeCallbacks(readStaying)
        if (shown) return readSoon(0)
        hidden = root
        handler.postDelayed(readStaying, LEAVE)
        return true
    }

    private fun readIfStaying() {
        val root = hidden ?: return
        hidden = null
        if (root.refresh() && root.findAccessibilityNodeInfosByViewId(OVERLAY).isNotEmpty()) takeFocus()
    }

    private fun onPreview(text: String): Boolean {
        preview = text
        if (text.length >= PREVIEW_LIMIT) return readSoon(0)
        val cleaned = App.instance.cleaner.cleanText(text)
        if (cleaned == text) return false
        if (text.any(Char::isWhitespace)) return readSoon(0)
        preview = cleaned
        wroteAt = SystemClock.uptimeMillis()
        App.instance.writeClipboard(cleaned)
        return true
    }

    private fun watch(enabled: Boolean) {
        handler.removeCallbacks(unwatch)
        if (enabled) handler.postDelayed(unwatch, WATCH) else preview = null
        if (watching == enabled) return
        watching = enabled
        serviceInfo = serviceInfo.apply {
            eventTypes = if (enabled) EVENTS or AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED else EVENTS
            packageNames = if (enabled) arrayOf(SYSTEM_UI) else null
        }
    }

    private fun isCopyClick(event: AccessibilityEvent): Boolean {
        val copy = getString(android.R.string.copy)
        return (event.text + event.contentDescription).any {
            it != null && it.length <= LABEL_LIMIT && it.startsWith(copy, ignoreCase = true)
        }
    }

    private fun onCopyClick(event: AccessibilityEvent): Boolean {
        val ahead = cleanSelection(event)
        selection = ahead
        handler.removeCallbacks(writeAhead)
        if (ahead != null) handler.postAtTime(writeAhead, event.eventTime + AHEAD)
        handler.removeCallbacks(fallback)
        handler.postDelayed(
            fallback,
            when {
                previewSeen -> FALLBACK
                ahead != null -> AHEAD + SETTLE
                else -> SETTLE
            },
        )
        return true
    }

    private fun cleanSelection(event: AccessibilityEvent): String? {
        val copy = getString(android.R.string.copy)
        if (event.text.none { copy.contentEquals(it, ignoreCase = true) }) return null
        val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return null
        val text = node.text ?: return null
        val start = minOf(node.textSelectionStart, node.textSelectionEnd)
        val end = maxOf(node.textSelectionStart, node.textSelectionEnd)
        if (start < 0 || start == end || end > text.length) return null
        val selected = text.subSequence(start, end).toString()
        if (selected.length >= PREVIEW_LIMIT || selected.any(Char::isWhitespace)) return null
        return App.instance.cleaner.cleanText(selected).takeIf { it != selected }
    }

    private fun writeSelection() {
        val cleaned = selection ?: return
        selection = null
        preview = cleaned
        wroteAt = SystemClock.uptimeMillis()
        App.instance.writeClipboard(cleaned)
        if (BuildConfig.DEBUG) Log.d(TAG, "wrote ahead")
    }

    private fun isCopyToast(event: AccessibilityEvent) = !previews && event.packageName != SYSTEM &&
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
                if (hasWindowFocus && probe === this && !probed) readClipboard()
            }
        }
        val params = WindowManager.LayoutParams(
            1,
            1,
            WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or WindowManager.LayoutParams.FLAG_ALT_FOCUSABLE_IM,
            PixelFormat.TRANSLUCENT,
        )
        getSystemService(WindowManager::class.java).addView(view, params)
        probe = view
        probed = false
        if (getSystemService(ClipboardManager::class.java).hasPrimaryClip()) {
            readClipboard()
        } else {
            handler.postDelayed(release, TIMEOUT)
        }
    }

    private fun readClipboard() {
        probed = true
        try {
            val cleaned = App.instance.cleanClipboard()
            if (cleaned != null) {
                wroteAt = SystemClock.uptimeMillis()
                preview = cleaned.take(PREVIEW_LIMIT)
            }
            if (BuildConfig.DEBUG) Log.d(TAG, "read cleaned=${cleaned != null}")
        } finally {
            handler.removeCallbacks(release)
            handler.post(release)
        }
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
        private const val SYSTEM = "android"
        private const val SYSTEM_UI = "com.android.systemui"
        private const val PREVIEW_PREFIX = "com.android.systemui:id/clipboard"
        private const val PREVIEW_TEXT = "com.android.systemui:id/text_preview"
        private const val OVERLAY = "com.android.systemui:id/clipboard_ui"
        private const val PREVIEW_LIMIT = 500
        private const val LABEL_LIMIT = 24
        private const val WATCH = 10_000L
        private const val EVENTS = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or AccessibilityEvent.TYPE_VIEW_CLICKED
        private const val SETTLE = 150L
        private const val AHEAD = 150L
        private const val FALLBACK = 1000L
        private const val ECHO = 700L
        private const val LEAVE = 500L
        private const val TIMEOUT = 3000L
    }
}
