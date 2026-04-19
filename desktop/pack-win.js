#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const isLinux = process.platform === "linux";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.error) {
    console.error(`Failed to run ${command}:`, result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}

function commandExists(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${command}`], {
    stdio: "ignore",
  });
  return result.status === 0;
}

if (isLinux) {
  if (!commandExists("wine")) {
    console.error("Missing prerequisite: wine");
    console.error("Install with: sudo apt update && sudo apt install -y wine64 wine32:i386 xvfb");
    process.exit(1);
  }

  if (!commandExists("xvfb-run")) {
    console.error("Missing prerequisite: xvfb-run");
    console.error("Install with: sudo apt update && sudo apt install -y xvfb");
    process.exit(1);
  }

  const wineCheck = spawnSync("wine", ["--version"], {
    encoding: "utf8",
  });

  const wineOutput = `${wineCheck.stdout || ""}\n${wineCheck.stderr || ""}`;
  if (wineOutput.toLowerCase().includes("wine32 is missing")) {
    console.error("Wine is installed but wine32 is missing.");
    console.error("Run: sudo dpkg --add-architecture i386 && sudo apt update && sudo apt install -y wine32:i386");
    process.exit(1);
  }

  run("xvfb-run", ["-a", "electron-builder", "--win", "nsis"]);
} else {
  run("electron-builder", ["--win", "nsis"]);
}
