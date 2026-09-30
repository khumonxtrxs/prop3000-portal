// Starts the Firebase emulators (npm run emulators).
//
// Two Windows-specific problems this wrapper works around, both in the JVM the emulators run on:
//
// 1. The Firestore emulator dies with "Unable to establish loopback connection" when Java's temp
//    directory can't host a Unix-domain socket (a long path, or one with spaces or brackets, as
//    this repo has). Pointing the JVM at a short, plain temp directory fixes it.
// 2. The usual fix for (1) is JAVA_TOOL_OPTIONS, but then the JVM prints "Picked up
//    JAVA_TOOL_OPTIONS: ..." on startup, and the Storage emulator's rules runtime reads that line
//    as protocol output and fails with "Unexpected rules runtime error". So we set the temp
//    directory through TMP/TEMP, which the JVM reads silently, and strip the noisy variables.
//
// Everything here applies to the emulator processes only; your own environment is untouched.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const env = { ...process.env };

if (process.platform === "win32") {
  const shortTmp = "C:\\Users\\Public\\firebase-emulators-tmp";
  try {
    mkdirSync(shortTmp, { recursive: true });
    env["TMP"] = shortTmp;
    env["TEMP"] = shortTmp;
  } catch {
    // Fall back to the default temp directory; the emulator may still start.
    env["TMP"] = tmpdir();
    env["TEMP"] = tmpdir();
  }
  delete env["JAVA_TOOL_OPTIONS"];
  delete env["_JAVA_OPTIONS"];
}

// A demo- project id keeps everything local: the emulators never reach a real Firebase project.
const args = process.argv.slice(2);
const projectArgs = args.includes("--project") ? [] : ["--project", "demo-prop3000"];

// Run the CLI's own entry point with this Node binary: no shell, so no quoting surprises on a
// path with spaces, and no .cmd shim to resolve.
const firebaseCli = createRequire(import.meta.url).resolve("firebase-tools/lib/bin/firebase.js");

const child = spawn(process.execPath, [firebaseCli, "emulators:start", ...projectArgs, ...args], {
  env,
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 0));
