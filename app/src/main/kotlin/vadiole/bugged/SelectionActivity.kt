package vadiole.bugged

import android.app.Activity
import android.content.Intent
import android.os.Bundle

class SelectionActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)?.toString()
        if (text != null) {
            val cleaned = App.instance.cleaner.cleanText(text)
            if (intent.getBooleanExtra(Intent.EXTRA_PROCESS_TEXT_READONLY, false)) {
                App.instance.writeClipboard(cleaned)
            } else {
                setResult(RESULT_OK, Intent().putExtra(Intent.EXTRA_PROCESS_TEXT, cleaned))
            }
        }
        finish()
    }
}
