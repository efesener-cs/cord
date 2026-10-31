# Desktop and mobile clients

The Electron and Capacitor adapters mount the existing shared Vue client. They contain platform integration rather than copies of the screens. The dashboard overview is labeled **Genel bakış / Overview**.

The source is TypeScript (including a `.cts` preload); builds produce JavaScript. Native projects were generated with the installed Capacitor CLI. These are runnable development shells for the UI preview, not signed installers, an authenticated service, or complete native integrations.

## Shared setup

From the repository root, use the pinned Node 24.22.1 and pnpm 12.14.0:

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
pnpm desktop:build
pnpm mobile:build
```

`pnpm build` builds the web client. The separate desktop/mobile commands build their adapters. `pnpm typecheck` checks all Vue entry points, Capacitor configuration, the desktop launcher, and the Electron main/preload sources.

Web uses HTML5 history. Desktop and mobile use hash history, so the same `/`, `/register`, `/login`, and `/dashboard` screens work from bundled files without a server rewrite. Native URLs include `#/dashboard` rather than `/dashboard`.

## Electron

```sh
pnpm desktop:dev
```

This builds the main/preload code and renderer, then opens the application. A normal desktop session and the system libraries required by Electron are necessary. The Electron package downloads its official runtime on first use; that step needs network access. This first version uses bundled renderer files, not a live development server. After editing source, close the window and run the command again.

For separate build and startup:

```sh
pnpm desktop:build
pnpm --filter @cord/desktop start
pnpm --filter @cord/desktop start --version
```

The launcher removes an inherited `ELECTRON_RUN_AS_NODE` environment variable so the runtime starts as an application. Its `--version` option checks the Electron runtime without launching a window.

Files:

| Source | Responsibility |
| --- | --- |
| `apps/desktop/src/main/index.ts` | Window lifecycle, bundled renderer loading, navigation and permission policies |
| `apps/desktop/src/preload/index.cts` | A read-only platform-name bridge through `contextBridge` |
| `apps/desktop/src/renderer/main.ts` | Vue, Pinia, and hash-history bootstrap |
| `apps/desktop/scripts/start.ts` | Cross-platform runtime launch and signal forwarding |
| `apps/desktop/tsconfig.main.json` | Strict Node-target main/preload compilation |

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. It does not import Electron. There is no unrestricted IPC or filesystem API. New windows and navigation away from the bundled renderer are denied. Native permissions are denied because the current UI does not implement calls, notifications, or media capture. The renderer CSP allows bundled scripts/styles and blocks network connections; revise it deliberately when the backend is integrated.

The main/preload outputs are `apps/desktop/dist/main/index.js` and `apps/desktop/dist/preload/index.cjs`; the shared client is built into `apps/desktop/dist/renderer`. Installer packaging, application signing, auto-updates, tray integration, native notifications, and release icons are not configured.

## Capacitor browser preview

```sh
pnpm mobile:dev
```

Open http://localhost:5175. This uses the actual mobile entry point with the shared responsive UI. Browser device emulation is useful for layout checks, but does not test the native WebView, Android back button, keyboard insets, or native permissions.

`apps/mobile/capacitor.config.ts` uses `webDir: "dist"` and the provisional identifier `dev.cord.preview`. Assets are bundled locally; no remote `server.url` or cleartext server override is configured. The mobile adapter uses safe-area padding and connects Android's hardware back button to router history, exiting the app only when native history cannot go back. Native plugin imports remain in `apps/mobile`.

## Android emulator or device

The generated project is already in `apps/mobile/android`. Do not run the add command again for an existing platform.

Install Android Studio and its SDK components. The generated project targets/compiles SDK 36 and needs Java 21-compatible tooling; use Android Studio's supported JDK rather than assuming the shell's newest Java works with Gradle. Configure the SDK through Android Studio or an untracked `apps/mobile/android/local.properties` file. Start an emulator or connect a device with USB debugging enabled, then run:

```sh
pnpm mobile:android
```

This rebuilds the web assets, syncs the Android project/plugins, and runs Capacitor's native build/deploy flow. With multiple targets, the CLI lets you select one. To sync and inspect in the IDE instead:

```sh
pnpm mobile:sync
pnpm --filter @cord/mobile exec cap open android
```

Android Studio can run the project or build a debug APK. From a prepared command-line environment:

```sh
cd apps/mobile/android
./gradlew assembleDebug
```

On Windows use `gradlew.bat assembleDebug`. The debug APK is produced under `app/build/outputs/apk/debug/`. Native builds require SDK packages, Gradle dependencies, and their network downloads in addition to pnpm dependencies.

`pnpm mobile:add:android` exists only to recreate the platform in a fresh checkout where the generated Android directory is intentionally absent. Native sources belong in version control; copied web assets, local SDK paths, and build outputs do not.

## iOS simulator or device

The generated Swift/Xcode project is in `apps/mobile/ios`, with Swift Package Manager integration. Building/running it requires macOS, Xcode 26 or newer, and the Xcode command-line tools for the installed Capacitor 8 toolchain. On a prepared Mac:

```sh
pnpm install --frozen-lockfile
pnpm mobile:ios
```

For IDE testing:

```sh
pnpm mobile:sync
pnpm --filter @cord/mobile exec cap open ios
```

Choose a simulator in Xcode and run. A real device also needs an appropriate signing team/profile. `pnpm mobile:add:ios` is only for creating a platform that does not already exist. The generated SPM plugin paths follow the workspace installation; sync after installing dependencies and before opening/building on another machine.

## Manual checks

On each native target, try signup/login with arbitrary nonempty preview credentials and confirm that the name reaches the dashboard. Switch themes and languages, open a direct-message conversation, and send enough local messages to require scrolling. The message composer and application chrome should remain visible while messages scroll. Check narrow and short windows, keyboard focus, mobile safe areas/keyboard behavior, Android back navigation, and restart behavior. State is intentionally in memory and resets when the app restarts.

Native launcher icons and splash screens currently come from the generated Capacitor templates; `resources/` directories remain reserved for reviewed native branding. Backend authentication, real network messaging, push notifications, microphone/camera access, app links, secure credential storage, release signing, and store distribution are separate future work.

## Verification limits

Type checking and renderer/native-source compilation can run without an emulator or display. Platform generation and `cap sync` do not prove an APK/IPA can build or run. Electron `--version` verifies the runtime, not the interface. Only claim device, simulator, or desktop UI success after running and inspecting those targets.

Official references: [Electron first application](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Capacitor setup](https://capacitorjs.com/docs/getting-started), [native environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), and [Capacitor App plugin](https://capacitorjs.com/docs/apis/app).
