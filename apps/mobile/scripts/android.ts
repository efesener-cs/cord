import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const executableSuffix = process.platform === "win32" ? ".exe" : "";
function directoryHasFiles(path: string): boolean {
  try {
    return readdirSync(path).length > 0;
  } catch {
    return false;
  }
}
function completeSdk(root: string): boolean {
  return (
    existsSync(join(root, "platform-tools", `adb${executableSuffix}`)) &&
    existsSync(join(root, "platforms", "android-36", "android.jar")) &&
    directoryHasFiles(join(root, "build-tools"))
  );
}
function sdkFromProperties(): string | undefined {
  try {
    const text = readFileSync(join(appRoot, "android/local.properties"), "utf8");
    const value = text.match(/^\s*sdk\.dir\s*=\s*(.+?)\s*$/m)?.[1];
    return value?.replace(/\\([\\: ])/g, "$1");
  } catch {
    return undefined;
  }
}
function resolveSdk(): string {
  const explicit = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (explicit) {
    if (!completeSdk(explicit))
      throw new Error(
        `The configured SDK at ${explicit} is incomplete. Install Platform 36, Build-Tools and Platform-Tools, or correct ANDROID_HOME.`,
      );
    return resolve(explicit);
  }
  const candidates = [
    sdkFromProperties(),
    join(homedir(), "Android/Sdk"),
    join(homedir(), "Library/Android/sdk"),
    process.env.LOCALAPPDATA ? join(process.env.LOCALAPPDATA, "Android/Sdk") : undefined,
    "/opt/android-sdk",
  ];
  const sdk = candidates.find(
    (candidate): candidate is string => !!candidate && completeSdk(candidate),
  );
  if (!sdk)
    throw new Error(
      "No complete Android SDK found. Set ANDROID_HOME to the SDK Manager location and install Platform 36, Build-Tools and Platform-Tools. See docs/native-clients.md.",
    );
  return resolve(sdk);
}
function javaVersion(home: string): number | undefined {
  try {
    return Number(readFileSync(join(home, "release"), "utf8").match(/JAVA_VERSION="(\d+)/)?.[1]);
  } catch {
    return undefined;
  }
}
function resolveJava(): string {
  const explicit = process.env.JAVA_HOME;
  if (explicit) {
    if (javaVersion(explicit) !== 21)
      throw new Error(
        "This Android wrapper expects JDK 21. Correct JAVA_HOME; Gradle 8.14.3 does not support Java 25/27.",
      );
    return explicit;
  }
  const java = [
    "/usr/lib/jvm/java-21-openjdk",
    "/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home",
    "/Library/Java/JavaVirtualMachines/zulu-21.jdk/Contents/Home",
  ].find((home) => javaVersion(home) === 21);
  if (!java)
    throw new Error(
      "JDK 21 was not found. Set JAVA_HOME to an installed JDK 21; the system Java is left unchanged.",
    );
  return java;
}
async function run(args: string[], environment: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolveRun, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: appRoot,
      env: environment,
      stdio: "inherit",
    });
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    child.once("error", reject);
    child.once("exit", (code) => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
      if (code === 0) resolveRun();
      else reject(new Error(`Android command exited with code ${code ?? "signal"}.`));
    });
  });
}
try {
  const sdk = resolveSdk();
  const java = resolveJava();
  console.info(`Android SDK: ${sdk}\nGradle JDK: ${java}`);
  if (!process.argv.includes("--check")) {
    const environment = {
      ...process.env,
      ANDROID_HOME: sdk,
      ANDROID_SDK_ROOT: sdk,
      JAVA_HOME: java,
      PATH: [
        join(java, "bin"),
        join(sdk, "platform-tools"),
        join(sdk, "emulator"),
        process.env.PATH ?? "",
      ].join(delimiter),
    };
    await run([fileURLToPath(import.meta.resolve("vite-plus/bin")), "build"], environment);
    // cap run already synchronizes the native project; do not copy assets twice.
    await run(
      [
        join(dirname(require.resolve("@capacitor/cli/package.json")), "bin/capacitor"),
        "run",
        "android",
        ...process.argv.slice(2),
      ],
      environment,
    );
  }
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : "Unable to prepare Android.");
  process.exitCode = 1;
}
