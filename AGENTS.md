Bugged: an open source Android app that removes trackers from links. It works offline and collects nothing.

Main features:
- Cleans a link in the clipboard right after it is copied, through an accessibility service.
- Cleans a link opened from another app: Bugged is the default browser and forwards the clean link to the browser picked in the app.
- Counts cleaned links on the device and shows the number on Home.

## Project

- UI: Views in Kotlin, single activity, no fragments; no XML layouts, no AppCompat, no Compose, no Material library. `ui/` holds our own Material 3 Expressive components, with colors from the wallpaper on Android 12+.
- Navigation: `Nav` keeps a back stack of `Route`s and builds each `Destination` from it; a `Screen` fills the window, a `Sheet` is a bottom sheet over the screen below. Both support predictive back, and the stack is saved and restored with the activity. Screens talk to the activity through `Host`.
- Architecture: app-scoped singletons on `App`.
- Dependencies: none at runtime; junit for tests. The app has no `INTERNET` permission and never gets one: working offline is the product's promise.
- Cleaning rules are data, not code: `app/src/main/assets/rules.txt` (tracking parameters per host) and `redirects.txt` (redirect wrappers). Both are generated; change them through the `update-rules` skill, never by hand.
- Clipboard: only the focused app may read the clipboard, so `ClipboardService` reads the copied text from the system clipboard preview's accessibility events and writes the clean link back, which needs no focus. Text the preview cuts off (500 characters) and copies with no readable preview fall back to a 1px focusable overlay that reads the clipboard; that read makes Android show its "pasted from your clipboard" toast, so it stays the last resort. Every clipboard write restarts the system preview, so on a tap on "Copy" over a selected link the service writes the clean link from the selection before the preview appears. Polling is impossible, and a window on a private virtual display never gets focus.
- Tests cover the cleaner only: `Cleaner` is pure Kotlin with no Android imports, and `CleanerTest` checks the `dirty clean` pairs in `app/src/test/resources/cases.txt`.
- No comments or docs in code. Exception: critical info with a link to an issue or source.
- User-visible text in `strings.xml`.

## APK size

A non-inline Kotlin stdlib call keeps stdlib classes in the dex. Inline stdlib functions (`map`, `filter`, `any`, `let`, `apply`) cost nothing; for everything else, write the platform or `java.util` equivalent:

- Lazy init: a nullable backing field with a getter instead of `by lazy` (`Type.brand`), with `@Volatile` and `synchronized` when it is read off the main thread (`App.cleaner`).
- Regex: `java.util.regex.Pattern` and `Matcher` instead of `kotlin.text.Regex` (`Cleaner.replaceLinks`).
- Splitting: `splitBy(Char)` from `String.kt` instead of `String.split`.
- Collections: `Collections.emptyList()`, `ArrayList`, `HashSet`, `LinkedHashSet`, the `*To(destination)` variants (`mapTo`, `filterTo`, `filterNotTo`) and in-place `sortBy` instead of `emptyList`, `buildList`, `toSet`, `distinct`, `sortedBy` and `list + list`.
- Ranges and enums: `lastIndex downTo 0` instead of `indices.reversed()`, `Route.values()` instead of `Route.entries`.
- IO and threads: `InputStreamReader` with `try`/`finally` instead of `bufferedReader().use`, `Thread { }.start()` instead of `thread { }`.

A change that adds a stdlib call the list doesn't name is done when the alpha APK is no larger than before it.

## Commands

```
./gradlew assembleDebug lintDebug testDebugUnitTest 2>&1 | tee /tmp/gradle-build.log | tail -40
./gradlew installDebug && adb shell am start -n vadiole.bugged.debug/vadiole.bugged.MainActivity
./gradlew assembleAlpha 2>&1 | tee /tmp/gradle-alpha.log | tail -40
```

- The alpha build is the one to share or to test on a phone: release code with R8, installed as `vadiole.bugged.alpha`.
- After a code change, build, install and launch the app; done when it opens and `adb logcat` shows no `FATAL EXCEPTION`.
- The debug build logs every accessibility event the service receives and whether it acted on it: `adb logcat -s Bugged`.
- The debug build can copy text as if another app did: `adb shell "am broadcast -n vadiole.bugged.debug/vadiole.bugged.CopyReceiver --es text '<text>'"`.
- Each reinstall kills the accessibility service; turn it off and on again before testing the clipboard.
- `uiautomator dump` suspends accessibility services while it runs; check clipboard results in the `Bugged` log, not with a dump.

## Git

- `master` is the released code. `develop` is the integration branch; never commit to it directly. Branch from an up-to-date `develop`, one branch per scope, named after the request; agree on the name with the user first.
- Scope commits so the history reads like a changelog. Messages are one line, lowercase, high-level outcome, e.g. `add the settings screen`, `fix crash on rotation`.
- Stage explicit paths; never `git add .` or `git add -A`.
- Push or open PRs only on explicit request, or with an explicit ok when it's the only step left.
- PR description: one-sentence outcome, plus risks or critical info.
