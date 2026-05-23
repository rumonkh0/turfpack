#!/usr/bin/env node
/**
 * Manual .deb builder using system dpkg-deb
 * Bypasses FPM's buggy ar tool
 */

import { execSync } from "child_process";
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  readFileSync,
  existsSync,
  chmodSync,
} from "fs";
import { join, resolve } from "path";

try {
  const pkg = JSON.parse(readFileSync("./package.json", "utf8"));
  const version = pkg.version;
  const releaseDir = resolve("./release");
  const debFile = join(releaseDir, `turfslot-desktop_${version}_amd64.deb`);
  const stagingDir = join(releaseDir, "linux-unpacked");

  // First, build the unpacked app using electron-builder
  console.log("📦 Preparing app with electron-builder...");
  execSync("electron-builder --linux --dir", { stdio: "inherit" });

  if (!existsSync(stagingDir)) {
    throw new Error(`Staging directory not found: ${stagingDir}`);
  }

  console.log(`📦 Building ${debFile} using system dpkg-deb...`);

  // Create temp root for .deb contents
  const debianDir = mkdtempSync("/tmp/turfslot-deb-");
  const controlDir = join(debianDir, "DEBIAN");

  mkdirSync(controlDir, { recursive: true });
  chmodSync(controlDir, 0o755);

  // Create control file
  const controlContent = `Package: turfslot-desktop
Version: ${version}
Architecture: amd64
Maintainer: TurfSlot Team <support@turf.rumon.top>
Homepage: https://turf.rumon.top
Description: TurfSlot desktop app with embedded Express API and SQLite
 A desktop application for managing TurfSlot bookings.
`;

  writeFileSync(join(controlDir, "control"), controlContent);

  const postinstContent = `#!/bin/sh
set -e

SANDBOX_BIN="/opt/TurfSlot/chrome-sandbox"

if [ -f "$SANDBOX_BIN" ]; then
  chown root:root "$SANDBOX_BIN"
  chmod 4755 "$SANDBOX_BIN"
fi

exit 0
`;

  const postinstPath = join(controlDir, "postinst");
  writeFileSync(postinstPath, postinstContent);
  chmodSync(postinstPath, 0o755);

  // Copy app files to opt/TurfSlot
  const appDir = join(debianDir, "opt", "TurfSlot");
  mkdirSync(appDir, { recursive: true });

  console.log("📂 Staging files...");
  execSync(`cp -r ${stagingDir}/* "${appDir}"/`, { stdio: "pipe" });

  // Copy icon
  const iconDir = join(
    debianDir,
    "usr",
    "share",
    "icons",
    "hicolor",
    "1024x1024",
    "apps",
  );
  mkdirSync(iconDir, { recursive: true });
  execSync(`cp desktop/assets/icon.png "${iconDir}/turfslot-desktop.png"`, {
    stdio: "pipe",
  });

  // Copy .desktop file
  const appsDir = join(debianDir, "usr", "share", "applications");
  mkdirSync(appsDir, { recursive: true });
  execSync(`cp desktop/assets/turfslot-desktop.desktop "${appsDir}/"`, {
    stdio: "pipe",
  });

  console.log("🔨 Building .deb package...");
  execSync(`dpkg-deb --build --root-owner-group "${debianDir}" "${debFile}"`, {
    stdio: "pipe",
  });

  console.log(`✅ Successfully built: ${debFile}`);

  const sizeOutput = execSync(`ls -lh "${debFile}" | awk '{print $5}'`, {
    encoding: "utf8",
  }).trim();
  console.log(`📊 Package size: ${sizeOutput}`);

  // Cleanup
  rmSync(debianDir, { recursive: true, force: true });
} catch (err) {
  console.error(`❌ Build failed: ${err.message}`);
  process.exit(1);
}
