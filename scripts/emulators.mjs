import { spawn } from "node:child_process";

const child = spawn(
    "npx",
    [
        "firebase",
        "emulators:start",
        "--only",
        "auth,firestore,storage",
        "--project",
        "demo-prop3000",
    ],
    {
        stdio: "inherit",
        shell: true,
    },
);

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
