package vadiole.bugged

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.widget.Toast

class OpenActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val link = intent.dataString
        val browser = App.instance.browsers.target()
        if (link == null || browser == null || !forward(link, browser)) {
            if (link != null) Toast.makeText(applicationContext, R.string.browser_none, Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
        finish()
    }

    private fun forward(link: String, browser: String): Boolean {
        val cleaned = App.instance.cleaner.clean(link)
        val forward = Intent(Intent.ACTION_VIEW, Uri.parse(cleaned))
            .setPackage(browser)
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        intent.extras?.let(forward::putExtras)
        return try {
            startActivity(forward)
            if (cleaned != link) App.instance.setup.count()
            true
        } catch (_: ActivityNotFoundException) {
            false
        }
    }
}
