package vadiole.bugged.ui

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.annotation.SuppressLint
import android.annotation.TargetApi

class Colors(
    val primary: Int,
    val onPrimary: Int,
    val primaryContainer: Int,
    val onPrimaryContainer: Int,
    val secondaryContainer: Int,
    val onSecondaryContainer: Int,
    val surface: Int,
    val surfaceContainerLow: Int,
    val surfaceContainer: Int,
    val surfaceContainerHigh: Int,
    val surfaceContainerHighest: Int,
    val onSurface: Int,
    val onSurfaceVariant: Int,
    val outline: Int,
    val outlineVariant: Int,
    val errorContainer: Int,
    val onErrorContainer: Int,
) {
    val scrim = 0x52000000

    companion object {
        fun of(context: Context): Colors {
            val mask = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
            val dark = mask == Configuration.UI_MODE_NIGHT_YES
            return when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> roles(context, dark)
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> tones(context, dark)
                dark -> DARK
                else -> LIGHT
            }
        }

        @SuppressLint("UseRequiresApi")
        @TargetApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
        private fun roles(context: Context, dark: Boolean): Colors {
            fun c(light: Int, night: Int) = context.getColor(if (dark) night else light)
            return Colors(
                primary = c(android.R.color.system_primary_light, android.R.color.system_primary_dark),
                onPrimary = c(android.R.color.system_on_primary_light, android.R.color.system_on_primary_dark),
                primaryContainer = c(android.R.color.system_primary_container_light, android.R.color.system_primary_container_dark),
                onPrimaryContainer = c(android.R.color.system_on_primary_container_light, android.R.color.system_on_primary_container_dark),
                secondaryContainer = c(android.R.color.system_secondary_container_light, android.R.color.system_secondary_container_dark),
                onSecondaryContainer = c(android.R.color.system_on_secondary_container_light, android.R.color.system_on_secondary_container_dark),
                surface = c(android.R.color.system_surface_light, android.R.color.system_surface_dark),
                surfaceContainerLow = c(android.R.color.system_surface_container_low_light, android.R.color.system_surface_container_low_dark),
                surfaceContainer = c(android.R.color.system_surface_container_light, android.R.color.system_surface_container_dark),
                surfaceContainerHigh = c(android.R.color.system_surface_container_high_light, android.R.color.system_surface_container_high_dark),
                surfaceContainerHighest = c(android.R.color.system_surface_container_highest_light, android.R.color.system_surface_container_highest_dark),
                onSurface = c(android.R.color.system_on_surface_light, android.R.color.system_on_surface_dark),
                onSurfaceVariant = c(android.R.color.system_on_surface_variant_light, android.R.color.system_on_surface_variant_dark),
                outline = c(android.R.color.system_outline_light, android.R.color.system_outline_dark),
                outlineVariant = c(android.R.color.system_outline_variant_light, android.R.color.system_outline_variant_dark),
                errorContainer = c(android.R.color.system_error_container_light, android.R.color.system_error_container_dark),
                onErrorContainer = c(android.R.color.system_on_error_container_light, android.R.color.system_on_error_container_dark),
            )
        }

        @SuppressLint("UseRequiresApi")
        @TargetApi(Build.VERSION_CODES.S)
        private fun tones(context: Context, dark: Boolean): Colors {
            fun c(id: Int) = context.getColor(id)
            fun mix(from: Int, to: Int, fraction: Float) = mixColor(from, to, fraction)
            val n0 = c(android.R.color.system_neutral1_1000)
            val n10 = c(android.R.color.system_neutral1_900)
            val n20 = c(android.R.color.system_neutral1_800)
            val n30 = c(android.R.color.system_neutral1_700)
            val n90 = c(android.R.color.system_neutral1_100)
            val n95 = c(android.R.color.system_neutral1_50)
            val n99 = c(android.R.color.system_neutral1_10)
            return if (dark) {
                Colors(
                    primary = c(android.R.color.system_accent1_200),
                    onPrimary = c(android.R.color.system_accent1_800),
                    primaryContainer = c(android.R.color.system_accent1_700),
                    onPrimaryContainer = c(android.R.color.system_accent1_100),
                    secondaryContainer = c(android.R.color.system_accent2_700),
                    onSecondaryContainer = c(android.R.color.system_accent2_100),
                    surface = mix(n0, n10, 0.6f),
                    surfaceContainerLow = n10,
                    surfaceContainer = mix(n10, n20, 0.2f),
                    surfaceContainerHigh = mix(n10, n20, 0.7f),
                    surfaceContainerHighest = mix(n20, n30, 0.2f),
                    onSurface = n90,
                    onSurfaceVariant = c(android.R.color.system_neutral2_200),
                    outline = c(android.R.color.system_neutral2_400),
                    outlineVariant = c(android.R.color.system_neutral2_700),
                    errorContainer = DARK.errorContainer,
                    onErrorContainer = DARK.onErrorContainer,
                )
            } else {
                Colors(
                    primary = c(android.R.color.system_accent1_600),
                    onPrimary = c(android.R.color.system_accent1_0),
                    primaryContainer = c(android.R.color.system_accent1_100),
                    onPrimaryContainer = c(android.R.color.system_accent1_700),
                    secondaryContainer = c(android.R.color.system_accent2_100),
                    onSecondaryContainer = c(android.R.color.system_accent2_700),
                    surface = mix(n95, n99, 0.75f),
                    surfaceContainerLow = mix(n95, n99, 0.25f),
                    surfaceContainer = mix(n90, n95, 0.8f),
                    surfaceContainerHigh = mix(n90, n95, 0.4f),
                    surfaceContainerHighest = n90,
                    onSurface = n10,
                    onSurfaceVariant = c(android.R.color.system_neutral2_700),
                    outline = c(android.R.color.system_neutral2_500),
                    outlineVariant = c(android.R.color.system_neutral2_200),
                    errorContainer = LIGHT.errorContainer,
                    onErrorContainer = LIGHT.onErrorContainer,
                )
            }
        }

        private val LIGHT = Colors(
            primary = 0xFF66558E.toInt(),
            onPrimary = 0xFFFFFFFF.toInt(),
            primaryContainer = 0xFFEADDFF.toInt(),
            onPrimaryContainer = 0xFF4E3D75.toInt(),
            secondaryContainer = 0xFFE9DEF8.toInt(),
            onSecondaryContainer = 0xFF4A4358.toInt(),
            surface = 0xFFFEF7FF.toInt(),
            surfaceContainerLow = 0xFFF8F1FA.toInt(),
            surfaceContainer = 0xFFF2ECF4.toInt(),
            surfaceContainerHigh = 0xFFECE6EE.toInt(),
            surfaceContainerHighest = 0xFFE7E0E8.toInt(),
            onSurface = 0xFF1D1B20.toInt(),
            onSurfaceVariant = 0xFF49454E.toInt(),
            outline = 0xFF7A757F.toInt(),
            outlineVariant = 0xFFCBC4CF.toInt(),
            errorContainer = 0xFFFFDAD6.toInt(),
            onErrorContainer = 0xFF93000A.toInt(),
        )

        private val DARK = Colors(
            primary = 0xFFD1BCFD.toInt(),
            onPrimary = 0xFF37265D.toInt(),
            primaryContainer = 0xFF4E3D75.toInt(),
            onPrimaryContainer = 0xFFEADDFF.toInt(),
            secondaryContainer = 0xFF4A4358.toInt(),
            onSecondaryContainer = 0xFFE9DEF8.toInt(),
            surface = 0xFF141218.toInt(),
            surfaceContainerLow = 0xFF1D1B20.toInt(),
            surfaceContainer = 0xFF211F24.toInt(),
            surfaceContainerHigh = 0xFF2B292F.toInt(),
            surfaceContainerHighest = 0xFF36343A.toInt(),
            onSurface = 0xFFE7E0E8.toInt(),
            onSurfaceVariant = 0xFFCBC4CF.toInt(),
            outline = 0xFF948F99.toInt(),
            outlineVariant = 0xFF49454E.toInt(),
            errorContainer = 0xFF93000A.toInt(),
            onErrorContainer = 0xFFFFDAD6.toInt(),
        )
    }
}
