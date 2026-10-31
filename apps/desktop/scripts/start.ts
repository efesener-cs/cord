import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const executable = require("electron") as string;
const environment = { ...process.env };
// Some editor environments use Electron as Node; the application needs GUI mode.
delete environment.ELECTRON_RUN_AS_NODE;

const child = spawn(executable, [...process.argv.slice(2), "."], {
  env: environment,
  stdio: "inherit",
});
child.on("error", (error: Error) => {
  console.error("Unable to start Electron:", error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
