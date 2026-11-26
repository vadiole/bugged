package vadiole.bugged

import android.annotation.SuppressLint
import android.app.Activity
import android.app.role.RoleManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.database.ContentObserver
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.view.View
import android.widget.FrameLayout
import android.window.BackEvent
import android.window.OnBackAnimationCallback
import android.window.OnBackInvokedCallback
import android.window.OnBackInvokedDispatcher
import vadiole.bugged.ui.AboutScreen
import vadiole.bugged.ui.BrowserSheet
import vadiole.bugged.ui.Colors
import vadiole.bugged.ui.CopySheet
import vadiole.bugged.ui.HomeScreen
import vadiole.bugged.ui.Host
import vadiole.bugged.ui.Nav
import vadiole.bugged.ui.OpenSheet
import vadiole.bugged.ui.Route
import vadiole.bugged.ui.WelcomeScreen

class MainActivity : Activity(), Host {
    override lateinit var colors: Colors
        private set
    override val setup get() = App.instance.setup
    override val browsers get() = App.instance.browsers

    private lateinit var nav: Nav
    private var backCallback: Any? = null
    private var backRegistered = false
    private var roleAsked = 0L

    private val settingsObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
        override fun onChange(selfChange: Boolean) = sync()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        colors = Colors.of(this)
        edgeToEdge()
        val container = FrameLayout(this)
        setContentView(container)
        nav = Nav(container) { route ->
            when (route) {
                Route.Welcome -> WelcomeScreen(this, this)
                Route.Home -> HomeScreen(this, this)
                Route.About -> AboutScreen(this, this)
                Route.Copy -> CopySheet(this, this)
                Route.Open -> OpenSheet(this, this)
                Route.Browser -> BrowserSheet(this, this)
            }
        }
        nav.onChange = ::updateBack
        val restored = savedInstanceState?.getBundle(KEY_NAV)?.let(nav::restore) ?: false
        if (!restored) nav.setRoot(if (setup.welcomed) Route.Home else Route.Welcome)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBundle(KEY_NAV, nav.save())
    }

    override fun onStart() {
        super.onStart()
        val setting = Settings.Secure.getUriFor(Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES)
        contentResolver.registerContentObserver(setting, false, settingsObserver)
    }

    override fun onStop() {
        contentResolver.unregisterContentObserver(settingsObserver)
        super.onStop()
    }

    override fun onResume() {
        super.onResume()
        sync()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus && App.instance.cleanClipboard()) nav.refresh()
    }

    private fun sync() {
        when (nav.current()?.route) {
            Route.Copy -> if (setup.copyOn()) nav.pop()
            Route.Open -> if (setup.openOn()) nav.pop()
            else -> Unit
        }
        nav.refresh()
    }

    override fun go(route: Route) = nav.push(route)

    override fun start() {
        setup.welcomed = true
        nav.push(Route.Home, clear = true)
    }

    override fun back() {
        nav.pop()
    }

    override fun openAccessibility() {
        val service = ComponentName(this, ClipboardService::class.java).flattenToString()
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            .putExtra(FRAGMENT_ARG_KEY, service)
            .putExtra(SHOW_FRAGMENT_ARGS, Bundle().apply { putString(FRAGMENT_ARG_KEY, service) })
        launch(intent)
    }

    override fun turnOffCopy() {
        val service = ClipboardService.instance
        if (service != null) service.disableSelf() else openAccessibility()
    }

    override fun requestBrowser() {
        val roles = getSystemService(RoleManager::class.java)
        if (roles.isRoleAvailable(RoleManager.ROLE_BROWSER) && !roles.isRoleHeld(RoleManager.ROLE_BROWSER)) {
            roleAsked = SystemClock.elapsedRealtime()
            @Suppress("DEPRECATION")
            startActivityForResult(roles.createRequestRoleIntent(RoleManager.ROLE_BROWSER), REQUEST_ROLE)
        } else {
            openDefaultApps()
        }
    }

    override fun openDefaultApps() = launch(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQUEST_ROLE || resultCode == RESULT_OK) return
        if (SystemClock.elapsedRealtime() - roleAsked < DENIED_WITHOUT_ASKING) openDefaultApps()
    }

    private fun launch(intent: Intent) {
        try {
            startActivity(intent)
        } catch (_: ActivityNotFoundException) {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun edgeToEdge() {
        window.setBackgroundDrawable(ColorDrawable(colors.surface))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = window.decorView.systemUiVisibility or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) {
            @Suppress("DEPRECATION")
            window.statusBarColor = Color.TRANSPARENT
            @Suppress("DEPRECATION")
            window.navigationBarColor = Color.TRANSPARENT
        }
        window.isNavigationBarContrastEnforced = false
    }

    private fun updateBack() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val callback = (backCallback ?: createBack().also { backCallback = it }) as OnBackInvokedCallback
        val wanted = nav.canPop()
        if (wanted == backRegistered) return
        backRegistered = wanted
        if (wanted) {
            onBackInvokedDispatcher.registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, callback)
        } else {
            onBackInvokedDispatcher.unregisterOnBackInvokedCallback(callback)
        }
    }

    private fun createBack(): Any = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        object : OnBackAnimationCallback {
            override fun onBackStarted(backEvent: BackEvent) {
                nav.startBack(backEvent.swipeEdge == BackEvent.EDGE_LEFT, backEvent.touchY)
            }

            override fun onBackProgressed(backEvent: BackEvent) = nav.progressBack(backEvent.progress, backEvent.touchY)

            override fun onBackCancelled() = nav.cancelBack()

            override fun onBackInvoked() {
                nav.pop()
            }
        }
    } else {
        OnBackInvokedCallback { nav.pop() }
    }

    @SuppressLint("GestureBackNavigation")
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        @Suppress("DEPRECATION")
        if (!nav.pop()) super.onBackPressed()
    }

    private companion object {
        const val KEY_NAV = "nav"
        const val REQUEST_ROLE = 1
        const val DENIED_WITHOUT_ASKING = 400L
        const val FRAGMENT_ARG_KEY = ":settings:fragment_args_key"
        const val SHOW_FRAGMENT_ARGS = ":settings:show_fragment_args"
    }
}
