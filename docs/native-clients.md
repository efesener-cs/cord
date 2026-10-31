# Desktop and mobile clients

The Electron and Capacitor adapters mount the existing shared Vue client. They contain platform integration rather than copies of the screens. The dashboard overview is labeled **Genel bakış / Overview**.

The source is TypeScript (including a `.cts` preload); builds produce JavaScript. Native projects were generated with the installed Capacitor CLI. These are runnable development shells for the UI preview, not signed installers or complete native integrations. Account forms now use the real API, while messaging remains local demo content.

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

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. It does not import Electron. There is no unrestricted IPC or filesystem API. New windows and navigation away from the bundled renderer are denied. Native permissions are denied because the current UI does not implement calls, notifications, or media capture. The renderer CSP allows bundled scripts/styles and exactly the configured API origin. Electron defaults to `http://127.0.0.1:3001`. Start the API stack before registering/logging in. Set `VITE_API_URL` to an HTTP(S) origin without a trailing slash when building for another server; the Vite adapter updates both the SDK configuration and CSP. The local API explicitly permits the `null` file origin via `API_ALLOWED_ORIGINS`; do not carry that allowance into an unrelated public web deployment.

The main/preload outputs are `apps/desktop/dist/main/index.js` and `apps/desktop/dist/preload/index.cjs`; the shared client is built into `apps/desktop/dist/renderer`. Installer packaging, application signing, auto-updates, tray integration, native notifications, and release icons are not configured.

## Capacitor browser preview

```sh
pnpm mobile:dev
```

Open http://localhost:5175. This uses the actual mobile entry point with the shared responsive UI. Browser device emulation is useful for layout checks, but does not test the native WebView, Android back button, keyboard insets, or native permissions.

`apps/mobile/capacitor.config.ts` uses `webDir: "dist"` and the provisional identifier `dev.cord.preview`. Assets are bundled locally; no remote `server.url` or cleartext server override is configured. The mobile adapter uses safe-area padding, a content-resizing viewport directive, Android `adjustResize`, and connects Android's hardware back button to router history, exiting the app only when native history cannot go back. Native plugin imports remain in `apps/mobile`.

## Android emulator or device

The generated project is already in `apps/mobile/android`. Do not run the add command again for an existing platform.

Install Android Studio and its SDK components. The generated project targets/compiles SDK 36 and needs Java 21-compatible tooling; use Android Studio's supported JDK rather than assuming the shell's newest Java works with Gradle. Gradle 8.14.3 does not support running on Java 25 or 27. Java 25 requires Gradle 9.1 or later; upgrading Gradle alone is not an Android plugin compatibility plan. Keep this project on JDK 21 and install it alongside the system JDK. On Arch:

```sh
sudo pacman -S --needed jdk21-openjdk
```

For a project-scoped command without changing the global Java default:

```sh
JAVA_HOME=/usr/lib/jvm/java-21-openjdk pnpm mobile:android
```

For the VS Code Java/Gradle importer, set `java.import.gradle.java.home` to `/usr/lib/jvm/java-21-openjdk` in your local editor settings, then reload/reimport the Gradle project. Android Studio has its own Gradle JDK setting; select the installed JDK 21 there as well. `java -version` in a terminal can differ from the IDE's selected JVM. Machine-specific paths do not belong in the shared Gradle configuration.

Validate the selected JVM before an APK build:

```sh
cd apps/mobile/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk ./gradlew --version
```

The installed Capacitor Android sources target Java 21. Installing the newest Arch Java package does not make an older Gradle wrapper compatible with it. See the [Gradle Java compatibility matrix](https://docs.gradle.org/current/userguide/compatibility.html) and [Arch JDK 21 package](https://archlinux.org/packages/extra/x86_64/jdk21-openjdk/).

### SDK discovery and `ERR_SDK_NOT_FOUND`

`adb` being installed does not mean a complete Android SDK is available. On Arch, an `android-sdk-platform-tools` package can provide `/opt/android-sdk/platform-tools` without platforms, build tools, command-line tools, or an emulator. Pointing `ANDROID_HOME` at that partial installation resolves discovery only; it does not install missing components.

In Android Studio's SDK Manager, choose a writable SDK location (for example `$HOME/Android/Sdk`) and install Android SDK Platform 36, Android SDK Build-Tools 36.0.0, Android SDK Platform-Tools, and Android SDK Command-line Tools. For emulator testing, also install Android Emulator, a compatible system image, and create/start a virtual device. A physical device does not require an emulator image.

The project Android launcher now discovers a complete SDK from an explicit environment variable, local `sdk.dir`, or standard Android Studio locations (including `$HOME/Android/Sdk`), and discovers the installed Arch JDK 21 when `JAVA_HOME` is absent. It passes the selected paths to child processes without changing the global shell or Java default. Check the detected paths before building:

```sh
pnpm mobile:android:check
pnpm mobile:android
```

An explicit incomplete SDK or incompatible `JAVA_HOME` produces an early actionable error. The launcher builds the web bundle and invokes `cap run android`, which already performs sync; assets are no longer copied twice. Pass a target when multiple devices are attached:

```sh
pnpm mobile:android --target emulator-5554
```

For a manual override of SDK discovery, run from the repository root:

```sh
export ANDROID_HOME="$HOME/Android/Sdk"
JAVA_HOME=/usr/lib/jvm/java-21-openjdk pnpm mobile:android
```

Use your SDK Manager's actual SDK location if it differs. `ANDROID_HOME` is the preferred current variable; `ANDROID_SDK_ROOT` is deprecated and, if already set, must not point to a different directory. If you bypass the project launcher, set `ANDROID_HOME` in your own shell configuration for persistence; an export in one terminal is not inherited by terminals already open elsewhere.

For direct Gradle builds, configure Android Studio or put `sdk.dir=/absolute/path/to/Android/Sdk` in the untracked `apps/mobile/android/local.properties`. That file supplies Gradle's location. Raw Capacitor/native-run does not read it for SDK discovery, but this project's Android launcher now reads it and passes the selected SDK through `ANDROID_HOME` to its child processes. Direct `cap run` still needs the correct environment or a natively discoverable SDK. Do not commit a machine-specific SDK path.

Official references: [Android environment variables](https://developer.android.com/tools/variables), [SDK Manager](https://developer.android.com/tools/sdkmanager), and [native-run Android errors](https://github.com/ionic-team/native-run/wiki/Android-Errors).

Start an emulator or connect a device with USB debugging enabled, then run with the environment configured as above:

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

On the desktop, start the API stack, register an account using a 3–32 character ASCII username and a password of at least 12 characters, then log in and confirm the server-returned name reaches the dashboard. Incorrect credentials must fail. For Capacitor native builds, first configure a reachable `VITE_API_URL`, exact API CORS origin, and platform TLS/network settings; localhost in an emulator is not the host machine. Native auth integration has not been verified. The mobile browser preview at port 5175 uses its Vite API proxy. Switch themes and languages, open a direct-message conversation, and send enough local messages to require scrolling. The message composer and application chrome should remain visible while messages scroll. Check narrow and short windows, keyboard focus, mobile safe areas/keyboard behavior, Android back navigation, and restart behavior. State is intentionally in memory and resets when the app restarts.

Native launcher icons and splash screens currently come from the generated Capacitor templates; `resources/` directories remain reserved for reviewed native branding. Real network messaging, push notifications, microphone/camera access, app links, secure credential storage, release signing, and store distribution are separate future work.

## Recent verification

On 2026-10-31, the project launcher discovered the installed SDK and JDK 21 without `ANDROID_HOME`/`JAVA_HOME` exports, built the APK with Gradle, and deployed it specifically to `emulator-5554` (Android API 37); the application process was confirmed running. This verifies the SDK discovery/deploy flow; it does not certify keyboard, file-picker, or visual layout behavior. The physically attached phone was not selected. Recheck the latest composer/keyboard changes on the emulator.

## Verification limits

Type checking and renderer/native-source compilation can run without an emulator or display. Platform generation and `cap sync` do not prove an APK/IPA can build or run. Electron `--version` verifies the runtime, not the interface. Only claim device, simulator, or desktop UI success after running and inspecting those targets.

Official references: [Electron first application](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Capacitor setup](https://capacitorjs.com/docs/getting-started), [native environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), and [Capacitor App plugin](https://capacitorjs.com/docs/apis/app).
