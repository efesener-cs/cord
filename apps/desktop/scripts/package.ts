import { packager } from "@electron/packager";
import { mkdtemp, cp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const staging = await mkdtemp(join(tmpdir(), "cord-package-"));
try {
  await cp(join(root, "dist"), join(staging, "dist"), { recursive: true });
  const electron = require("electron/package.json") as { version: string };
  const manifest = require("../package.json") as { version: string };
  await writeFile(
    join(staging, "package.json"),
    JSON.stringify(
      {
        name: "cord",
        productName: "Cord",
        version: manifest.version,
        type: "module",
        main: "dist/main/index.js",
      },
      null,
      2,
    ),
  );
  const paths = await packager({
    dir: staging,
    name: "Cord",
    appBundleId: "dev.cord.desktop",
    appVersion: manifest.version,
    electronVersion: electron.version,
    ...(process.platform === "linux"
      ? { icon: join(root, "resources/cord.png") }
      : process.platform === "win32"
        ? { icon: join(root, "resources/cord.ico") }
        : {}),
    out: join(root, "release"),
    overwrite: true,
    asar: true,
    prune: false,
  });
  console.info(paths.join("\n"));
} finally {
  await rm(staging, { recursive: true, force: true });
}
