package vadiole.bugged.ui

import android.view.View
import android.view.accessibility.AccessibilityNodeInfo
import android.view.accessibility.AccessibilityNodeInfo.AccessibilityAction

class ClickLabel(private val role: String, private val label: String?) : View.AccessibilityDelegate() {
    override fun onInitializeAccessibilityNodeInfo(host: View, info: AccessibilityNodeInfo) {
        super.onInitializeAccessibilityNodeInfo(host, info)
        info.className = role
        if (label != null) info.addAction(AccessibilityAction(AccessibilityNodeInfo.ACTION_CLICK, label))
    }
}
