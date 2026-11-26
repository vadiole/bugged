package vadiole.bugged.ui

import vadiole.bugged.Browsers
import vadiole.bugged.Setup

interface Host {
    val colors: Colors
    val setup: Setup
    val browsers: Browsers

    fun go(route: Route)

    fun start()

    fun back()

    fun openAccessibility()

    fun turnOffCopy()

    fun requestBrowser()

    fun openDefaultApps()
}
