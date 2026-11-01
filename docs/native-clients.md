# Desktop and mobile clients

The Electron and Capacitor adapters mount the existing shared Vue client. They contain platform integration rather than copies of the screens. The dashboard overview is labeled **Genel bakış / Overview**.

The source is TypeScript (including a `.cts` preload); builds produce JavaScript. Native projects were generated with the installed Capacitor CLI. The shared dashboard now has persistent communication and media code. Native secure session storage, opt-in local notifications, media permissions, and packaging commands are present. This slice has not been compiled or run on devices; tests/builds/runtime verification belong to the user. These are not signed store releases. See [verification.md](verification.md).

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
| `apps/desktop/src/preload/index.cts` | Narrow platform/session bridge through `contextBridge` |
| `apps/desktop/src/renderer/main.ts` | Vue, Pinia, and hash-history bootstrap |
| `apps/desktop/scripts/start.ts` | Cross-platform runtime launch and signal forwarding |
| `apps/desktop/tsconfig.main.json` | Strict Node-target main/preload compilation |

The renderer has `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`. It does not import Electron. The preload exposes only the platform name and origin-bound session read/write/clear operations. Main-process IPC checks that the caller is the bundled main frame; there is no unrestricted IPC or filesystem API. New windows and navigation away from the bundled renderer are denied. Media/notification permissions are limited to the trusted bundled main frame. Screen capture requires a user gesture and explicit screen/window selection. F5 and Ctrl/Cmd+R reload the renderer. The renderer CSP allows the configured HTTP API, its Socket.IO WebSocket origin, and the configured media origin. Electron defaults to `http://127.0.0.1:3001`. Start the API stack before registering/logging in. Set `VITE_API_URL` to an HTTP(S) origin without a trailing slash when building for another server; the Vite adapter updates both the SDK configuration and CSP. The local API explicitly permits the `null` file origin via `API_ALLOWED_ORIGINS`; do not carry that allowance into an unrelated public web deployment.

The main/preload outputs are `apps/desktop/dist/main/index.js` and `apps/desktop/dist/preload/index.cjs`; the shared client is built into `apps/desktop/dist/renderer`. Run `pnpm desktop:package` to build and stage a distributable host-platform application folder under `apps/desktop/release/`. The packager includes compiled files and a minimal manifest, not workspace source/dependencies. Linux/Windows icon assets derive from the shared logo. OS signing/notarization, automatic updates, and installer formats are not configured. System notifications are opt-in in Settings.

## Capacitor browser preview

```sh
pnpm mobile:dev
```

Open http://localhost:5175. This uses the actual mobile entry point with the shared responsive UI. Browser device emulation is useful for layout checks, but does not test the native WebView, Android back button, keyboard insets, or native permissions.

`apps/mobile/capacitor.config.ts` uses `webDir: "dist"` and the provisional identifier `dev.cord.preview`. Assets are bundled locally; no remote `server.url` is configured. HTTP is allowed only in Android debug builds for local development; release traffic requires TLS. The mobile adapter uses safe-area padding, a content-resizing viewport directive, Android `adjustResize`, and connects Android's hardware back button to router history, exiting the app only when native history cannot go back. Native plugin imports remain in `apps/mobile`.

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

## API/media origins, secure storage, notifications

Desktop and mobile Vite adapters read the repository-root `.env`. `VITE_API_URL` explicitly overrides a platform default; otherwise desktop uses `VITE_DESKTOP_API_URL` and Android uses `VITE_ANDROID_API_URL`. The local example sets desktop to `http://127.0.0.1:3001` and Android emulator to `http://10.0.2.2:3001`. iOS requires `VITE_IOS_API_URL` or the explicit override. The mobile browser preview uses its same-origin Vite proxy, regardless of native API defaults.

Native builds require a reachable API origin at build time. For Android emulator host API access, for example:

```sh
VITE_API_URL=http://10.0.2.2:3001 pnpm mobile:android --target emulator-5554
VITE_API_URL=http://10.0.2.2:3001 pnpm mobile:apk
```

The debug APK is under `apps/mobile/android/app/build/outputs/apk/debug/`. Native release traffic uses HTTPS. Add the exact Capacitor WebView origin (`https://localhost` for default Android, `capacitor://localhost` for default iOS) to `API_ALLOWED_ORIGINS`; the local example includes them. Server/native origins are independent of browser cookie-write origins.

Media access is returned by the API's `LIVEKIT_URL`, not inferred from the device's localhost. The loopback media config is for same-host clients. For emulator/LAN media, publish media ports on the host interface, set a client-reachable signaling URL, and advertise a host IP the device can reach in LiveKit's RTC configuration. Never assume changing only the HTTP API URL fixes ICE/media routing. For domain-based self-hosting use HTTPS/WSS and the separate stack.

The mobile adapter uses `@aparajita/capacitor-secure-storage` only on native platforms, with iCloud synchronization disabled and keys scoped by API origin. Android uses KeyStore-backed AES-GCM; iOS uses Keychain. Web remains cookie-based and never calls the plugin's insecure web adapter. Logout/revoked-session cleanup removes the native saved token. Native plugin metadata is updated via Capacitor; this is not device verification.

Microphone/camera permissions are declared for Android and described in iOS Info.plist. Enable system notifications in Settings to request OS permission. Realtime events may schedule native local notifications through the official Capacitor plugin; closed-app Android delivery requires the optional FCM setup below. Android screen sharing uses the custom `CordScreenShare` MediaProjection plugin with native LiveKit 2.29.2, Kotlin 2.3.0, a system consent prompt, and the SDK foreground capture service. It publishes a separate screen-only participant without subscribing to audio/video; stopping capture or leaving the call releases it. This source has not been compiled/device-tested. iOS screen broadcasting needs a separate ReplayKit extension.

For desktop builds against another server, set `VITE_API_URL` and `VITE_MEDIA_URL` before building. These are public origins only; media API secrets/database URLs stay server-side. Native startup restores the session through `/dashboard`; the browser landing stays public.

## Packaging, branding, signing

`pnpm mobile:apk` uses the existing SDK/JDK 21 discovery, builds web assets, synchronizes plugins, and invokes `assembleDebug` without selecting/installing onto a device. Pass `--release` for `assembleRelease`; provide `CORD_ANDROID_KEYSTORE`, `CORD_ANDROID_STORE_PASSWORD`, `CORD_ANDROID_KEY_ALIAS`, and `CORD_ANDROID_KEY_PASSWORD` through a private environment. Missing signing variables cause the release task to fail instead of silently producing a purported signed release. Do not commit keys/passwords or change the system Java default.

`python3 scripts/generate-brand.py` regenerates Android/iOS launchers/splashes and desktop PNG/ICO assets from the approved shared logo using ImageMagick. The existing provisional app identifier remains `dev.cord.preview`; choose a final identity/signing plan before store distribution. iOS compilation/signing requires macOS/Xcode and operator provisioning. Desktop packaging is a local app folder, not a claim of notarized/signed installers.

Follow the full two-account, permission, media, file, session, responsive, and packaging checks in [verification.md](verification.md). No latest-slice native checks were executed.

## Recent verification

Historical result before the communication changes: on 2026-10-31, the project launcher discovered the installed SDK and JDK 21 without `ANDROID_HOME`/`JAVA_HOME` exports, built the APK with Gradle, and deployed it specifically to `emulator-5554` (Android API 37); the application process was confirmed running. This verifies the SDK discovery/deploy flow; it does not certify keyboard, file-picker, or visual layout behavior. The physically attached phone was not selected. Recheck the latest composer/keyboard changes on the emulator.

## Verification limits

Type checking and renderer/native-source compilation can run without an emulator or display. Platform generation and `cap sync` do not prove an APK/IPA can build or run. Electron `--version` verifies the runtime, not the interface. Only claim device, simulator, or desktop UI success after running and inspecting those targets.

Official references: [Electron first application](https://www.electronjs.org/docs/latest/tutorial/tutorial-first-app), [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [Capacitor setup](https://capacitorjs.com/docs/getting-started), [native environment requirements](https://capacitorjs.com/docs/getting-started/environment-setup), and [Capacitor App plugin](https://capacitorjs.com/docs/apis/app).

## Electron session restoration

Electron uses the native Bearer transport (`X-Cord-Client: native`) rather than relying on cross-site cookies from its `file://` renderer. Its renderer injects a small session-storage adapter into the shared client. A session token is held in the main process, so reloading the renderer does not discard it. When Electron safeStorage has real OS-backed encryption, the token and its API origin are encrypted into `session.enc` under Electron's userData directory (POSIX mode 0600). With OS encryption available, no plaintext token is written to disk. Browser storage is never used. Switching API origins does not restore a token from a different server.

Linux `basic_text` is not treated as secure encryption. When OS encryption is unavailable, login shows a native warning attached to the requesting window, in the selected Turkish/English language. The default/cancel option is **Saklama / Don't save**: the token remains only in main-process memory until Cord closes. **Onayla, şifresiz sakla / Confirm and save unencrypted** explicitly permits saving that session token and API origin to `session.json` in userData, with POSIX mode 0600. The warning explains that anyone able to read this file can use the account until expiry/logout; account passwords are never saved. Consent applies to that login, not future logins. The saved token restores on restart without repeating the prompt; a new login asks again if secure storage is still unavailable. No local encryption key is created. If OS encryption becomes available later, restoration migrates the plaintext session into `session.enc` and removes `session.json`. Encryption errors do not silently downgrade storage. Logout and server rejection remove both storage formats. Corrupt/unreadable encrypted data requires a new login. Logout clears local state and the vault and requests server-side revocation. Server rejection of an expired/revoked token clears the saved session.

`pnpm desktop:test` checks encrypted/plaintext restoration, consent, migration, cleanup, and the warning dialog with Electron mocked; `pnpm client:test` checks store restoration and credential transport. These tests do not verify the real GNOME keyring, Electron IPC runtime, or GUI. Manually test login, renderer reload, application restart, logout, revoked/expired sessions, and no-keyring behavior on actual desktop targets.

## Optional Android FCM setup

Local self-hosting works without Firebase. To enable closed-app Android notifications, create/configure a Firebase Android application matching the current app ID. Supply its private operator `apps/mobile/android/app/google-services.json` (Git-ignored), and build with `VITE_PUSH_ENABLED=true` plus the reachable `VITE_API_URL`. The existing conditional Gradle Google Services plugin applies only when that file exists. Do not enable push in a build missing that provider configuration.

Supply a separate Firebase service-account JSON to the API, outside the repository, using `GOOGLE_APPLICATION_CREDENTIALS` and `PUSH_ENABLED=true`, or merge `compose.push.yaml` with the chosen base stack and set `PUSH_CREDENTIALS_FILE`. The file must be readable by the API container's non-root user. These are server credentials, never Vite variables. Client registration tokens are tied to active account sessions, and opt-in is remembered per API origin. Without this configuration, only in-app/realtime/local notifications operate.

Kotlin 2.3.0 is paired with the existing AGP 8.13.0 and Gradle 8.14.3/JDK 21 setup for the custom screen adapter; see the [Kotlin compatibility table](https://kotlinlang.org/docs/gradle-configure-project.html). This is a selected configuration, not a successful native build result. Native file downloads use private app cache plus the system share/save sheet, rather than relying on unsupported WebView Blob-download navigation.
