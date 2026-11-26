Bugged: an open source Android app that removes trackers from links. It works offline, has no `INTERNET` permission and collects nothing.

Main features:
- Cleans a link in the clipboard right after it is copied, through an accessibility service.
- Cleans a link opened from another app: Bugged is the default browser and forwards the clean link to the browser picked in the app.
- Counts cleaned links on the device and shows the number on Home.

## Project

- UI: Views in Kotlin, single activity, no fragments; no XML layouts, no AppCompat, no Compose, no Material library. `ui/` holds our own Material 3 Expressive components: colors from the wallpaper on Android 12+ (`Colors`), the type scale (`Type`), spring tokens (`Motion`), shapes and ripples (`Shapes`), buttons, top bar, list rows (`Components`).
- Navigation: `Nav` keeps a back stack of `Route`s and builds each `Destination` from it; a `Screen` fills the window, a `Sheet` is a bottom sheet over the screen below. Both support predictive back, and the stack is saved and restored with the activity. Screens talk to the activity through `Host`.
- The approved design and copy live in the prototype `store/app-ui.html` (`python3 store/serve.py 8731`). Don't change copy or layout without the owner's approval.
- Modules: single `:app`. minSdk 29, targetSdk 37.
- Architecture: app-scoped singletons on `App`. `Cleaner` is pure Kotlin with no Android imports, so it runs in unit tests.
- Dependencies: none at runtime; junit for tests. Never add the `INTERNET` permission.
- Cleaning rules are data, not code: `app/src/main/assets/rules.txt` (tracking parameters per host) and `redirects.txt` (redirect wrappers). Both are generated from `tools/rules/build.py` and `redirects.base`; change them through the `update-rules` skill, never by hand. `app/src/test/resources/cases.txt` holds `dirty clean` pairs that `CleanerTest` checks.
- Clipboard: only the focused app may read the clipboard, so `ClipboardService` reads the copied text from the system clipboard preview's accessibility events and writes the clean link back, which needs no focus. Text the preview cuts off (500 characters) and copies with no preview fall back to a 1px focusable overlay that reads the clipboard. Polling is impossible, and a window on a private virtual display never gets focus.
- Tests cover the cleaner only.
- No comments or docs in code. Exception: critical info with a link to an issue or source.
- User-visible text in `strings.xml`.

## Commands

```
./gradlew assembleDebug lintDebug testDebugUnitTest 2>&1 | tee /tmp/gradle-build.log | tail -40
./gradlew installDebug && adb shell am start -n vadiole.bugged.debug/vadiole.bugged.MainActivity
./gradlew assembleAlpha 2>&1 | tee /tmp/gradle-alpha.log | tail -40
```

- The alpha build is the one to share or to test on a phone: release code with R8, installed as `vadiole.bugged.alpha`.

- After a task or fix, build, install and launch the app, then check `adb logcat` for crashes.
- The debug build logs every accessibility event the service receives and whether it acted on it: `adb logcat -s Bugged`.
- The debug build can copy text as if another app did: `adb shell "am broadcast -n vadiole.bugged.debug/vadiole.bugged.CopyReceiver --es text '<text>'"`.
- Each reinstall kills the accessibility service; turn it off and on again before testing the clipboard.

## Git

- `develop` is the integration branch; never commit to it directly. Branch from an up-to-date `develop`, one branch per scope, named after the request; agree on the name with the user first.
- Commit finished, verified work, scoped so the history reads like a changelog. Messages are one line, lowercase, high-level outcome, e.g. `add the settings screen`, `fix crash on rotation`.
- Stage explicit paths; never `git add .` or `git add -A`; don't commit unrelated changes.
- Push or open PRs only on explicit request, or with an explicit ok when it's the only step left.
- PR description: one-sentence outcome, plus risks or critical info.

## Meta

- Suggest reasonable updates to AGENTS.md as the project evolves.
